/* Supabase 저장소 계층. 화면(app.js)은 이 객체만 사용하고 supabase-js를 직접 호출하지 않는다. */
(function (global) {
  'use strict';

  const TABLE = 'todos';
  const COLUMNS = 'id, text, completed, priority, position';

  const ERROR_MESSAGES = {
    invalid_credentials: '이메일 또는 비밀번호가 올바르지 않습니다.',
    email_not_confirmed: '이메일 인증이 아직 끝나지 않았습니다. 받은 메일의 링크를 눌러 주세요.',
    user_already_exists: '이미 가입된 이메일입니다. 로그인해 주세요.',
    email_exists: '이미 가입된 이메일입니다. 로그인해 주세요.',
    weak_password: '비밀번호가 너무 약합니다. 8자 이상으로 더 복잡하게 입력해 주세요.',
    same_password: '이전과 다른 비밀번호를 입력해 주세요.',
    signup_disabled: '현재 새 회원가입을 받지 않습니다.',
    email_address_invalid: '사용할 수 없는 이메일 주소입니다.',
    validation_failed: '입력한 값을 다시 확인해 주세요.',
    over_email_send_rate_limit: '메일을 너무 자주 요청했습니다. 잠시 후 다시 시도해 주세요.',
    over_request_rate_limit: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
    session_not_found: '로그인이 만료되었습니다. 다시 로그인해 주세요.',
    session_expired: '로그인이 만료되었습니다. 다시 로그인해 주세요.',
    provider_disabled: 'Google 로그인이 아직 켜져 있지 않습니다. 관리자에게 문의해 주세요.',
  };

  const MESSAGE_PATTERNS = [
    [/invalid login credentials/i, 'invalid_credentials'],
    [/email not confirmed/i, 'email_not_confirmed'],
    [/already registered/i, 'user_already_exists'],
    [/password should be at least/i, 'weak_password'],
    [/rate limit/i, 'over_request_rate_limit'],
    [/provider is not enabled|unsupported provider/i, 'provider_disabled'],
  ];

  const OAUTH_FALLBACK = 'Google 로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.';

  /**
   * OAuth 로그인에서 돌아온 주소(?error=... 또는 #error=...)에서 오류를 찾아 한국어 문장으로 바꾼다.
   * 오류가 없으면 null.
   */
  function oauthErrorFromUrl(href) {
    let url;
    try {
      url = new URL(href);
    } catch (error) {
      return null;
    }
    const params = new URLSearchParams(url.search);
    new URLSearchParams(url.hash.replace(/^#/, '')).forEach((value, key) => {
      if (!params.has(key)) params.set(key, value);
    });
    const error = params.get('error');
    const code = params.get('error_code');
    const description = params.get('error_description') || '';
    if (!error && !code) return null;
    if (error === 'access_denied' && !code) return '로그인을 취소했습니다.';
    if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
    const match = MESSAGE_PATTERNS.find(([pattern]) => pattern.test(description));
    if (match) return ERROR_MESSAGES[match[1]];
    if (error === 'access_denied') return '로그인을 취소했습니다.';
    return OAUTH_FALLBACK;
  }

  /** 주소에서 OAuth 오류 관련 값만 지운 주소를 돌려준다. */
  function stripOAuthError(href) {
    const url = new URL(href);
    const keys = ['error', 'error_code', 'error_description'];
    keys.forEach((key) => url.searchParams.delete(key));
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
    keys.forEach((key) => hash.delete(key));
    url.hash = hash.toString();
    return url.toString().replace(/#$/, '');
  }

  /** Supabase 오류를 사용자에게 보여 줄 한국어 문장으로 바꾼다. */
  function toKoreanMessage(error, fallback = '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.') {
    if (!error) return fallback;
    const message = String(error.message || '');
    const match = MESSAGE_PATTERNS.find(([pattern]) => pattern.test(message));
    // validation_failed는 범위가 넓어서, 메시지로 더 구체적인 원인을 알 수 있으면 그것을 쓴다.
    if (error.code === 'validation_failed' && match) return ERROR_MESSAGES[match[1]];
    if (error.code && ERROR_MESSAGES[error.code]) return ERROR_MESSAGES[error.code];
    if (match) return ERROR_MESSAGES[match[1]];
    if (/fetch|network/i.test(message)) return '서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.';
    return fallback;
  }

  class StoreError extends Error {
    constructor(error) {
      super(toKoreanMessage(error));
      this.name = 'StoreError';
      this.cause = error;
    }
  }

  async function unwrap(promise) {
    const { data, error } = await promise;
    if (error) throw new StoreError(error);
    return data;
  }

  function toTodo(row) {
    return { id: row.id, text: row.text, completed: row.completed, priority: row.priority };
  }

  function createStore(client) {
    return {
      /* ---------- 인증 ---------- */
      onAuthChange(callback) {
        const { data } = client.auth.onAuthStateChange((event, session) => {
          // supabase-js 콜백 안에서 다른 Supabase 호출을 기다리면 멈출 수 있어 다음 틱으로 미룬다.
          setTimeout(() => callback(event, session), 0);
        });
        return () => data.subscription.unsubscribe();
      },

      async signIn(email, password) {
        return unwrap(client.auth.signInWithPassword({ email, password }));
      },

      /** 가입 후 바로 로그인되면 session이 있고, 이메일 인증이 필요하면 session이 null이다. */
      async signUp(email, password, redirectTo) {
        return unwrap(client.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } }));
      },

      /** Google 로그인 화면으로 이동한다. 돌아오면 onAuthChange가 SIGNED_IN을 받는다. */
      async signInWithGoogle(redirectTo) {
        return unwrap(
          client.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo, queryParams: { prompt: 'select_account' } },
          })
        );
      },

      async signOut() {
        return unwrap(client.auth.signOut());
      },

      async sendPasswordReset(email, redirectTo) {
        return unwrap(client.auth.resetPasswordForEmail(email, { redirectTo }));
      },

      async updatePassword(password) {
        return unwrap(client.auth.updateUser({ password }));
      },

      /* ---------- 할 일 ---------- */
      async list() {
        const rows = await unwrap(
          client.from(TABLE).select(COLUMNS).order('position', { ascending: true }).order('created_at', { ascending: true })
        );
        return rows.map(toTodo);
      },

      async add(text, priority) {
        const row = await unwrap(client.from(TABLE).insert({ text, priority }).select(COLUMNS).single());
        return toTodo(row);
      },

      /** 여러 개를 순서대로 넣는다. 위치는 DB 트리거가 각 우선순위의 맨 끝으로 정한다. */
      async addMany(todos) {
        if (todos.length === 0) return [];
        const rows = await unwrap(
          client
            .from(TABLE)
            .insert(todos.map(({ text, completed, priority }) => ({ text, completed, priority })))
            .select(COLUMNS)
        );
        return rows.map(toTodo);
      },

      async setCompleted(id, completed) {
        await unwrap(client.from(TABLE).update({ completed }).eq('id', id));
      },

      async setText(id, text) {
        await unwrap(client.from(TABLE).update({ text }).eq('id', id));
      },

      async remove(id) {
        await unwrap(client.from(TABLE).delete().eq('id', id));
      },

      async removeCompleted() {
        await unwrap(client.from(TABLE).delete().eq('completed', true));
      },

      /** id 항목을 priority 등급의 beforeId 앞으로 옮긴다. beforeId가 null이면 맨 끝. */
      async move(id, priority, beforeId = null) {
        await unwrap(client.rpc('move_todo', { p_id: id, p_priority: priority, p_before_id: beforeId }));
      },
    };
  }

  const TodoStore = { createStore, toKoreanMessage, oauthErrorFromUrl, stripOAuthError, StoreError };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TodoStore;
  } else {
    global.TodoStore = TodoStore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
