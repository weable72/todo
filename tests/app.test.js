/**
 * @jest-environment jsdom
 */
const fs = require('fs');
const path = require('path');
const { initApp } = require('../app.js');
const { createStore } = require('../store.js');
const { createFakeSupabase } = require('./fakeSupabase.js');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const bodyHtml = html.match(/<body>([\s\S]*)<\/body>/)[1];

const ME = 'me@example.com';
const PASSWORD = 'password123';
const REDIRECT = 'https://weable72.github.io/todo/';

let fake;
let app;

/** 비동기 작업(가짜 서버 응답, 인증 이벤트)이 모두 끝날 때까지 기다린다. */
async function settle() {
  for (let i = 0; i < 20; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

async function start({ signedIn = true, rows = [], local, ...options } = {}) {
  document.body.innerHTML = bodyHtml;
  window.localStorage.clear();
  if (local) window.localStorage.setItem('todos', JSON.stringify(local));
  fake = createFakeSupabase({
    users: [{ email: ME, password: PASSWORD }],
    signedInAs: signedIn ? ME : null,
    rows: rows.map((r) => ({ owner: ME, ...r })),
    ...options,
  });
  app = initApp({ root: document, store: createStore(fake), storage: window.localStorage, redirectTo: REDIRECT });
  await settle();
  return fake;
}

const $ = (selector) => document.querySelector(selector);
const sectionOf = (priority) => $(`.priority-section[data-priority="${priority}"]`);
const items = (priority) =>
  Array.from(document.querySelectorAll(priority ? `.todo-list[data-priority="${priority}"] .todo-item` : '.todo-item'));
const itemById = (id) => $(`.todo-item[data-id="${id}"]`);
const texts = (priority) => items(priority).map((li) => li.querySelector('.text').textContent);
const ids = (priority) => items(priority).map((li) => li.dataset.id);
const visible = (selector) => !$(selector).hidden;
const callsOf = (op) => fake.calls.filter((c) => c.op === op);

function submit(formSelector) {
  $(formSelector).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

async function addTodo(text, priority) {
  if (priority) $(`input[name="priority"][value="${priority}"]`).checked = true;
  $('#new-todo-input').value = text;
  submit('#new-todo-form');
  await settle();
}

async function login(email, password, confirm) {
  $('#auth-email').value = email;
  $('#auth-password').value = password;
  if (confirm !== undefined) $('#auth-password-confirm').value = confirm;
  submit('#auth-form');
  await settle();
}

function startEdit(id) {
  itemById(id).querySelector('.text').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  return $('.todo-list .edit');
}

function pressKey(element, key, options = {}) {
  element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options }));
}

function change(element, value) {
  element.value = value;
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

/* jsdom에는 PointerEvent와 레이아웃이 없으므로 MouseEvent로 포인터 이벤트를 흉내 내고,
   elementFromPoint와 getBoundingClientRect를 mock한다. 모든 항목은 top 0, 높이 40으로 가정한다. */
function pointer(type, target, clientY = 0) {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: 50, clientY, button: 0 }));
}

function dragTo(id, dropTarget, clientY) {
  pointer('pointerdown', itemById(id).querySelector('.drag-handle'), 20);
  document.elementFromPoint = jest.fn(() => dropTarget());
  pointer('pointermove', document, clientY);
}

beforeEach(() => {
  jest
    .spyOn(Element.prototype, 'getBoundingClientRect')
    .mockReturnValue({ top: 0, left: 0, width: 300, height: 40, right: 300, bottom: 40, x: 0, y: 0 });
});

afterEach(() => {
  if (app) app.destroy();
  jest.restoreAllMocks();
  delete document.elementFromPoint;
});

const board = [
  { id: 'h1', text: 'H1', priority: 'high' },
  { id: 'm1', text: 'M1', priority: 'medium' },
  { id: 'm2', text: 'M2', priority: 'medium', completed: true },
  { id: 'm3', text: 'M3', priority: 'medium' },
  { id: 'l1', text: 'L1', priority: 'low' },
];

