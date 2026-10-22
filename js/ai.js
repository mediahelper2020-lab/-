// AI 연동 — Google Gemini 무료 API 키(사용자 본인 키)를 브라우저에서 직접 호출
// 키는 이 브라우저의 localStorage에만 저장되며, 서버로 전송되지 않습니다.

const AI = {
  settingsKey: 'ppp_ai_settings',

  getSettings() {
    try { return JSON.parse(localStorage.getItem(this.settingsKey)) || {}; } catch { return {}; }
  },
  saveSettings(s) {
    try { localStorage.setItem(this.settingsKey, JSON.stringify(s)); } catch {}
  },
  hasKey() { return !!this.getSettings().key; },

  async call(prompt, { json = false } = {}) {
    const { key, model = 'gemini-2.5-flash' } = this.getSettings();
    if (!key) throw new Error('API 키가 없습니다. 상단 [⚙ AI 설정]에서 무료 Gemini API 키를 입력해주세요.');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const body = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.6, ...(json ? { responseMimeType: 'application/json' } : {}) },
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error?.message || res.statusText;
      if (res.status === 429) throw new Error('무료 사용량 한도를 초과했습니다. 1분 정도 뒤에 다시 시도해주세요.\n' + msg);
      throw new Error(`AI 호출 실패 (${res.status}): ${msg}`);
    }
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    if (!text) throw new Error('AI 응답이 비어 있습니다. 잠시 후 다시 시도해주세요.');
    if (!json) return text.trim();
    return JSON.parse(text.replace(/^```json\s*|```$/g, ''));
  },
};

const SYSTEM_PROMPT = `당신은 발달장애인 평생과정설계(PPP: Person-centered Planning Process)를 지원하는 숙련된 사회복지사입니다.
원칙:
- 당사자 중심: 당사자의 꿈, 강점, 선호를 출발점으로 삼고 "결핍"보다 "힘과 필요"의 언어로 씁니다.
- 쉬운 말: 당사자와 가족이 읽고 이해할 수 있도록 짧고 쉬운 문장으로 씁니다. 당사자의 1인칭("나는 ~")을 기본으로 합니다.
- 구체성: 목표는 측정 가능하고 실천 가능하게(누가/언제/어디서/무엇을/얼마나) 씁니다.
- 지역사회 중심: 시설 안이 아닌 지역사회 자원(주민센터, 도서관, 복지관, 동호회, 시민옹호인, 활동지원사 등)을 활용합니다.
- 입력에 없는 사실을 지어내지 않습니다. 정보가 부족하면 "(확인 필요)"라고 표시합니다.
- 실명 등 개인식별정보는 쓰지 않고 "당사자"로 지칭합니다.`;

// AI로 보낼 자기소개서 요약 (개인식별정보 제외)
function summarizeIntro(intro) {
  const lines = [];
  for (const sec of INTRO_SCHEMA) {
    const part = [];
    for (const f of sec.fields) {
      if (f.private || PRIVATE_FIELDS.includes(f.id) || f.type === 'heading' || f.type === 'note') continue;
      const v = formatValue(f, intro);
      if (v) part.push(`- ${f.label}: ${v}`);
    }
    if (part.length) lines.push(`[${sec.title}]\n${part.join('\n')}`);
  }
  return lines.join('\n\n');
}

function formatValue(f, d) {
  switch (f.type) {
    case 'text': case 'textarea': case 'radio':
      return (d[f.id] || '').toString().trim();
    case 'check':
      return (d[f.id] || []).join(', ') + (d[f.id + '__etc'] ? ` (기타: ${d[f.id + '__etc']})` : '');
    case 'grid': {
      const rows = f.rowLabels || Array.from({ length: d[f.id + '__n'] || f.rows }, (_, i) => `${i + 1}`);
      const out = [];
      rows.forEach((r, ri) => {
        const cells = f.cols.map((c, ci) => {
          const v = (d[`${f.id}__${ri}__${ci}`] || '').trim();
          return v ? `${c}=${v}` : '';
        }).filter(Boolean);
        if (cells.length) out.push(`${f.rowLabels ? r + ': ' : ''}${cells.join(', ')}`);
      });
      return out.join(' / ');
    }
    case 'scale': {
      const byLevel = {};
      f.groups.forEach((g, gi) => g.items.forEach((it, ii) => {
        const v = d[`${f.id}__${gi}__${ii}`];
        if (v) (byLevel[v] = byLevel[v] || []).push(it);
      }));
      return Object.entries(byLevel).map(([lv, items]) => `${lv}: ${items.join(', ')}`).join(' / ');
    }
  }
  return '';
}

