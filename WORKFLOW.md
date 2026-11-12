# WORKFLOW

---

## 1. 프롬프트

```
@/home/ubuntu/work/vibe/day12/tetris 에서 AGENTS.md와 CLAUDE.md를 이 폴더에 복사해줘. AGENTS.md에서 특정 프로젝트와 관계있는 부분은 제거해줘. 내가 만들 어플리케이션은 todo 앱이야.
```

### 결과
- `day12/tetris`의 `CLAUDE.md`(`@AGENTS.md` 참조)를 그대로 복사함.
- `AGENTS.md`를 복사하면서 tetris 프로젝트 전용 내용을 제거함.
  - 테스트 규칙에서 프론트엔드(Jest, `frontend/`에서 `npm test`)·백엔드(pytest, `scripts/test-backend.sh`, Docker/MySQL) 실행 명령과 관련 문구를 삭제하고, "프로젝트의 유닛 테스트를 모두 실행"하는 일반 규칙으로 바꿈.
  - 코드 파일 예시(`*.js`, `*.html`, `*.css`, `*.py`)를 "소스 파일"로 일반화함.
  - 언어, 요청 범위, Git, 작업 기록 규칙은 그대로 유지함.
- `WORKFLOW.md`를 새로 만들고 이 항목을 기록함.

---

## 2. 프롬프트

```
HTML, css, javascript만 사용해서 간단한 todo list 앱을 만들고 싶어. HTML, css, javascript는 별개의 파일로 분리해줘.
```

### 결과
- plan 모드에서 구현 계획만 세움 (코드는 아직 작성하지 않음).
- 사용자 선택: 기본 기능(추가·완료 체크·삭제) + localStorage 저장, 필터(전체/진행 중/완료), 완료 항목 일괄 삭제, 더블클릭 수정. 테스트는 Jest(+jsdom).
- 파일 구성 계획: `index.html`, `style.css`, `todo.js`(순수 로직), `app.js`(DOM·이벤트), `package.json`, `tests/todo.test.js`, `tests/app.test.js`, `.gitignore`.
- `file://`로 열어도 동작하도록 ES module 대신 일반 `<script>`를 쓰고, Jest용으로 `module.exports`를 함께 두기로 함.

---

## 3. 프롬프트

```
현재의 계획을 PLAN.md로 저장해줘
```

### 결과
- 2번에서 세운 구현 계획을 프로젝트 루트의 `PLAN.md`로 저장함.

---

## 4. 프롬프트

```
PLAN.md를 확인했으니 계획대로 구현해줘
```

### 결과
- `PLAN.md`대로 todo list 앱을 구현함.
  - `index.html`: 마크업 (입력 폼, 목록, 남은 개수, 필터 버튼, 완료 항목 지우기 버튼)
  - `style.css`: 카드 레이아웃, 완료 항목 취소선, 모바일 대응
  - `todo.js`: 순수 로직 (`addTodo`, `toggleTodo`, `deleteTodo`, `editTodo`, `clearCompleted`, `filterTodos`, `countActive`, `loadTodos`, `saveTodos`). 깨진 JSON·잘못된 항목·storage 오류를 안전하게 처리
  - `app.js`: `initApp(root, storage)`로 렌더링과 이벤트 위임 처리 (체크, 삭제, 더블클릭 수정 Enter/Esc/blur, 필터, 일괄 삭제, localStorage 저장)
- 일반 `<script defer>`로 불러오므로 `index.html`을 `file://`로 바로 열 수 있음. Jest에서는 `module.exports`로 불러옴.
- `package.json`(`npm test` = `jest`), `.gitignore`(`node_modules/`, `coverage/`) 추가. devDependencies로 `jest`, `jest-environment-jsdom` 설치.
- 테스트: `tests/todo.test.js`(로직), `tests/app.test.js`(jsdom DOM 동작). `npm test` 결과 2개 스위트, 39개 테스트 모두 통과.

---

## 5. 프롬프트

```
README.md에 이 어플리케이션의 구동방법을 정리해서 적어줘
```

### 결과
- `README.md`를 새로 작성함: 앱 소개, 기능 목록, 실행 방법(`index.html` 바로 열기 / `python3 -m http.server`·`npx serve` 정적 서버), 테스트 실행 방법(`npm install`, `npm test`), 파일 구성.
- 문서만 추가했으므로 코드 변경은 없고 테스트는 실행하지 않음.

