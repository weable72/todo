const Logic = require('../todo.js');

const sample = () => [
  { id: 'a', text: '장보기', completed: false, priority: 'medium' },
  { id: 'b', text: '운동하기', completed: true, priority: 'medium' },
  { id: 'c', text: '책 읽기', completed: false, priority: 'medium' },
];

/* 등급별 순서를 확인하기 위한 목록: high[h1,h2] medium[m1,m2,m3] low[l1] */
const board = () => [
  { id: 'h1', text: 'H1', completed: false, priority: 'high' },
  { id: 'm1', text: 'M1', completed: false, priority: 'medium' },
  { id: 'h2', text: 'H2', completed: true, priority: 'high' },
  { id: 'm2', text: 'M2', completed: true, priority: 'medium' },
  { id: 'l1', text: 'L1', completed: false, priority: 'low' },
  { id: 'm3', text: 'M3', completed: false, priority: 'medium' },
];

const order = (todos) => {
  const groups = Logic.groupByPriority(todos);
  return {
    high: groups.high.map((t) => t.id),
    medium: groups.medium.map((t) => t.id),
    low: groups.low.map((t) => t.id),
  };
};

function createStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value);
    },
    data,
  };
}

describe('상수', () => {
  test('우선순위는 높음/중간/낮음 순서이고 기본값은 중간이다', () => {
    expect(Logic.PRIORITIES).toEqual(['high', 'medium', 'low']);
    expect(Logic.PRIORITY_LABELS).toEqual({ high: '높음', medium: '중간', low: '낮음' });
    expect(Logic.DEFAULT_PRIORITY).toBe('medium');
  });
});

describe('addTodo', () => {
  test('앞뒤 공백을 제거하고 미완료 상태로 끝에 추가한다', () => {
    const result = Logic.addTodo(sample(), '  빨래  ', 'high', 'x');
    expect(result).toHaveLength(4);
    expect(result[3]).toEqual({ id: 'x', text: '빨래', completed: false, priority: 'high' });
  });

  test('우선순위를 주지 않으면 중간으로 추가한다', () => {
    expect(Logic.addTodo([], '빨래')[0].priority).toBe('medium');
  });

  test('잘못된 우선순위는 중간으로 바꾼다', () => {
    expect(Logic.addTodo([], '빨래', 'urgent')[0].priority).toBe('medium');
  });

  test('추가한 항목은 해당 등급의 맨 끝에 보인다', () => {
    const result = Logic.addTodo(board(), '새 항목', 'high', 'h3');
    expect(order(result).high).toEqual(['h1', 'h2', 'h3']);
  });

  test('빈 문자열이나 공백만 있으면 원본 배열을 그대로 반환한다', () => {
    const todos = sample();
    expect(Logic.addTodo(todos, '')).toBe(todos);
    expect(Logic.addTodo(todos, '   ')).toBe(todos);
    expect(Logic.addTodo(todos, undefined)).toBe(todos);
  });

  test('id를 주지 않으면 서로 다른 id를 만든다', () => {
    const result = Logic.addTodo(Logic.addTodo([], '하나'), '둘');
    expect(result[0].id).not.toBe(result[1].id);
  });

  test('원본 배열을 변경하지 않는다', () => {
    const todos = sample();
    Logic.addTodo(todos, '새 항목');
    expect(todos).toEqual(sample());
  });
});

describe('toggleTodo', () => {
  test('해당 항목의 완료 상태를 뒤집는다', () => {
    const result = Logic.toggleTodo(sample(), 'a');
    expect(result[0].completed).toBe(true);
    expect(Logic.toggleTodo(result, 'a')[0].completed).toBe(false);
  });

  test('없는 id면 내용이 바뀌지 않는다', () => {
    expect(Logic.toggleTodo(sample(), 'zzz')).toEqual(sample());
  });

  test('원본 항목 객체를 변경하지 않는다', () => {
    const todos = sample();
    Logic.toggleTodo(todos, 'a');
    expect(todos[0].completed).toBe(false);
  });
});

