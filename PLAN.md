# Todo List 앱 (HTML / CSS / JavaScript)

## Phase 1 — 기본 todo 앱 (완료)

### Context
빈 폴더 `/home/ubuntu/work/vibe/day13/todo`에 프레임워크 없이 HTML·CSS·JavaScript만으로 간단한 todo list 앱을 만든다. HTML, CSS, JS는 서로 다른 파일로 나눈다.
기능: 추가 · 완료 체크 · 삭제, localStorage 저장, 필터(전체/진행 중/완료)와 남은 개수, 완료 항목 일괄 삭제, 더블클릭 수정.
AGENTS.md 규칙: 코드를 바꾸면 유닛 테스트를 실행하고, `WORKFLOW.md`를 업데이트한다. 테스트는 Jest(+jsdom)로 한다(사용자 선택).

### 파일 구성
```
index.html        마크업만. style.css, todo.js, app.js를 <script defer>로 불러옴
style.css         스타일 (가운데 카드 레이아웃, 완료 항목 취소선, 모바일 대응)
todo.js           순수 로직 (DOM 없음) — 테스트하기 쉽게 분리
app.js            DOM 렌더링과 이벤트 처리, localStorage 연동
package.json      devDependencies: jest, jest-environment-jsdom / scripts.test = "jest"
tests/todo.test.js  로직 유닛 테스트
tests/app.test.js   jsdom 기반 DOM 동작 테스트
.gitignore        node_modules/
```
ES module 대신 일반 `<script>`를 쓴다. 그래서 `index.html`을 더블클릭해 `file://`로 열어도 동작한다. 브라우저와 Jest가 같은 파일을 쓸 수 있도록 각 JS 파일 끝에서 `typeof module !== 'undefined'`이면 `module.exports`로 내보내고, 브라우저에서는 전역(`window.TodoLogic`)으로 노출한다.

### todo.js (순수 함수, 상태를 바꾸지 않고 새 배열 반환)
- todo 형태: `{ id, text, completed }`
- `addTodo(todos, text)` — 앞뒤 공백 제거, 빈 문자열이면 원본 반환
- `toggleTodo(todos, id)`, `deleteTodo(todos, id)`
- `editTodo(todos, id, text)` — 빈 문자열이면 해당 항목 삭제
- `clearCompleted(todos)`
- `filterTodos(todos, filter)` — `'all' | 'active' | 'completed'`
- `countActive(todos)`
- `loadTodos(storage)` / `saveTodos(storage, todos)` — 키 `todos`. JSON이 깨졌으면 빈 배열 반환
- id: `Date.now()` + 카운터 (테스트에서 주입 가능하도록 `addTodo`에 선택적 id 인자)

### app.js
- `initApp(root = document, storage = window.localStorage)` — 상태(`todos`, `filter`)를 들고 `render()`
- 이벤트 위임: 목록 `ul`에 click(체크박스 토글, 삭제 버튼), dblclick(수정 모드 진입 → input 표시, Enter/blur 저장, Esc 취소)
- 폼 submit으로 추가, 필터 버튼, "완료 항목 지우기" 버튼(완료 항목이 없으면 숨김)
- 상태가 바뀔 때마다 `saveTodos` 후 `render()`
- 텍스트는 `textContent`로 넣어 XSS 방지
- 브라우저에서는 `DOMContentLoaded` 시 자동 실행, Jest에서는 export만 함

### index.html 구조
`<h1>` 제목, `<form id="new-todo-form">` + 입력창 + 추가 버튼, `<ul id="todo-list">`, footer(`#todo-count`, 필터 버튼 3개 `data-filter`, `#clear-completed`). `lang="ko"`, 접근성용 `aria-label`.

### 테스트
- `tests/todo.test.js`: 각 함수 정상/경계 케이스 (빈 입력, 공백, 없는 id, 깨진 JSON, 불변성)
- `tests/app.test.js` (`@jest-environment jsdom`): index.html 본문을 읽어 넣고 `initApp` 호출 → 추가, 토글, 삭제, 더블클릭 수정(Enter/Esc), 필터, 일괄 삭제, 남은 개수, localStorage 저장·복원 확인

### 마무리
- `WORKFLOW.md`에 2번 항목 추가 (프롬프트 원문 + 결과 요약)
- `AGENTS.md`의 테스트 규칙에 실행 명령(`npm test`)을 넣을지는 제안만 함 (요청 범위 규칙)