describe('기본 화면', () => {
  test('페이지 제목과 화면 제목이 "오늘 할일"이다', async () => {
    await start({ signedIn: false });
    expect(html).toMatch(/<title>오늘 할일<\/title>/);
    expect($('h1').textContent).toBe('오늘 할일');
  });

  test('supabase-js를 버전 고정과 SRI로 불러오고 config.js를 store.js·app.js보다 먼저 불러온다', () => {
    expect(html).toMatch(/@supabase\/supabase-js@2\.\d+\.\d+\/dist\/umd\/supabase\.js" integrity="sha384-/);
    const order = ['supabase.js', 'config.js', 'todo.js', 'store.js', 'app.js'].map((f) => html.indexOf(`${f}"`));
    expect(order.every((pos, i) => pos > -1 && (i === 0 || pos > order[i - 1]))).toBe(true);
  });
});

describe('로그인 / 회원가입', () => {
  test('로그인하지 않았으면 로그인 화면만 보인다', async () => {
    await start({ signedIn: false });
    expect(visible('#auth-view')).toBe(true);
    expect(visible('#app-view')).toBe(false);
    expect(visible('#user-menu')).toBe(false);
    expect(visible('#todo-count')).toBe(false);
  });

  test('잘못된 비밀번호면 한국어 오류를 보여 준다', async () => {
    await start({ signedIn: false });
    await login(ME, 'wrong-password');
    expect($('#auth-message').textContent).toBe('이메일 또는 비밀번호가 올바르지 않습니다.');
    expect($('#auth-message').classList.contains('form-message--error')).toBe(true);
    expect(visible('#app-view')).toBe(false);
  });

  test('로그인하면 할 일 화면과 내 이메일을 보여 주고 서버 목록을 불러온다', async () => {
    await start({ signedIn: false, rows: board });
    await login(ME, PASSWORD);
    expect(visible('#auth-view')).toBe(false);
    expect(visible('#app-view')).toBe(true);
    expect($('#user-email').textContent).toBe(ME);
    expect(ids('medium')).toEqual(['m1', 'm2', 'm3']);
    expect($('#todo-count').textContent).toBe('남은 할 일 4개');
    expect(visible('#loading-message')).toBe(false);
  });

  test.each([
    ['not-an-email', PASSWORD, '올바른 이메일 주소를 입력해 주세요.'],
    [ME, 'short', '비밀번호는 8자 이상이어야 합니다.'],
  ])('입력 검사: %s / %s', async (email, password, message) => {
    await start({ signedIn: false });
    await login(email, password);
    expect($('#auth-message').textContent).toBe(message);
    expect(callsOf('auth.signIn')).toHaveLength(0);
  });

  test('회원가입 탭에서는 비밀번호 확인 칸이 보이고, 일치하지 않으면 가입하지 않는다', async () => {
    await start({ signedIn: false });
    $('[data-auth-mode="signup"]').click();
    expect($('#auth-title').textContent).toBe('회원가입');
    expect(visible('#auth-password-confirm-field')).toBe(true);
    expect(visible('#forgot-password')).toBe(false);
    await login('new@example.com', 'password789', 'password000');
    expect($('#auth-message').textContent).toBe('비밀번호 확인이 일치하지 않습니다.');
    expect(callsOf('auth.signUp')).toHaveLength(0);
  });

  test('이메일 인증이 꺼져 있으면 가입 즉시 로그인된다', async () => {
    await start({ signedIn: false, autoConfirm: true });
    $('[data-auth-mode="signup"]').click();
    await login('new@example.com', 'password789', 'password789');
    expect(callsOf('auth.signUp')[0].options).toEqual({ emailRedirectTo: REDIRECT });
    expect(visible('#app-view')).toBe(true);
    expect($('#user-email').textContent).toBe('new@example.com');
  });

  test('이메일 인증이 필요하면 안내 문구를 보여 주고 로그인 탭으로 돌아간다', async () => {
    await start({ signedIn: false, autoConfirm: false });
    $('[data-auth-mode="signup"]').click();
    await login('new@example.com', 'password789', 'password789');
    expect($('#auth-message').textContent).toBe('확인 메일을 보냈습니다. 메일의 링크를 누른 뒤 로그인해 주세요.');
    expect($('#auth-title').textContent).toBe('로그인');
    expect(visible('#app-view')).toBe(false);
  });

  test('이미 가입된 이메일로 가입하면 한국어 오류', async () => {
    await start({ signedIn: false });
    $('[data-auth-mode="signup"]').click();
    await login(ME, PASSWORD, PASSWORD);
    expect($('#auth-message').textContent).toBe('이미 가입된 이메일입니다. 로그인해 주세요.');
  });

  test('비밀번호 찾기: 이메일이 없으면 안내하고, 있으면 재설정 메일을 요청한다', async () => {
    await start({ signedIn: false });
    $('#forgot-password').click();
    await settle();
    expect($('#auth-message').textContent).toBe('비밀번호를 재설정할 이메일 주소를 먼저 입력해 주세요.');
    expect(fake.resetRequests).toHaveLength(0);

    $('#auth-email').value = ME;
    $('#forgot-password').click();
    await settle();
    expect(fake.resetRequests).toEqual([{ email: ME, redirectTo: REDIRECT }]);
    expect($('#auth-message').textContent).toMatch(/재설정 메일을 보냈습니다/);
  });

  test('재설정 링크로 돌아오면 새 비밀번호 화면을 보여 주고, 변경하면 할 일 화면으로 간다', async () => {
    await start({ signedIn: false, rows: board });
    fake.simulateRecovery(ME);
    await settle();
    expect(visible('#recovery-view')).toBe(true);
    expect(visible('#app-view')).toBe(false);

    $('#recovery-password').value = 'new-password-1';
    $('#recovery-password-confirm').value = 'different-1';
    submit('#recovery-form');
    await settle();
    expect($('#recovery-message').textContent).toBe('비밀번호 확인이 일치하지 않습니다.');

    $('#recovery-password').value = 'new-password-1';
    $('#recovery-password-confirm').value = 'new-password-1';
    submit('#recovery-form');
    await settle();
    expect(fake.db.users[0].password).toBe('new-password-1');
    expect(visible('#recovery-view')).toBe(false);
    expect(visible('#app-view')).toBe(true);
    expect($('#snackbar').textContent).toBe('비밀번호를 변경했습니다.');
    expect(ids('high')).toEqual(['h1']);
  });

  test('로그아웃하면 로그인 화면으로 돌아가고 목록을 비운다', async () => {
    await start({ rows: board });
    $('#logout-button').click();
    await settle();
    expect(fake.session).toBeNull();
    expect(visible('#auth-view')).toBe(true);
    expect(visible('#app-view')).toBe(false);
    expect(visible('#user-menu')).toBe(false);
    expect(items()).toHaveLength(0);
  });
});