---

## 6. 프롬프트

```
우선 순위(높음/중간/낮음)을 설정할 수 있는 기능을 추가해줘. 우선 순위는 나중에도 변경할 수 있어야 하고 같은 등급의 우선순위를 변경할 수 있도록 드래그앤 드롭 기능도 넣어줘. 드래그앤드롭을 등급을 넘어서 이동하면 등급이 바뀌게 해줘. 머티리얼 디자인으로, 반응형으로 인터페이스를 바꿔줘. 페이지 타이틀의 타이틀을 '오늘 할일'로 바꿔줘. 이 내용을 Phase 2로 하여 PLAN.md를 수정해줘,
```

### 결과
- `PLAN.md`를 수정함 (코드는 아직 변경하지 않음).
  - 기존 계획을 "Phase 1 — 기본 todo 앱 (완료)" 아래로 옮김.
  - "Phase 2 — 우선순위, 드래그 앤 드롭, 머티리얼 디자인"을 추가함.
- Phase 2 주요 결정:
  - todo에 `priority`(`high`/`medium`/`low`, 기본 `medium`)를 추가하고, 기존 저장 데이터는 `medium`으로 채움.
  - `setPriority`, `moveTodo(todos, id, priority, beforeId)`, `groupByPriority`를 추가함. 위치를 `beforeId`로 지정해 필터로 숨겨진 항목이 있어도 순서를 유지함.
  - 모바일 터치를 지원하려고 HTML5 DnD 대신 Pointer Events로 드래그를 구현함. 키보드 `Alt+↑/↓` 이동도 지원함.
  - Material 3 색상 변수와 다크 모드를 적용함. 반응형은 compact/medium 1열, expanded(≥840px)는 등급별 3열로 함. 아이콘은 인라인 SVG를 씀.
  - `<title>`과 화면 제목을 모두 '오늘 할일'로 바꿈.

---

## 7. 프롬프트

```
PLAN.md의 Phase 2대로 구현해줘
```

### 결과
- `PLAN.md` Phase 2를 구현함.
  - `todo.js`: todo에 `priority`(`high`/`medium`/`low`)를 추가함. `addTodo(todos, text, priority, id)`로 시그니처를 바꾸고 `moveTodo`, `setPriority`, `groupByPriority`, `PRIORITIES`/`PRIORITY_LABELS`/`DEFAULT_PRIORITY`를 추가함. `loadTodos`는 priority가 없는 기존 데이터를 `medium`으로 채움. `moveTodo`는 등급과 그 등급 안의 순서가 그대로면 원본 배열을 반환함.
  - `index.html`: 제목(`<title>`, `h1`)을 '오늘 할일'로 바꿈. top app bar, outlined 텍스트 필드, 우선순위 segmented button(라디오), filter chip, 등급별 섹션 3개(빈 섹션 드롭 안내 포함)를 구성함.
  - `app.js`: 등급별 렌더링, 항목별 우선순위 `<select>`를 추가함. Pointer Events로 드래그 앤 드롭을 구현함(고스트, 자리 표시, `elementFromPoint`로 드롭 위치 계산, 섹션 헤더에 놓으면 맨 앞, 자동 스크롤, Esc/`pointercancel` 취소). `Alt+↑/↓` 키보드 이동도 추가함. 아이콘은 인라인 SVG를 씀.
  - `style.css`: Material 3 색상 토큰, 다크 모드, elevation, 상태 레이어와 ripple, 우선순위 색을 적용함. 반응형은 compact(<600px, 터치 영역 48px), expanded(≥840px, 3열)로 나눔. `prefers-reduced-motion`도 지원함.
- 테스트: `tests/todo.test.js`(우선순위·이동·마이그레이션 추가)와 `tests/app.test.js`(마크업 변경 반영, 제목·select 변경·드래그·키보드 이동·필터 테스트 추가)를 수정함. `npm test` 결과 2개 스위트, 78개 테스트 모두 통과함.
  - 기존 테스트 변경 이유: `addTodo`의 세 번째 인자가 id에서 priority로 바뀌었고, 마크업이 `#todo-list` 하나에서 등급별 목록 3개로 바뀌었음.
- jsdom에서 일반 `<script>`로 불러와 동작함을 확인함. 실제 브라우저가 설치되어 있지 않아 브라우저 화면 확인은 하지 않음.
- `README.md`의 기능·화면 배치·파일 설명을 갱신하고, `PLAN.md` Phase 2를 완료로 표시함.

