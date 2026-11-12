# Supabase 프로젝트 구성안

현재 `localStorage`에 저장하는 할 일 데이터를 Supabase(PostgreSQL)로 옮기기 위한 구성안입니다. 앱은 GitHub Pages(`https://weable72.github.io/todo/`)에 올리는 정적 사이트이므로 서버 코드가 없습니다. 브라우저에서 `supabase-js`로 DB에 직접 접근합니다.

## 핵심 결정 요약

| 항목 | 결정 | 이유 |
| --- | --- | --- |
| 리전 | Northeast Asia (Seoul) | 사용자와 가까워 응답이 빠름 |
| 플랜 | Free | 개인 todo 앱에는 충분 |
| 로그인 | Supabase Auth **이메일 + 비밀번호만** 사용 (소셜 로그인 없음) | 브라우저에 공개되는 키만으로 안전하려면 사용자 구분이 필요함. 매번 메일을 보내는 매직 링크보다 메일 발송이 적어 기본 메일 발송 제한에 덜 걸림 |
| 보안 | 모든 테이블에 **RLS**(Row Level Security), 본인 행만 접근 | 프론트엔드 키는 누구나 볼 수 있음 |
| 테이블 | `public.todos` 하나 | 현재 데이터 모델(`id, text, completed, priority`) + 소유자 + 정렬 위치 |
| 정렬 | `position`(실수) 값 + `move_todo` DB 함수 | 드래그 한 번에 한 행만 수정, 서버에서 원자적으로 계산 |
| 클라이언트 | CDN의 `supabase-js` v2 (버전 고정, 일반 `<script>`) | 빌드 없이 지금 구조 유지 |

---

## 1. 가입과 프로젝트 생성

1. https://supabase.com → **Start your project** → **Sign up**에서 이메일과 비밀번호로 가입하고, 받은 확인 메일의 링크를 누릅니다.
2. 조직(Organization)을 만듭니다. 이름은 자유이고 Plan은 **Free**입니다.
3. **New project**에 다음을 입력합니다.
   - Name: `todo`
   - Database Password: 강력한 비밀번호를 **생성 버튼으로 만들고 비밀번호 관리자에 보관**합니다. 앱 코드에는 쓰지 않습니다.
   - Region: **Northeast Asia (Seoul)**
4. 생성(1~2분)이 끝나면 **Project Settings → API**(또는 **Connect** 버튼)에서 다음 두 값을 확인합니다.
   - **Project URL**: `https://<project-ref>.supabase.co`
   - **Publishable key**(`sb_publishable_...`) 또는 예전 이름인 **anon public key**: 프론트엔드에 넣는 키입니다.

> ⚠️ **Secret key / `service_role` key는 절대 프론트엔드 코드나 저장소에 넣지 않습니다.** RLS를 무시하는 관리자 키입니다.

### Free 플랜 참고
- DB 500MB, 활성 프로젝트 2개까지 쓸 수 있습니다.
- **1주일 동안 접속이 없으면 프로젝트가 일시 중지**됩니다. 대시보드에서 Restore를 누르면 다시 켜집니다.

---

## 2. 로그인(Auth) 설정 — 이메일 로그인만 사용

정적 사이트에서는 브라우저에 공개 키가 그대로 노출됩니다. 그래서 "누구의 데이터인가"를 로그인으로 구분하고, RLS로 본인 데이터만 허용해야 안전합니다. 로그인 방법은 **이메일 + 비밀번호 하나만** 씁니다.

### 2-1. 이메일 로그인만 켜기
**Authentication → Sign In / Providers**에서 다음을 확인합니다.
- **Email**: Enabled
  - **Confirm email**: 켬 (가입할 때 확인 메일의 링크를 눌러야 로그인 가능)
  - **Minimum password length**: 8 이상
- **GitHub, Google 등 다른 provider**: 모두 꺼 둠(기본값이 꺼짐)
- **Allow anonymous sign-ins**: 끔
- **Allow new users to sign up**: 처음에는 켬. 혼자만 쓸 앱이라면 **내 계정을 만든 뒤 끄면** 다른 사람이 가입할 수 없습니다.

