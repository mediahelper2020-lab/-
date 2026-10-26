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

## 5. 서버 DB 설계안 (별도 설계 필요 — 미구현)
지침서의 저장 방식은 "서버 DB"이나 호스팅 주체·인증·개인정보 처리 승인이 확정되지 않아 현재는 브라우저 저장으로 구현했다. 아래는 제안이며 확정 전 검토가 필요하다.

| 테이블 | 주요 컬럼 |
|---|---|
| users | id, name, role(admin/worker/viewer), org_id |
| cases | id, org_id, label, status, start_date, worker_id, created_at, updated_at, deleted_at |
| case_forms | case_id, form_type(intro/plan/story), year, data(JSONB), updated_by, updated_at |
| process_steps | case_id, step_id, done, date, memo |
| evaluations | case_id, kind(activity/year), date, data(JSONB) |
| events | id, case_id, kind, date, time, title, memo, done |
| audit_logs | id, user_id, case_id, action, at |

- 후보: Vercel 서버리스 함수 + 관리형 PostgreSQL(예: Supabase) — 검증 필요
- 필수: 로그인, 역할별 권한(담당자는 본인 담당 참여자만 수정), 행 단위 접근 통제, 전송·저장 암호화, 접근 기록
- 프론트 전환: `load()/save()`를 저장소 어댑터로 분리해 localStorage ↔ API 교체
