# SUPABASE_SETUP.md — Supabase DB 연결 · RLS 보안 설정

이 앱은 `js/config.js`가 비어 있으면 **브라우저 저장(로컬 모드)**, 값이 있으면 **Supabase DB 모드**로 동작합니다.
DB 모드에서는 로그인한 직원만 사용할 수 있고, 모든 테이블에 RLS(행 단위 보안)가 켜져 있어 **권한 판단은 DB가 직접** 합니다.
화면에서 버튼을 숨기는 것은 편의일 뿐이고, 누군가 브라우저를 조작해도 DB가 거부합니다.

## 1. 권한 구조

| 역할 | 참여자 보기 | 등록·수정 | 삭제 | 직원 관리 | 접근 기록 열람 |
|---|---|---|---|---|---|
| 관리자(admin) | 기관 전체 | 기관 전체 | ✔ | ✔ | ✔ |
| 팀장(manager) | 기관 전체 | 기관 전체·담당자 지정 | ✕ | ✕ | ✕ |
| 담당자(worker) | **본인 담당만** | 본인 담당만 | ✕ | ✕ | ✕ |
| 열람(viewer) | 기관 전체 | ✕ | ✕ | ✕ | ✕ |
| 승인 대기(pending) | ✕ | ✕ | ✕ | ✕ | ✕ |
| 비로그인(anon) | ✕ (테이블 권한 자체 회수) | ✕ | ✕ | ✕ | ✕ |

추가 보호 장치(트리거):
- 다른 기관의 기록은 어떤 역할도 볼 수 없음(기관 = `org_id` 분리)
- 기록 생성 시 기관·작성자는 서버가 강제로 채움(위조 불가)
- 본인 역할·기관 변경 불가, 역할 변경은 같은 기관 관리자만
- 담당자는 같은 기관의 승인된 직원만 지정 가능
- 수정할 때마다 `version`이 올라가 **동시 수정 충돌을 감지**(앱이 덮어쓰지 않고 다시 불러옴)
- 등록·수정·삭제는 `audit_logs`에 누가·언제만 기록(내용은 기록하지 않음), 로그는 수정·삭제 불가

> 역할별 범위(예: 담당자도 팀 전체를 볼지)는 기관 정책에 맞게 바꿀 수 있습니다. `supabase/migrations/…_ppp_schema.sql`의 `case_select` 정책을 수정하세요.

## 2. 설정 순서

### ① 프로젝트 만들기
1. https://supabase.com → New project
2. Region: **Northeast Asia (Seoul)** 권장, DB 비밀번호는 안전한 곳에 보관

### ② 스키마 + RLS 적용
1. 대시보드 → **SQL Editor** → New query
2. 아래 주소를 열어 SQL 전체를 복사(Ctrl+A → Ctrl+C) → SQL Editor에 붙여넣고 **Run**
   https://raw.githubusercontent.com/mediahelper2020-lab/-/main/supabase/migrations/20261026000000_ppp_schema.sql
   (GitHub 화면에서 열었다면 파일 오른쪽 위 **Copy raw file** 버튼으로 복사)
3. 실행이 끝나면 아래 **Results** 창에 4줄짜리 결과표가 나옵니다. 4개 테이블 모두 `RLS 켜짐 = true`, `✅ 설치 완료`면 정상입니다.
   - 결과표가 안 보이면 SQL Editor 아래쪽 패널을 위로 끌어올리거나 Results 탭을 누르세요.
   - 빨간 오류가 나오면 오류 문구와 함께 알려주세요. 이 SQL은 여러 번 실행해도 안전합니다.
   - 따로 확인하려면 아래 쿼리 결과가 0행이어야 합니다.
   ```sql
   select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
   ```

