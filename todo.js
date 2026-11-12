/* 할 일 목록의 순수 로직. DOM에 의존하지 않으며 상태를 직접 바꾸지 않고 새 배열을 반환한다. */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'todos';
  const FILTERS = ['all', 'active', 'completed'];
  const PRIORITIES = ['high', 'medium', 'low'];
  const PRIORITY_LABELS = { high: '높음', medium: '중간', low: '낮음' };
  const DEFAULT_PRIORITY = 'medium';
  let idCounter = 0;

  function createId() {
    idCounter += 1;
    return `${Date.now()}-${idCounter}`;
  }

  function isPriority(priority) {
    return PRIORITIES.includes(priority);
  }

  function normalizePriority(priority) {
    return isPriority(priority) ? priority : DEFAULT_PRIORITY;
  }

  function addTodo(todos, text, priority = DEFAULT_PRIORITY, id = createId()) {
    const trimmed = String(text ?? '').trim();
    if (!trimmed) return todos;
    return [...todos, { id, text: trimmed, completed: false, priority: normalizePriority(priority) }];
  }

  function toggleTodo(todos, id) {
    return todos.map((todo) =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    );
  }

  function deleteTodo(todos, id) {
    return todos.filter((todo) => todo.id !== id);
  }

  function editTodo(todos, id, text) {
    const trimmed = String(text ?? '').trim();
    if (!trimmed) return deleteTodo(todos, id);
    return todos.map((todo) => (todo.id === id ? { ...todo, text: trimmed } : todo));
  }

  /**
   * id 항목을 priority 등급으로 옮기고 beforeId 항목 바로 앞에 놓는다.
   * beforeId가 null이면 그 등급의 맨 끝에 놓는다.
   * 바뀌는 것이 없거나 인자가 잘못되면 원본 배열을 그대로 반환한다.
   */
  function moveTodo(todos, id, priority, beforeId = null) {
    if (!isPriority(priority) || beforeId === id) return todos;
    const item = todos.find((todo) => todo.id === id);
    if (!item) return todos;

    const rest = todos.filter((todo) => todo.id !== id);
    const moved = item.priority === priority ? item : { ...item, priority };
    let index;

    if (beforeId === null || beforeId === undefined) {
      let lastIndex = -1;
      rest.forEach((todo, i) => {
        if (todo.priority === priority) lastIndex = i;
      });
      index = lastIndex === -1 ? rest.length : lastIndex + 1;
    } else {
      index = rest.findIndex((todo) => todo.id === beforeId);
      if (index === -1 || rest[index].priority !== priority) return todos;
    }

    const result = [...rest.slice(0, index), moved, ...rest.slice(index)];
    if (moved === item) {
      // 등급이 그대로이고 그 등급 안의 순서도 같으면 화면상 바뀌는 것이 없다.
      const before = todos.filter((todo) => todo.priority === priority);
      const after = result.filter((todo) => todo.priority === priority);
      if (after.every((todo, i) => todo === before[i])) return todos;
    }
    return result;
  }

  /** 등급을 바꾸고 새 등급의 맨 끝으로 옮긴다. */
  function setPriority(todos, id, priority) {
    const item = todos.find((todo) => todo.id === id);
    if (!item || !isPriority(priority) || item.priority === priority) return todos;
    return moveTodo(todos, id, priority, null);
  }

  function groupByPriority(todos) {
    const groups = {};
    PRIORITIES.forEach((priority) => {
      groups[priority] = todos.filter((todo) => todo.priority === priority);
    });
    return groups;
  }

  function clearCompleted(todos) {
    return todos.filter((todo) => !todo.completed);
  }

  function filterTodos(todos, filter) {
    if (filter === 'active') return todos.filter((todo) => !todo.completed);
    if (filter === 'completed') return todos.filter((todo) => todo.completed);
    return todos;
  }

  function countActive(todos) {
    return todos.filter((todo) => !todo.completed).length;
  }

  function isValidTodo(todo) {
    return (
      todo !== null &&
      typeof todo === 'object' &&
      (typeof todo.id === 'string' || typeof todo.id === 'number') &&
      typeof todo.text === 'string' &&
      typeof todo.completed === 'boolean'
    );
  }

  function loadTodos(storage) {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(isValidTodo)
        .map((todo) =>
          isPriority(todo.priority) ? todo : { ...todo, priority: DEFAULT_PRIORITY }
        );
    } catch (error) {
      return [];
    }
  }

  function saveTodos(storage, todos) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(todos));
      return true;
    } catch (error) {
      return false;
    }
  }

  const TodoLogic = {
    STORAGE_KEY,
    FILTERS,
    PRIORITIES,
    PRIORITY_LABELS,
    DEFAULT_PRIORITY,
    addTodo,
    toggleTodo,
    deleteTodo,
    editTodo,
    moveTodo,
    setPriority,
    groupByPriority,
    clearCompleted,
    filterTodos,
    countActive,
    loadTodos,
    saveTodos,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TodoLogic;
  } else {
    global.TodoLogic = TodoLogic;
  }
})(typeof window !== 'undefined' ? window : globalThis);
