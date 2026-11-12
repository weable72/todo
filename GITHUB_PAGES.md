# GitHub Pages 배포 가이드

프론트엔드(정적 파일)는 **GitHub Pages**에 올리고, 백엔드는 이미 설정한 **Supabase**를 그대로 씁니다. 배포가 끝나면 누구나 아래 주소로 접속해 가입하고 자기 할 일을 저장할 수 있습니다.

| 항목 | 값 |
| --- | --- |
| GitHub 계정 | [`weable72`](https://github.com/weable72) |
| 저장소 | [`weable72/todo`](https://github.com/weable72/todo) (Public) |
| 원격 주소 (SSH) | `git@github.com:weable72/todo.git` |
| 로컬 저장소 | `~/work/todo` |
| 개발 폴더 (지금까지 작업한 곳) | `~/work/vibe/day13/todo` |
| **배포 주소** | **https://weable72.github.io/todo/** |
| 백엔드 | Supabase 프로젝트 `dffjixdhzzlbykvbrzyz` ([대시보드](https://supabase.com/dashboard/project/dffjixdhzzlbykvbrzyz)) |

## 배포 방식

GitHub Actions 워크플로를 따로 만들지 않고, **브랜치 배포(Deploy from a branch)**를 씁니다. `main` 브랜치의 루트(`/`) 폴더가 그대로 웹사이트가 됩니다. push할 때마다 GitHub가 자동으로 다시 배포합니다.

```
~/work/todo ──git push──▶ github.com/weable72/todo (main, / root) ──자동 배포──▶ weable72.github.io/todo
                                                                                       │
                                                                    브라우저 ──supabase-js──▶ Supabase (Auth + DB, RLS)
```

브랜치 배포에서 알아 둘 점은 다음과 같습니다.

- **테스트를 자동으로 돌리지 않습니다.** push하기 전에 로컬에서 `npm test`를 꼭 실행합니다.
- **저장소의 파일이 모두 공개 주소로 올라갑니다.** `tests/`, `*.md`(`WORKFLOW.md`의 프롬프트 기록 포함), `package.json`도 `https://weable72.github.io/todo/README.md`처럼 열립니다. 저장소가 Public이라 원래 공개되는 내용이지만, 올리면 안 되는 내용이 없는지 push 전에 확인합니다. `node_modules/`는 `.gitignore`로 빠집니다.
- 루트에 빈 파일 **`.nojekyll`**을 둡니다. 그러면 GitHub가 Jekyll로 사이트를 변환하지 않고 파일을 그대로 올립니다. 그래서 배포가 빠르고, `SUPABASE.md`의 `{{ .ConfirmationURL }}` 같은 문구 때문에 Jekyll 빌드가 실패하는 일도 막을 수 있습니다.

---

## 1. SSH 인증 확인 (처음 한 번)

```bash
ssh -T git@github.com
```

`Hi weable72! You've successfully authenticated...`가 나오면 **2단계로 넘어갑니다.** `Permission denied (publickey)`가 나오면 키를 만들고 등록합니다.

```bash
ssh-keygen -t ed25519 -C "GitHub 계정 이메일"   # 저장 위치는 Enter, 암호는 선택
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
cat ~/.ssh/id_ed25519.pub                        # 출력된 한 줄 전체를 복사
```

복사한 공개 키를 [GitHub → Settings → SSH and GPG keys → New SSH key](https://github.com/settings/ssh/new)에 붙여 넣습니다(Key type: Authentication Key). 그다음 `ssh -T git@github.com`으로 다시 확인합니다.

- 참고: [GitHub 문서 – SSH 키 생성](https://docs.github.com/ko/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent), [SSH 키 등록](https://docs.github.com/ko/authentication/connecting-to-github-with-ssh/adding-a-new-ssh-key-to-your-github-account)

git 사용자 정보가 없다면 함께 설정합니다.

```bash
git config --global user.name "이름"
git config --global user.email "GitHub 계정 이메일"
```

---

## 2. GitHub 저장소 만들기

[새 저장소 만들기](https://github.com/new)에서 다음과 같이 만듭니다.

- Owner: `weable72`
- Repository name: `todo`
- Visibility: **Public** (무료 계정에서 Pages를 쓰려면 Public이어야 함)
- **Add README / .gitignore / license: 모두 선택하지 않음** (로컬 파일과 충돌 방지)

---

## 3. 로컬 저장소 `~/work/todo` 만들기

개발 폴더의 파일을 `~/work/todo`로 복사합니다. `node_modules/`는 빼고 복사합니다.

```bash
mkdir -p ~/work/todo
rsync -a --exclude node_modules --exclude coverage ~/work/vibe/day13/todo/ ~/work/todo/
cd ~/work/todo
ls
```

`config.js`에 **publishable 키만** 들어 있는지 확인합니다. 아래 명령의 결과가 아무것도 없어야 합니다.

```bash
grep -nE "service_role|sb_secret_" config.js
```

> `sb_publishable_...` 키는 브라우저에 공개되도록 만든 키입니다. 데이터는 Supabase의 RLS가 보호합니다. 반대로 `sb_secret_...`나 `service_role` 키가 들어 있으면 **절대 push하지 말고** Supabase에서 그 키를 재발급(rotate)합니다.

Jekyll 변환을 끄는 `.nojekyll` 파일을 만듭니다.

```bash
touch .nojekyll
```

테스트가 통과하는지 확인합니다. `node_modules/`는 테스트용이며 저장소에는 올라가지 않습니다.

```bash
npm ci
npm test
```

---

## 4. 첫 commit과 push

```bash
cd ~/work/todo
git init -b main
git add .
git status        # node_modules/ 가 없고 .nojekyll 이 있어야 함
git commit -m "오늘 할일 앱 첫 배포"
git remote add origin git@github.com:weable72/todo.git
git push -u origin main   # 끝나면 5단계에서 Pages를 켬
```

---

## 5. GitHub Pages 켜기 (브랜치 배포)

push로 `main` 브랜치가 생긴 뒤에 설정합니다.

1. [weable72/todo → Settings → Pages](https://github.com/weable72/todo/settings/pages)로 이동합니다.
2. **Build and deployment → Source**: **Deploy from a branch**
3. **Branch**: `main`, 폴더 **`/ (root)`** → **Save**
4. 1~2분 뒤 같은 화면 위쪽에 `Your site is live at https://weable72.github.io/todo/`가 표시되면 배포가 끝난 것입니다.

> 워크플로 파일을 만들지 않았어도 [Actions 탭](https://github.com/weable72/todo/actions)에 **`pages build and deployment`**가 실행됩니다. GitHub가 브랜치 배포를 위해 자동으로 돌리는 것이므로 그대로 두면 됩니다. 배포 진행 상황과 실패 원인은 여기서 확인합니다.

- 참고: [GitHub 문서 – 브랜치에서 게시](https://docs.github.com/ko/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site#publishing-from-a-branch)

---

## 6. Supabase에 배포 주소 등록

가입 확인 메일과 비밀번호 재설정 메일의 링크가 배포 주소로 돌아오도록 등록합니다.

[Supabase → Authentication → URL Configuration](https://supabase.com/dashboard/project/dffjixdhzzlbykvbrzyz/auth/url-configuration)에서 다음을 입력합니다.

- **Site URL**: `https://weable72.github.io/todo/`
- **Redirect URLs**(Add URL):
  - `https://weable72.github.io/todo/**`
  - `http://localhost:8000/**` (로컬 테스트용, 이미 있으면 그대로)

> 브라우저에서 Supabase로 보내는 요청(API·로그인)은 별도 CORS 설정 없이 GitHub Pages 주소에서 동작합니다.

---

## 7. 공개(public) 운영 전 점검

배포하면 누구나 가입할 수 있게 됩니다. 아래 설정을 확인합니다.

| 항목 | 위치 | 권장 |
| --- | --- | --- |
| RLS | [Table Editor](https://supabase.com/dashboard/project/dffjixdhzzlbykvbrzyz/editor), [Security Advisor](https://supabase.com/dashboard/project/dffjixdhzzlbykvbrzyz/advisors/security) | `todos`가 "RLS enabled"이고 Security Advisor에 경고가 없어야 함 |
| 신규 가입 허용 | [Sign In / Providers](https://supabase.com/dashboard/project/dffjixdhzzlbykvbrzyz/auth/providers) → Allow new users to sign up | 다른 사람도 쓰게 하려면 켬. 혼자 쓸 거면 내 계정을 만든 뒤 끔 |
| Confirm email (현재 **꺼짐**) | 같은 화면 → Email → Confirm email | 꺼져 있으면 없는 이메일로도 가입됨. 공개 운영이면 켜고 아래 Custom SMTP 설정 권장 |
| 메일 발송 | [Emails → SMTP Settings](https://supabase.com/dashboard/project/dffjixdhzzlbykvbrzyz/auth/smtp) | 기본 메일 서버는 팀원 이메일로만 발송. 다른 사람에게 확인·재설정 메일을 보내려면 Custom SMTP 연결 ([문서](https://supabase.com/docs/guides/auth/auth-smtp)) |
| 요청 한도 | [Rate Limits](https://supabase.com/dashboard/project/dffjixdhzzlbykvbrzyz/auth/rate-limits) | 기본값 유지. 가입 남용이 보이면 낮춤 |
| 키 | [API Keys](https://supabase.com/dashboard/project/dffjixdhzzlbykvbrzyz/settings/api-keys) | 저장소에는 publishable 키만. secret 키는 어디에도 넣지 않음 |

> Free 플랜은 **1주일 동안 요청이 없으면 프로젝트가 일시 중지**됩니다. 그러면 배포 주소에서 로그인·저장이 실패합니다. [대시보드](https://supabase.com/dashboard/project/dffjixdhzzlbykvbrzyz)에서 Restore를 누르면 다시 켜집니다.

---

## 8. 접속 확인

1. https://weable72.github.io/todo/ 에 접속합니다(휴대폰에서도 확인).
2. 회원가입이나 로그인을 한 뒤 할 일을 추가하고, 체크·수정·우선순위 변경·드래그를 해 봅니다.
3. 새로고침해도 그대로인지 확인합니다. 다른 기기에서 같은 계정으로 로그인해 같은 목록이 보이는지도 확인합니다.
4. Supabase [Table Editor → todos](https://supabase.com/dashboard/project/dffjixdhzzlbykvbrzyz/editor)에 행이 생기는지 확인합니다.
5. 다른 계정으로 가입해 첫 번째 계정의 할 일이 **보이지 않는지** 확인합니다(RLS 확인).

> `localhost`에서 테스트할 때 저장한 할 일도 같은 Supabase 계정에 있으므로 배포 주소에서도 보입니다.

---

## 9. 수정 후 다시 배포

앞으로는 **`~/work/todo`에서 바로 작업**하는 것을 권장합니다. 두 폴더를 함께 쓰면 어느 쪽이 최신인지 헷갈리기 쉽습니다.

```bash
cd ~/work/todo
npm test
git add .
git commit -m "변경 내용 요약"
git push
```

push하면 GitHub가 자동으로 다시 배포합니다(1~2분). 테스트는 자동으로 돌지 않으므로 **`npm test`가 통과한 뒤에만 push**합니다. 원격에 새 커밋이 있어 push가 거부되면 **rebase 없이 merge**합니다.

```bash
git pull --no-rebase
git push
```

개발 폴더(`~/work/vibe/day13/todo`)에서 계속 작업한다면, 바뀐 내용을 복사한 뒤 위 순서로 commit·push합니다.

```bash
rsync -a --exclude node_modules --exclude coverage --exclude .git ~/work/vibe/day13/todo/ ~/work/todo/
```

> 이 명령은 개발 폴더에서 **지운 파일을 `~/work/todo`에서 지우지 않습니다.** 파일을 지웠다면 `~/work/todo`에서도 `git rm <파일>`로 지웁니다.

파일을 바꾸지 않고 다시 배포하려면 빈 커밋을 push합니다.

```bash
git commit --allow-empty -m "재배포"
git push
```

---

## 10. 문제 해결

| 증상 | 확인할 것 |
| --- | --- |
| `Permission denied (publickey)` | 1단계를 다시 확인합니다. `ssh-add -l`로 키가 agent에 올라가 있는지 봅니다. |
| `remote origin already exists` | `git remote set-url origin git@github.com:weable72/todo.git` |
| push 시 `rejected (fetch first)` | `git pull --no-rebase` 후 `git push` |
| 배포 주소가 404 | 5단계 설정(`main`, `/ (root)`)을 확인합니다. Actions의 `pages build and deployment`가 성공했는지 보고, 1~2분 뒤 다시 접속합니다. 주소 끝 `/todo/`와 `index.html`이 저장소 루트에 있는지도 확인합니다. |
| `pages build and deployment` 실패 (Jekyll / Liquid 오류) | 루트에 `.nojekyll`이 commit되어 있는지 확인합니다(`git ls-files .nojekyll`). 없으면 `touch .nojekyll` 후 commit·push합니다. |
| Settings → Pages에서 Branch를 고를 수 없음 | 아직 push하지 않아 `main`이 없는 상태입니다. 4단계를 먼저 합니다. 저장소가 Public인지도 확인합니다. |
| "Supabase 라이브러리를 불러오지 못했습니다" | 인터넷 연결이나 회사 방화벽이 `cdn.jsdelivr.net`을 막는지 확인합니다. |
| 로그인·저장 시 "서버에 연결하지 못했습니다" | Supabase 프로젝트가 일시 중지되었는지 [대시보드](https://supabase.com/dashboard/project/dffjixdhzzlbykvbrzyz)에서 확인합니다. `config.js`의 URL도 확인합니다. |
| 메일 링크를 누르면 `localhost:3000` 등 다른 주소로 감 | 6단계의 Site URL과 Redirect URLs를 확인합니다. |
| 예전 화면이 계속 보임 | 강력 새로고침(`Ctrl+Shift+R`, macOS는 `Cmd+Shift+R`) |

## 참고 링크

- 저장소: https://github.com/weable72/todo · [Settings → Pages](https://github.com/weable72/todo/settings/pages) · [Actions(배포 기록)](https://github.com/weable72/todo/actions)
- 배포 주소: https://weable72.github.io/todo/
- Supabase 대시보드: https://supabase.com/dashboard/project/dffjixdhzzlbykvbrzyz
- GitHub Pages 문서: https://docs.github.com/ko/pages
- Jekyll 끄기(`.nojekyll`): https://docs.github.com/ko/pages/getting-started-with-github-pages/about-github-pages#static-site-generators
- Supabase Auth 리다이렉트 URL: https://supabase.com/docs/guides/auth/redirect-urls
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase 프로젝트 구성안(이 저장소): `SUPABASE.md`