const AIPrompts = {
  plan(intro) {
    return `아래는 발달장애 당사자의 평생과정설계 자기소개서 내용입니다.
이를 바탕으로 「미래설계 실천계획서」 초안을 JSON으로 작성하세요.

${summarizeIntro(intro) || '(작성된 내용이 거의 없음)'}

출력 JSON 형식:
{
  "dream": "꿈과 희망 (당사자 1인칭, 2~3문장)",
  "midGoal": "중장기목표 (3~5년 관점, 2~3개 항목을 줄바꿈으로)",
  "important": "내가 중요하게 생각하는 것 (가치, 관계, 루틴 등)",
  "needs": "나에게 필요한 것 (지원, 자원, 기술)",
  "success": "성공경험 (자기소개서에 나타난 강점과 해낸 경험)",
  "domains": [
    {"area": "교육|보건의료|문화여가|직업|결혼|주거|법적|소득재정 중 하나", "goal": "단기목표(2년, 측정가능)", "plan": "해당연도 실천계획(누가/언제/어디서/무엇을, 2~3개 줄바꿈)", "note": "필요 자원·협력자"}
  ]
}
domains는 자기소개서에서 욕구가 드러난 영역 위주로 3~6개를 우선순위 순서로 작성하세요.`;
  },

  polish(label, text) {
    return `다음은 평생과정설계 문서의 「${label}」 항목입니다. 의미는 그대로 두고, 당사자와 가족이 이해하기 쉬운 짧은 문장으로 다듬어 주세요. 다듬은 문장만 출력하세요.\n\n${text}`;
  },

  goal(area, intro, current) {
    return `발달장애 당사자의 「${area}」 영역 단기목표(2년)와 해당연도 실천계획을 제안하세요.
자기소개서 요약:
${summarizeIntro(intro)}

현재 작성된 내용: ${current || '(없음)'}

JSON으로만 출력: {"goal": "측정 가능한 단기목표 1문장", "plan": "실천계획 2~3개 (줄바꿈 구분, 누가/언제/어디서/무엇을)", "note": "필요 자원·협력자"}`;
  },

  meeting(stepName, stepDesc, intro, plan) {
    return `평생과정설계 지원회의 중 「${stepName}」(${stepDesc}) 단계를 진행하려 합니다.
사회복지사가 회의를 진행할 때 사용할 수 있도록 아래를 작성하세요.
1) 회의 목적 한 줄
2) 당사자에게 물어볼 쉬운 질문 5개 (그림/선택지 활용 팁 포함)
3) 보호자·지원자에게 물어볼 질문 3개
4) 회의 진행 시 유의점 3개

참고 자료(자기소개서 요약):
${summarizeIntro(intro) || '(없음)'}
${plan?.dream ? `\n현재 꿈과 희망: ${plan.dream}` : ''}`;
  },

  evaluate(plan, evals) {
    const rows = (plan.domains || []).map((d, i) => `- [${d.area}] 목표: ${d.goal} / 계획: ${d.plan} / 달성도: ${evals?.[i]?.level || '미평가'} / 메모: ${evals?.[i]?.memo || ''}`).join('\n');
    return `평생과정설계 실천과정 평가(연 1회)를 작성하려 합니다. 아래 영역별 목표와 달성 현황을 바탕으로
1) 영역별 목표평가 요약 (잘된 점 / 어려웠던 점)
2) 지원내용에 대한 평가 (지원 방법, 협력자 역할)
3) 다음 연도 실천계획에 반영할 제안
을 쉬운 말로 작성하세요.

꿈과 희망: ${plan.dream || ''}
중장기목표: ${plan.midGoal || ''}
${rows}`;
  },
};