describe('할 일 (서버 저장)', () => {
  test('처음에는 빈 목록 3개와 남은 개수 0개를 보여 주고, 완료 지우기 버튼은 숨긴다', async () => {
    await start();
    expect(items()).toHaveLength(0);
    ['high', 'medium', 'low'].forEach((priority) => {
      expect(sectionOf(priority).classList.contains('is-empty')).toBe(true);
      expect(sectionOf(priority).querySelector('[data-count]').textContent).toBe('0');
    });
    expect($('#todo-count').textContent).toBe('남은 할 일 0개');
    expect($('#clear-completed').hidden).toBe(true);
  });

  test('할 일을 추가하면 서버에 저장되고 선택한 우선순위 섹션에 표시된다', async () => {
    await start();
    await addTodo('  장보기 ');
    await addTodo('급한 일', 'high');
    expect(texts('medium')).toEqual(['장보기']);
    expect(texts('high')).toEqual(['급한 일']);
    expect($('#new-todo-input').value).toBe('');
    expect(callsOf('insert').map((c) => c.values)).toEqual([
      { text: '장보기', priority: 'medium' },
      { text: '급한 일', priority: 'high' },
    ]);
    const created = fake.db.todos.find((t) => t.text === '급한 일');
    expect(itemById(created.id).querySelector('.priority-select').value).toBe('high');
  });

  test('빈 입력은 서버에 보내지 않는다', async () => {
    await start();
    await addTodo('   ');
    expect(callsOf('insert')).toHaveLength(0);
    expect(items()).toHaveLength(0);
  });

  test('HTML 문자열은 텍스트로 표시한다', async () => {
    await start();
    await addTodo('<img src=x onerror=alert(1)>');
    expect($('.todo-list img')).toBeNull();
    expect(texts()).toEqual(['<img src=x onerror=alert(1)>']);
  });

  test('완료 체크는 화면을 바로 바꾸고 서버에도 저장한다', async () => {
    await start({ rows: board });
    itemById('m1').querySelector('.toggle').click();
    expect(itemById('m1').classList.contains('completed')).toBe(true);
    await settle();
    expect(fake.byId('m1').completed).toBe(true);
    expect($('#todo-count').textContent).toBe('남은 할 일 3개');
  });

  test('삭제 버튼(아이콘 클릭 포함)으로 지운다', async () => {
    await start({ rows: board });
    itemById('m1').querySelector('.delete svg').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(itemById('m1')).toBeNull();
    await settle();
    expect(fake.byId('m1')).toBeUndefined();
  });

  describe('더블클릭 수정', () => {
    test('Enter로 저장한다', async () => {
      await start({ rows: board });
      const edit = startEdit('m1');
      expect(edit.value).toBe('M1');
      expect(document.activeElement).toBe(edit);
      edit.value = ' 마트 가기 ';
      pressKey(edit, 'Enter');
      await settle();
      expect($('.todo-list .edit')).toBeNull();
      expect(texts('medium')[0]).toBe('마트 가기');
      expect(fake.byId('m1').text).toBe('마트 가기');
    });

    test('Escape로 취소하면 서버에 보내지 않는다', async () => {
      await start({ rows: board });
      const edit = startEdit('m1');
      edit.value = '바뀐 내용';
      pressKey(edit, 'Escape');
      await settle();
      expect(texts('medium')[0]).toBe('M1');
      expect(callsOf('update')).toHaveLength(0);
    });

    test('내용이 그대로면 서버에 보내지 않는다', async () => {
      await start({ rows: board });
      pressKey(startEdit('m1'), 'Enter');
      await settle();
      expect(callsOf('update')).toHaveLength(0);
    });

    test('포커스를 잃으면 저장한다', async () => {
      await start({ rows: board });
      const edit = startEdit('l1');
      edit.value = '요가';
      edit.blur();
      await settle();
      expect(fake.byId('l1').text).toBe('요가');
    });

    test('빈 내용으로 저장하면 서버에서도 삭제한다', async () => {
      await start({ rows: board });
      const edit = startEdit('m1');
      edit.value = '  ';
      pressKey(edit, 'Enter');
      await settle();
      expect(itemById('m1')).toBeNull();
      expect(fake.byId('m1')).toBeUndefined();
    });

    test('수정하는 도중 다른 항목이 추가되어 다시 그려져도 입력 중인 내용이 유지된다', async () => {
      await start({ rows: board });
      const edit = startEdit('m1');
      edit.value = '입력 중';
      await addTodo('다른 일', 'low');
      const again = $('.todo-list .edit');
      expect(again).not.toBeNull();
      expect(again.value).toBe('입력 중');
      expect(texts('low')).toEqual(['L1', '다른 일']);
    });
  });

  test('select로 우선순위를 바꾸면 해당 섹션의 맨 끝으로 옮기고 서버에 move_todo를 보낸다', async () => {
    await start({ rows: board });
    change(itemById('m1').querySelector('.priority-select'), 'high');
    expect(ids('high')).toEqual(['h1', 'm1']);
    await settle();
    expect(callsOf('rpc').map((c) => c.args)).toEqual([{ p_id: 'm1', p_priority: 'high', p_before_id: null }]);
    expect(fake.order('high')).toEqual(['h1', 'm1']);
    expect(fake.byId('m1').priority).toBe('high');
  });

  test('필터와 완료 항목 지우기', async () => {
    await start({ rows: board });
    $('[data-filter="active"]').click();
    expect(ids('medium')).toEqual(['m1', 'm3']);
    expect($('[data-filter="active"]').getAttribute('aria-pressed')).toBe('true');
    $('[data-filter="completed"]').click();
    expect(ids()).toEqual(['m2']);
    $('[data-filter="all"]').click();

    $('#clear-completed').click();
    await settle();
    expect(itemById('m2')).toBeNull();
    expect(fake.byId('m2')).toBeUndefined();
    expect($('#clear-completed').hidden).toBe(true);
  });

  test('서버 저장에 실패하면 알리고 서버 상태로 되돌린다', async () => {
    await start({ rows: board });
    fake.failNext('update');
    itemById('m1').querySelector('.toggle').click();
    expect(itemById('m1').classList.contains('completed')).toBe(true);
    await settle();
    expect(visible('#snackbar')).toBe(true);
    expect($('#snackbar').textContent).toBe('저장하지 못했습니다. 서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.');
    expect(itemById('m1').classList.contains('completed')).toBe(false);
  });

  test('목록을 불러오지 못하면 알린다', async () => {
    document.body.innerHTML = bodyHtml;
    fake = createFakeSupabase({ users: [{ email: ME, password: PASSWORD }], signedInAs: ME });
    fake.failNext('select');
    app = initApp({ root: document, store: createStore(fake), storage: window.localStorage, redirectTo: REDIRECT });
    await settle();
    expect($('#snackbar').textContent).toMatch(/^목록을 불러오지 못했습니다\./);
  });

  test('요청은 보낸 순서대로 처리된다', async () => {
    await start({ rows: board });
    itemById('m3').querySelector('.toggle').click();
    pressKey(itemById('m3').querySelector('.drag-handle'), 'ArrowUp', { altKey: true });
    itemById('m1').querySelector('.delete').click();
    await settle();
    expect(fake.calls.filter((c) => ['update', 'rpc', 'delete'].includes(c.op)).map((c) => c.op)).toEqual([
      'update',
      'rpc',
      'delete',
    ]);
    expect(fake.order('medium')).toEqual(['m3', 'm2']);
    expect(fake.byId('m3').completed).toBe(true);
  });
});

