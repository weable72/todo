const { createStore, toKoreanMessage, oauthErrorFromUrl, stripOAuthError, StoreError } = require('../store.js');
const { createFakeSupabase } = require('./fakeSupabase.js');

const ME = 'me@example.com';
const OTHER = 'other@example.com';

function setup(options = {}) {
  const fake = createFakeSupabase({
    users: [
      { email: ME, password: 'password123' },
      { email: OTHER, password: 'password456' },
    ],
    signedInAs: ME,
    ...options,
  });
  return { fake, store: createStore(fake) };
}

describe('toKoreanMessage', () => {
  test.each([
    [{ code: 'invalid_credentials' }, '이메일 또는 비밀번호가 올바르지 않습니다.'],
    [{ code: 'email_not_confirmed' }, '이메일 인증이 아직 끝나지 않았습니다. 받은 메일의 링크를 눌러 주세요.'],
    [{ code: 'user_already_exists' }, '이미 가입된 이메일입니다. 로그인해 주세요.'],
    [{ code: 'over_email_send_rate_limit' }, '메일을 너무 자주 요청했습니다. 잠시 후 다시 시도해 주세요.'],
    [{ message: 'Invalid login credentials' }, '이메일 또는 비밀번호가 올바르지 않습니다.'],
    [{ message: 'TypeError: Failed to fetch' }, '서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.'],
  ])('%j', (error, expected) => {
    expect(toKoreanMessage(error)).toBe(expected);
  });

  test('validation_failed는 메시지로 원인을 알 수 있으면 그 문장을, 아니면 일반 문장을 쓴다', () => {
    expect(toKoreanMessage({ code: 'validation_failed', message: 'Password should be at least 8 characters' })).toBe(
      '비밀번호가 너무 약합니다. 8자 이상으로 더 복잡하게 입력해 주세요.'
    );
    expect(toKoreanMessage({ code: 'validation_failed', message: 'something else' })).toBe('입력한 값을 다시 확인해 주세요.');
  });

  test('알 수 없는 오류는 기본 문장을 쓴다', () => {
    expect(toKoreanMessage({ message: 'boom' })).toBe('요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    expect(toKoreanMessage(null, '기본')).toBe('기본');
  });
});

describe('할 일 저장소', () => {
  test('list는 내 할 일만 position 순서로 앱 형식에 맞춰 돌려준다', async () => {
    const { store } = setup({
      rows: [
        { id: 'b', text: 'B', priority: 'high', position: 2048, owner: ME },
        { id: 'a', text: 'A', priority: 'high', position: 1024, owner: ME, completed: true },
        { id: 'x', text: '남의 것', priority: 'high', position: 10, owner: OTHER },
      ],
    });
    expect(await store.list()).toEqual([
      { id: 'a', text: 'A', completed: true, priority: 'high' },
      { id: 'b', text: 'B', completed: false, priority: 'high' },
    ]);
  });

  test('add는 서버가 만든 id로 새 할 일을 돌려주고 우선순위의 맨 끝에 놓는다', async () => {
    const { fake, store } = setup({ rows: [{ id: 'a', text: 'A', priority: 'low', owner: ME }] });
    const created = await store.add('새 일', 'low');
    expect(created).toEqual({ id: expect.any(String), text: '새 일', completed: false, priority: 'low' });
    expect(fake.order('low')).toEqual(['a', created.id]);
    expect(fake.byId(created.id).user_id).toBe(fake.session.user.id);
  });

  test('addMany는 순서대로 넣는다', async () => {
    const { fake, store } = setup();
    const created = await store.addMany([
      { id: 'local-1', text: '하나', completed: true, priority: 'high' },
      { id: 'local-2', text: '둘', completed: false, priority: 'high' },
    ]);
    expect(created.map((t) => t.text)).toEqual(['하나', '둘']);
    expect(created[0].completed).toBe(true);
    expect(fake.order('high').map((id) => fake.byId(id).text)).toEqual(['하나', '둘']);
    expect(await store.addMany([])).toEqual([]);
  });

  test('setCompleted, setText, remove는 id로 한 행만 바꾼다', async () => {
    const { fake, store } = setup({
      rows: [
        { id: 'a', text: 'A', owner: ME },
        { id: 'b', text: 'B', owner: ME },
      ],
    });
    await store.setCompleted('a', true);
    await store.setText('b', '비');
    expect(fake.byId('a').completed).toBe(true);
    expect(fake.byId('b').text).toBe('비');
    await store.remove('a');
    expect(fake.byId('a')).toBeUndefined();
    expect(fake.calls.filter((c) => c.op === 'update').map((c) => c.filters)).toEqual([[['id', 'a']], [['id', 'b']]]);
  });

  test('removeCompleted는 내 완료 항목만 지운다', async () => {
    const { fake, store } = setup({
      rows: [
        { id: 'a', text: 'A', completed: true, owner: ME },
        { id: 'b', text: 'B', owner: ME },
        { id: 'x', text: 'X', completed: true, owner: OTHER },
      ],
    });
    await store.removeCompleted();
    expect(fake.db.todos.map((t) => t.id).sort()).toEqual(['b', 'x']);
  });

  test('move는 move_todo RPC를 부른다', async () => {
    const { fake, store } = setup({
      rows: [
        { id: 'h1', text: 'H1', priority: 'high', owner: ME },
        { id: 'm1', text: 'M1', priority: 'medium', owner: ME },
        { id: 'm2', text: 'M2', priority: 'medium', owner: ME },
      ],
    });
    await store.move('m2', 'medium', 'm1');
    expect(fake.order('medium')).toEqual(['m2', 'm1']);
    await store.move('m1', 'high');
    expect(fake.order('high')).toEqual(['h1', 'm1']);
    expect(fake.calls.filter((c) => c.op === 'rpc').map((c) => c.args)).toEqual([
      { p_id: 'm2', p_priority: 'medium', p_before_id: 'm1' },
      { p_id: 'm1', p_priority: 'high', p_before_id: null },
    ]);
  });

  test('서버 오류는 한국어 메시지를 가진 StoreError로 던진다', async () => {
    const { fake, store } = setup();
    fake.failNext('select');
    await expect(store.list()).rejects.toBeInstanceOf(StoreError);
    fake.failNext('rpc', { code: 'P0001', message: 'todo not found' });
    await expect(store.move('zzz', 'high')).rejects.toThrow('요청을 처리하지 못했습니다');
    fake.failNext('insert');
    await expect(store.add('x', 'high')).rejects.toThrow('서버에 연결하지 못했습니다');
  });

  test('로그인하지 않으면 데이터가 보이지 않고 추가할 수 없다', async () => {
    const { store } = setup({ signedInAs: null, rows: [{ id: 'a', text: 'A', owner: ME }] });
    expect(await store.list()).toEqual([]);
    await expect(store.add('x', 'high')).rejects.toBeInstanceOf(StoreError);
  });
});

describe('인증', () => {
  test('signIn 성공과 실패', async () => {
    const { fake, store } = setup({ signedInAs: null });
    await expect(store.signIn(ME, 'wrong-pass')).rejects.toThrow('이메일 또는 비밀번호가 올바르지 않습니다.');
    await store.signIn(ME, 'password123');
    expect(fake.session.user.email).toBe(ME);
  });

  test('signUp은 redirectTo를 emailRedirectTo로 넘기고, 이메일 인증이 필요하면 session이 없다', async () => {
    const { fake, store } = setup({ signedInAs: null, autoConfirm: false });
    const data = await store.signUp('new@example.com', 'password789', 'https://weable72.github.io/todo/');
    expect(data.session).toBeNull();
    expect(fake.calls.find((c) => c.op === 'auth.signUp').options).toEqual({
      emailRedirectTo: 'https://weable72.github.io/todo/',
    });
  });

  test('이미 가입된 이메일로 signUp하면 한국어 오류', async () => {
    const { store } = setup({ signedInAs: null });
    await expect(store.signUp(ME, 'password123', 'x')).rejects.toThrow('이미 가입된 이메일입니다.');
  });

  test('sendPasswordReset, updatePassword, signOut', async () => {
    const { fake, store } = setup();
    await store.sendPasswordReset(ME, 'https://weable72.github.io/todo/');
    expect(fake.resetRequests).toEqual([{ email: ME, redirectTo: 'https://weable72.github.io/todo/' }]);
    await store.updatePassword('new-password-1');
    expect(fake.db.users[0].password).toBe('new-password-1');
    await store.signOut();
    expect(fake.session).toBeNull();
  });

  test('onAuthChange는 다음 틱에 콜백을 부르고, 해제 함수를 돌려준다', async () => {
    jest.useFakeTimers();
    try {
      const { fake, store } = setup({ signedInAs: null });
      const events = [];
      const unsubscribe = store.onAuthChange((event, session) => events.push([event, session && session.user.email]));
      await Promise.resolve();
      expect(events).toEqual([]);
      jest.runAllTimers();
      expect(events).toEqual([['INITIAL_SESSION', null]]);

      await fake.auth.signInWithPassword({ email: ME, password: 'password123' });
      jest.runAllTimers();
      expect(events[1]).toEqual(['SIGNED_IN', ME]);

      unsubscribe();
      await fake.auth.signOut();
      jest.runAllTimers();
      expect(events).toHaveLength(2);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('Google 로그인', () => {
  test('signInWithGoogle은 google provider, redirectTo, 계정 선택 옵션을 넘긴다', async () => {
    const { fake, store } = setup({ signedInAs: null });
    const data = await store.signInWithGoogle('https://weable72.github.io/todo/');
    expect(data.provider).toBe('google');
    expect(fake.calls.find((c) => c.op === 'auth.oauth')).toEqual({
      op: 'auth.oauth',
      provider: 'google',
      options: { redirectTo: 'https://weable72.github.io/todo/', queryParams: { prompt: 'select_account' } },
    });
  });

  test('provider가 꺼져 있으면 한국어 오류', async () => {
    const { fake, store } = setup({ signedInAs: null });
    fake.failNext('auth.oauth', { code: 'validation_failed', message: 'Unsupported provider: provider is not enabled' });
    await expect(store.signInWithGoogle('x')).rejects.toThrow('Google 로그인이 아직 켜져 있지 않습니다.');
    fake.failNext('auth.oauth', { message: 'Unsupported provider: provider is not enabled' });
    await expect(store.signInWithGoogle('x')).rejects.toThrow('Google 로그인이 아직 켜져 있지 않습니다.');
  });
});

describe('oauthErrorFromUrl / stripOAuthError', () => {
  const BASE = 'https://weable72.github.io/todo/';

  test.each([
    [BASE, null],
    [`${BASE}#access_token=abc&type=bearer`, null],
    [`${BASE}#error=access_denied&error_description=The+user+denied`, '로그인을 취소했습니다.'],
    [`${BASE}?error=access_denied&error_code=signup_disabled&error_description=Signups+not+allowed`, '현재 새 회원가입을 받지 않습니다.'],
    [`${BASE}?error=server_error&error_code=unexpected_failure&error_description=Unable+to+exchange+external+code`, 'Google 로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.'],
    [`${BASE}#error=invalid_request&error_description=Unsupported+provider%3A+provider+is+not+enabled`, 'Google 로그인이 아직 켜져 있지 않습니다. 관리자에게 문의해 주세요.'],
    ['not a url', null],
  ])('%s', (href, expected) => {
    expect(oauthErrorFromUrl(href)).toBe(expected);
  });

  test('오류 값만 지우고 나머지 주소는 유지한다', () => {
    expect(stripOAuthError(`${BASE}#error=access_denied&error_description=x`)).toBe(BASE);
    expect(stripOAuthError(`${BASE}?keep=1&error=server_error&error_code=y#error_description=z`)).toBe(`${BASE}?keep=1`);
  });
});
