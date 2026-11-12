/* 테스트용 가짜 Supabase 클라이언트.
   실제 서버에 접속하지 않고 메모리에서 동작한다. SUPABASE.md의 스키마 동작을 흉내 낸다:
   - RLS: 로그인한 사용자의 행만 보이고 바뀐다.
   - 새 행의 position은 같은 우선순위의 맨 끝(max + 1024).
   - move_todo(p_id, p_priority, p_before_id) RPC. */

const PRIORITIES = ['high', 'medium', 'low'];

function createFakeSupabase({ users = [], signedInAs = null, rows = [], autoConfirm = true } = {}) {
  let idSeq = 0;
  let clock = 0;
  const nextId = (prefix) => `${prefix}-${++idSeq}`;

  const db = {
    users: users.map((u) => ({ id: u.id || nextId('user'), email: u.email, password: u.password, confirmed: u.confirmed !== false })),
    todos: [],
  };
  const calls = [];
  const failures = [];
  const listeners = [];
  const resetRequests = [];

  let session = null;
  const makeSession = (user) => ({ access_token: `token-${user.id}`, user: { id: user.id, email: user.email } });
  if (signedInAs) {
    const user = db.users.find((u) => u.email === signedInAs);
    if (!user) throw new Error(`unknown user ${signedInAs}`);
    session = makeSession(user);
  }

  rows.forEach((row) => {
    const owner = db.users.find((u) => u.email === row.owner) || db.users[0];
    db.todos.push({
      id: row.id || nextId('todo'),
      user_id: owner.id,
      text: row.text,
      completed: row.completed ?? false,
      priority: row.priority ?? 'medium',
      position: row.position ?? 0,
      created_at: ++clock,
    });
  });
  // position이 없는 초기 행은 입력 순서대로 1024 간격으로 채운다.
  PRIORITIES.forEach((priority) => {
    db.todos
      .filter((t) => t.priority === priority && !t.position)
      .forEach((t, i) => {
        t.position = (i + 1) * 1024;
      });
  });

  function emit(event) {
    listeners.slice().forEach((cb) => cb(event, session));
  }

  function takeFailure(op) {
    const index = failures.findIndex((f) => f.op === op);
    if (index === -1) return null;
    return failures.splice(index, 1)[0].error;
  }

  const uid = () => (session ? session.user.id : null);
  const own = () => db.todos.filter((t) => t.user_id === uid());
  const rlsError = { code: '42501', message: 'new row violates row-level security policy' };

  function pick(row, columns) {
    if (!columns || columns === '*') return { ...row };
    const out = {};
    columns.split(',').map((c) => c.trim()).forEach((c) => {
      out[c] = row[c];
    });
    return out;
  }

  function endPosition(priority, exceptId) {
    const positions = own().filter((t) => t.priority === priority && t.id !== exceptId).map((t) => t.position);
    return (positions.length ? Math.max(...positions) : 0) + 1024;
  }

  function validateTodo(values) {
    if (typeof values.text !== 'string' || values.text.trim().length < 1 || values.text.trim().length > 500) {
      return { code: '23514', message: 'new row violates check constraint "todos_text_check"' };
    }
    if (values.priority !== undefined && !PRIORITIES.includes(values.priority)) {
      return { code: '23514', message: 'new row violates check constraint "todos_priority_check"' };
    }
    return null;
  }

  function execute(q) {
    calls.push({ op: q.op, table: q.table, values: q.values, filters: q.filters.slice(), orders: q.orders.slice() });
    const failure = takeFailure(q.op);
    if (failure) return { data: null, error: failure };

    const matches = (row) => q.filters.every(([col, val]) => row[col] === val);

    if (q.op === 'select') {
      let result = own().filter(matches);
      result.sort((a, b) => {
        for (const [col, asc] of q.orders) {
          if (a[col] !== b[col]) return (a[col] < b[col] ? -1 : 1) * (asc ? 1 : -1);
        }
        return 0;
      });
      result = result.map((r) => pick(r, q.columns));
      return { data: q.single ? result[0] ?? null : result, error: null };
    }

    if (q.op === 'insert') {
      if (!uid()) return { data: null, error: rlsError };
      const list = Array.isArray(q.values) ? q.values : [q.values];
      for (const values of list) {
        const error = validateTodo(values);
        if (error) return { data: null, error };
      }
      const inserted = list.map((values) => {
        const priority = values.priority ?? 'medium';
        const row = {
          id: nextId('todo'),
          user_id: uid(),
          text: values.text,
          completed: values.completed ?? false,
          priority,
          position: values.position || endPosition(priority),
          created_at: ++clock,
        };
        db.todos.push(row);
        return row;
      });
      if (!q.returning) return { data: null, error: null };
      const data = inserted.map((r) => pick(r, q.columns));
      return { data: q.single ? data[0] : data, error: null };
    }

    if (q.op === 'update') {
      if (q.values.text !== undefined) {
        const error = validateTodo({ text: q.values.text });
        if (error) return { data: null, error };
      }
      own().filter(matches).forEach((row) => Object.assign(row, q.values));
      return { data: null, error: null };
    }

    if (q.op === 'delete') {
      const ids = new Set(own().filter(matches).map((r) => r.id));
      db.todos = db.todos.filter((r) => !ids.has(r.id));
      return { data: null, error: null };
    }

    throw new Error(`unsupported op ${q.op}`);
  }

  function query(table) {
    const q = { table, op: 'select', columns: '*', filters: [], orders: [], values: null, returning: false, single: false };
    const builder = {
      select(columns = '*') {
        if (q.op === 'select') {
          q.columns = columns;
        } else {
          q.returning = true;
          q.columns = columns;
        }
        return builder;
      },
      insert(values) {
        q.op = 'insert';
        q.values = values;
        return builder;
      },
      update(values) {
        q.op = 'update';
        q.values = values;
        return builder;
      },
      delete() {
        q.op = 'delete';
        return builder;
      },
      eq(column, value) {
        q.filters.push([column, value]);
        return builder;
      },
      order(column, { ascending = true } = {}) {
        q.orders.push([column, ascending]);
        return builder;
      },
      single() {
        q.single = true;
        return builder;
      },
      then(resolve, reject) {
        return Promise.resolve().then(() => execute(q)).then(resolve, reject);
      },
    };
    return builder;
  }

  function moveTodo({ p_id, p_priority, p_before_id = null }) {
    if (!uid()) return { data: null, error: { code: '42501', message: 'permission denied for function move_todo' } };
    if (!PRIORITIES.includes(p_priority)) return { data: null, error: { code: 'P0001', message: `invalid priority: ${p_priority}` } };
    const item = own().find((t) => t.id === p_id);
    if (!item) return { data: null, error: { code: 'P0001', message: 'todo not found' } };

    let position;
    if (p_before_id === null) {
      position = endPosition(p_priority, p_id);
    } else {
      const before = own().find((t) => t.id === p_before_id && t.priority === p_priority);
      if (!before) return { data: null, error: { code: 'P0001', message: 'before item not found' } };
      const prev = own()
        .filter((t) => t.priority === p_priority && t.id !== p_id && t.position < before.position)
        .map((t) => t.position);
      position = prev.length ? (Math.max(...prev) + before.position) / 2 : before.position - 1024;
    }
    item.priority = p_priority;
    item.position = position;
    return { data: null, error: null };
  }

  const auth = {
    onAuthStateChange(callback) {
      listeners.push(callback);
      Promise.resolve().then(() => callback('INITIAL_SESSION', session));
      return {
        data: {
          subscription: {
            unsubscribe() {
              const i = listeners.indexOf(callback);
              if (i !== -1) listeners.splice(i, 1);
            },
          },
        },
      };
    },

    async signInWithPassword({ email, password }) {
      calls.push({ op: 'auth.signIn', email });
      const failure = takeFailure('auth.signIn');
      if (failure) return { data: { user: null, session: null }, error: failure };
      const user = db.users.find((u) => u.email === email && u.password === password);
      if (!user) return { data: { user: null, session: null }, error: { code: 'invalid_credentials', message: 'Invalid login credentials' } };
      if (!user.confirmed) return { data: { user: null, session: null }, error: { code: 'email_not_confirmed', message: 'Email not confirmed' } };
      session = makeSession(user);
      emit('SIGNED_IN');
      return { data: { user: session.user, session }, error: null };
    },

    async signUp({ email, password, options = {} }) {
      calls.push({ op: 'auth.signUp', email, options });
      const failure = takeFailure('auth.signUp');
      if (failure) return { data: { user: null, session: null }, error: failure };
      if (db.users.some((u) => u.email === email)) {
        return { data: { user: null, session: null }, error: { code: 'user_already_exists', message: 'User already registered' } };
      }
      const user = { id: nextId('user'), email, password, confirmed: autoConfirm };
      db.users.push(user);
      if (!autoConfirm) return { data: { user: { id: user.id, email }, session: null }, error: null };
      session = makeSession(user);
      emit('SIGNED_IN');
      return { data: { user: session.user, session }, error: null };
    },

    async signOut() {
      calls.push({ op: 'auth.signOut' });
      session = null;
      emit('SIGNED_OUT');
      return { error: null };
    },

    async resetPasswordForEmail(email, options = {}) {
      calls.push({ op: 'auth.resetPassword', email, options });
      resetRequests.push({ email, ...options });
      return { data: {}, error: null };
    },

    async updateUser({ password }) {
      calls.push({ op: 'auth.updateUser' });
      const failure = takeFailure('auth.updateUser');
      if (failure) return { data: { user: null }, error: failure };
      if (!session) return { data: { user: null }, error: { code: 'session_not_found', message: 'Auth session missing!' } };
      const user = db.users.find((u) => u.id === session.user.id);
      if (user.password === password) return { data: { user: null }, error: { code: 'same_password', message: 'same password' } };
      user.password = password;
      emit('USER_UPDATED');
      return { data: { user: session.user }, error: null };
    },
  };

  return {
    auth,
    from: query,
    async rpc(name, args) {
      calls.push({ op: 'rpc', name, args });
      const failure = takeFailure('rpc');
      if (failure) return { data: null, error: failure };
      if (name !== 'move_todo') return { data: null, error: { code: 'PGRST202', message: `function ${name} not found` } };
      return moveTodo(args);
    },

    /* ---------- 테스트 도우미 ---------- */
    db,
    calls,
    resetRequests,
    /** 다음 op 호출 하나를 실패시킨다. op: select|insert|update|delete|rpc|auth.signIn|auth.signUp|auth.updateUser */
    failNext(op, error = { message: 'Failed to fetch' }) {
      failures.push({ op, error });
    },
    /** 비밀번호 재설정 링크로 돌아온 상황을 흉내 낸다. */
    simulateRecovery(email) {
      const user = db.users.find((u) => u.email === email);
      session = makeSession(user);
      emit('PASSWORD_RECOVERY');
    },
    /** 서버 기준 우선순위별 id 순서 (position 순) */
    order(priority, email) {
      const user = email ? db.users.find((u) => u.email === email) : session && { id: session.user.id };
      return db.todos
        .filter((t) => t.priority === priority && (!user || t.user_id === user.id))
        .sort((a, b) => a.position - b.position || a.created_at - b.created_at)
        .map((t) => t.id);
    },
    byId(id) {
      return db.todos.find((t) => t.id === id);
    },
    get session() {
      return session;
    },
  };
}

module.exports = { createFakeSupabase };