---

## 8. 프롬프트

```
이 어플리케이션을 github pages에 배포할 거야. 배포방법을 정리해서 DEPLOY.md에 저장해줘. 나의 github id는 weable72이고 repo는 todo를 쓸거야. git은 ssh 인증을 쓰는 걸로 해줘.
```

### 결과
- `DEPLOY.md`를 새로 작성함. 대상은 계정 `weable72`, 저장소 `todo`, 원격 `git@github.com:weable72/todo.git`, 배포 주소 `https://weable72.github.io/todo/`.
  - 내용: SSH 키 생성·등록·연결 확인, Public 저장소 생성(웹 / `gh repo create`), `git init -b main`부터 push까지, Pages 설정(Deploy from a branch, `main` `/ (root)`), 재배포 방법(merge 규칙 포함).
  - 선택 사항으로 GitHub Actions 워크플로 예시를 넣음. `npm test`를 통과해야 배포되고, 앱 파일 4개만 배포함.
  - 참고 사항(localStorage 저장 범위와 같은 도메인 공유, 캐시)과 문제 해결 표를 넣음.
- 문서만 작성함. git 초기화, 원격 저장소 생성, push, workflow 파일 추가는 하지 않음. 코드 변경이 없어 테스트는 실행하지 않음.

---

## 9. 프롬프트

```
이 어플리케이션의 데이터 저장을 supabase로 변경하려고 해. supabase에 아직 가입하지 않은 상태인데, supabase 프로젝트 구성을 어떻게 할지 정리해서 SUPABASE.md로 저장해줘. 테이블 구조도 제안해줘.
```

### 결과
- `SUPABASE.md`를 새로 작성함 (코드는 변경하지 않음).
  - 가입과 프로젝트 생성: GitHub로 가입, Free 플랜, 이름 `todo`, Seoul 리전. Project URL과 publishable/anon 키 확인 방법을 적고, secret/service_role 키는 노출하지 말라고 경고함.
  - 인증: 정적 사이트라 공개 키만 쓰므로 Supabase Auth + GitHub OAuth와 RLS를 권장함. OAuth App 콜백, Site URL·Redirect URL 설정, `file://`에서는 로그인이 안 된다는 점을 적음. 익명 로그인은 대안으로만 언급함.
  - 테이블 제안: `public.todos`(`id uuid`, `user_id`, `text`, `completed`, `priority` text+CHECK, `position double precision`, `created_at`, `updated_at`)와 `(user_id, priority, position)` 인덱스.
  - SQL: 테이블, `updated_at`·`position` 트리거, 본인 행만 허용하는 RLS 정책 4개, 드래그 이동용 `move_todo(p_id, p_priority, p_before_id)` 함수(중간값 위치, 간격이 좁으면 그룹 번호를 다시 매김, `security invoker`).
  - 앱 변경 계획: CDN `supabase-js`(버전 고정), `config.js`, 저장소 계층 분리, 낙관적 업데이트, 로그인 UI, localStorage 데이터 가져오기, 선택 Realtime, Jest에서는 가짜 저장소 사용.
- 코드 변경이 없어 테스트는 실행하지 않음.

---

## 10. 프롬프트

```
SUPABASE 로그인은 이메일만 사용하는 걸로 문서를 수정해줘
```

### 결과
- `SUPABASE.md`의 로그인 방식을 GitHub OAuth에서 **이메일 + 비밀번호만**으로 바꿈.
  - 요약 표의 로그인 항목을 수정함.
  - Supabase 대시보드 가입도 이메일 가입으로 바꿈.
  - 2장을 다시 씀:
    - Email provider 설정(Confirm email 켬, 비밀번호 최소 8자, 다른 provider와 익명 로그인 끔, 혼자 쓸 경우 계정 생성 후 신규 가입 막기)
    - 리다이렉트 주소
    - 기본 SMTP 제한(팀원 주소로만, 적은 발송량)과 Custom SMTP 안내
    - 한국어 메일 템플릿(선택)
    - 회원가입·로그인·비밀번호 재설정·로그아웃 흐름표
  - 매직 링크·OTP는 발송 제한 때문에 쓰지 않기로 함. GitHub OAuth App 설정과 익명 로그인 대안은 삭제함.
  - 5장 로그인 UI를 이메일·비밀번호 카드로 바꿈. 6장 공유 금지 항목의 GitHub Client Secret을 SMTP 비밀번호로 바꿈. 7장 참고 문서 링크를 바꿈.