describe('deleteTodo', () => {
  test('해당 항목을 제거한다', () => {
    const result = Logic.deleteTodo(sample(), 'b');
    expect(result.map((t) => t.id)).toEqual(['a', 'c']);
  });

  test('없는 id면 내용이 바뀌지 않는다', () => {
    expect(Logic.deleteTodo(sample(), 'zzz')).toEqual(sample());
  });
});

describe('editTodo', () => {
  test('텍스트를 공백 제거 후 바꾸고 완료 상태와 우선순위는 유지한다', () => {
    const result = Logic.editTodo(sample(), 'b', '  요가  ');
    expect(result[1]).toEqual({ id: 'b', text: '요가', completed: true, priority: 'medium' });
  });

  test('빈 텍스트로 수정하면 항목을 삭제한다', () => {
    const result = Logic.editTodo(sample(), 'a', '   ');
    expect(result.map((t) => t.id)).toEqual(['b', 'c']);
  });
});

describe('moveTodo', () => {
  test('같은 등급 안에서 앞으로 옮긴다', () => {
    const result = Logic.moveTodo(board(), 'm3', 'medium', 'm1');
    expect(order(result).medium).toEqual(['m3', 'm1', 'm2']);
  });

  test('같은 등급 안에서 뒤로 옮긴다', () => {
    const result = Logic.moveTodo(board(), 'm1', 'medium', 'm3');
    expect(order(result).medium).toEqual(['m2', 'm1', 'm3']);
  });

  test('beforeId가 null이면 그 등급의 맨 끝으로 옮긴다', () => {
    const result = Logic.moveTodo(board(), 'm1', 'medium', null);
    expect(order(result).medium).toEqual(['m2', 'm3', 'm1']);
  });

  test('다른 등급으로 옮기면 우선순위가 바뀌고 지정한 위치에 놓인다', () => {
    const result = Logic.moveTodo(board(), 'm2', 'high', 'h2');
    expect(order(result)).toEqual({ high: ['h1', 'm2', 'h2'], medium: ['m1', 'm3'], low: ['l1'] });
    expect(result.find((t) => t.id === 'm2')).toMatchObject({ priority: 'high', completed: true, text: 'M2' });
  });

  test('비어 있는 등급으로 옮길 수 있다', () => {
    const todos = board().filter((t) => t.priority !== 'low');
    const result = Logic.moveTodo(todos, 'h1', 'low', null);
    expect(order(result)).toEqual({ high: ['h2'], medium: ['m1', 'm2', 'm3'], low: ['h1'] });
  });

  test('필터로 숨겨진 항목이 있어도 다른 항목의 상대 순서는 유지된다', () => {
    // 진행 중 필터에서는 medium이 [m1, m3]로 보이고 m2(완료)는 숨겨져 있다.
    // 보이는 목록에서 m1을 m3 뒤(맨 끝)로 옮겨도 숨겨진 m2와 m3의 순서는 그대로다.
    const result = Logic.moveTodo(board(), 'm1', 'medium', null);
    expect(order(result).medium).toEqual(['m2', 'm3', 'm1']);
  });

  test('바뀌는 것이 없으면 원본 배열을 반환한다', () => {
    const todos = board();
    expect(Logic.moveTodo(todos, 'm1', 'medium', 'm2')).toBe(todos);
    expect(Logic.moveTodo(todos, 'm3', 'medium', null)).toBe(todos);
    expect(Logic.moveTodo(todos, 'm1', 'medium', 'm1')).toBe(todos);
  });

  test('잘못된 인자면 원본 배열을 반환한다', () => {
    const todos = board();
    expect(Logic.moveTodo(todos, 'zzz', 'high', null)).toBe(todos);
    expect(Logic.moveTodo(todos, 'm1', 'urgent', null)).toBe(todos);
    expect(Logic.moveTodo(todos, 'm1', 'high', 'zzz')).toBe(todos);
    expect(Logic.moveTodo(todos, 'm1', 'high', 'l1')).toBe(todos);
  });

  test('원본 배열과 항목을 변경하지 않는다', () => {
    const todos = board();
    Logic.moveTodo(todos, 'm1', 'high', 'h1');
    expect(todos).toEqual(board());
  });
});