### Verification
1. `npm install` 후 `npm test` — 모든 테스트 통과, 통과 수를 보고
2. 브라우저에서 `index.html`을 열어 추가/체크/수정/삭제/필터/새로고침 후 유지 여부를 직접 확인 (사용자에게 안내)

## Phase 2 — 우선순위, 드래그 앤 드롭, 머티리얼 디자인 (완료)

### Context
Phase 1 앱에 우선순위(높음/중간/낮음)를 추가한다. 우선순위는 나중에 바꿀 수 있어야 한다. 드래그 앤 드롭으로 같은 등급 안의 순서를 바꾸고, 다른 등급으로 옮기면 그 등급으로 바뀐다. 인터페이스는 머티리얼 디자인(Material 3) 스타일의 반응형으로 바꾸고, 제목을 '오늘 할일'로 바꾼다.
제약은 Phase 1과 같다: HTML·CSS·JS 파일 분리, 프레임워크·빌드 없음, `file://`로 열어도 동작, Jest 테스트 통과.

### 데이터 모델 (`todo.js`)
- todo 형태: `{ id, text, completed, priority }`, `priority`는 `'high' | 'medium' | 'low'`
- 화면 순서는 배열 순서를 따른다. 등급별로 묶어 보여 주고, 같은 등급 안에서는 배열에 들어 있는 순서대로 보여 준다.
- 상수 `PRIORITIES = ['high', 'medium', 'low']`, `PRIORITY_LABELS = { high: '높음', medium: '중간', low: '낮음' }`
- 기존 데이터 호환: `loadTodos`에서 `priority`가 없거나 잘못된 항목은 `'medium'`으로 채운다(버리지 않는다).

### `todo.js` 함수 변경·추가 (순수 함수, 불변성 유지)
- `addTodo(todos, text, priority = 'medium', id)` — 잘못된 priority는 `'medium'`. 해당 등급의 맨 끝에 추가
- `setPriority(todos, id, priority)` — 등급을 바꾸고 새 등급의 맨 끝으로 이동. 같은 등급이거나 잘못된 값이면 원본 반환
- `moveTodo(todos, id, priority, beforeId = null)` — 드래그 앤 드롭용. `id` 항목을 `priority` 등급으로 바꾸고 `beforeId` 항목 바로 앞에 놓는다. `beforeId`가 `null`이면 그 등급의 맨 끝. 위치를 인덱스가 아닌 `beforeId`로 지정하므로, 필터 때문에 일부 항목이 숨겨져 있어도 순서가 꼬이지 않는다. 자기 자신 앞으로 옮기거나 없는 id면 원본 반환
- `groupByPriority(todos)` — `{ high: [...], medium: [...], low: [...] }`
- 기존 함수(`toggleTodo`, `deleteTodo`, `editTodo`, `clearCompleted`, `filterTodos`, `countActive`, `loadTodos`, `saveTodos`)는 유지

### 화면 구성 (`index.html`)
- `<title>`과 화면 제목을 모두 **'오늘 할일'**로 바꾼다.
- 상단 앱 바: 제목, 남은 할 일 개수
- 입력 영역(카드): outlined 텍스트 필드, 우선순위 선택(segmented button 3개: 높음/중간/낮음, 기본 중간), 추가 버튼(filled)
- 필터: filter chip 3개(전체/진행 중/완료), "완료 항목 지우기" text 버튼
- 목록: 등급별 섹션 3개(`<section data-priority="high|medium|low">`). 각 섹션에 등급 이름, 개수 배지, `<ul class="todo-list">`. 비어 있는 섹션도 드롭할 수 있도록 "여기로 끌어다 놓기" 안내 영역을 보여 준다.
- 각 항목: 드래그 핸들, 체크박스, 텍스트(더블클릭 수정은 그대로), 우선순위 변경 `<select>`(chip 모양), 삭제 아이콘 버튼
- 아이콘은 인라인 SVG를 쓴다. 외부 아이콘 폰트에 의존하지 않으므로 오프라인·`file://`에서도 깨지지 않는다. 글꼴은 시스템 글꼴을 쓰고 `Roboto`, `Noto Sans KR`이 있으면 사용한다.

### 우선순위 변경
- 추가할 때: segmented button으로 선택
- 나중에 바꿀 때: 각 항목의 우선순위 `<select>` 변경 → `setPriority`. 모바일에서는 기본 선택 UI가 떠서 쓰기 편하다.
- 드래그 앤 드롭으로 다른 등급 섹션에 놓을 때 → `moveTodo`가 등급까지 바꾼다.