- 코드 변경이 없어 테스트는 실행하지 않음.

---

## 11. 프롬프트

```
지금까지의 내용을 공용 repo인 /home/ubuntu/work/kosa-ict-genai-2026-hyundai/src/exercise/bardroh 밑에 복사하고 commit & push해줘
```

### 결과
- 기존 폴더 구성(`bardroh/day12/tetris`)에 맞춰 `src/exercise/bardroh/day13/todo`로 복사함. `node_modules/`는 제외함.
- 공용 repo(`weable-kosa/kosa-ict-genai-2026-hyundai`)의 `main`에 commit하고 push함. 기존 커밋 메시지 형식(`[dayNN] bardroh: ...`)을 따름.

---

## 12. 프롬프트

```
cofig.js에 URL과 key를 넣었으니 이제 소스를 수정해서 supabse로 로그인하고 데이터를 저장할 수 있게 해줘
```

### 결과
- 사전 확인: 사용자의 Supabase 프로젝트에 `todos` 테이블, RLS(비로그인 select는 빈 결과), `move_todo` 함수(anon 실행 거부)가 있음을 확인함. Auth는 email provider만 켜져 있음. 이메일 인증(Confirm email)은 꺼져 있음(autoconfirm).
- `config.js`: 사용자가 넣은 값은 그대로 두고 `window.SUPABASE_URL` / `window.SUPABASE_PUBLISHABLE_KEY` 형식으로 명시함.
- `index.html`:
  - `supabase-js@2.118.0` UMD를 jsdelivr에서 불러옴. 버전을 고정하고 SRI(sha384)를 붙임.
  - `config.js`, `store.js`를 추가함.
  - 로그인/회원가입 카드, 비밀번호 재설정 카드, 사용자 메뉴(이메일, 로그아웃), 진행 표시줄, 예전 데이터 가져오기 배너, snackbar, 오류 표시를 추가함.
- `store.js`(신규): Supabase 저장소 계층.
  - 인증: `signIn`, `signUp`, `signOut`, `sendPasswordReset`, `updatePassword`, `onAuthChange`(콜백을 다음 틱으로 미뤄 supabase-js 교착 방지)
  - 할 일: `list`(position 순), `add`, `addMany`, `setCompleted`, `setText`, `remove`, `removeCompleted`, `move`(`move_todo` RPC)
  - Supabase 오류 코드를 한국어 메시지로 바꾸는 `toKoreanMessage`와 `StoreError`
- `app.js`:
  - `initApp({ root, store, storage, redirectTo })`로 바꿈.
  - 인증 상태에 따라 로그인/재설정/할 일 화면을 전환함. 회원가입은 이메일 인증 유무 모두 처리함. 입력 검사(이메일 형식, 8자 이상, 비밀번호 확인)를 함.
  - 낙관적 업데이트를 하고, 서버 요청은 큐로 순서대로 보냄. 실패하면 snackbar로 알리고 서버 목록을 다시 불러옴. 첫 목록 불러오기도 큐를 거침.
  - 다시 그릴 때 수정 중인 입력 내용을 유지함.
  - `localStorage`의 예전 할 일을 가져오거나 버릴 수 있음.
  - 브라우저 시작 시 `supabase-js`·config가 없으면 오류를 표시함.
- `style.css`: 로그인 카드, 탭, 진행 표시줄, 배너, snackbar, 사용자 메뉴 스타일과 모바일 대응을 추가함.
- 테스트:
  - `tests/fakeSupabase.js`(신규): 메모리 기반 가짜 클라이언트. RLS, position 트리거, `move_todo`, 인증 이벤트, 실패 주입을 흉내 냄.
  - `tests/store.test.js`(신규)를 추가함.
  - `tests/app.test.js`를 로그인과 서버 저장 기준으로 다시 작성함. 기존 테스트를 바꾼 이유는 저장소가 localStorage에서 Supabase로, `initApp` 인자가 객체로 바뀌었고, 로그인해야 할 일 화면이 보이기 때문임.
  - `npm test` 결과 3개 스위트, 109개 테스트 모두 통과함. 서버 이동 호출을 일부러 끊으면 9개가 실패하는 것도 확인함.
