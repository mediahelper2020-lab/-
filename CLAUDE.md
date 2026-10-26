# CLAUDE.md — AI 개발 지침

## 1. 프로젝트 목적
- 기관: 클로드복지관 (종합사회복지관)
- 프로젝트: PPP 평생과정설계 웹앱 — 발달장애인 평생과정설계(PPP) 참여자의 기록·서식·진행상황을 한곳에서 관리
- 개발 목적: 기록 및 문서 업무 효율화
- 참고 업무흐름: 「평생과정설계 단계별 Process」(준비 → 계획(지원회의) → 실천 → 평가(모니터링))
- TODO(입력 필요): 현장 문제, 주요 사용자 및 사용 환경, 기관 고유 평가기준·예외/승인 절차 → `PROJECT_SPEC.md` 9장 참고

## 2. 작업 원칙
1. 당사자의 **존엄성·자기결정권·접근성**을 우선한다. 화면 문구는 당사자 1인칭·쉬운 말을 쓴다.
2. 서식은 한글(HWP) 원본 3종의 항목·순서를 그대로 따른다. 항목 변경은 `js/schema.js`에서만 한다.
3. 샘플·테스트에는 **가상 데이터만** 쓴다(`js/sample.js`). 실제 이용자 정보를 코드·문서·커밋에 넣지 않는다.
4. 확인되지 않은 법령·평가지표·보존기간은 "검증 필요"로 표기하고 단정하지 않는다.
5. 기능을 바꾸면 관련 MD 문서를 같은 커밋에서 갱신한다(아래 7장).

## 3. 기술 스택
- HTML + CSS + JavaScript (프레임워크·빌드 도구 없음). 외부 라이브러리는 Supabase JS 1개만 허용하며 CDN이 아닌 `js/vendor/`에 버전 고정으로 포함
- 차트: 직접 그린 SVG/CSS (`js/dashboard.js`)
- 저장: `js/config.js`가 비어 있으면 브라우저 `localStorage`(로컬 모드), 값이 있으면 Supabase DB(모든 테이블 RLS) → `SUPABASE_SETUP.md`
- 배포: Vercel 정적 배포(`vercel.json` CSP·보안 헤더), GitHub Pages도 가능

## 4. 파일 구조
```
index.html        화면 뼈대(헤더·탭·모달)
css/style.css     전체 스타일, 반응형, 인쇄용 스타일
js/schema.js      서식 정의(자기소개서·실천계획서·행복한 미래 이야기·진행단계·상태값)
js/ai.js          무료 AI 호출(선택 기능), 프롬프트
js/app.js         저장소, 공통 UI, 진행과정·자기소개서·실천계획서·평가, 출력, 백업, 글자 크기
js/dashboard.js   진행률 계산, 통계 집계, 원형/막대 그래프, 대시보드 화면
js/records.js     참여자 관리, 일정(캘린더), 행복한 미래 이야기
js/sample.js      교육용 가상 예시 데이터
js/config.js      Supabase 연결 설정(anon 키만, 비우면 로컬 모드)
js/cloud.js       로그인·역할·DB 동기화(버전 충돌 감지)·직원 관리·자동 로그아웃
js/vendor/        Supabase JS 2.117.3 (MIT, 고정 버전)
supabase/migrations/  DB 스키마·RLS 정책·트리거 SQL
vercel.json       배포 보안 헤더(CSP 포함)
*.md              설계 문서
```
스크립트는 `<script>` 순서(vendor → config → schema → ai → app → dashboard → records → sample → cloud)대로 전역 함수를 공유한다.

## 5. 코딩 규칙
- 사용자 입력을 HTML에 넣을 때는 반드시 `esc()`를 거친다(XSS 방지). `innerHTML`에 원문을 직접 넣지 않는다.
- 저장은 항상 `save()`를 통한다(디바운스 + 오류 안내, DB 모드면 `Cloud.sync()`). 새 필드는 `normalizeCase()`에 기본값을 추가해 예전 데이터·백업과 호환시킨다.
- 권한 판단은 DB의 RLS가 최종 책임진다. 화면에서 버튼을 숨기는 것만으로 권한을 구현하지 않는다. 새 테이블은 반드시 `enable row level security` + 역할별 정책 + anon 권한 회수를 같은 마이그레이션에 포함한다.
- DB 모드에서는 참여자 기록을 localStorage에 저장하지 않는다.
- 인라인 스크립트·`onclick=` 속성 금지(CSP `script-src 'self'`).
- 입력 검증 실패 시 `role="alert"` 영역에 한국어 문구를 표시하고 해당 입력칸에 포커스를 옮긴다.
- 모든 버튼·입력에는 보이는 라벨 또는 `aria-label`을 둔다. 색만으로 의미를 전달하지 않는다(숫자·문구 병기).
- 차트 색은 `SERIES` 팔레트를 고정 순서로 쓴다. 범례·수치를 함께 표시한다.
- 들여쓰기 2칸, 세미콜론 사용, 한국어 주석은 짧게.

## 6. 금지사항
- 실제 이용자 실명·주민번호·연락처·주소·병력을 샘플/코드/문서/이슈에 포함
- 외부 분석·추적 스크립트, 사용자 동의 없는 외부 전송
- 개인정보 🔒 필드(`PRIVATE_FIELDS`)를 AI 요청에 포함
- Supabase service_role / Secret 키를 코드·설정·문서에 포함(앱은 감지 시 실행 거부)
- RLS를 끄거나 `using (true)` 같은 전체 허용 정책 추가
- 확인되지 않은 법적 의무를 기능 문구에 사실처럼 표기
- 백업 파일 형식(`app: 'ppp'`)을 하위 호환 없이 변경

## 7. 완료 기준 · 문서 갱신 규칙
- 콘솔 오류 0건, `node --check js/*.js` 통과
- `DEVELOPMENT_PLAN.md`의 단계별 검증 항목 수동 점검(데스크톱 1360px, 모바일 390px)
- 백업 → 전체 삭제 → 복원 후 데이터 일치 확인
- DB 정책 변경 시 역할별(관리자·팀장·담당자·열람·승인 대기·비로그인·타 기관) 허용/차단 테스트
- 변경 내용에 따라 갱신: 기능 → `FEATURES.md`, 필드 → `DATA_MODEL.md`, 화면 → `UI_UX.md`, 보안 → `SECURITY.md`·`SUPABASE_SETUP.md`, 사용법 → `README.md`
