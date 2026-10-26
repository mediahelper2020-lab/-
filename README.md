# 🌱 성민복지관 평생과정설계 (PPP 웹앱)

발달장애인 평생과정설계(PPP)의 **상담(자기소개서) → 지원계획(사전·통합·컨퍼런스·확정회의, 단기계획) → 실천 → 모니터링**을 기록하는 웹앱입니다.

- 🏝 **3D 아바타 마을 홈**: 떠 있는 섬 위 마을에서 대상자 캐릭터가 지금 단계의 장소(이야기집 → 회의마루 → 실천 놀이터 → 전망대)를 돌아다닙니다. 캐릭터를 누르면 진행 단계·꿈과 희망·8개 영역·지원회의 이력을 보고 바로 이어 쓸 수 있습니다.
- 🤖 **ChatGPT · Gemini · Claude**: API 키는 **Vercel 환경변수**에만 두고, AI 버튼을 누를 때마다 모델을 고릅니다.
- ☁ **Supabase**: 로그인과 기록 저장. 다른 PC에서 로그인해도 같은 기록이 보입니다.
- ✍ **서술형 → 양식 초안**: 상담·지원계획·실천·모니터링 화면 맨 위에 대상자 이야기를 서술형으로 적고, 언어모델을 고른 뒤 **AI 초안 생성**을 누르면 지금 열린 양식의 각 칸에 맞춰 채웁니다(미리보기 후 「빈 칸만 채우기」/「모두 바꾸기」).
- ⛶ **3D 마을 전체화면**: 마을 아래 「전체화면」 버튼 (Esc 또는 「닫기」로 돌아옴).

---

## 1. Supabase 준비 (5분)

1. <https://supabase.com> → **New project** (Region은 **Northeast Asia (Seoul)** 권장)
2. 왼쪽 **SQL Editor** → `supabase/schema.sql` 내용을 붙여넣고 **Run**
   - 로그인한 사람마다 자기 기록만 읽고 쓸 수 있게 보안 규칙(RLS)이 켜집니다.
3. **Authentication → Users → Add user** 로 사회복지사 계정(이메일·비밀번호)을 만듭니다.
   - 아무나 가입하지 못하게 하려면 **Authentication → Sign In / Providers → Allow new users to sign up** 을 끕니다.
4. **Project Settings → API** 에서 두 값을 복사합니다.
   - `Project URL` → `SUPABASE_URL`
   - `anon public` 키 → `SUPABASE_ANON_KEY` (공개용 키입니다. `service_role` 키는 **절대 넣지 마세요**)

## 2. Vercel 환경변수 등록

Vercel 프로젝트 → **Settings → Environment Variables** 에 추가하고, **Deployments → Redeploy** 합니다.