- jsdom에서 실제 `supabase-js` 번들로 부팅해 로그인 화면이 정상 표시됨을 확인함(실제 가입·로그인은 하지 않음).
- 문서:
  - `README.md`: Supabase 준비, 실행 방법(인터넷 필요, 메일 링크는 http 주소), 파일 구성을 갱신함.
  - `DEPLOY.md`: Actions 배포 파일 목록에 `config.js`, `store.js`를 추가하고 저장 데이터 설명을 Supabase 기준으로 바꿈.

---

## 13. 프롬프트

```
아직 github pages에는 배포하지 않았는데 로컬에서 테스트해볼 수 있나?
```

### 결과
- 로컬 테스트 방법을 안내함 (파일 변경 없음).
  - `python3 -m http.server 8000`으로 띄운 뒤 `http://localhost:8000`에 접속함. WSL2에서는 Windows 브라우저로 접속할 수 있음.
  - 현재 Confirm email이 꺼져 있어 가입하면 바로 로그인되므로, 메일 없이 가입·로그인·할 일 저장을 확인할 수 있음.
  - 비밀번호 재설정 메일을 확인하려면 Supabase Redirect URLs에 `http://localhost:8000/**`를 추가해야 함. 기본 SMTP는 팀원 이메일로만 메일을 보냄.
  - 확인할 항목: 가입·로그인, 추가·체크·수정·삭제, 우선순위 변경, 드래그, 새로고침 후 유지, 다른 브라우저에서 같은 계정으로 로그인, Supabase Table Editor에서 행 확인.

---

## 14. 프롬프트

```
백엔드는 확인했고 이제 github pages에 프론트엔드를 배포해서 양쪽 모두 public하게 접속하게 하고 싶어. github 계정은 weable72이고 repo는 todo로 할거야. github local repo는 ~/work/todo로 하려고 하니 GITHUB_PAGES.md를 이에 맞춰 수정해줘. 네가 정리해주는 프로세스대로 작업할거야. 필요한 링크도 문서에 걸어줘.
```

### 결과
- 이 폴더에는 `GITHUB_PAGES.md`가 없고 배포 문서는 `DEPLOY.md`였음. 그래서 `GITHUB_PAGES.md`를 새로 작성하고 `DEPLOY.md`는 삭제함(내용은 새 문서로 옮기고 갱신함). `README.md`의 참조를 `GITHUB_PAGES.md`로 바꿈.
- `GITHUB_PAGES.md` 구성:
  - 계정 `weable72`, 저장소 `weable72/todo`, SSH 원격, 로컬 저장소 `~/work/todo`, 배포 주소 `https://weable72.github.io/todo/`
  - 배포 방식을 GitHub Actions로 정함. `npm test`를 통과해야 배포되고, 앱 파일 6개(`index.html`, `style.css`, `config.js`, `todo.js`, `store.js`, `app.js`)만 Pages에 올림.
  - 단계: SSH 확인 → 저장소 생성 → Pages Source를 GitHub Actions로 설정(push 전) → `rsync`로 `~/work/todo` 생성, `config.js`에 secret 키가 없는지 검사, `npm ci && npm test` → 워크플로 생성 명령 → 첫 commit·push → Supabase URL Configuration(Site URL, Redirect URLs) → 공개 운영 점검표 → 접속 확인 → 재배포(merge 규칙 포함) → 문제 해결
  - 액션 최신 메이저 버전을 확인해 사용함: checkout@v7, setup-node@v7(Node 24), configure-pages@v6, upload-pages-artifact@v5, deploy-pages@v5.
  - GitHub 설정·Actions 페이지, Supabase 대시보드 각 설정 화면, 공식 문서 링크를 넣음.
- 코드 변경이 없어 테스트는 실행하지 않음.

---

## 15. 프롬프트

```
github action을 안쓰는 방법(branch 배포)로 바꿔줘
```