describe('드래그 앤 드롭 (서버 저장)', () => {
  test('같은 등급 안에서 앞으로 옮기면 move_todo(beforeId)를 보낸다', async () => {
    await start({ rows: board });
    dragTo('m3', () => itemById('m1').querySelector('.text'), 10);
    expect($('.drag-ghost')).not.toBeNull();
    pointer('pointerup', document, 10);
    expect(ids('medium')).toEqual(['m3', 'm1', 'm2']);
    expect($('.drag-ghost')).toBeNull();
    await settle();
    expect(callsOf('rpc')[0].args).toEqual({ p_id: 'm3', p_priority: 'medium', p_before_id: 'm1' });
    expect(fake.order('medium')).toEqual(['m3', 'm1', 'm2']);
  });

  test('항목 아래쪽 절반에 놓으면 그 뒤로 옮긴다', async () => {
    await start({ rows: board });
    dragTo('m1', () => itemById('m2').querySelector('.text'), 30);
    pointer('pointerup', document, 30);
    await settle();
    expect(ids('medium')).toEqual(['m2', 'm1', 'm3']);
    expect(fake.order('medium')).toEqual(['m2', 'm1', 'm3']);
  });

  test('다른 등급으로 옮기면 서버에서도 우선순위가 바뀐다', async () => {
    await start({ rows: board });
    dragTo('m2', () => itemById('h1').querySelector('.text'), 10);
    expect(sectionOf('high').classList.contains('drop-target')).toBe(true);
    pointer('pointerup', document, 10);
    await settle();
    expect(ids('high')).toEqual(['m2', 'h1']);
    expect(fake.order('high')).toEqual(['m2', 'h1']);
    expect(fake.byId('m2')).toMatchObject({ priority: 'high', completed: true });
  });

  test('비어 있는 등급 섹션에 놓을 수 있다', async () => {
    await start({ rows: board.filter((t) => t.priority !== 'low') });
    dragTo('h1', () => sectionOf('low').querySelector('.empty-hint'), 10);
    pointer('pointerup', document, 10);
    await settle();
    expect(ids('low')).toEqual(['h1']);
    expect(fake.byId('h1').priority).toBe('low');
  });

  test('섹션 헤더에 놓으면 그 등급의 맨 앞으로 옮긴다', async () => {
    await start({ rows: board });
    dragTo('l1', () => sectionOf('medium').querySelector('h2'), 10);
    pointer('pointerup', document, 10);
    await settle();
    expect(fake.order('medium')).toEqual(['l1', 'm1', 'm2', 'm3']);
  });

  test('Escape나 pointercancel이면 취소하고 서버에 보내지 않는다', async () => {
    await start({ rows: board });
    dragTo('m3', () => itemById('h1').querySelector('.text'), 10);
    pressKey(document, 'Escape');
    dragTo('m3', () => itemById('m1').querySelector('.text'), 10);
    pointer('pointercancel', document, 10);
    await settle();
    expect(ids('medium')).toEqual(['m1', 'm2', 'm3']);
    expect($('.drop-placeholder')).toBeNull();
    expect(callsOf('rpc')).toHaveLength(0);
  });

  test('제자리에 놓으면 서버에 보내지 않는다', async () => {
    await start({ rows: board });
    dragTo('m2', () => itemById('m1').querySelector('.text'), 30);
    pointer('pointerup', document, 30);
    await settle();
    expect(callsOf('rpc')).toHaveLength(0);
  });

  test('필터가 적용된 상태에서도 숨겨진 항목의 순서를 유지한다', async () => {
    await start({ rows: board });
    $('[data-filter="active"]').click();
    dragTo('m1', () => itemById('m3').querySelector('.text'), 30);
    pointer('pointerup', document, 30);
    await settle();
    expect(ids('medium')).toEqual(['m3', 'm1']);
    expect(fake.order('medium')).toEqual(['m2', 'm3', 'm1']);
  });

  test('오른쪽 버튼으로는 드래그를 시작하지 않는다', async () => {
    await start({ rows: board });
    itemById('m1').querySelector('.drag-handle').dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 2 }));
    expect($('.drag-ghost')).toBeNull();
  });
});