// API 키 없이도 동작하는 규칙 기반 초안 (자기소개서 응답을 계획서 칸에 옮겨 담기)
function offlinePlanDraft(intro) {
  const g = (id) => (intro[id] || '').toString().trim();
  const grid = (id, ri, ci) => (intro[`${id}__${ri}__${ci}`] || '').trim();
  const checks = (id) => (intro[id] || []).filter(x => x !== '기타');

  const likes = [];
  for (let r = 0; r < 8; r++) { const v = grid('likes', r, 0); if (v) likes.push(v); }

  const strengths = [];
  ['adl', 'social'].forEach(id => {
    const field = INTRO_SCHEMA.flatMap(s => s.fields).find(x => x.id === id);
    field.groups.forEach((gr, gi) => gr.items.forEach((it, ii) => {
      if (intro[`${id}__${gi}__${ii}`] === '수행가능') strengths.push(it);
    }));
  });

  const needs = [
    ...checks('health_need'), ...checks('leisure_need'), ...checks('house_need'), ...checks('money_need'),
  ];

  const domains = [];
  const add = (area, goal, plan, note = '') => { if (goal) domains.push({ area, goal, plan, note }); };
  const edu = grid('edu_future', 0, 0);
  add('교육', edu && `${edu} 교육에 참여한다.`, edu && `- 지역 내 ${edu} 교육기관 찾아보기\n- 신청 및 정기 참여하기`, grid('edu_future', 0, 2));
  if (checks('health_need').length) add('보건의료', `${checks('health_need')[0]}을(를) 꾸준히 실천한다.`, `- ${checks('health_need').join('\n- ')}`, g('health_need_desc'));
  const leisure = grid('leisure_hope', 0, 0);
  add('문화여가', leisure && `${leisure} 활동을 정기적으로 한다.`, leisure && `- ${grid('leisure_hope', 0, 1) || '함께할 사람'}와(과) ${grid('leisure_hope', 0, 2) || '정해진 시간'}에 ${leisure} 하기`, checks('leisure_need').join(', '));
  const job = g('job_hope');
  add('직업', job && `${job} 직업을 위한 준비를 시작한다.`, job && (g('job_hope_prep') || `- ${job} 관련 직업훈련 알아보기`), g('job_hope_support'));
  if (g('dating_want') === '네' || g('marry_want') === '네') add('결혼', '의미 있는 관계를 맺고 이어간다.', `- ${[...checks('dating_need'), ...checks('marry_need')].join('\n- ') || '관계 맺기 지원'}`);
  if (checks('house_need').length) add('주거', '살고 싶은 집을 준비한다.', `- ${checks('house_need').join('\n- ')}`);
  if (checks('advocate').length) add('법적', `나를 응원해주는 사람(${checks('advocate').join(', ')})과 함께한다.`, `- ${checks('advocate_help').slice(0, 3).join('\n- ')}`);
  if (checks('money_need').length) add('소득재정', '돈을 계획적으로 관리한다.', `- ${checks('money_need').join('\n- ')}`, checks('asset_need').join(', '));

  return {
    dream: g('dream') || g('happiness'),
    midGoal: domains.slice(0, 3).map(d => `${d.area}: ${d.goal}`).join('\n'),
    important: [likes.length && `좋아하는 것: ${likes.join(', ')}`, g('comfort') && `편안하게 하는 방법: ${g('comfort')}`].filter(Boolean).join('\n'),
    needs: needs.join(', '),
    success: [g('good_at'), strengths.length && `스스로 할 수 있는 것: ${strengths.slice(0, 8).join(', ')}`].filter(Boolean).join('\n'),
    domains,
  };
}
