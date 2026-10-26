# DATA_MODEL.md — 데이터 구조

## 1. 저장 개요 (현재 MVP)
| 키(localStorage) | 내용 |
|---|---|
| `ppp_cases_v1` | 참여자(Case) 배열 JSON |
| `ppp_cases_v1_cur` | 마지막으로 선택한 참여자 id |
| `ppp_last_backup` | 마지막 백업 시각(ISO) |
| `ppp_font` | 글자 크기 배율 |
| `ppp_ai_settings` | AI 제공자·키(선택 기능) |

## 2. 엔터티
### Case (참여자)
| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| id | string(8) | ✔ | 무작위 식별자 |
| label | string(≤30) | ✔ | 표시 이름(가명·이니셜 권장) |
| created / updated | ISO string | ✔ | 생성·최근 수정 시각 |
| sample | boolean |  | 교육용 가상 데이터 표시 |
| meta | Meta | ✔ | 기관 관리 항목 |
| intro | object | ✔ | 자기소개서 응답(키 = `INTRO_SCHEMA` 필드 id) |
| plan | Plan | ✔ | 실천계획서 |
| stories | { [연도]: object } | ✔ | 행복한 미래 이야기(키 = `storyFields()` id) |
| process | { [stepId]: Step } | ✔ | 진행과정 14단계 |
| activityLog | ActivityEval[] | ✔ | 활동평가 |
| evals | YearEval[] | ✔ | 실천과정 평가(plan.domains 중 단기목표가 있는 행 순서) |
| evalSummary | string |  | 종합 평가 |
| events | Event[] | ✔ | 직접 등록한 일정 |

### Meta
| 필드 | 타입 | 필수 | 값 |
|---|---|---|---|
| status | enum | ✔ | 진행중 / 보류 / 종결 / 자조활동 연계 |
| start | YYYY-MM-DD | ✔ | 참여 시작일(오늘 이전) |
| worker | string(≤20) |  | 담당 사회복지사 |
| memo | string(≤300) |  | 관리 메모 |

### Plan
| 필드 | 타입 | 설명 |
|---|---|---|
| year | number | 대상 연도 |
| stage | enum | 초안 / 사전회의 반영 / 통합회의 반영 / 컨퍼런스회의 반영 / 확정 |
| dream, midGoal, important, needs, success | string | 꿈과 희망, 중장기목표, 중요하게 생각하는 것, 필요한 것, 성공경험 |
| domains | {area, goal, plan, note}[] | 영역별 단기목표·실천계획·비고, 배열 순서 = 우선순위 |

### Step / ActivityEval / YearEval / Event
| 엔터티 | 필드 |
|---|---|
| Step | done: boolean, date: YYYY-MM-DD, memo: string |
| ActivityEval | date, kind(월/분기/반기/수시), content, adjust |
| YearEval | level(달성/부분 달성/진행 중/미달성/목표 변경), memo |
| Event | id, kind(`EVENT_KINDS`), date(필수), time(HH:MM), title(필수 ≤60), memo(≤500), done |

### 서식 응답 키 규칙 (intro, stories 공통)
| 필드 타입 | 저장 형태 |
|---|---|
| text / textarea / radio | `d[id] = string` |
| check | `d[id] = string[]`, 기타 입력 `d[id + '__etc']` |
| grid | `d[id__행__열] = string`, 행 수 추가 시 `d[id__n]` |
| scale | `d[id__그룹__항목] = 수준` |

## 3. 관계
`Case 1 ─ 1 Meta / Plan`, `Case 1 ─ N Event / ActivityEval / Story(연도별)`, `Plan.domains[i](단기목표 있는 행) ─ evals[i]`.
진행과정 단계 진행일은 화면에서 일정으로 파생 표시(별도 저장 안 함).

## 4. 저장 · 삭제 · 복원 정책
- 저장: 입력 시 0.3초 디바운스 후 전체 배열 저장. 저장 실패(용량 초과 등) 시 경고창.
- 삭제: 참여자 삭제는 즉시·영구(휴지통 없음). 표시 이름 재입력으로 확인.
- 복원: `{ app:'ppp', version:1, exported, cases[] }` 형식만 허용. 같은 id는 덮어쓰기, 새 id는 추가(병합). 불러온 항목은 `normalizeCase()`로 누락 필드 보정.
- 마이그레이션: 필드 추가 시 `normalizeCase()`에 기본값 추가. 구조 변경 시 `version`을 올리고 변환 함수 작성.
- 보존기간·파기 기준: **검증 필요**(기관 지침·관련 법령 확인 후 기재).

## 5. Supabase DB (구현됨 — `supabase/migrations/20261026000000_ppp_schema.sql`)
`js/config.js`에 Supabase URL·anon 키를 넣으면 DB 모드로 동작한다. 설정 절차는 `SUPABASE_SETUP.md`.

### 5-1. 테이블 (모두 RLS enabled)
| 테이블 | 주요 컬럼 | 비고 |
|---|---|---|
| organizations | id uuid, name(1~100자), created_at | 기관. SQL Editor에서만 생성 |
| profiles | id(=auth.users.id), org_id, role(admin/manager/worker/viewer/pending), display_name(≤30) | 가입 시 트리거로 pending 생성 |
| cases | id text(4~32, 영문소문자·숫자), org_id, label(1~30), status(4종), assigned_to, is_sample, data jsonb(<2MB), version, created_by/at, updated_by/at | `data` = 앱 Case 구조(id·label·sample 제외) |
| audit_logs | id, org_id, user_id, case_id, action(insert/update/delete), at | 내용 미기록, 트리거로만 기록 |

### 5-2. 함수·트리거
| 이름 | 역할 |
|---|---|
| private.my_org_id(), private.my_role() | RLS용 현재 사용자 기관·역할 (security definer, API 비노출 스키마) |
| on_auth_user_created | 가입 시 profiles(pending) 생성 |
| guard_profile | 본인 역할·기관 변경 차단, 역할 변경은 같은 기관 관리자만 |
| guard_case | org_id·created_by 서버 강제, version +1, 담당자는 같은 기관 승인 직원만 |
| log_case | 등록·수정·삭제 접근 기록 |
| public.add_member(email, role) | 관리자가 가입 직원을 기관에 추가 |

### 5-3. 동기화 규칙 (`js/cloud.js`)
- 로그인 후 권한 범위의 `cases` 전체를 불러와 `state.cases`로 사용(localStorage에 저장하지 않음)
- 저장 시 마지막 동기화 상태와 비교해 변경된 참여자만: 신규 → insert, 기존 → `update … where id = ? and version = ?`, 목록에서 사라진 참여자 → delete
- 0행 갱신(버전 불일치·권한 없음) → 알림 후 DB에서 다시 불러옴(덮어쓰기 방지)
- 백업 JSON 형식은 로컬 모드와 동일(`app:'ppp'`)