describe('setPriority', () => {
  test('우선순위를 바꾸고 새 등급의 맨 끝으로 옮긴다', () => {
    const result = Logic.setPriority(board(), 'm1', 'high');
    expect(order(result)).toEqual({ high: ['h1', 'h2', 'm1'], medium: ['m2', 'm3'], low: ['l1'] });
  });

  test('같은 우선순위, 잘못된 값, 없는 id면 원본 배열을 반환한다', () => {
    const todos = board();
    expect(Logic.setPriority(todos, 'm1', 'medium')).toBe(todos);
    expect(Logic.setPriority(todos, 'm1', 'urgent')).toBe(todos);
    expect(Logic.setPriority(todos, 'zzz', 'high')).toBe(todos);
  });
});

describe('groupByPriority', () => {
  test('등급별로 순서를 유지하며 묶는다', () => {
    expect(order(board())).toEqual({ high: ['h1', 'h2'], medium: ['m1', 'm2', 'm3'], low: ['l1'] });
  });

  test('빈 목록이면 빈 배열 3개', () => {
    expect(Logic.groupByPriority([])).toEqual({ high: [], medium: [], low: [] });
  });
});

describe('clearCompleted', () => {
  test('완료된 항목만 제거한다', () => {
    expect(Logic.clearCompleted(sample()).map((t) => t.id)).toEqual(['a', 'c']);
  });

  test('완료된 항목이 없으면 그대로다', () => {
    expect(Logic.clearCompleted([])).toEqual([]);
  });
});

describe('filterTodos', () => {
  test.each([
    ['all', ['a', 'b', 'c']],
    ['active', ['a', 'c']],
    ['completed', ['b']],
    ['unknown', ['a', 'b', 'c']],
  ])('%s 필터', (filter, ids) => {
    expect(Logic.filterTodos(sample(), filter).map((t) => t.id)).toEqual(ids);
  });
});

describe('countActive', () => {
  test('미완료 항목 수를 센다', () => {
    expect(Logic.countActive(sample())).toBe(2);
    expect(Logic.countActive([])).toBe(0);
  });
});

describe('loadTodos / saveTodos', () => {
  test('저장한 목록을 다시 불러온다', () => {
    const storage = createStorage();
    expect(Logic.saveTodos(storage, board())).toBe(true);
    expect(storage.data[Logic.STORAGE_KEY]).toBe(JSON.stringify(board()));
    expect(Logic.loadTodos(storage)).toEqual(board());
  });

  test('우선순위가 없거나 잘못된 기존 데이터는 중간으로 채운다', () => {
    const raw = JSON.stringify([
      { id: 'a', text: '예전 항목', completed: false },
      { id: 'b', text: '이상한 값', completed: true, priority: 'urgent' },
    ]);
    expect(Logic.loadTodos(createStorage({ todos: raw }))).toEqual([
      { id: 'a', text: '예전 항목', completed: false, priority: 'medium' },
      { id: 'b', text: '이상한 값', completed: true, priority: 'medium' },
    ]);
  });

  test('저장된 값이 없으면 빈 배열', () => {
    expect(Logic.loadTodos(createStorage())).toEqual([]);
  });

  test('JSON이 깨졌으면 빈 배열', () => {
    expect(Logic.loadTodos(createStorage({ todos: '{not json' }))).toEqual([]);
  });

  test('배열이 아니면 빈 배열', () => {
    expect(Logic.loadTodos(createStorage({ todos: '{"a":1}' }))).toEqual([]);
  });

  test('형식이 잘못된 항목은 걸러낸다', () => {
    const raw = JSON.stringify([...sample(), { id: 'd' }, null, 'text']);
    expect(Logic.loadTodos(createStorage({ todos: raw }))).toEqual(sample());
  });

  test('storage 접근이 실패해도 예외를 던지지 않는다', () => {
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(Logic.loadTodos(broken)).toEqual([]);
    expect(Logic.saveTodos(broken, sample())).toBe(false);
  });
});
