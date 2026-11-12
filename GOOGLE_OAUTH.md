# Google OAuth 로그인 추가 가이드

지금 앱은 Supabase Auth의 **이메일 + 비밀번호** 로그인을 씁니다. 여기에 **"Google로 로그인"**을 더하는 방법을 정리합니다. 서버 코드는 필요 없습니다. Google Cloud와 Supabase 대시보드에서 설정하고, 프론트엔드에 버튼과 호출 몇 줄을 추가하면 됩니다.

| 항목 | 값 |
| --- | --- |
| 배포 주소 | https://weable72.github.io/todo/ |
| 로컬 테스트 주소 | http://localhost:8000/ |
| Supabase 프로젝트 | `dffjixdhzzlbykvbrzyz` ([대시보드](https://supabase.com/dashboard/project/dffjixdhzzlbykvbrzyz)) |
| **Supabase 콜백 URL** (Google에 등록) | `https://dffjixdhzzlbykvbrzyz.supabase.co/auth/v1/callback` |

## 동작 흐름

```
[Google로 로그인] 클릭
  └─ supabase.auth.signInWithOAuth({ provider: 'google', redirectTo: 배포 주소 })
       └─▶ Google 로그인·동의 화면 (accounts.google.com)
             └─▶ Supabase 콜백  https://dffjixdhzzlbykvbrzyz.supabase.co/auth/v1/callback
                   └─▶ 앱으로 돌아옴  https://weable72.github.io/todo/#access_token=...
                         └─ supabase-js가 주소의 토큰을 읽어 세션 저장 → SIGNED_IN → 할 일 화면
```

- Google의 **Client Secret은 Supabase에만** 넣습니다. 프론트엔드 코드(`config.js` 등)에는 넣지 않습니다.
- 할 일 데이터, RLS, `move_todo`는 그대로입니다. 로그인 방법만 하나 늘어납니다.
- 같은 이메일로 이미 가입한 계정이 있으면 Supabase가 **자동으로 같은 사용자에 연결**합니다(Google 이메일은 인증된 이메일이므로). 그래서 예전 할 일이 그대로 보입니다. → [Identity Linking](https://supabase.com/docs/guides/auth/auth-identity-linking)

---

## 1. Google Cloud 프로젝트 만들기

1. [Google Cloud Console](https://console.cloud.google.com/)에 Google 계정으로 로그인합니다.
2. [새 프로젝트 만들기](https://console.cloud.google.com/projectcreate)에서 프로젝트 이름(예: `todo`)을 넣고 **만들기**를 누릅니다. 결제 정보는 필요 없습니다.
3. 상단 프로젝트 선택기에서 방금 만든 프로젝트가 선택되어 있는지 확인합니다.

## 2. OAuth 동의 화면 (Google Auth Platform)

[Google Auth Platform](https://console.cloud.google.com/auth/overview)에서 **시작하기(Get started)**를 누르고 차례로 입력합니다.

### 2-1. 앱 정보 (Branding)
- 앱 이름: `오늘 할일`
- 사용자 지원 이메일: 내 Gmail 주소
- 앱 홈페이지: `https://weable72.github.io/todo/`
- 개인정보처리방침 / 서비스 약관 링크: 공개 운영 시 준비합니다(아래 2-4 참고).
- **승인된 도메인(Authorized domains)**:
  - `dffjixdhzzlbykvbrzyz.supabase.co`
  - `weable72.github.io`
- 개발자 연락처 이메일: 내 이메일

### 2-2. 대상 (Audience)
- 사용자 유형: **외부(External)**
- 처음에는 **테스트(Testing)** 상태입니다. 이 상태에서는 **테스트 사용자**로 등록한 Google 계정(최대 100개)만 로그인할 수 있습니다. **Test users → Add users**에 내 Gmail을 추가합니다.

### 2-3. 데이터 액세스 (Data Access) — 스코프
**Add or remove scopes**에서 다음 3개만 선택합니다. 모두 민감하지 않은 기본 스코프입니다.
- `openid`
- `.../auth/userinfo.email`
- `.../auth/userinfo.profile`

### 2-4. 누구나 로그인하게 하려면 (게시)
- **Audience → Publish app**으로 **프로덕션(In production)**으로 바꿉니다.
- 위의 기본 스코프만 쓰면 보통 별도의 앱 심사 없이 게시됩니다. 다만 앱 이름·로고를 동의 화면에 보여 주려면 **브랜드 확인(Brand verification)**이 필요할 수 있습니다. 그때는 홈페이지, 개인정보처리방침 URL, 도메인 소유 확인을 요구합니다.
- 참고: [OAuth 앱 게시 상태](https://support.google.com/cloud/answer/15549945), [앱 인증 안내](https://support.google.com/cloud/answer/13463073)

## 3. OAuth 클라이언트 ID 만들기

[Clients → Create client](https://console.cloud.google.com/auth/clients/create)에서 다음과 같이 입력합니다.

- 애플리케이션 유형: **웹 애플리케이션(Web application)**
- 이름: `todo-supabase`
- **승인된 JavaScript 원본(Authorized JavaScript origins)**:
  - `https://weable72.github.io`
  - `http://localhost:8000`
- **승인된 리디렉션 URI(Authorized redirect URIs)**:
  - `https://dffjixdhzzlbykvbrzyz.supabase.co/auth/v1/callback`

> 리디렉션 URI에는 **앱 주소가 아니라 Supabase 콜백 URL**을 넣습니다. 앱으로 돌아오는 주소는 Supabase의 Redirect URLs(4-2)가 정합니다.

**만들기**를 누르면 **Client ID**와 **Client Secret**이 나옵니다.
- Client Secret은 다시 볼 수 없을 수 있으므로 **JSON을 다운로드**하거나 비밀번호 관리자에 보관합니다.
- 저장소, 채팅, 문서에 붙여 넣지 않습니다.

## 4. Supabase 설정

### 4-1. Google provider 켜기
[Authentication → Sign In / Providers → Google](https://supabase.com/dashboard/project/dffjixdhzzlbykvbrzyz/auth/providers)에서 다음을 설정합니다.
- **Enable Sign in with Google**: 켬
- **Client IDs**: 3단계의 Client ID
- **Client Secret (for OAuth)**: 3단계의 Client Secret
- **Skip nonce checks**: 끈 상태 유지
- 화면에 보이는 **Callback URL (for OAuth)**이 3단계에서 등록한 리디렉션 URI와 같은지 확인합니다.
- **Save**

### 4-2. 돌아올 주소 확인
[Authentication → URL Configuration](https://supabase.com/dashboard/project/dffjixdhzzlbykvbrzyz/auth/url-configuration)에서 확인합니다(이메일 로그인 때 이미 설정했다면 그대로 둡니다).
- Site URL: `https://weable72.github.io/todo/`
- Redirect URLs: `https://weable72.github.io/todo/**`, `http://localhost:8000/**`

> 앱이 보낸 `redirectTo`가 이 목록에 없으면 Supabase는 **Site URL로 돌려보냅니다.**

### 4-3. 이메일 계정과의 연결 (보안 점검)
- 지금은 **Confirm email이 꺼져 있습니다.** 그래서 누군가 내 Gmail 주소로 먼저 비밀번호 계정을 만들어 둘 수도 있습니다(메일 인증 없이).
- Google 로그인을 추가할 때는 **Confirm email을 켜는 것**을 권장합니다. 그래야 같은 이메일로 계정이 자동 연결될 때 인증된 주인만 연결됩니다. Confirm email을 켜면 다른 사람에게 메일을 보내기 위해 Custom SMTP도 필요합니다(`GITHUB_PAGES.md` 7단계 점검표 참고).
- Google로만 로그인하게 하려면 **Email provider를 끄면** 됩니다. 그러면 이미 비밀번호로 가입한 사용자는 같은 Gmail의 Google 로그인으로만 들어올 수 있습니다.

---

## 5. 앱 코드 변경 내용 (구현 완료)

> 아래 내용대로 구현했습니다. 실제 코드와 조금 다른 점이 있습니다.
> - 버튼은 로그인 카드 제목 아래에 있습니다(`#google-login`).
> - 돌아온 주소의 오류는 `store.js`의 `oauthErrorFromUrl` / `stripOAuthError`로 처리합니다.
> - `validation_failed` 오류는 메시지로 원인(예: provider가 꺼져 있음)을 알 수 있으면 그 문장을 보여 줍니다.

### 5-1. `index.html` — 로그인 카드에 버튼 추가
로그인 폼 위에 버튼과 구분선을 둡니다.

```html
<button type="button" id="google-login" class="btn btn--outlined btn--block">
  <svg viewBox="0 0 48 48" aria-hidden="true"><!-- Google "G" 로고 (공식 4색 SVG) --></svg>
  Google로 계속하기
</button>
<p class="auth-divider"><span>또는 이메일로</span></p>
```

- 버튼 모양과 로고는 [Google 로그인 브랜딩 가이드라인](https://developers.google.com/identity/branding-guidelines)을 따릅니다. 흰 배경, 공식 "G" 로고, "Google로 계속하기 / Google 계정으로 로그인" 같은 문구를 씁니다.

### 5-2. `store.js` — 메서드 추가

```js
async signInWithGoogle(redirectTo) {
  return unwrap(
    client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,                                 // 배포 주소 또는 http://localhost:8000/
        queryParams: { prompt: 'select_account' },  // 매번 계정 선택 화면 표시
      },
    })
  );
}
```

- 호출하면 브라우저가 Google로 이동합니다. 돌아오면 기존 `onAuthChange`가 `SIGNED_IN`을 받습니다. 그래서 로그인 후 처리(목록 불러오기, 예전 데이터 가져오기 배너)는 **지금 코드 그대로** 동작합니다.

### 5-3. `app.js` — 버튼 처리와 오류 표시
- `#google-login` 클릭 → `store.signInWithGoogle(redirectTo)`. 이동하기 전까지 버튼을 비활성화하고 진행 표시줄을 보여 줍니다.
- 사용자가 Google 화면에서 취소하거나 설정이 잘못되면 앱 주소에 `#error=...&error_description=...`(또는 `?error=`)가 붙어 돌아옵니다. 시작할 때 이 값을 읽어 로그인 카드에 한국어로 보여 주고, 주소에서 지웁니다(`history.replaceState`).
  - `access_denied` → "Google 로그인을 취소했습니다."
  - 그 밖의 오류 → "Google 로그인에 실패했습니다. 잠시 후 다시 시도해 주세요."
- 로그아웃은 지금처럼 `signOut()`만 합니다. Supabase 세션만 끝나고 브라우저의 Google 로그인 상태는 유지됩니다. 다음 로그인에서 `prompt: 'select_account'`로 계정을 다시 고를 수 있습니다.
- 상단 사용자 메뉴의 이메일 표시는 Google 계정 이메일이 그대로 나옵니다(`session.user.email`).

### 5-4. `style.css`
- `.btn--outlined`(흰 배경 + 테두리), `.auth-divider`(가운데 글자가 있는 구분선) 스타일을 추가합니다.

### 5-5. 테스트
- `tests/fakeSupabase.js`에 `auth.signInWithOAuth`를 추가합니다. 호출 인자를 기록하고, 테스트에서 `SIGNED_IN`을 흉내 낼 수 있게 합니다.
- `tests/store.test.js`: `provider: 'google'`, `redirectTo`, `prompt` 전달을 확인합니다.
- `tests/app.test.js`: 버튼 클릭 시 호출되는지, 돌아온 뒤 할 일 화면으로 가는지 확인합니다. `#error=access_denied`로 시작하면 안내 문구를 보여 주는지도 확인합니다.

### 5-6. 문서
- `SUPABASE.md`의 "로그인은 이메일 + 비밀번호만" 결정을 "이메일 + Google"로 고칩니다.
- `README.md` 기능 목록에 Google 로그인을 추가합니다.

---

## 6. 확인 순서

1. 로컬: `python3 -m http.server 8000` → http://localhost:8000 → **Google로 계속하기**를 누릅니다. 테스트 사용자로 등록한 계정으로 로그인한 뒤 할 일 화면이 보이는지 확인합니다.
2. Supabase [Authentication → Users](https://supabase.com/dashboard/project/dffjixdhzzlbykvbrzyz/auth/users)에서 해당 사용자의 Provider에 `google`이 보이는지 확인합니다. 같은 이메일의 기존 사용자라면 `email, google` 두 개가 함께 보입니다.
3. 배포: push 후 https://weable72.github.io/todo/ 에서 같은 확인을 합니다.
4. 다른 Google 계정으로 로그인했을 때 앞 계정의 할 일이 보이지 않는지 확인합니다(RLS).

> `file://`로 연 페이지에서는 OAuth가 돌아올 주소가 없어 동작하지 않습니다. 반드시 `http://localhost:8000`이나 배포 주소에서 테스트합니다.

## 7. 문제 해결

| 증상 | 원인 / 해결 |
| --- | --- |
| Google 화면에 `Error 400: redirect_uri_mismatch` | 3단계의 승인된 리디렉션 URI가 `https://dffjixdhzzlbykvbrzyz.supabase.co/auth/v1/callback`와 정확히 같은지 확인합니다(https, 끝 경로, 오타). |
| `Error 403: access_denied` / "앱이 테스트 중" | 앱이 Testing 상태이고 로그인한 계정이 테스트 사용자가 아닙니다. 2-2에서 추가하거나 2-4에서 게시합니다. |
| 로그인 후 `localhost:3000` 등 엉뚱한 주소로 감 | 4-2의 Site URL과 Redirect URLs를 확인합니다. `redirectTo`가 목록에 없으면 Site URL로 갑니다. |
| 돌아왔는데 로그인 화면 그대로, 주소에 `#error=server_error` / `Unable to exchange external code` | 4-1의 Client Secret이 틀렸거나 Client ID와 짝이 맞지 않습니다. Google Console에서 새 Secret을 만들어 다시 넣습니다. |
| `Unsupported provider: provider is not enabled` | 4-1에서 Google provider를 켜고 Save했는지 확인합니다. |
| 같은 이메일인데 할 일이 안 보임(다른 사용자로 생성됨) | 기존 이메일 계정이 미인증 상태였을 수 있습니다. Users 화면에서 두 사용자를 확인하고, Confirm email 설정(4-3)을 점검합니다. |

## 8. 참고 링크

- Supabase – Login with Google: https://supabase.com/docs/guides/auth/social-login/auth-google
- Supabase – `signInWithOAuth`: https://supabase.com/docs/reference/javascript/auth-signinwithoauth
- Supabase – Redirect URLs: https://supabase.com/docs/guides/auth/redirect-urls
- Supabase – Identity Linking: https://supabase.com/docs/guides/auth/auth-identity-linking
- Google Cloud Console: https://console.cloud.google.com/
- Google Auth Platform (동의 화면·클라이언트): https://console.cloud.google.com/auth/overview
- Google OAuth 2.0 웹 서버 앱 개요: https://developers.google.com/identity/protocols/oauth2/web-server
- Google 로그인 브랜딩 가이드라인: https://developers.google.com/identity/branding-guidelines
