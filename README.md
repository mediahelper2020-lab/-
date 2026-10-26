# 🌱 성민복지관 평생과정설계 (PPP 웹앱)

발달장애인 평생과정설계(PPP)의 **상담(자기소개서) → 지원계획(사전·통합·컨퍼런스·확정회의, 단기계획) → 실천 → 모니터링**을 기록하는 웹앱입니다.

- 🏝 **3D 아바타 마을 홈**: 떠 있는 섬 위 마을에서 대상자 캐릭터가 지금 단계의 장소(이야기집 → 회의마루 → 실천 놀이터 → 전망대)를 돌아다닙니다. 캐릭터를 누르면 진행 단계·꿈과 희망·8개 영역·지원회의 이력을 보고 바로 이어 쓸 수 있습니다.
- 🤖 **ChatGPT · Gemini · Claude**: API 키는 **Vercel 환경변수**에만 두고, AI 버튼을 누를 때마다 모델을 고릅니다.
- ☁ **Supabase**: 로그인과 기록 저장. 다른 PC에서 로그인해도 같은 기록이 보입니다.

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
| `AI_MODELS` | 선택 | 쓸 모델 버전 목록(JSON). 없으면 키가 있는 회사의 기본 모델 2개씩 |
| `AI_DEFAULT_MODEL` | 선택 | 처음 선택될 모델 (예: `gpt-5-mini`) |
| `ALLOWED_EMAILS` | 선택 | AI를 쓸 수 있는 계정. 쉼표로 구분, `@기관도메인` 가능 (예: `@sungmin.or.kr,admin@gmail.com`) |

`AI_MODELS` 예시 — 원하는 버전을 여러 개 넣으면 AI 버튼을 누를 때 모두 고를 수 있습니다:

```json
[
  {"provider":"openai","model":"gpt-5-mini","label":"GPT-5 mini (빠름)"},
  {"provider":"openai","model":"gpt-5","label":"GPT-5"},
  {"provider":"gemini","model":"gemini-2.5-flash","label":"Gemini 2.5 Flash"},
  {"provider":"anthropic","model":"claude-sonnet-5-5","label":"Claude Sonnet"}
]
```

모델 이름은 각 회사 사정에 따라 바뀝니다. 앱의 **🤖 AI 모델 → 연결 테스트**가 실패하면 회사 문서에서 정확한 모델 ID를 확인해 `AI_MODELS`를 고친 뒤 다시 배포하세요.

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