| 이름 | 필수 | 내용 |
|---|---|---|
| `SUPABASE_URL` | ✅ | Supabase Project URL |
| `SUPABASE_ANON_KEY` | ✅ | Supabase anon public 키 |
| `OPENAI_API_KEY` | 선택 | ChatGPT 키 (<https://platform.openai.com/api-keys>) |
| `GEMINI_API_KEY` | 선택 | Gemini 키 (<https://aistudio.google.com/apikey>) |
| `ANTHROPIC_API_KEY` | 선택 | Claude 키 (<https://console.anthropic.com/settings/keys>) |
| `AI_MODEL_LIMIT` | 선택 | 회사별로 보여줄 최대 모델 수 (기본 15) |
| `AI_MODELS` | 선택 | 목록에 꼭 넣을 모델(JSON). 예: `[{"provider":"openai","model":"gpt-6-luna","label":"GPT-6 Luna"}]` |
| `AI_MODELS_EXCLUDE` | 선택 | 숨길 모델 ID, 쉼표 구분 (앞부분만 써도 됨, 예: `o4,gemini-2.5`) |
| `AI_DEFAULT_MODEL` | 선택 | 처음 선택될 모델 ID |
| `ALLOWED_EMAILS` | 선택 | AI를 쓸 수 있는 계정. 쉼표로 구분, `@기관도메인` 가능 (예: `@sungmin.or.kr,admin@gmail.com`) |

### 모델 목록은 자동으로 최신 유지
서버가 각 회사의 모델 목록 API에서 **지금 그 키로 쓸 수 있는 대화형 모델**을 받아와 최신순으로 보여줍니다(10분마다 갱신).
새 모델이 나오거나 옛 모델이 종료되어도 코드를 고칠 필요가 없습니다. 음성·이미지·임베딩·날짜 고정 버전은 자동으로 뺍니다.
앱의 **🤖 AI 모델** 화면에서 회사별 연결 상태(키 오류 등)와 「🔄 최신 모델 다시 불러오기」를 쓸 수 있습니다.


### ChatGPT(OpenAI)가 안 될 때
앱의 **🤖 AI 모델 → 🩺 연결 점검**을 누르면 키 형식 → 모델 목록 → 실제 호출 순서로 점검하고 원인을 알려줍니다.

| 점검 결과 | 해결 |
|---|---|
| 크레딧(잔액)이 없다 | platform.openai.com → Settings → **Billing**에서 결제수단 등록·크레딧 충전 (ChatGPT Plus 구독과 API 요금은 별개) |
| API 키가 올바르지 않다 | platform.openai.com/api-keys 에서 새 키 → Vercel `OPENAI_API_KEY` 교체 → Redeploy |
| 권한이 제한된 키(Restricted) | 새 키를 만들 때 Permissions를 **All**로 |
| 조직 인증이 필요한 모델 | Settings → Organization → General → **Verify Organization**, 또는 다른 GPT 모델 선택 |
| 이 키로는 모델을 쓸 수 없다 | 사용량 등급(Tier)이 낮으면 최신 모델이 막힐 수 있음 → 다른 GPT 모델 선택 |

## 3. 보안 구조

- API 키는 Vercel 서버 함수(`api/`)에만 있고 브라우저·작성본 HTML·백업 파일로 나오지 않습니다.
- `/api/ai` 는 **Supabase에 로그인한 사람만** 호출할 수 있습니다(로그인 토큰을 서버에서 확인). 주소를 알아도 로그인 없이 AI 요금을 쓸 수 없습니다.
- AI에는 이름·생년월일·연락처·주소·작성자·함께하는 사람 정보를 보내지 않고, 글 속 이름은 「당사자」로 바꿔 보냅니다. 자유서술 칸의 다른 개인정보는 그대로 전송되므로 기관 지침에 맞게 확인하세요.
- 기록은 Supabase에 계정별로 저장됩니다(RLS로 다른 계정은 볼 수 없음). 같은 계정을 두 곳에서 동시에 고치면 나중에 저장하려는 쪽에서 어느 기록을 쓸지 묻습니다.
- 로그아웃할 때 「이 기기의 기록 지우기」를 고를 수 있습니다(공용 PC 권장).

## 4. 파일 구성

```
index.html            배포되는 앱 (원본 디자인 + src 파일을 합친 것)
src/village3d.js      3D 마을·3D 캐릭터 (Three.js)
src/village-ai.js     마을 화면·캐릭터 카드·아바타 만들기·AI 기능
src/cloud.js          Supabase 로그인·클라우드 저장
src/village-ai.css    화면 디자인
api/                  Vercel 서버 함수 (config · models · ai)
supabase/schema.sql   Supabase 테이블·보안 규칙
build.py              src 파일을 index.html에 넣는 스크립트
```

`src/`를 고친 뒤 `python3 build.py` 를 실행하면 `index.html`에 반영됩니다.
Vercel 설정은 Framework Preset `Other`, Build Command·Output Directory는 비워 둡니다.

`index.html`을 파일로 직접 열면 로그인·AI 없이 이 브라우저에만 저장되는 모드로 동작합니다.
3D를 지원하지 않는 기기에서는 마을이 2D 그림으로 자동 전환됩니다.