### 2-2. 리다이렉트 주소
확인 메일과 비밀번호 재설정 메일의 링크를 누르면 아래 주소로 돌아옵니다. **Authentication → URL Configuration**에서 다음을 입력합니다.
- Site URL: `https://weable72.github.io/todo/`
- Redirect URLs:
  - `https://weable72.github.io/todo/**`
  - `http://localhost:8000/**` (로컬 개발용)

> 비밀번호 로그인 자체는 페이지 이동이 없습니다. 하지만 메일 링크는 위의 http(s) 주소로만 돌아옵니다. 그래서 로컬 개발은 `file://` 대신 `python3 -m http.server 8000`으로 띄워서 합니다.

### 2-3. 메일 발송 제한
Supabase 기본 메일 서버는 테스트용입니다.
- **프로젝트 팀원(대시보드 계정)의 이메일 주소로만** 메일을 보냅니다.
- 시간당 발송 수도 매우 적습니다.

그래서 쓰는 사람에 따라 다음과 같이 합니다.

| 사용 범위 | 설정 |
| --- | --- |
| 나 혼자 사용 | 대시보드에 가입한 이메일로 앱 계정을 만들면 기본 설정 그대로 됩니다. |
| 다른 사람도 가입 | **Authentication → Emails → SMTP Settings**에서 외부 메일 서비스(Resend, SendGrid, Amazon SES 등)를 연결합니다(Custom SMTP). 그다음 **Authentication → Rate Limits**에서 발송 한도를 조정합니다. |

로그인할 때마다 메일을 보내는 매직 링크·OTP 방식은 이 제한에 쉽게 걸립니다. 그래서 쓰지 않습니다. 메일은 **가입 확인**과 **비밀번호 재설정** 때만 나갑니다.

### 2-4. (선택) 메일 문구 한국어로 바꾸기
**Authentication → Emails → Templates**에서 `Confirm signup`, `Reset password` 템플릿의 제목과 본문을 한국어로 바꿉니다. 링크 변수(`{{ .ConfirmationURL }}`)는 그대로 둡니다.

### 2-5. 앱에서 쓰는 인증 흐름
| 화면 동작 | `supabase-js` 호출 |
| --- | --- |
| 회원가입 | `auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } })` → "확인 메일을 보냈습니다" 안내 |
| 로그인 | `auth.signInWithPassword({ email, password })` |
| 비밀번호 찾기 | `auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname })` |
| 재설정 링크로 돌아옴 | `auth.onAuthStateChange`에서 `PASSWORD_RECOVERY` 이벤트 → 새 비밀번호 입력 폼 → `auth.updateUser({ password })` |
| 로그아웃 | `auth.signOut()` |
| 로그인 상태 유지 | `supabase-js`가 세션을 브라우저에 저장하고 자동 갱신함. 앱 시작 시 `auth.getSession()`으로 확인 |

---

## 3. 테이블 구조

### `public.todos`

| 컬럼 | 타입 | 제약 / 기본값 | 설명 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, `gen_random_uuid()` | 할 일 id. 현재 앱의 문자열 id와 호환 |
| `user_id` | `uuid` | NOT NULL, `auth.uid()`, `auth.users(id)` 참조, 삭제 시 함께 삭제 | 소유자 |
| `text` | `text` | NOT NULL, 공백 제외 1~500자 | 할 일 내용 |
| `completed` | `boolean` | NOT NULL, `false` | 완료 여부 |
| `priority` | `text` | NOT NULL, `'medium'`, `high/medium/low`만 허용 | 우선순위 |
| `position` | `double precision` | NOT NULL | 같은 우선순위 안의 정렬 순서(작을수록 위) |
| `created_at` | `timestamptz` | NOT NULL, `now()` | 생성 시각 |
| `updated_at` | `timestamptz` | NOT NULL, `now()`, 트리거로 자동 갱신 | 수정 시각 |

- 인덱스: `(user_id, priority, position)`. 화면에 그릴 때 쓰는 정렬 순서와 같습니다.
- `priority`는 enum 대신 `text + CHECK`로 둡니다. 값을 추가하거나 바꾸기가 쉽고, JS 값(`'high'` 등)과 그대로 맞습니다.

