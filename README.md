# 오늘 할일

HTML, CSS, JavaScript만으로 만든 할 일 목록 앱입니다. 빌드 과정 없이 브라우저에서 실행되고, 데이터는 [Supabase](https://supabase.com)에 저장되어 로그인하면 어느 기기에서나 같은 목록을 볼 수 있습니다. 머티리얼 디자인(Material 3) 스타일이며 휴대폰부터 데스크톱까지 반응형으로 동작하고, 시스템 설정에 따라 다크 모드로 바뀝니다.

## 기능

- 이메일 + 비밀번호 로그인 / 회원가입 / 비밀번호 재설정 (Supabase Auth). 내 할 일만 보이고 바꿀 수 있음 (RLS)
- 할 일 추가, 완료 체크, 삭제
- 우선순위(높음/중간/낮음): 추가할 때 고르고, 나중에 각 항목의 우선순위 선택 상자로 바꿀 수 있음
- 드래그 앤 드롭: 항목 왼쪽 손잡이(⋮⋮)를 끌어 같은 등급 안의 순서를 바꾸고, 다른 등급 영역에 놓으면 등급도 바뀜 (마우스·터치 모두 지원, 드래그 중 Esc로 취소)
- 키보드 이동: 손잡이에 포커스를 두고 `Alt+↑` / `Alt+↓`로 한 칸씩 이동 (등급 경계를 넘으면 등급이 바뀜)
- 더블클릭으로 내용 수정 (Enter 저장, Esc 취소, 다른 곳 클릭 시 저장, 빈 내용으로 저장하면 삭제)
- 필터: 전체 / 진행 중 / 완료, 남은 할 일 개수 표시
- 완료 항목 일괄 삭제
- Supabase DB에 저장. 화면은 바로 바뀌고(낙관적 업데이트) 요청은 순서대로 보내며, 저장에 실패하면 알림 후 서버 상태로 되돌림
- 예전에 브라우저(`localStorage`)에 저장한 할 일이 있으면 로그인 후 내 계정으로 가져오기 제안

## 준비: Supabase 설정

1. `SUPABASE.md`대로 Supabase 프로젝트와 테이블·RLS·`move_todo` 함수를 만듭니다.
2. `config.js`에 Project URL과 publishable 키를 넣습니다. publishable 키는 공개되어도 되는 값이고, secret / service_role 키는 절대 넣지 않습니다.

```js
window.SUPABASE_URL = 'https://<project-ref>.supabase.co';
window.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_...';
```

## 앱 실행

`supabase-js`를 CDN에서 불러오므로 **인터넷 연결이 필요**합니다.

### 방법 1. 로컬 웹 서버로 열기 (권장)

```bash
python3 -m http.server 8000
```

브라우저에서 `http://localhost:8000`에 접속합니다. 가입 확인 메일과 비밀번호 재설정 메일의 링크는 Supabase에 등록한 주소(`http://localhost:8000/**`, `https://weable72.github.io/todo/**`)로만 돌아옵니다. 그래서 메일 링크까지 확인하려면 이 방법을 씁니다.

### 방법 2. 파일 바로 열기

`index.html`을 브라우저로 열어도 로그인과 할 일 저장은 됩니다. 다만 메일 링크는 `file://` 주소로 돌아오지 않습니다.

```bash
xdg-open index.html      # Linux
open index.html          # macOS
explorer.exe index.html  # Windows (WSL)
```

### 배포

GitHub Pages 배포 방법은 `GITHUB_PAGES.md`를 참고합니다. 배포 주소: https://weable72.github.io/todo/

## 테스트 실행

테스트에는 Node.js와 npm이 필요합니다 (Jest + jsdom 사용). 실제 Supabase에는 접속하지 않고, `tests/fakeSupabase.js`(메모리에서 RLS·위치 트리거·`move_todo`를 흉내 내는 가짜 클라이언트)를 씁니다.

```bash
npm install   # 처음 한 번만
npm test
```

## 화면 배치

- 폭 840px 미만: 높음/중간/낮음 목록을 위아래로 쌓아서 표시 (휴대폰에서는 버튼을 터치하기 쉽게 크게 표시)
- 폭 840px 이상: 높음/중간/낮음을 가로 3열로 나란히 표시

## 파일 구성

```
index.html          화면 마크업
style.css           스타일
config.js           Supabase 접속 정보 (URL, publishable 키)
todo.js             할 일 처리 로직: 추가·수정·우선순위·이동 등 (DOM 없음)
store.js            Supabase 저장소 계층: 로그인과 할 일 읽기·쓰기, 한국어 오류 메시지
app.js              화면 렌더링, 로그인 화면, 이벤트, 드래그 앤 드롭
tests/todo.test.js  로직 유닛 테스트
tests/store.test.js 저장소·인증 테스트
tests/fakeSupabase.js 테스트용 가짜 Supabase 클라이언트
tests/app.test.js   화면 동작 테스트 (jsdom, 로그인·서버 저장 포함)
package.json        테스트 설정 (jest, jest-environment-jsdom)
```