### 결과
- `GITHUB_PAGES.md`를 GitHub Actions 배포에서 **브랜치 배포**(Deploy from a branch, `main` / `(root)`)로 바꿈.
  - 워크플로 파일 생성 단계와 push 전 "Source = GitHub Actions" 설정 단계를 지움. 대신 push 뒤에 "5. GitHub Pages 켜기(브랜치 배포)"를 추가하고 단계 번호를 1~10으로 다시 매김.
  - 브랜치 배포에서 알아 둘 점을 적음: 테스트가 자동으로 돌지 않으므로 push 전에 `npm test`를 실행함. 저장소의 파일이 모두 공개 주소로 올라감(`*.md`, `tests/` 포함).
  - 루트에 `.nojekyll`을 만드는 단계를 추가함. `SUPABASE.md`의 `{{ .ConfirmationURL }}` 같은 Liquid 문법 때문에 Jekyll 빌드가 실패하는 것을 막고 배포를 빠르게 하기 위함.
  - Actions 탭의 `pages build and deployment`는 GitHub가 자동으로 실행한다고 설명함. 재배포용 빈 커밋 방법을 넣음.
  - 문제 해결 표를 브랜치 배포 기준으로 바꿈(404, Jekyll 오류, Branch 선택 불가). 참고 링크를 바꿈.
- 코드 변경이 없어 테스트는 실행하지 않음.

---

## 16. 프롬프트

```
todo repo가 만들어졌으니 GITHUB_PAGES.md의 4번까지 네가 진행해줘. 5번의 배포는 내가 할께.
```

### 결과
- `GITHUB_PAGES.md` 1~4단계를 진행함. 5단계(Pages 켜기)는 사용자가 진행함.
  - 1단계: `ssh -T git@github.com`이 `weable72`로 인증됨을 확인함.
  - 2단계: `weable72/todo` 원격 저장소가 있고 비어 있음을 확인함.
  - 3단계: `rsync`로 `~/work/todo`를 만듦(`node_modules`, `coverage` 제외). `config.js`에 secret/service_role 키가 없음을 확인하고 `.nojekyll`을 만듦. `npm ci && npm test`를 실행함.
  - 4단계: `git init -b main`, 첫 commit, `origin`(`git@github.com:weable72/todo.git`) 추가, `git push -u origin main`.

---

## 17. 프롬프트

```
배포는 완료되었으니 작업한 내용을 공용 repo에 복사하고 동일하게 commit & push해줘. commit log에 github pages URI를 포함시켜줘.
```

### 결과
- 배포 주소 https://weable72.github.io/todo/ 가 HTTP 200으로 응답함(제목 "오늘 할일")을 확인함.
- `~/work/todo`의 내용을 공용 repo `src/exercise/bardroh/day13/todo`로 동기화함(`.git`, `node_modules`, `coverage` 제외).
  - 이 폴더 안에서만 지운 파일을 반영함: `DEPLOY.md`를 삭제함(`GITHUB_PAGES.md`로 대체).
  - 추가된 파일: `.nojekyll`, `GITHUB_PAGES.md`, `config.js`, `store.js`, `tests/fakeSupabase.js`, `tests/store.test.js`
- 기존 형식(`[day13] bardroh: ...`)으로 commit하고 GitHub Pages 주소를 commit 메시지에 넣음. 공용 repo `main`에 push함.
- `~/work/todo`(weable72/todo)에 생긴 이 `WORKFLOW.md` 변경은 commit·push하지 않음.

---

## 18. 프롬프트

```
google의 oauth 인증을 추가하고 싶은데 어떻게 해야 하는지 정리해서 GOOGLE_OAUTH.md로 저장해줘.
```

### 결과
- `GOOGLE_OAUTH.md`를 새로 작성함 (코드는 변경하지 않음). 작업 폴더 `~/work/todo`에 쓰고 개발 폴더 `~/work/vibe/day13/todo`에도 같은 파일을 복사함.
  - 동작 흐름: `signInWithOAuth` → Google → Supabase 콜백(`https://dffjixdhzzlbykvbrzyz.supabase.co/auth/v1/callback`) → 앱. Client Secret은 Supabase에만 넣음. 같은 이메일 계정은 자동으로 연결됨.
  - Google Cloud: 프로젝트 생성, Google Auth Platform(Branding·승인된 도메인, Audience External·테스트 사용자, 기본 스코프 3개, 게시와 브랜드 확인), 웹 OAuth 클라이언트(JS 원본 2개, 리디렉션 URI는 Supabase 콜백).
  - Supabase: Google provider 켜기, URL Configuration 확인. Confirm email이 꺼진 상태의 계정 연결 위험과 권장 설정을 적음.
  - 앱 코드 변경 계획: 버튼(브랜딩 가이드), `store.signInWithGoogle`(`prompt: select_account`), 돌아온 주소의 `#error` 처리, 스타일, 가짜 클라이언트와 테스트, 문서 갱신(`SUPABASE.md`의 "이메일만" 결정 변경).
  - 확인 순서, 문제 해결 표(`redirect_uri_mismatch`, 테스트 사용자, Site URL, Secret 오류 등), 참고 링크.