describe('키보드 이동 (Alt+↑/↓)', () => {
  const handle = (id) => itemById(id).querySelector('.drag-handle');

  test('같은 등급 안에서 이동하고 핸들 포커스를 유지한다', async () => {
    await start({ rows: board });
    pressKey(handle('m3'), 'ArrowUp', { altKey: true });
    expect(document.activeElement).toBe(handle('m3'));
    pressKey(handle('m1'), 'ArrowDown', { altKey: true });
    await settle();
    expect(ids('medium')).toEqual(['m3', 'm1', 'm2']);
    expect(fake.order('medium')).toEqual(['m3', 'm1', 'm2']);
  });

  test('등급 경계를 넘으면 인접 등급으로 옮긴다', async () => {
    await start({ rows: board });
    pressKey(handle('m1'), 'ArrowUp', { altKey: true });
    pressKey(handle('m3'), 'ArrowDown', { altKey: true });
    await settle();
    expect(fake.order('high')).toEqual(['h1', 'm1']);
    expect(fake.order('low')).toEqual(['m3', 'l1']);
  });

  test('맨 끝에서는 움직이지 않고, Alt 없이는 이동하지 않는다', async () => {
    await start({ rows: board });
    pressKey(handle('h1'), 'ArrowUp', { altKey: true });
    pressKey(handle('l1'), 'ArrowDown', { altKey: true });
    pressKey(handle('m3'), 'ArrowUp');
    await settle();
    expect(callsOf('rpc')).toHaveLength(0);
  });
});