### ③ 인증(Authentication) 보안 설정
대시보드 → **Authentication**
- **Sign In / Providers → Email**: 켜기, **Confirm email** 켜기
- **Allow new users to sign up: 끄기** (초대한 직원만 계정 생성 — 가장 중요)
- 비밀번호 최소 길이 10자 이상, 가능하면 "Leaked password protection" 켜기(요금제에 따라 다름 — 확인 필요)
- **URL Configuration**
  - Site URL: Vercel 주소(예: `https://ppp-record.vercel.app`)
  - Redirect URLs: 같은 주소 추가(초대·비밀번호 재설정 링크가 이 주소로 돌아옴)

### ④ 기관과 첫 관리자 만들기
1. Authentication → Users → **Invite user** → 관리자 이메일로 초대
2. 관리자가 메일 링크를 누르면 앱에서 비밀번호·이름을 설정합니다(이 시점엔 "승인 대기" 화면이 정상)
3. SQL Editor에서 아래 실행 (이메일만 바꾸세요)
   ```sql
   with org as (insert into public.organizations (name) values ('클로드복지관') returning id)
   update public.profiles p set org_id = (select id from org), role = 'admin'
   from auth.users u where u.id = p.id and u.email = 'admin@example.org';
   ```
4. 관리자가 새로고침하면 앱 사용 가능

### ⑤ 직원 추가 (이후에는 앱에서)
1. Supabase: Authentication → Users → **Invite user**로 직원 초대
2. 직원이 메일 링크로 비밀번호 설정
3. 관리자: 앱 [데이터 관리 → 👥 직원 관리]에서 이메일·역할 입력 → [직원 추가]
4. 퇴사·업무 변경 시 같은 화면에서 역할 변경 또는 [기관에서 제외]

### ⑥ 앱에 연결
1. 대시보드 → Project Settings → **API**(또는 API Keys)
2. `js/config.js`에 입력 후 GitHub에 올리면 Vercel이 자동 재배포합니다.
   ```js
   window.PPP_CONFIG = {
     supabaseUrl: 'https://xxxxxxxx.supabase.co',
     supabaseAnonKey: 'anon(public) 또는 Publishable 키',
     idleLogoutMinutes: 30,
   };
   ```
3. ⚠ **service_role / Secret 키는 절대 넣지 마세요.** 이 키는 RLS를 무시합니다. 실수로 넣으면 앱이 실행을 거부하며, 이미 GitHub에 올라갔다면 즉시 Supabase에서 키를 재발급(rotate)하세요.
4. anon 키는 공개되어도 되는 키입니다. RLS가 켜져 있어 이 키만으로는 로그인 없이 아무 데이터도 읽을 수 없습니다.

### ⑦ 기존 브라우저 기록 옮기기
로컬 모드로 쓰던 PC에서 DB 모드로 처음 로그인하면 "이 브라우저 기록을 DB로 옮길까요?"를 묻습니다.
다른 PC의 기록은 그 PC에서 [백업 파일 저장] → DB 모드에서 [백업 파일 불러오기]로 옮깁니다.

## 3. 점검 체크리스트
- [ ] 4개 테이블 RLS enabled
- [ ] 회원가입(Sign up) 꺼짐
- [ ] `js/config.js`에 service_role 키 없음
- [ ] 담당자 계정으로 로그인 → 다른 담당자의 참여자가 보이지 않음
- [ ] 열람 계정으로 로그인 → 입력칸이 잠겨 있음
- [ ] 로그아웃 상태에서 `https://xxxx.supabase.co/rest/v1/cases`를 anon 키로 호출 → 오류(권한 없음)
- [ ] Supabase 대시보드 → Advisors → **Security Advisor** 경고 0건
- [ ] Database → Backups 설정 확인(요금제별 자동 백업 범위 다름 — 확인 필요)

## 4. 알아둘 한계
- 30분(설정 가능) 동안 조작이 없으면 자동 로그아웃합니다.
- 오프라인에서는 저장되지 않습니다(저장 실패 표시 후 다시 불러옴).
- 사진·파일 첨부는 아직 저장하지 않습니다.
- 개인정보 처리 위탁, 국외 이전, 보존기간 등 법적 요건은 **기관 개인정보 보호책임자 검토 필요**(Supabase 서버 위치는 선택한 Region).