### 정렬(`position`) 방식
- 새 항목: 그 우선순위의 `max(position) + 1024`, 즉 맨 끝에 붙습니다.
- 드래그로 A와 B 사이에 놓을 때: `(A.position + B.position) / 2`. **옮긴 한 행만 수정**합니다.
- 맨 앞: `첫 항목 - 1024` / 맨 끝: `마지막 항목 + 1024`
- 간격이 너무 좁아지면(같은 자리에 수십 번 반복 삽입) 그 우선순위 그룹 전체를 1024 간격으로 다시 번호를 매깁니다.
- 이 계산은 `move_todo(id, priority, before_id)` DB 함수가 합니다. 앱의 `moveTodo(todos, id, priority, beforeId)`와 인자 형태가 같아서 연결하기 쉽습니다.

### 앱 데이터와의 대응
| 앱(`todo.js`) | DB |
| --- | --- |
| `id` | `id` |
| `text` | `text` |
| `completed` | `completed` |
| `priority` | `priority` |
| 배열 순서 | `order by priority, position` (우선순위 섹션별로 묶어 그리므로 그룹 안의 순서만 의미 있음) |

---

## 4. SQL (SQL Editor에서 실행)

대시보드 **SQL Editor → New query**에 붙여 넣고 실행합니다. 같은 내용을 저장소의 `supabase/schema.sql`로 보관해 두면 다시 만들기 쉽습니다.

```sql
-- 1) 테이블
create table public.todos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text        text not null check (char_length(btrim(text)) between 1 and 500),
  completed   boolean not null default false,
  priority    text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  position    double precision not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index todos_user_priority_position_idx
  on public.todos (user_id, priority, position);

-- 2) updated_at 자동 갱신
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger todos_set_updated_at
  before update on public.todos
  for each row execute function public.set_updated_at();

-- 3) 새 항목은 해당 우선순위의 맨 끝 위치로 (클라이언트가 position을 안 보내도 됨)
create or replace function public.set_todo_position()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.position is null or new.position = 0 then
    select coalesce(max(t.position), 0) + 1024
      into new.position
      from public.todos t
     where t.user_id = new.user_id
       and t.priority = new.priority;
  end if;
  return new;
end;
$$;

create trigger todos_set_position
  before insert on public.todos
  for each row execute function public.set_todo_position();

-- 4) RLS: 로그인한 본인 행만
alter table public.todos enable row level security;

create policy "todos_select_own" on public.todos
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "todos_insert_own" on public.todos
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "todos_update_own" on public.todos
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "todos_delete_own" on public.todos
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- 5) 드래그 이동: id 항목을 p_priority 등급의 p_before_id 앞으로 (null이면 맨 끝)
create or replace function public.move_todo(
  p_id uuid,
  p_priority text,
  p_before_id uuid default null
)
returns void
language plpgsql
security invoker            -- 호출한 사용자 권한으로 실행 → RLS 적용
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_before double precision;
  v_prev   double precision;
  v_pos    double precision;
begin
  if p_priority not in ('high', 'medium', 'low') then
    raise exception 'invalid priority: %', p_priority;
  end if;

  if p_before_id is null then
    select coalesce(max(position), 0) + 1024 into v_pos
      from public.todos
     where user_id = v_uid and priority = p_priority and id <> p_id;
  else
    select position into v_before
      from public.todos
     where id = p_before_id and user_id = v_uid and priority = p_priority;
    if v_before is null then
      raise exception 'before item not found';
    end if;

    select max(position) into v_prev
      from public.todos
     where user_id = v_uid and priority = p_priority
       and position < v_before and id <> p_id;

    -- 간격이 너무 좁으면 그룹 전체를 다시 번호 매김
    if v_prev is not null and v_before - v_prev < 1e-6 then
      update public.todos t
         set position = r.rn * 1024
        from (
          select id, row_number() over (order by position, created_at) as rn
            from public.todos
           where user_id = v_uid and priority = p_priority and id <> p_id
        ) r
       where t.id = r.id;

      select position into v_before from public.todos where id = p_before_id;
      select max(position) into v_prev
        from public.todos
       where user_id = v_uid and priority = p_priority
         and position < v_before and id <> p_id;
    end if;

    v_pos := case when v_prev is null then v_before - 1024
                  else (v_prev + v_before) / 2 end;
  end if;

  update public.todos
     set priority = p_priority, position = v_pos
   where id = p_id and user_id = v_uid;

  if not found then
    raise exception 'todo not found';
  end if;
end;
$$;

revoke execute on function public.move_todo(uuid, text, uuid) from public, anon;
grant execute on function public.move_todo(uuid, text, uuid) to authenticated;
```

