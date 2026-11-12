/* 화면 렌더링과 이벤트 처리.
   로직은 todo.js(TodoLogic), 데이터 저장과 로그인은 store.js(TodoStore → Supabase)를 사용한다. */
(function (global) {
  'use strict';

  const isNode = typeof module !== 'undefined' && module.exports;
  const Logic = isNode ? require('./todo.js') : global.TodoLogic;
  const Store = isNode ? require('./store.js') : global.TodoStore;

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ICONS = {
    drag: 'M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',
    delete: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
  };
  const AUTO_SCROLL_EDGE = 64;
  const AUTO_SCROLL_MAX_SPEED = 16;
  const MIN_PASSWORD_LENGTH = 8;
  const SNACKBAR_MS = 4000;
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function createIcon(doc, name) {
    const svg = doc.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = doc.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', ICONS[name]);
    svg.appendChild(path);
    return svg;
  }

  /**
   * @param {object} options
   * @param {Document} [options.root]
   * @param {object} options.store    store.js의 createStore() 결과 (테스트에서는 가짜 객체)
   * @param {Storage} [options.storage] 예전 localStorage 데이터 가져오기에 사용
   * @param {string} [options.redirectTo] 인증 메일 링크가 돌아올 주소
   */
  function initApp({ root = document, store, storage = global.localStorage, redirectTo } = {}) {
    const doc = root.ownerDocument || root;
    const win = doc.defaultView || global;
    const $ = (selector) => root.querySelector(selector);

    const view = {
      auth: $('#auth-view'),
      recovery: $('#recovery-view'),
      app: $('#app-view'),
    };
    const authForm = $('#auth-form');
    const authEmail = $('#auth-email');
    const authPassword = $('#auth-password');
    const authConfirm = $('#auth-password-confirm');
    const authConfirmField = $('#auth-password-confirm-field');
    const authTitle = $('#auth-title');
    const authSubmit = $('#auth-submit');
    const authMessage = $('#auth-message');
    const authTabs = root.querySelectorAll('[data-auth-mode]');
    const forgotButton = $('#forgot-password');
    const googleButton = $('#google-login');
    const recoveryForm = $('#recovery-form');
    const recoveryPassword = $('#recovery-password');
    const recoveryConfirm = $('#recovery-password-confirm');
    const recoveryMessage = $('#recovery-message');
    const userMenu = $('#user-menu');
    const userEmail = $('#user-email');
    const logoutButton = $('#logout-button');
    const progress = $('#progress');
    const snackbar = $('#snackbar');
    const importBanner = $('#import-banner');
    const importText = $('#import-text');
    const loadingMessage = $('#loading-message');

    const form = $('#new-todo-form');
    const input = $('#new-todo-input');
    const board = $('#board');
    const count = $('#todo-count');
    const filterButtons = root.querySelectorAll('[data-filter]');
    const clearButton = $('#clear-completed');

    let todos = [];
    let filter = 'all';
    let editingId = null;
    let drag = null;
    let rendering = false;
    let authMode = 'signin';
    let currentUserId = null;
    let recovering = false;
    let pending = 0;
    let queue = Promise.resolve();
    let snackbarTimer = null;
    // Google 로그인에서 오류와 함께 돌아왔으면 로그인 화면에 보여 줄 문장
    let pendingAuthError = readOAuthError();
    let loadToken = 0;

    /* ---------- 공통 UI ---------- */

    function showView(name) {
      Object.entries(view).forEach(([key, el]) => {
        el.hidden = key !== name;
      });
      count.hidden = name !== 'app';
    }

    function setBusy(delta) {
      pending = Math.max(0, pending + delta);
      progress.hidden = pending === 0;
    }

    function showSnackbar(message) {
      snackbar.textContent = message;
      snackbar.hidden = false;
      win.clearTimeout(snackbarTimer);
      snackbarTimer = win.setTimeout(() => {
        snackbar.hidden = true;
      }, SNACKBAR_MS);
    }

    function setMessage(el, message, isError = false) {
      el.textContent = message;
      el.classList.toggle('form-message--error', isError);
    }

    function errorText(error) {
      return error instanceof Store.StoreError ? error.message : Store.toKoreanMessage(error);
    }

    /* ---------- 서버 요청 ---------- */

    /** 요청을 순서대로 하나씩 보낸다. 실패하면 알리고 서버 상태로 다시 맞춘다. */
    function enqueue(task) {
      const userId = currentUserId;
      setBusy(1);
      queue = queue
        .then(task)
        .catch((error) => {
          if (userId !== currentUserId) return;
          showSnackbar(`저장하지 못했습니다. ${errorText(error)}`);
          return reload();
        })
        .finally(() => setBusy(-1));
      return queue;
    }

    async function reload() {
      const token = ++loadToken;
      try {
        const list = await store.list();
        if (token !== loadToken || currentUserId === null) return;
        todos = list;
        render();
      } catch (error) {
        if (token === loadToken) showSnackbar(`목록을 불러오지 못했습니다. ${errorText(error)}`);
      }
    }

    /** 화면 상태를 먼저 바꾸고(낙관적 업데이트), 서버 요청은 큐에 넣는다. */
    function commit(nextTodos, request, focusHandleOf = null) {
      if (nextTodos === todos) return;
      todos = nextTodos;
      render();
      focusHandle(focusHandleOf);
      enqueue(request);
    }

    function focusHandle(id) {
      if (id === null) return;
      const handle = itemElement(id)?.querySelector('.drag-handle');
      if (handle) handle.focus();
    }

    function itemElement(id) {
      return Array.from(board.querySelectorAll('.todo-item')).find((li) => li.dataset.id === String(id)) || null;
    }

    /* ---------- 할 일 동작 ---------- */

    function addTodo(text, priority) {
      const trimmed = String(text ?? '').trim();
      if (!trimmed) return;
      enqueue(async () => {
        const created = await store.add(trimmed, priority);
        todos = [...todos, created];
        render();
      });
    }

    function toggleTodo(id) {
      const next = Logic.toggleTodo(todos, id);
      const target = next.find((t) => t.id === id);
      if (!target) return;
      commit(next, () => store.setCompleted(id, target.completed));
    }

    function deleteTodo(id) {
      commit(Logic.deleteTodo(todos, id), () => store.remove(id));
    }

    function editTodo(id, text) {
      const trimmed = String(text ?? '').trim();
      const before = todos.find((t) => t.id === id);
      if (!before) {
        render();
        return;
      }
      if (trimmed === before.text) {
        render();
        return;
      }
      const next = Logic.editTodo(todos, id, trimmed);
      commit(next, () => (trimmed ? store.setText(id, trimmed) : store.remove(id)));
    }

    function setPriority(id, priority) {
      const next = Logic.setPriority(todos, id, priority);
      if (next === todos) {
        render();
        return;
      }
      commit(next, () => store.move(id, priority, null));
    }

    function moveTodo(id, priority, beforeId, focus = false) {
      const next = Logic.moveTodo(todos, id, priority, beforeId);
      if (next === todos) {
        render();
        focusHandle(focus ? id : null);
        return;
      }
      commit(next, () => store.move(id, priority, beforeId), focus ? id : null);
    }

    function clearCompleted() {
      commit(Logic.clearCompleted(todos), () => store.removeCompleted());
    }

    /* ---------- 예전 localStorage 데이터 가져오기 ---------- */

    function localTodos() {
      return storage ? Logic.loadTodos(storage) : [];
    }

    function forgetLocalTodos() {
      try {
        storage.removeItem(Logic.STORAGE_KEY);
      } catch (error) {
        /* 저장소 접근이 막힌 환경은 무시 */
      }
      importBanner.hidden = true;
    }

    function updateImportBanner() {
      const local = localTodos();
      importBanner.hidden = local.length === 0;
      importText.textContent = `이 브라우저에 예전에 저장한 할 일 ${local.length}개가 있습니다. 내 계정으로 가져올까요?`;
    }

    function importLocalTodos() {
      const local = localTodos();
      if (local.length === 0) {
        forgetLocalTodos();
        return;
      }
      importBanner.hidden = true;
      // 우선순위별 화면 순서를 유지하도록 그룹 순서대로 넣는다.
      const groups = Logic.groupByPriority(local);
      const ordered = Logic.PRIORITIES.flatMap((priority) => groups[priority]);
      enqueue(async () => {
        const created = await store.addMany(ordered);
        forgetLocalTodos();
        todos = [...todos, ...created];
        render();
        showSnackbar(`할 일 ${created.length}개를 가져왔습니다.`);
      });
    }

    /* ---------- 렌더링 ---------- */

    function section(priority) {
      return board.querySelector(`.priority-section[data-priority="${priority}"]`);
    }

    function listOf(priority) {
      return section(priority).querySelector('.todo-list');
    }

    function visibleGroups() {
      return Logic.groupByPriority(Logic.filterTodos(todos, filter));
    }

    function createPrioritySelect(todo) {
      const select = doc.createElement('select');
      select.className = `priority-select priority-select--${todo.priority}`;
      select.setAttribute('aria-label', '우선순위 변경');
      Logic.PRIORITIES.forEach((priority) => {
        const option = doc.createElement('option');
        option.value = priority;
        option.textContent = Logic.PRIORITY_LABELS[priority];
        option.selected = priority === todo.priority;
        select.appendChild(option);
      });
      return select;
    }

    function createItem(todo, editValue) {
      const li = doc.createElement('li');
      li.className = `todo-item todo-item--${todo.priority}`;
      li.dataset.id = todo.id;
      li.dataset.priority = todo.priority;
      if (todo.completed) li.classList.add('completed');

      if (todo.id === editingId) {
        li.classList.add('editing');
        const edit = doc.createElement('input');
        edit.type = 'text';
        edit.className = 'edit';
        edit.maxLength = 500;
        edit.value = editValue ?? todo.text;
        edit.setAttribute('aria-label', '할 일 수정');
        li.appendChild(edit);
        return li;
      }

      const handle = doc.createElement('button');
      handle.type = 'button';
      handle.className = 'icon-btn drag-handle';
      handle.setAttribute('aria-label', `순서 이동: ${todo.text} (Alt+위/아래 화살표)`);
      handle.title = '끌어서 순서·우선순위 변경 (Alt+↑/↓)';
      handle.appendChild(createIcon(doc, 'drag'));

      const checkbox = doc.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'toggle';
      checkbox.checked = todo.completed;
      checkbox.setAttribute('aria-label', '완료 표시');

      const text = doc.createElement('span');
      text.className = 'text';
      text.textContent = todo.text;
      text.title = '더블클릭하여 수정';

      const del = doc.createElement('button');
      del.type = 'button';
      del.className = 'icon-btn delete';
      del.setAttribute('aria-label', '삭제');
      del.appendChild(createIcon(doc, 'delete'));

      li.append(handle, checkbox, text, createPrioritySelect(todo), del);
      return li;
    }

    function render() {
      // 드래그 중에는 DOM을 다시 만들지 않는다(드롭이 끝나면 다시 그림).
      if (drag) return;

      // 수정 중인 항목이 있으면 입력 중인 내용과 포커스를 유지한다.
      const currentEdit = board.querySelector('.edit');
      const editValue = currentEdit ? currentEdit.value : undefined;
      const hadFocus = currentEdit !== null && doc.activeElement === currentEdit;
      if (editingId !== null && !todos.some((t) => t.id === editingId)) editingId = null;

      rendering = true;
      try {
        const groups = visibleGroups();
        Logic.PRIORITIES.forEach((priority) => {
          const items = groups[priority];
          listOf(priority).replaceChildren(...items.map((todo) => createItem(todo, editValue)));
          const sec = section(priority);
          sec.classList.toggle('is-empty', items.length === 0);
          sec.querySelector('[data-count]').textContent = String(items.length);
        });
      } finally {
        rendering = false;
      }

      const active = Logic.countActive(todos);
      count.textContent = `남은 할 일 ${active}개`;

      filterButtons.forEach((button) => {
        const selected = button.dataset.filter === filter;
        button.classList.toggle('selected', selected);
        button.setAttribute('aria-pressed', String(selected));
      });

      clearButton.hidden = todos.length === active;

      const edit = board.querySelector('.edit');
      if (edit && (hadFocus || currentEdit === null)) {
        edit.focus();
        edit.setSelectionRange(edit.value.length, edit.value.length);
      }
    }

    function getId(target) {
      const li = target.closest('.todo-item');
      return li ? li.dataset.id : null;
    }

    function finishEdit(save, value) {
      if (editingId === null) return;
      const id = editingId;
      editingId = null;
      if (save) {
        editTodo(id, value);
      } else {
        render();
      }
    }

    /* ---------- 로그인 화면 ---------- */

    function setAuthMode(mode) {
      authMode = mode;
      const signup = mode === 'signup';
      authTitle.textContent = signup ? '회원가입' : '로그인';
      authSubmit.textContent = signup ? '가입하기' : '로그인';
      authConfirmField.hidden = !signup;
      authConfirm.required = signup;
      forgotButton.hidden = signup;
      authPassword.setAttribute('autocomplete', signup ? 'new-password' : 'current-password');
      authTabs.forEach((tab) => {
        const selected = tab.dataset.authMode === mode;
        tab.classList.toggle('selected', selected);
        tab.setAttribute('aria-selected', String(selected));
      });
      setMessage(authMessage, '');
    }

    function validateCredentials() {
      const email = authEmail.value.trim();
      const password = authPassword.value;
      if (!EMAIL_PATTERN.test(email)) return { error: '올바른 이메일 주소를 입력해 주세요.' };
      if (password.length < MIN_PASSWORD_LENGTH) {
        return { error: `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.` };
      }
      if (authMode === 'signup' && password !== authConfirm.value) {
        return { error: '비밀번호 확인이 일치하지 않습니다.' };
      }
      return { email, password };
    }

    function setFormDisabled(formEl, disabled) {
      formEl.querySelectorAll('input, button').forEach((el) => {
        el.disabled = disabled;
      });
    }

    async function submitAuth() {
      const result = validateCredentials();
      if (result.error) {
        setMessage(authMessage, result.error, true);
        return;
      }
      setFormDisabled(authForm, true);
      setBusy(1);
      setMessage(authMessage, authMode === 'signup' ? '가입하는 중…' : '로그인하는 중…');
      try {
        if (authMode === 'signup') {
          const data = await store.signUp(result.email, result.password, redirectTo);
          if (data && data.session) {
            setMessage(authMessage, '');
          } else {
            setAuthMode('signin');
            authPassword.value = '';
            authConfirm.value = '';
            setMessage(authMessage, '확인 메일을 보냈습니다. 메일의 링크를 누른 뒤 로그인해 주세요.');
          }
        } else {
          await store.signIn(result.email, result.password);
          setMessage(authMessage, '');
        }
      } catch (error) {
        setMessage(authMessage, errorText(error), true);
      } finally {
        setBusy(-1);
        setFormDisabled(authForm, false);
      }
    }

    async function sendPasswordReset() {
      const email = authEmail.value.trim();
      if (!EMAIL_PATTERN.test(email)) {
        setMessage(authMessage, '비밀번호를 재설정할 이메일 주소를 먼저 입력해 주세요.', true);
        authEmail.focus();
        return;
      }
      setBusy(1);
      try {
        await store.sendPasswordReset(email, redirectTo);
        setMessage(authMessage, '비밀번호 재설정 메일을 보냈습니다. 메일의 링크를 눌러 새 비밀번호를 정해 주세요.');
      } catch (error) {
        setMessage(authMessage, errorText(error), true);
      } finally {
        setBusy(-1);
      }
    }

    async function submitRecovery() {
      const password = recoveryPassword.value;
      if (password.length < MIN_PASSWORD_LENGTH) {
        setMessage(recoveryMessage, `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`, true);
        return;
      }
      if (password !== recoveryConfirm.value) {
        setMessage(recoveryMessage, '비밀번호 확인이 일치하지 않습니다.', true);
        return;
      }
      setFormDisabled(recoveryForm, true);
      setBusy(1);
      try {
        await store.updatePassword(password);
        recovering = false;
        recoveryForm.reset();
        setMessage(recoveryMessage, '');
        showSnackbar('비밀번호를 변경했습니다.');
        showView('app');
      } catch (error) {
        setMessage(recoveryMessage, errorText(error), true);
      } finally {
        setBusy(-1);
        setFormDisabled(recoveryForm, false);
      }
    }

    /* ---------- Google 로그인 ---------- */

    /** 돌아온 주소의 OAuth 오류를 읽고, 새로고침해도 다시 뜨지 않도록 주소에서 지운다. */
    function readOAuthError() {
      const href = win.location && win.location.href;
      const message = href ? Store.oauthErrorFromUrl(href) : null;
      if (message && win.history && typeof win.history.replaceState === 'function') {
        try {
          win.history.replaceState(win.history.state, '', Store.stripOAuthError(href));
        } catch (error) {
          /* file:// 등 주소를 바꿀 수 없는 환경은 무시 */
        }
      }
      return message;
    }

    async function signInWithGoogle() {
      googleButton.disabled = true;
      setBusy(1);
      setMessage(authMessage, 'Google 로그인 화면으로 이동하는 중…');
      try {
        // 성공하면 브라우저가 Google로 이동하고, 로그인 후 redirectTo로 돌아온다.
        await store.signInWithGoogle(redirectTo);
      } catch (error) {
        setMessage(authMessage, errorText(error), true);
      } finally {
        setBusy(-1);
        googleButton.disabled = false;
      }
    }

    /* ---------- 로그인 상태 변화 ---------- */

    function enterSignedIn(session) {
      const user = session.user;
      userEmail.textContent = user.email || '';
      userMenu.hidden = false;
      if (recovering) {
        showView('recovery');
      } else {
        showView('app');
      }
      if (currentUserId === user.id) return;

      currentUserId = user.id;
      todos = [];
      filter = 'all';
      editingId = null;
      loadingMessage.hidden = false;
      render();
      updateImportBanner();
      // 큐를 거쳐 불러와야, 불러오는 도중에 추가한 항목이 목록 덮어쓰기로 사라지지 않는다.
      enqueue(() => reload()).then(() => {
        if (currentUserId === user.id) loadingMessage.hidden = true;
      });
    }

    function enterSignedOut() {
      currentUserId = null;
      recovering = false;
      loadToken += 1;
      todos = [];
      editingId = null;
      render();
      userMenu.hidden = true;
      userEmail.textContent = '';
      importBanner.hidden = true;
      loadingMessage.hidden = true;
      authForm.reset();
      setAuthMode('signin');
      if (pendingAuthError) {
        setMessage(authMessage, pendingAuthError, true);
        pendingAuthError = null;
      }
      showView('auth');
    }

    function handleAuthChange(event, session) {
      if (event === 'PASSWORD_RECOVERY') {
        recovering = true;
      }
      if (session && session.user) {
        enterSignedIn(session);
      } else if (event === 'SIGNED_OUT' || event === 'INITIAL_SESSION' || !session) {
        enterSignedOut();
      }
    }

    /* ---------- 키보드 이동 (Alt+↑/↓) ---------- */

    function moveByKeyboard(id, direction) {
      const todo = todos.find((t) => t.id === id);
      if (!todo) return;
      const groups = visibleGroups();
      const group = groups[todo.priority];
      const index = group.findIndex((t) => t.id === id);
      const priorityIndex = Logic.PRIORITIES.indexOf(todo.priority);

      if (direction < 0) {
        if (index > 0) {
          moveTodo(id, todo.priority, group[index - 1].id, true);
        } else if (priorityIndex > 0) {
          moveTodo(id, Logic.PRIORITIES[priorityIndex - 1], null, true);
        }
      } else if (index < group.length - 1) {
        const after = group[index + 2];
        moveTodo(id, todo.priority, after ? after.id : null, true);
      } else if (priorityIndex < Logic.PRIORITIES.length - 1) {
        const target = Logic.PRIORITIES[priorityIndex + 1];
        const first = groups[target][0];
        moveTodo(id, target, first ? first.id : null, true);
      }
    }

    /* ---------- 포인터 드래그 앤 드롭 ---------- */

    function placePlaceholder(clientX, clientY) {
      const hit = typeof doc.elementFromPoint === 'function' ? doc.elementFromPoint(clientX, clientY) : null;
      if (!hit) return;
      const targetSection = hit.closest('.priority-section');
      if (!targetSection) return;
      const list = targetSection.querySelector('.todo-list');
      const { placeholder } = drag;

      const targetItem = hit.closest('.todo-item');
      if (targetItem && targetItem !== drag.item && list.contains(targetItem)) {
        const rect = targetItem.getBoundingClientRect();
        if (clientY < rect.top + rect.height / 2) {
          list.insertBefore(placeholder, targetItem);
        } else {
          list.insertBefore(placeholder, targetItem.nextSibling);
        }
      } else if (hit.closest('.section-header')) {
        list.insertBefore(placeholder, list.firstChild);
      } else if (!list.contains(placeholder)) {
        list.appendChild(placeholder);
      }

      Logic.PRIORITIES.forEach((priority) => {
        section(priority).classList.toggle('drop-target', section(priority) === targetSection);
      });
    }

    function autoScrollStep() {
      if (!drag) return;
      const height = win.innerHeight || 0;
      let speed = 0;
      if (drag.lastY < AUTO_SCROLL_EDGE) {
        speed = -AUTO_SCROLL_MAX_SPEED * (1 - drag.lastY / AUTO_SCROLL_EDGE);
      } else if (drag.lastY > height - AUTO_SCROLL_EDGE) {
        speed = AUTO_SCROLL_MAX_SPEED * (1 - (height - drag.lastY) / AUTO_SCROLL_EDGE);
      }
      if (speed !== 0 && typeof win.scrollBy === 'function') {
        win.scrollBy(0, speed);
        placePlaceholder(drag.lastX, drag.lastY);
      }
      drag.frame = win.requestAnimationFrame(autoScrollStep);
    }

    function startDrag(event, handle) {
      const item = handle.closest('.todo-item');
      if (!item || editingId !== null) return;
      event.preventDefault();

      const rect = item.getBoundingClientRect();
      const ghost = item.cloneNode(true);
      ghost.classList.add('drag-ghost');
      ghost.removeAttribute('data-id');
      ghost.setAttribute('aria-hidden', 'true');
      ghost.style.width = `${rect.width}px`;
      ghost.style.left = `${rect.left}px`;
      ghost.style.top = `${rect.top}px`;
      doc.body.appendChild(ghost);

      const placeholder = doc.createElement('li');
      placeholder.className = 'drop-placeholder';
      placeholder.setAttribute('aria-hidden', 'true');
      placeholder.style.height = `${rect.height}px`;
      item.parentNode.insertBefore(placeholder, item);
      item.classList.add('dragging');

      drag = {
        id: item.dataset.id,
        item,
        ghost,
        placeholder,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        frame: null,
      };
      if (handle.setPointerCapture && event.pointerId !== undefined) {
        try {
          handle.setPointerCapture(event.pointerId);
        } catch (error) {
          /* 포인터 캡처를 지원하지 않는 환경은 무시 */
        }
      }

      doc.body.classList.add('is-dragging');
      doc.addEventListener('pointermove', onPointerMove);
      doc.addEventListener('pointerup', onPointerUp);
      doc.addEventListener('pointercancel', onPointerCancel);
      doc.addEventListener('keydown', onDragKeydown, true);
      if (typeof win.requestAnimationFrame === 'function') {
        drag.frame = win.requestAnimationFrame(autoScrollStep);
      }
    }

    function isSamePointer(event) {
      return drag && (drag.pointerId === undefined || event.pointerId === undefined || event.pointerId === drag.pointerId);
    }

    function onPointerMove(event) {
      if (!isSamePointer(event)) return;
      event.preventDefault();
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      drag.ghost.style.transform = `translate(${event.clientX - drag.startX}px, ${event.clientY - drag.startY}px)`;
      placePlaceholder(event.clientX, event.clientY);
    }

    function endDrag(commitDrop) {
      if (!drag) return;
      const { id, item, ghost, placeholder, frame } = drag;
      drag = null;

      if (frame !== null && typeof win.cancelAnimationFrame === 'function') win.cancelAnimationFrame(frame);
      doc.removeEventListener('pointermove', onPointerMove);
      doc.removeEventListener('pointerup', onPointerUp);
      doc.removeEventListener('pointercancel', onPointerCancel);
      doc.removeEventListener('keydown', onDragKeydown, true);
      doc.body.classList.remove('is-dragging');
      ghost.remove();
      board.querySelectorAll('.drop-target').forEach((el) => el.classList.remove('drop-target'));

      const list = placeholder.parentNode;
      const unmoved =
        !list || placeholder.previousElementSibling === item || placeholder.nextElementSibling === item;

      let target = null;
      if (commitDrop && !unmoved) {
        let sibling = placeholder.nextElementSibling;
        while (sibling && !(sibling.classList.contains('todo-item') && sibling !== item)) {
          sibling = sibling.nextElementSibling;
        }
        target = { priority: list.dataset.priority, beforeId: sibling ? sibling.dataset.id : null };
      }

      placeholder.remove();
      item.classList.remove('dragging');
      if (target) {
        moveTodo(id, target.priority, target.beforeId, true);
      } else {
        render();
        focusHandle(id);
      }
    }

    function onPointerUp(event) {
      if (!isSamePointer(event)) return;
      endDrag(true);
    }

    function onPointerCancel(event) {
      if (!isSamePointer(event)) return;
      endDrag(false);
    }

    function onDragKeydown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        endDrag(false);
      }
    }

    /* ---------- 이벤트 ---------- */

    authTabs.forEach((tab) => {
      tab.addEventListener('click', () => setAuthMode(tab.dataset.authMode));
    });

    authForm.addEventListener('submit', (event) => {
      event.preventDefault();
      submitAuth();
    });

    googleButton.addEventListener('click', () => {
      signInWithGoogle();
    });

    // 뒤로 가기로 돌아왔을 때(bfcache) 버튼이 비활성 상태로 남지 않게 한다.
    const onPageShow = () => {
      googleButton.disabled = false;
    };
    win.addEventListener('pageshow', onPageShow);

    forgotButton.addEventListener('click', () => {
      sendPasswordReset();
    });

    recoveryForm.addEventListener('submit', (event) => {
      event.preventDefault();
      submitRecovery();
    });

    logoutButton.addEventListener('click', async () => {
      setBusy(1);
      try {
        await queue;
        await store.signOut();
      } catch (error) {
        showSnackbar(`로그아웃하지 못했습니다. ${errorText(error)}`);
      } finally {
        setBusy(-1);
      }
    });

    $('#import-confirm').addEventListener('click', importLocalTodos);
    $('#import-discard').addEventListener('click', forgetLocalTodos);

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const checked = form.querySelector('input[name="priority"]:checked');
      addTodo(input.value, checked ? checked.value : Logic.DEFAULT_PRIORITY);
      input.value = '';
    });

    board.addEventListener('change', (event) => {
      const { target } = event;
      if (target.classList.contains('toggle')) {
        toggleTodo(getId(target));
      } else if (target.classList.contains('priority-select')) {
        setPriority(getId(target), target.value);
      }
    });

    board.addEventListener('click', (event) => {
      const del = event.target.closest('.delete');
      if (del) deleteTodo(getId(del));
    });

    board.addEventListener('dblclick', (event) => {
      if (event.target.classList.contains('text')) {
        editingId = getId(event.target);
        render();
      }
    });

    board.addEventListener('pointerdown', (event) => {
      const handle = event.target.closest('.drag-handle');
      if (!handle || drag) return;
      if (event.button !== undefined && event.button !== 0) return;
      if (event.isPrimary === false) return;
      startDrag(event, handle);
    });

    board.addEventListener('keydown', (event) => {
      const { target } = event;
      if (target.classList.contains('edit')) {
        if (event.key === 'Enter') {
          finishEdit(true, target.value);
        } else if (event.key === 'Escape') {
          finishEdit(false);
        }
        return;
      }
      if (
        target.classList.contains('drag-handle') &&
        event.altKey &&
        (event.key === 'ArrowUp' || event.key === 'ArrowDown')
      ) {
        event.preventDefault();
        moveByKeyboard(getId(target), event.key === 'ArrowUp' ? -1 : 1);
      }
    });

    board.addEventListener('focusout', (event) => {
      if (rendering) return;
      if (event.target.classList.contains('edit')) {
        finishEdit(true, event.target.value);
      }
    });

    filterButtons.forEach((button) => {
      button.addEventListener('click', () => {
        filter = button.dataset.filter;
        render();
      });
    });

    clearButton.addEventListener('click', clearCompleted);

    setAuthMode('signin');
    render();
    const unsubscribe = store.onAuthChange(handleAuthChange);

    return {
      getTodos: () => todos,
      getFilter: () => filter,
      /** 지금까지 넣은 서버 요청이 모두 끝날 때 resolve된다. */
      idle: () => queue,
      destroy: () => {
        unsubscribe();
        win.removeEventListener('pageshow', onPageShow);
      },
    };
  }

  /** 브라우저 시작: config.js와 supabase-js를 확인하고 앱을 띄운다. */
  function boot() {
    const fatal = document.querySelector('#fatal-message');
    const fail = (message) => {
      fatal.textContent = message;
      fatal.hidden = false;
    };
    if (!global.supabase || typeof global.supabase.createClient !== 'function') {
      fail('Supabase 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 새로고침해 주세요.');
      return;
    }
    if (!global.SUPABASE_URL || !global.SUPABASE_PUBLISHABLE_KEY) {
      fail('config.js에 SUPABASE_URL과 SUPABASE_PUBLISHABLE_KEY를 설정해 주세요.');
      return;
    }
    const client = global.supabase.createClient(global.SUPABASE_URL, global.SUPABASE_PUBLISHABLE_KEY);
    const redirectTo = global.location.href.split('#')[0].split('?')[0];
    initApp({ store: Store.createStore(client), redirectTo });
  }

  if (isNode) {
    module.exports = { initApp };
  } else {
    global.TodoApp = { initApp };
    document.addEventListener('DOMContentLoaded', boot);
  }
})(typeof window !== 'undefined' ? window : globalThis);