describe('예전 localStorage 데이터 가져오기', () => {
  const local = [
    { id: 'old-1', text: '예전 낮음', completed: false, priority: 'low' },
    { id: 'old-2', text: '예전 높음', completed: true, priority: 'high' },
    { id: 'old-3', text: '우선순위 없음', completed: false },
  ];

  test('로컬에 데이터가 있으면 가져오기 배너를 보여 준다', async () => {
    await start({ local });
    expect(visible('#import-banner')).toBe(true);
    expect($('#import-text').textContent).toMatch(/할 일 3개/);
  });

  test('가져오면 우선순위별로 서버에 저장하고 로컬 데이터를 지운다', async () => {
    await start({ rows: [{ id: 'h1', text: 'H1', priority: 'high' }], local });
    $('#import-confirm').click();
    await settle();
    expect(visible('#import-banner')).toBe(false);
    expect(window.localStorage.getItem('todos')).toBeNull();
    expect(texts('high')).toEqual(['H1', '예전 높음']);
    expect(texts('medium')).toEqual(['우선순위 없음']);
    expect(texts('low')).toEqual(['예전 낮음']);
    expect(fake.order('high').map((id) => fake.byId(id).text)).toEqual(['H1', '예전 높음']);
    expect(fake.db.todos.find((t) => t.text === '예전 높음').completed).toBe(true);
    expect($('#snackbar').textContent).toBe('할 일 3개를 가져왔습니다.');
  });

  test('버리면 서버에 넣지 않고 로컬 데이터만 지운다', async () => {
    await start({ local });
    $('#import-discard').click();
    await settle();
    expect(visible('#import-banner')).toBe(false);
    expect(window.localStorage.getItem('todos')).toBeNull();
    expect(callsOf('insert')).toHaveLength(0);
  });

  test('로컬 데이터가 없으면 배너를 보여 주지 않는다', async () => {
    await start();
    expect(visible('#import-banner')).toBe(false);
  });
});