- 코드 변경이 없어 테스트는 실행하지 않음. commit·push하지 않음.

---

## 19. 프롬프트

```
google oauth 설정이 끝나서 얻은 client_id와 client_secret을 supabase에 주었고 설정도 마쳤어. 이제 소스를 수정해줘.
```

### 결과
- 사전 확인: Supabase Auth 설정에서 provider `google`, `email`이 켜져 있음을 확인함. `/auth/v1/authorize?provider=google`이 Google로 302 리디렉션되고, `redirect_uri`가 Supabase 콜백인 것도 확인함.
- 작업 폴더 `~/work/todo`에서 수정함:
  - `index.html`: 로그인 카드에 "Google로 계속하기" 버튼(공식 4색 G 로고)과 "또는 이메일로" 구분선을 추가함.
  - `store.js`:
    - `signInWithGoogle(redirectTo)`를 추가함(`provider: 'google'`, `queryParams.prompt = 'select_account'`).
    - 돌아온 주소의 OAuth 오류를 처리하는 `oauthErrorFromUrl`·`stripOAuthError`를 추가함. `?error=`와 `#error=`를 모두 지원함.
    - `provider_disabled` 메시지를 추가함. `validation_failed` 코드는 메시지로 원인을 알 수 있으면 더 구체적인 문장을 쓰도록 바꿈.
  - `app.js`:
    - Google 버튼을 처리함(이동하는 동안 비활성화와 진행 표시, 실패 시 한국어 오류).
    - 시작할 때 주소의 OAuth 오류를 읽어 로그인 카드에 한 번 보여 주고 주소에서 지움. 로그인 성공 토큰(`#access_token`)이 있는 주소는 건드리지 않음.
    - `pageshow`일 때 버튼을 다시 활성화함.
  - `style.css`: `.btn--outlined`, `.google-logo`, `.auth-divider` 스타일을 추가함.
- 테스트:
  - `tests/fakeSupabase.js`에 `signInWithOAuth`와 `simulateOAuthSignIn`(같은 이메일이면 같은 사용자에 연결)을 추가함.
  - `tests/store.test.js`에 Google 로그인과 OAuth 오류 처리 테스트를 추가함.
  - `tests/app.test.js`에 버튼, 호출 인자, 로그인 후 화면, 같은 이메일 계정 연결, 실패 오류, 돌아온 주소의 오류 안내와 주소 정리, 성공 토큰 주소 유지 테스트를 추가함.
  - `npm test` 결과 3개 스위트, 129개 테스트 모두 통과함. 오류 안내 코드를 일부러 지우면 3개가 실패하는 것도 확인함.
- 실제 `supabase-js` 번들로 확인함: 페이지가 정상 부팅되고 Google 버튼이 표시됨. `signInWithOAuth`가 만든 주소가 Supabase → `accounts.google.com`(`prompt=select_account`)으로 이어짐. Google 계정 로그인 자체는 사용자가 브라우저에서 확인해야 함.
- 문서:
  - `README.md` 기능 목록에 Google 로그인을 추가하고, `file://`에서는 안 된다는 점을 적음.
  - `SUPABASE.md`의 "이메일만" 결정을 "이메일 + Google"로 바꿈.
  - `GOOGLE_OAUTH.md` 5장을 "구현 완료"로 바꿈.
- 개발 폴더 `~/work/vibe/day13/todo`에도 같은 내용을 동기화함. commit·push하지 않음.

---

## 20. 프롬프트

```
로컬에서 확인했으니 github pages용의 repo에 sync하고 배포해줘
```

### 결과
- 작업 폴더 `~/work/todo`가 GitHub Pages용 저장소(`weable72/todo`)이고, 개발 폴더와 내용이 같음을 확인함.
- push 전에 확인함: 원격에 새 커밋 없음, `npm test` 3개 스위트 129개 통과, 변경 파일에 secret 키(`sb_secret_`, Google `GOCSPX-`) 없음.
- Google 로그인 변경분을 commit하고 `main`에 push함. 브랜치 배포라서 push하면 GitHub Pages가 자동으로 배포함.