### RLS 확인 방법
- **Table Editor → todos**에 "RLS enabled"가 표시되는지 봅니다.
- **Advisors → Security Advisor**에 경고가 없는지 봅니다.
- 로그인하지 않은 상태(anon 키만 사용)에서 `select`하면 빈 결과가 나와야 합니다.

---

## 5. 앱 쪽 변경 계획 (구현 시 참고)

> 아래는 구성 방향입니다. 실제 코드 변경은 별도 요청 시 진행합니다.

1. **클라이언트 로드**: `index.html`에 `supabase-js`를 일반 `<script>`로 추가합니다. 작성 시점의 정확한 버전으로 고정합니다(예: `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.<x>.<y>/dist/umd/supabase.js`). 전역 `supabase.createClient`를 씁니다.
2. **설정 파일** `config.js`: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`를 넣습니다. publishable/anon 키는 공개해도 되는 값이라 GitHub Pages에 그대로 올려도 됩니다. 보안은 RLS가 담당합니다.
3. **저장소 계층 분리**: `todo.js`의 순수 로직(필터, 그룹, 이동 계산)은 그대로 둡니다. `app.js`의 `loadTodos/saveTodos` 자리에 저장소 객체를 둡니다.
   - `list()` → `select * order by priority, position`
   - `add(text, priority)` → `insert` (`user_id`, `position`은 DB 기본값과 트리거가 채움)
   - `toggle`, `edit`, `setPriority` → 해당 행 `update` (`setPriority`는 `move_todo(id, priority, null)`)
   - `delete`, `clearCompleted` → `delete`
   - 드래그·`Alt+↑/↓` → `rpc('move_todo', { p_id, p_priority, p_before_id })`
4. **낙관적 업데이트**: 화면을 먼저 바꾸고 요청합니다. 실패하면 다시 불러오고(`list()`) 오류 메시지(snackbar)를 보여 줍니다.
5. **로그인 UI**: 로그인하지 않았으면 목록 대신 이메일·비밀번호 입력 카드를 보여 줍니다. 카드에는 로그인과 회원가입 전환, "비밀번호 찾기" 링크가 있습니다. 로그인하면 상단 앱 바에 내 이메일과 로그아웃 버튼을 표시합니다. 호출 방법은 2-5를 따릅니다. 오류 메시지(잘못된 비밀번호, 이메일 미확인 등)는 한국어로 바꿔 보여 줍니다.
6. **기존 데이터 이전**: 로그인 후 서버 목록이 비어 있고 `localStorage`에 기존 할 일이 있으면 "가져오기"를 제안합니다. 가져온 뒤 로컬 데이터는 지웁니다.
7. **(선택) 여러 기기 동기화**: Realtime으로 `todos` 테이블 변경을 구독합니다. **Database → Publications**에서 `todos`를 `supabase_realtime`에 추가해야 합니다.
8. **테스트**: Jest에서는 저장소 객체를 가짜(in-memory)로 바꿔 끼웁니다. 실제 Supabase에 접속하지 않습니다. `todo.js` 테스트는 그대로 유지합니다.

---

## 6. 준비가 끝나면 알려 줄 값

구현을 시작할 때 다음 값만 있으면 됩니다(비밀 값 아님).

- Project URL: `https://<project-ref>.supabase.co`
- Publishable key(또는 anon key)

DB 비밀번호, Secret/service_role 키, Custom SMTP 비밀번호(API 키)는 **공유하지 않습니다**.

## 7. 참고 문서
- Supabase 시작하기: https://supabase.com/docs/guides/getting-started
- RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- 비밀번호 로그인: https://supabase.com/docs/guides/auth/passwords
- Custom SMTP: https://supabase.com/docs/guides/auth/auth-smtp
- JavaScript 클라이언트: https://supabase.com/docs/reference/javascript/introduction