### 드래그 앤 드롭 (`app.js`)
- HTML5 Drag and Drop API는 모바일 터치에서 동작하지 않는다. 그래서 **Pointer Events**(`pointerdown/move/up/cancel`)로 직접 구현해 마우스와 터치 모두 지원한다.
- 드래그 핸들에서만 시작하고, 핸들에 `touch-action: none`을 준다. 그래서 목록 스크롤과 충돌하지 않는다.
- 드래그 중에는 항목을 반투명하게 띄워(elevation) 포인터를 따라가게 한다. 드롭 위치는 `document.elementFromPoint`로 찾은 섹션과 항목의 위/아래 절반으로 계산하고, 그 자리에 삽입 표시선(placeholder)을 보여 준다.
- 화면 가장자리 근처에서는 자동 스크롤한다.
- 놓으면 `moveTodo(todos, id, 섹션 priority, beforeId)` → 저장 → 다시 그림. Esc나 `pointercancel`이면 취소한다.
- 키보드 접근성: 핸들에 포커스를 둔 상태에서 `Alt+↑/↓`로 한 칸 이동한다. 등급 경계를 넘으면 인접 등급으로 이동한다(같은 `moveTodo` 사용).
- 수정 모드인 항목은 드래그하지 않는다.

### 머티리얼 디자인 + 반응형 (`style.css`)
- Material 3 색상 체계를 CSS 변수로 정의한다(`--md-primary`, `--md-surface`, `--md-on-surface`, `--md-outline` 등). `prefers-color-scheme: dark`면 다크 테마를 쓴다.
- 우선순위 색: 높음=error 계열(빨강), 중간=tertiary(주황/노랑), 낮음=secondary(초록/청록). 섹션 헤더, 항목 왼쪽 강조선, chip에 사용한다.
- 카드 elevation(그림자), 둥근 모서리(12–16px), 상태 레이어(hover/focus/pressed 오버레이), 버튼 ripple(CSS만으로 간단히), 포커스 링을 적용한다.
- 반응형 브레이크포인트(Material window size class 기준):
  - Compact(< 600px): 한 열. 섹션을 위아래로 쌓고, 입력 영역은 텍스트 필드 아래에 우선순위 선택과 추가 버튼을 줄바꿈해서 놓는다. 터치 영역은 최소 48px.
  - Medium(600–839px): 한 열, 최대 폭 720px.
  - Expanded(≥ 840px): 세 등급 섹션을 **가로 3열(칸반형)**으로 놓는다. 등급 간 드래그가 직관적이다.
- `prefers-reduced-motion`이면 애니메이션을 줄인다.

### 테스트
- `tests/todo.test.js`에 추가:
  - `addTodo`의 priority 기본값과 잘못된 값 처리
  - `setPriority`
  - `moveTodo`: 같은 등급 안에서 앞/뒤 이동, 다른 등급으로 이동하며 등급 변경, `beforeId=null`이면 맨 끝, 숨겨진 항목이 있어도 순서 유지, 없는 id
  - `groupByPriority`
  - `loadTodos`가 priority 없는 기존 데이터를 `'medium'`으로 채우는지
- `tests/app.test.js`에서 바뀐 마크업에 맞게 기존 테스트를 수정하고 다음을 추가:
  - 제목이 '오늘 할일'인지
  - 선택한 우선순위로 추가되어 해당 섹션에 표시되는지
  - `<select>`로 우선순위를 바꾸면 섹션이 옮겨지는지
  - 포인터 이벤트로 드래그해 같은 등급 안에서 순서가 바뀌는지, 다른 등급으로 옮기면 등급이 바뀌는지, Esc로 취소되는지(jsdom에는 레이아웃이 없으므로 `document.elementFromPoint`와 `getBoundingClientRect`를 mock한다)
  - `Alt+↑/↓` 키보드 이동
  - 필터와 등급 표시가 함께 동작하는지

### 문서
- `README.md`의 기능 목록과 사용법에 우선순위와 드래그 앤 드롭 내용을 추가한다.
- `WORKFLOW.md`에 작업 항목을 추가한다.

### Verification
1. `npm test` — 기존 테스트와 새 테스트가 모두 통과, 통과 수를 보고
2. jsdom에서 브라우저처럼 스크립트를 불러와 동작하는지 확인
3. 사용자 확인 안내: 브라우저에서 `index.html`을 열어 데스크톱(3열)과 모바일 폭(개발자 도구 기기 모드, 터치 드래그)에서 우선순위 추가·변경, 등급 안/등급 간 드래그, 새로고침 후 유지를 확인한다.
