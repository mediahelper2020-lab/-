// 평생과정설계 웹앱 — 참여자별 데이터는 브라우저 localStorage에 저장
const STORE_KEY = 'ppp_cases_v1';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => (s ?? '').toString().replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);

const state = { cases: [], currentId: null, tab: 'process', introSection: 0 };

// ---------- 저장소 ----------
function load() {
  try { state.cases = JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch { state.cases = []; }
  try { state.currentId = localStorage.getItem(STORE_KEY + '_cur'); } catch {}
  if (!state.cases.find(c => c.id === state.currentId)) state.currentId = state.cases[0]?.id || null;
}
let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state.cases));
      localStorage.setItem(STORE_KEY + '_cur', state.currentId || '');
      flash('저장됨');
    } catch (e) { alert('저장 공간이 부족하거나 저장할 수 없습니다: ' + e.message); }
  }, 300);
}
const cur = () => state.cases.find(c => c.id === state.currentId);

function newCase(name) {
  const c = {
    id: uid(), label: name || '새 참여자', created: new Date().toISOString(),
    intro: {}, plan: { year: new Date().getFullYear(), domains: DOMAINS.map(a => ({ area: a, goal: '', plan: '', note: '' })) },
    process: {}, evals: [], evalSummary: '', activityLog: [],
  };
  state.cases.push(c); state.currentId = c.id; save();
  return c;
}

// ---------- 공통 UI ----------
function flash(msg) {
  const el = $('#flash'); el.textContent = msg; el.classList.add('show');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 1200);
}
function modal(title, html, buttons = []) {
  const m = $('#modal');
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = html;
  const foot = $('#modal-foot'); foot.innerHTML = '';
  [...buttons, { label: '닫기', cls: 'ghost' }].forEach(b => {
    const btn = document.createElement('button');
    btn.textContent = b.label; btn.className = b.cls || 'primary';
    btn.onclick = () => { if (b.onClick?.() !== false) m.close(); };
    foot.appendChild(btn);
  });
  m.showModal();
}
async function withLoading(btn, fn) {
  const old = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin"></span> AI 작성 중…';
  try { return await fn(); }
  catch (e) { alert(e.message); }
  finally { btn.disabled = false; btn.innerHTML = old; }
}
function requireKey() {
  if (AI.hasKey()) return true;
  modal('AI 설정이 필요해요', `<p>AI 기능을 쓰려면 <b>무료 Google Gemini API 키</b>가 필요합니다. 상단 <b>⚙ AI 설정</b>에서 입력해주세요.</p><p class="muted">키 없이도 계획서의 <b>[AI 없이 초안 채우기]</b>는 사용할 수 있습니다.</p>`,
    [{ label: 'AI 설정 열기', onClick: () => { setTimeout(openSettings, 50); } }]);
  return false;
}

// ---------- 헤더 ----------
function renderHeader() {
  const sel = $('#case-select');
  sel.innerHTML = state.cases.map(c => `<option value="${c.id}" ${c.id === state.currentId ? 'selected' : ''}>${esc(c.label)}</option>`).join('') || '<option>참여자 없음</option>';
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === state.tab));
  $('#ai-status').textContent = AI.hasKey() ? '● AI 연결됨' : '○ AI 미설정';
  $('#ai-status').className = AI.hasKey() ? 'ok' : 'off';
}

function render() {
  renderHeader();
  const main = $('#main');
  if (state.tab === 'guide') return renderGuide(main);
  if (!cur()) {
    main.innerHTML = `<div class="empty"><h2>참여자를 먼저 등록해주세요</h2><p>참여자별로 자기소개서, 실천계획서, 진행과정이 따로 저장됩니다.</p><button class="primary" id="first-case">+ 새 참여자 등록</button></div>`;
    $('#first-case').onclick = addCase; return;
  }
  ({ process: renderProcess, intro: renderIntro, plan: renderPlan, eval: renderEval })[state.tab](main);
}

function addCase() {
  const name = prompt('참여자 표시 이름 (가명/이니셜 권장, 예: 김OO, A님)');
  if (name === null) return;
  newCase(name.trim() || '새 참여자'); render();
}

// ---------- 1. 진행과정 ----------
function renderProcess(main) {
  const c = cur(); const p = c.process;
  const total = PROCESS.flatMap(x => x.steps).length;
  const done = PROCESS.flatMap(x => x.steps).filter(s => p[s.id]?.done).length;
  main.innerHTML = `
    <div class="page-head">
      <div><h2>평생과정설계 단계별 진행과정</h2><p class="muted">각 단계의 진행일과 회의 메모를 기록하세요. 지원회의 단계에서는 AI가 회의 질문을 추천해줍니다.</p></div>
      <div class="progress-wrap"><div class="progress"><i style="width:${done / total * 100}%"></i></div><span>${done}/${total} 단계 완료</span></div>
    </div>
    <div class="phases">
      ${PROCESS.map(ph => `
        <section class="phase">
          <header><b>${ph.phase}</b>${ph.sub ? `<small>(${ph.sub})</small>` : ''}</header>
          ${ph.steps.map(s => {
            const v = p[s.id] || {};
            return `<article class="step ${v.done ? 'done' : ''}" data-step="${s.id}">
              <label class="step-title"><input type="checkbox" data-k="done" ${v.done ? 'checked' : ''}> ${s.name}</label>
              <p class="muted small">${s.desc}</p>
              <input type="date" data-k="date" value="${esc(v.date)}" aria-label="${s.name} 진행일">
              <textarea data-k="memo" rows="2" placeholder="참석자, 논의 내용, 결정 사항 메모">${esc(v.memo)}</textarea>
              <button class="ai-btn small" data-meet="${s.id}">✨ AI 회의 질문 추천</button>
            </article>`;
          }).join('')}
        </section>`).join('')}
    </div>
    <p class="note-pink">※ 미래설계 지원 3년(지원회의 1년, 실천 2년) 후 미래설계 자조활동으로 연계 예정</p>`;

  $$('.step', main).forEach(el => {
    const id = el.dataset.step;
    $$('[data-k]', el).forEach(inp => {
      inp.addEventListener(inp.type === 'checkbox' ? 'change' : 'input', () => {
        p[id] = p[id] || {};
        p[id][inp.dataset.k] = inp.type === 'checkbox' ? inp.checked : inp.value;
        if (inp.type === 'checkbox') { el.classList.toggle('done', inp.checked); save(); renderProcess(main); return; }
        save();
      });
    });
  });
  $$('[data-meet]', main).forEach(btn => btn.onclick = () => {
    if (!requireKey()) return;
    const s = PROCESS.flatMap(x => x.steps).find(x => x.id === btn.dataset.meet);
    withLoading(btn, async () => {
      const txt = await AI.call(AIPrompts.meeting(s.name, s.desc, c.intro, c.plan));
      modal(`${s.name} — AI 추천 질문`, `<pre class="ai-out">${esc(txt)}</pre>`, [{
        label: '메모에 추가', onClick: () => { p[s.id] = p[s.id] || {}; p[s.id].memo = ((p[s.id].memo || '') + '\n' + txt).trim(); save(); render(); },
      }, { label: '복사', cls: 'ghost', onClick: () => { navigator.clipboard?.writeText(txt); flash('복사됨'); return false; } }]);
    });
  });
}

// ---------- 2. 자기소개서 ----------
function sectionFilled(sec, d) {
  const fs = sec.fields.filter(f => !['heading', 'note'].includes(f.type));
  const n = fs.filter(f => formatValue(f, d) || (f.private && d[f.id])).length;
  return [n, fs.length];
}

function renderIntro(main) {
  const c = cur(); const d = c.intro;
  const sec = INTRO_SCHEMA[state.introSection];
  main.innerHTML = `
    <div class="intro-layout">
      <nav class="side">
        <p class="side-title">행복을 이루기 위한<br><b>“나”의 이야기</b></p>
        ${INTRO_SCHEMA.map((s, i) => { const [n, t] = sectionFilled(s, d); return `<button class="${i === state.introSection ? 'active' : ''}" data-sec="${i}"><span>${s.domain ? '📘 ' : ''}${s.section}</span><em class="${n === t ? 'full' : n ? 'part' : ''}">${n}/${t}</em></button>`; }).join('')}
        <div class="side-actions">
          <button class="ghost" id="print-intro">🖨 인쇄 / PDF</button>
          <button class="ghost" id="doc-intro">📄 한글/워드 파일(.doc)</button>
        </div>
      </nav>
      <div class="form-area">
        <h2>${esc(sec.title)}</h2>
        ${sec.desc ? `<p class="desc">${esc(sec.desc)}</p>` : ''}
        ${sec.domain ? `<p class="muted small">이 영역의 응답은 실천계획서 「${sec.domain}」 영역 목표를 세우는 데 활용됩니다.</p>` : ''}
        <div class="fields">${sec.fields.map(f => fieldHTML(f, d)).join('')}</div>
        <div class="pager">
          ${state.introSection > 0 ? `<button class="ghost" data-go="${state.introSection - 1}">← ${INTRO_SCHEMA[state.introSection - 1].section}</button>` : '<span></span>'}
          ${state.introSection < INTRO_SCHEMA.length - 1 ? `<button class="primary" data-go="${state.introSection + 1}">${INTRO_SCHEMA[state.introSection + 1].section} →</button>` : `<button class="primary" id="to-plan">실천계획서 작성하기 →</button>`}
        </div>
      </div>
    </div>`;

  $$('[data-sec]', main).forEach(b => b.onclick = () => { state.introSection = +b.dataset.sec; renderIntro(main); window.scrollTo(0, 0); });
  $$('[data-go]', main).forEach(b => b.onclick = () => { state.introSection = +b.dataset.go; renderIntro(main); window.scrollTo(0, 0); });
  $('#to-plan', main)?.addEventListener('click', () => { state.tab = 'plan'; render(); window.scrollTo(0, 0); });
  $('#print-intro').onclick = () => printDoc(introDocHTML(c));
  $('#doc-intro').onclick = () => downloadDoc(`자기소개서_${c.label}.doc`, introDocHTML(c));
  bindFields(main, d, () => {
    // 이름 입력 시 참여자 표시 이름이 비어있으면 자동 반영
    if (d.name && c.label === '새 참여자') { c.label = d.name; renderHeader(); }
    const [n, t] = sectionFilled(sec, d);
    const em = $(`[data-sec="${state.introSection}"] em`, main);
    em.textContent = `${n}/${t}`; em.className = n === t ? 'full' : n ? 'part' : '';
  });
}

function fieldHTML(f, d) {
  const lock = f.private ? ' <span class="lock" title="AI에 전송되지 않는 개인정보">🔒</span>' : '';
  switch (f.type) {
    case 'heading': return `<h3 class="fh">${esc(f.text)}</h3>`;
    case 'note': return `<p class="muted">${esc(f.text)}</p>`;
    case 'text':
      return `<label class="f"><span>${esc(f.label)}${lock}</span><input type="${f.input || 'text'}" data-id="${f.id}" value="${esc(d[f.id])}" placeholder="${esc(f.placeholder || '')}"></label>`;
    case 'textarea':
      return `<label class="f wide"><span>${esc(f.label)}${lock}</span>${f.hint ? `<small class="muted">${esc(f.hint)}</small>` : ''}<textarea data-id="${f.id}" rows="${f.rows || 3}">${esc(d[f.id])}</textarea>${f.ai ? `<button class="ai-btn small" data-polish="${f.id}" data-label="${esc(f.label)}">✨ 쉬운 말로 다듬기</button>` : ''}</label>`;
    case 'radio':
      return `<div class="f"><span>${esc(f.label)}</span><div class="opts">${f.options.map(o => `<label class="chip"><input type="radio" name="${f.id}" data-id="${f.id}" value="${esc(o)}" ${d[f.id] === o ? 'checked' : ''}>${esc(o)}</label>`).join('')}</div></div>`;
    case 'check': {
      const v = d[f.id] || [];
      return `<div class="f wide"><span>${esc(f.label)}</span><div class="opts ${f.column ? 'col' : ''}">${f.options.map(o => `<label class="chip"><input type="checkbox" data-id="${f.id}" value="${esc(o)}" ${v.includes(o) ? 'checked' : ''}>${esc(o)}</label>`).join('')}</div>${f.options.includes('기타') ? `<input class="etc" data-id="${f.id}__etc" value="${esc(d[f.id + '__etc'])}" placeholder="기타 내용">` : ''}</div>`;
    }
    case 'grid': {
      const n = f.rowLabels ? f.rowLabels.length : (d[f.id + '__n'] || f.rows);
      return `<div class="f wide"><span>${esc(f.label)}${lock}</span><div class="tbl-wrap"><table class="grid"><thead><tr>${f.rowLabels ? '<th></th>' : ''}${f.cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>
        ${Array.from({ length: n }, (_, r) => `<tr>${f.rowLabels ? `<th>${esc(f.rowLabels[r])}</th>` : ''}${f.cols.map((_, ci) => `<td><textarea rows="1" data-id="${f.id}__${r}__${ci}">${esc(d[`${f.id}__${r}__${ci}`])}</textarea></td>`).join('')}</tr>`).join('')}
      </tbody></table></div>${f.rowLabels ? '' : `<button class="ghost small" data-addrow="${f.id}">+ 행 추가</button>`}</div>`;
    }
    case 'scale':
      return `<div class="f wide"><span>${esc(f.label)}</span><div class="tbl-wrap"><table class="grid scale"><thead><tr><th>활동</th>${LEVELS.map(l => `<th>${l}</th>`).join('')}</tr></thead><tbody>
        ${f.groups.map((g, gi) => `<tr class="grp"><th colspan="${LEVELS.length + 1}">${esc(g.title)}</th></tr>` + g.items.map((it, ii) => {
          const key = `${f.id}__${gi}__${ii}`;
          return `<tr><td>${esc(it)}</td>${LEVELS.map(l => `<td class="c"><input type="radio" name="${key}" data-id="${key}" value="${l}" ${d[key] === l ? 'checked' : ''} aria-label="${esc(it)} ${l}"></td>`).join('')}</tr>`;
        }).join('')).join('')}
      </tbody></table></div></div>`;
  }
  return '';
}

function bindFields(root, d, onChange) {
  $$('[data-id]', root).forEach(el => {
    const id = el.dataset.id;
    const ev = (el.type === 'radio' || el.type === 'checkbox') ? 'change' : 'input';
    el.addEventListener(ev, () => {
      if (el.type === 'checkbox') {
        const arr = new Set(d[id] || []);
        el.checked ? arr.add(el.value) : arr.delete(el.value);
        d[id] = [...arr];
      } else d[id] = el.value;
      save(); onChange?.();
    });
    if (el.tagName === 'TEXTAREA' && el.closest('.grid')) autoGrow(el);
  });
  $$('[data-addrow]', root).forEach(b => b.onclick = () => {
    const f = INTRO_SCHEMA.flatMap(s => s.fields).find(x => x.id === b.dataset.addrow);
    d[f.id + '__n'] = (d[f.id + '__n'] || f.rows) + 1; save(); render();
  });
  $$('[data-polish]', root).forEach(b => b.onclick = (e) => {
    e.preventDefault();
    const id = b.dataset.polish; const text = d[id];
    if (!text) return alert('먼저 내용을 적어주세요.');
    if (!requireKey()) return;
    withLoading(b, async () => {
      const out = await AI.call(AIPrompts.polish(b.dataset.label, text));
      modal('AI가 다듬은 문장', `<p class="muted small">원문</p><pre class="ai-out dim">${esc(text)}</pre><p class="muted small">다듬은 문장</p><pre class="ai-out">${esc(out)}</pre>`,
        [{ label: '이 문장으로 바꾸기', onClick: () => { d[id] = out; save(); render(); } }]);
    });
  });
}
function autoGrow(el) {
  const fit = () => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; };
  el.addEventListener('input', fit); requestAnimationFrame(fit);
}

// ---------- 3. 실천계획서 ----------
function renderPlan(main) {
  const c = cur(); const p = c.plan;
  p.domains = p.domains || [];
  main.innerHTML = `
    <div class="page-head">
      <div><h2>미래설계 실천계획서</h2><p class="muted">자기소개서를 바탕으로 AI가 초안을 만들고, 지원회의(사전·통합·컨퍼런스·확정)를 거치며 다듬어 확정하세요.</p></div>
      <div class="btn-row">
        <button class="ai-btn" id="ai-draft">✨ 자기소개서로 AI 초안 만들기</button>
        <button class="ghost" id="offline-draft">AI 없이 초안 채우기</button>
      </div>
    </div>
    <div class="plan-meta">
      <label>대상 연도 <input type="number" id="plan-year" value="${esc(p.year)}" min="2000" max="2100"></label>
      <label>단계 <select id="plan-stage">${['초안', '사전회의 반영', '통합회의 반영', '컨퍼런스회의 반영', '확정'].map(s => `<option ${p.stage === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
    </div>
    <table class="plan-tbl">
      <tbody>
        ${PLAN_FIELDS.map(f => `<tr><th>${f.label}</th><td><textarea data-pf="${f.id}" rows="3">${esc(p[f.id])}</textarea><button class="ai-btn small" data-ppolish="${f.id}" data-label="${f.label}">✨ 다듬기</button></td></tr>`).join('')}
      </tbody>
    </table>
    <h3 class="fh">영역별 단기목표(2년) 및 해당연도 실천계획</h3>
    <div class="tbl-wrap">
    <table class="grid domains">
      <thead><tr><th style="width:6.5rem">우선<br>순위</th><th style="width:8rem">영역</th><th>단기목표</th><th>실천계획</th><th style="width:12rem">비고</th><th style="width:5.5rem"></th></tr></thead>
      <tbody>
        ${p.domains.map((r, i) => `<tr data-row="${i}">
          <td class="c"><button class="ghost tiny" data-up="${i}" aria-label="위로">▲</button><b>${i + 1}</b><button class="ghost tiny" data-down="${i}" aria-label="아래로">▼</button></td>
          <td><select data-k="area">${DOMAINS.concat(DOMAINS.includes(r.area) ? [] : [r.area]).map(a => `<option ${r.area === a ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select></td>
          <td><textarea data-k="goal" rows="2">${esc(r.goal)}</textarea></td>
          <td><textarea data-k="plan" rows="2">${esc(r.plan)}</textarea></td>
          <td><textarea data-k="note" rows="2">${esc(r.note)}</textarea></td>
          <td class="c"><button class="ai-btn tiny" data-goal="${i}" title="이 영역 AI 제안">✨</button> <button class="ghost tiny danger" data-del="${i}" title="행 삭제">✕</button></td>
        </tr>`).join('')}
      </tbody>
    </table></div>
    <div class="btn-row">
      <button class="ghost" id="add-domain">+ 영역 추가</button>
      <span class="grow"></span>
      <button class="ghost" id="print-plan">🖨 인쇄 / PDF</button>
      <button class="ghost" id="doc-plan">📄 한글/워드 파일(.doc)</button>
    </div>`;

  $('#plan-year').oninput = e => { p.year = e.target.value; save(); };
  $('#plan-stage').onchange = e => { p.stage = e.target.value; save(); };
  $$('[data-pf]', main).forEach(el => { autoGrow(el); el.oninput = () => { p[el.dataset.pf] = el.value; save(); }; });
  $$('[data-row]', main).forEach(tr => {
    const r = p.domains[+tr.dataset.row];
    $$('[data-k]', tr).forEach(el => {
      if (el.tagName === 'TEXTAREA') autoGrow(el);
      el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => { r[el.dataset.k] = el.value; save(); });
    });
  });
  const move = (i, j) => { if (j < 0 || j >= p.domains.length) return; [p.domains[i], p.domains[j]] = [p.domains[j], p.domains[i]]; save(); renderPlan(main); };
  $$('[data-up]', main).forEach(b => b.onclick = () => move(+b.dataset.up, +b.dataset.up - 1));
  $$('[data-down]', main).forEach(b => b.onclick = () => move(+b.dataset.down, +b.dataset.down + 1));
  $$('[data-del]', main).forEach(b => b.onclick = () => { if (confirm('이 영역 행을 삭제할까요?')) { p.domains.splice(+b.dataset.del, 1); save(); renderPlan(main); } });
  $('#add-domain').onclick = () => { p.domains.push({ area: DOMAINS[0], goal: '', plan: '', note: '' }); save(); renderPlan(main); };

  const applyDraft = (draft) => {
    const hasContent = PLAN_FIELDS.some(f => p[f.id]) || p.domains.some(r => r.goal || r.plan);
    if (hasContent && !confirm('이미 작성된 계획서 내용이 초안으로 바뀝니다. 계속할까요?')) return;
    PLAN_FIELDS.forEach(f => { if (draft[f.id]) p[f.id] = draft[f.id]; });
    if (draft.domains?.length) p.domains = draft.domains.map(x => ({ area: x.area || '', goal: x.goal || '', plan: x.plan || '', note: x.note || '' }));
    p.stage = '초안'; save(); renderPlan(main); flash('초안을 채웠습니다');
  };
  $('#ai-draft').onclick = (e) => {
    if (!summarizeIntro(c.intro)) return alert('자기소개서를 먼저 작성해주세요.');
    if (!requireKey()) return;
    withLoading(e.currentTarget, async () => applyDraft(await AI.call(AIPrompts.plan(c.intro), { json: true })));
  };
  $('#offline-draft').onclick = () => {
    if (!summarizeIntro(c.intro)) return alert('자기소개서를 먼저 작성해주세요.');
    applyDraft(offlinePlanDraft(c.intro));
  };
  $$('[data-ppolish]', main).forEach(b => b.onclick = () => {
    const id = b.dataset.ppolish;
    if (!p[id]) return alert('먼저 내용을 적어주세요.');
    if (!requireKey()) return;
    withLoading(b, async () => {
      const out = await AI.call(AIPrompts.polish(b.dataset.label, p[id]));
      modal('AI가 다듬은 문장', `<pre class="ai-out dim">${esc(p[id])}</pre><pre class="ai-out">${esc(out)}</pre>`,
        [{ label: '이 문장으로 바꾸기', onClick: () => { p[id] = out; save(); renderPlan(main); } }]);
    });
  });
  $$('[data-goal]', main).forEach(b => b.onclick = () => {
    if (!requireKey()) return;
    const r = p.domains[+b.dataset.goal];
    withLoading(b, async () => {
      const out = await AI.call(AIPrompts.goal(r.area, c.intro, [r.goal, r.plan].filter(Boolean).join(' / ')), { json: true });
      modal(`「${r.area}」 영역 AI 제안`, `<p><b>단기목표</b></p><pre class="ai-out">${esc(out.goal)}</pre><p><b>실천계획</b></p><pre class="ai-out">${esc(out.plan)}</pre><p><b>비고</b></p><pre class="ai-out">${esc(out.note)}</pre>`,
        [{ label: '적용하기', onClick: () => { Object.assign(r, { goal: out.goal || r.goal, plan: out.plan || r.plan, note: out.note || r.note }); save(); renderPlan(main); } }]);
    });
  });
  $('#print-plan').onclick = () => printDoc(planDocHTML(c));
  $('#doc-plan').onclick = () => downloadDoc(`미래설계실천계획서_${c.label}_${p.year}.doc`, planDocHTML(c));
}

// ---------- 4. 평가 ----------
function renderEval(main) {
  const c = cur(); const p = c.plan;
  c.evals = c.evals || []; c.activityLog = c.activityLog || [];
  main.innerHTML = `
    <div class="page-head"><div><h2>활동평가 · 실천과정 평가</h2><p class="muted">활동평가는 월/분기/반기 등 약속된 기간마다, 실천과정 평가는 연 1회 작성해 다음 연도 계획에 반영합니다.</p></div></div>
    <h3 class="fh">○ 활동평가 기록 (세부계획 조정)</h3>
    <div class="tbl-wrap"><table class="grid">
      <thead><tr><th style="width:9rem">평가일</th><th style="width:8rem">구분</th><th>활동 내용 및 평가</th><th>세부계획 조정</th><th style="width:3rem"></th></tr></thead>
      <tbody>${c.activityLog.map((l, i) => `<tr data-log="${i}">
        <td><input type="date" data-k="date" value="${esc(l.date)}"></td>
        <td><select data-k="kind">${['월', '분기', '반기', '수시'].map(k => `<option ${l.kind === k ? 'selected' : ''}>${k}</option>`).join('')}</select></td>
        <td><textarea data-k="content" rows="2">${esc(l.content)}</textarea></td>
        <td><textarea data-k="adjust" rows="2">${esc(l.adjust)}</textarea></td>
        <td class="c"><button class="ghost tiny danger" data-dellog="${i}">✕</button></td></tr>`).join('') || '<tr><td colspan="5" class="muted c">아직 기록이 없습니다.</td></tr>'}</tbody>
    </table></div>
    <button class="ghost" id="add-log">+ 활동평가 추가</button>

    <h3 class="fh">○ 실천과정 평가 (연 1회 · ${esc(p.year)}년)</h3>
    <div class="tbl-wrap"><table class="grid">
      <thead><tr><th style="width:7rem">영역</th><th>단기목표</th><th style="width:9rem">달성도</th><th>목표평가 · 지원평가 메모</th></tr></thead>
      <tbody>${(p.domains || []).filter(r => r.goal).map((r, i) => {
        const e = c.evals[i] || {};
        return `<tr data-ev="${i}"><td>${esc(r.area)}</td><td class="small">${esc(r.goal)}</td>
          <td><select data-k="level"><option value="">선택</option>${['달성', '부분 달성', '진행 중', '미달성', '목표 변경'].map(k => `<option ${e.level === k ? 'selected' : ''}>${k}</option>`).join('')}</select></td>
          <td><textarea data-k="memo" rows="2">${esc(e.memo)}</textarea></td></tr>`;
      }).join('') || '<tr><td colspan="4" class="muted c">실천계획서에 단기목표를 먼저 작성해주세요.</td></tr>'}</tbody>
    </table></div>
    <div class="btn-row"><button class="ai-btn" id="ai-eval">✨ AI 평가 초안 만들기</button></div>
    <label class="f wide"><span>종합 평가 및 다음 연도 반영 사항</span><textarea id="eval-summary" rows="8">${esc(c.evalSummary)}</textarea></label>`;

  $$('[data-log]', main).forEach(tr => {
    const l = c.activityLog[+tr.dataset.log];
    $$('[data-k]', tr).forEach(el => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => { l[el.dataset.k] = el.value; save(); }));
  });
  $$('[data-dellog]', main).forEach(b => b.onclick = () => { c.activityLog.splice(+b.dataset.dellog, 1); save(); renderEval(main); });
  $('#add-log').onclick = () => { c.activityLog.push({ date: new Date().toISOString().slice(0, 10), kind: '분기' }); save(); renderEval(main); };
  $$('[data-ev]', main).forEach(tr => {
    const i = +tr.dataset.ev;
    $$('[data-k]', tr).forEach(el => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => { c.evals[i] = c.evals[i] || {}; c.evals[i][el.dataset.k] = el.value; save(); }));
  });
  $('#eval-summary').oninput = e => { c.evalSummary = e.target.value; save(); };
  $('#ai-eval').onclick = (e) => {
    if (!requireKey()) return;
    const plan = { ...p, domains: (p.domains || []).filter(r => r.goal) };
    withLoading(e.currentTarget, async () => {
      const out = await AI.call(AIPrompts.evaluate(plan, c.evals));
      c.evalSummary = (c.evalSummary ? c.evalSummary + '\n\n' : '') + out; save(); renderEval(main);
    });
  };
}

// ---------- 사용안내 ----------
function renderGuide(main) {
  main.innerHTML = `<div class="guide">
    <h2>사용 안내</h2>
    <ol>
      <li><b>참여자 등록</b> — 상단 [+ 새 참여자]로 등록합니다. 표시 이름은 가명/이니셜을 권장합니다.</li>
      <li><b>자기소개서</b> — 「행복을 이루기 위한 “나”의 이야기」를 당사자·가족과 함께 영역별로 작성합니다. 입력 즉시 자동 저장됩니다.</li>
      <li><b>실천계획서</b> — [✨ 자기소개서로 AI 초안 만들기]로 꿈과 희망·중장기목표·영역별 단기목표 초안을 만들고, 지원회의를 거쳐 다듬습니다. API 키가 없으면 [AI 없이 초안 채우기]를 사용하세요.</li>
      <li><b>진행과정</b> — 준비 → 계획(지원회의) → 실천 → 평가 단계별 진행일과 회의 메모를 기록합니다.</li>
      <li><b>평가</b> — 활동평가(월/분기/반기)와 연 1회 실천과정 평가를 기록하고, AI로 평가 초안을 만듭니다.</li>
      <li><b>출력</b> — 각 화면의 [🖨 인쇄 / PDF] 또는 [📄 .doc] 버튼으로 내려받아 한글(HWP)·워드에서 열 수 있습니다.</li>
    </ol>
    <h3>무료 AI(Gemini) API 키 발급 방법</h3>
    <ol>
      <li>구글 계정으로 <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> 접속</li>
      <li>[API 키 만들기(Create API key)] 클릭 → 생성된 키 복사 (카드 등록 불필요, 무료 등급)</li>
      <li>이 앱 상단 [⚙ AI 설정]에 붙여넣고 저장</li>
    </ol>
    <div class="warn">
      <b>⚠ 개인정보 보호 안내</b>
      <ul>
        <li>모든 기록은 <b>지금 사용하는 이 브라우저에만</b> 저장됩니다. 다른 PC에서 이어 쓰려면 [데이터 관리 → 백업 파일 저장/불러오기]를 이용하세요.</li>
        <li>AI 버튼을 누를 때만 내용이 Google Gemini로 전송됩니다. 이름·생년월일·연락처·주소·가족 인적사항(🔒 표시)은 <b>전송에서 제외</b>됩니다.</li>
        <li>Gemini <b>무료 등급은 입력 내용이 Google의 서비스 개선에 활용될 수 있습니다.</b> 서술형 칸에도 실명, 주민번호, 구체적 병력 등 민감정보는 적지 말고 기관 개인정보 지침을 따르세요.</li>
        <li>공용 PC에서는 사용 후 [데이터 관리 → 이 참여자 삭제]로 정리하세요.</li>
      </ul>
    </div>
  </div>`;
}

// ---------- 출력 ----------
function introDocHTML(c) {
  const d = c.intro;
  const body = INTRO_SCHEMA.map(sec => {
    const rows = sec.fields.map(f => {
      if (f.type === 'heading') return `<tr><td colspan="2" class="h">${esc(f.text)}</td></tr>`;
      if (f.type === 'grid') {
        const n = f.rowLabels ? f.rowLabels.length : (d[f.id + '__n'] || f.rows);
        return `<tr><th>${esc(f.label)}</th><td><table class="inner"><tr>${f.rowLabels ? '<th></th>' : ''}${f.cols.map(x => `<th>${esc(x)}</th>`).join('')}</tr>${Array.from({ length: n }, (_, r) => `<tr>${f.rowLabels ? `<th>${esc(f.rowLabels[r])}</th>` : ''}${f.cols.map((_, ci) => `<td>${esc(d[`${f.id}__${r}__${ci}`]).replace(/\n/g, '<br>')}</td>`).join('')}</tr>`).join('')}</table></td></tr>`;
      }
      if (f.type === 'scale') {
        return `<tr><td colspan="2"><b>${esc(f.label)}</b><table class="inner"><tr><th>활동</th>${LEVELS.map(l => `<th>${l}</th>`).join('')}</tr>${f.groups.map((g, gi) => `<tr><th colspan="6" style="text-align:left">${esc(g.title)}</th></tr>` + g.items.map((it, ii) => `<tr><td>${esc(it)}</td>${LEVELS.map(l => `<td style="text-align:center">${d[`${f.id}__${gi}__${ii}`] === l ? '●' : ''}</td>`).join('')}</tr>`).join('')).join('')}</table></td></tr>`;
      }
      if (f.type === 'check' || f.type === 'radio') {
        const sel = f.type === 'check' ? (d[f.id] || []) : [d[f.id]];
        return `<tr><th>${esc(f.label)}</th><td>${f.options.map(o => `${sel.includes(o) ? '■' : '□'} ${esc(o)}`).join('&nbsp;&nbsp; ')}${d[f.id + '__etc'] ? ` (${esc(d[f.id + '__etc'])})` : ''}</td></tr>`;
      }
      return `<tr><th>${esc(f.label)}</th><td>${esc(d[f.id]).replace(/\n/g, '<br>')}</td></tr>`;
    }).join('');
    return `<h2>【 ${esc(sec.title)} 】</h2><table class="doc">${rows}</table>`;
  }).join('');
  return `<h1>평생과정설계 자기소개서</h1><p class="sub">행복을 이루기 위한 “나”의 이야기 — 《 ${esc(d.name || c.label)} 》의 이야기</p>${body}`;
}

function planDocHTML(c) {
  const p = c.plan;
  return `<h1>${esc(p.year)} 미래설계 실천계획서</h1>
    <p class="sub">${esc(c.intro.name || c.label)} · ${esc(p.stage || '')}</p>
    <table class="doc">${PLAN_FIELDS.map(f => `<tr><th style="width:22%">${f.label}</th><td>${esc(p[f.id]).replace(/\n/g, '<br>')}</td></tr>`).join('')}</table>
    <table class="doc" style="margin-top:12px"><tr><th style="width:12%">영역</th><th style="width:28%">단기목표</th><th>실천계획</th><th style="width:16%">비고</th></tr>
    ${(p.domains || []).map(r => `<tr><td style="text-align:center">${esc(r.area)}</td><td>${esc(r.goal).replace(/\n/g, '<br>')}</td><td>${esc(r.plan).replace(/\n/g, '<br>')}</td><td>${esc(r.note).replace(/\n/g, '<br>')}</td></tr>`).join('')}</table>`;
}

const DOC_CSS = `body{font-family:'Malgun Gothic','맑은 고딕',sans-serif;font-size:10.5pt;color:#000}
h1{text-align:center;font-size:18pt;margin:0 0 4px}.sub{text-align:center;color:#444;margin:0 0 14px}
h2{font-size:12pt;margin:18px 0 6px;background:#1f5673;color:#fff;padding:4px 8px}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #555;padding:4px 6px;vertical-align:top}
th{background:#e8eef2;font-weight:bold;text-align:left;width:28%}table.inner th{width:auto}
td.h{background:#f4f4f4;font-weight:bold}table.inner{margin-top:4px}`;

function printDoc(html) {
  const w = window.open('', '_blank');
  if (!w) return alert('팝업이 차단되었습니다. 팝업을 허용해주세요.');
  w.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>인쇄</title><style>${DOC_CSS}@page{size:A4;margin:15mm}</style></head><body>${html}</body></html>`);
  w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
}
function downloadDoc(filename, html) {
  const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>${DOC_CSS}</style></head><body>${html}</body></html>`;
  const blob = new Blob(['﻿' + doc], { type: 'application/msword' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename.replace(/[\\/:*?"<>|]/g, '_'); a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- 설정 / 데이터 관리 ----------
function openSettings() {
  const s = AI.getSettings();
  modal('⚙ AI 설정 (무료 Gemini API)', `
    <p>Google AI Studio에서 <b>무료 API 키</b>를 발급받아 입력하세요. → <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">키 발급 페이지 열기</a></p>
    <label class="f wide"><span>API 키</span><input id="s-key" type="password" value="${esc(s.key)}" placeholder="AIza..." autocomplete="off"></label>
    <label class="f wide"><span>모델</span><input id="s-model" value="${esc(s.model || 'gemini-2.5-flash')}" list="model-list">
      <datalist id="model-list"><option value="gemini-2.5-flash"><option value="gemini-2.5-flash-lite"><option value="gemini-2.0-flash"></datalist>
      <small class="muted">무료 등급에서 오류가 나면 목록의 다른 모델로 바꿔보세요.</small></label>
    <p class="warn small">키는 이 브라우저에만 저장됩니다. 무료 등급은 입력 내용이 Google 서비스 개선에 활용될 수 있으니 민감정보는 입력하지 마세요.</p>
    <div id="s-test" class="muted small"></div>`,
    [{
      label: '저장', onClick: () => { AI.saveSettings({ key: $('#s-key').value.trim(), model: $('#s-model').value.trim() || 'gemini-2.5-flash' }); renderHeader(); flash('AI 설정 저장됨'); },
    }, {
      label: '연결 테스트', cls: 'ghost', onClick: () => {
        AI.saveSettings({ key: $('#s-key').value.trim(), model: $('#s-model').value.trim() || 'gemini-2.5-flash' });
        const out = $('#s-test'); out.textContent = '테스트 중…';
        AI.call('"연결 성공"이라고만 답하세요.').then(t => { out.textContent = '✅ ' + t; renderHeader(); }).catch(e => { out.textContent = '❌ ' + e.message; });
        return false;
      },
    }]);
}

function openDataMenu() {
  const c = cur();
  modal('데이터 관리', `
    <p>모든 기록은 이 브라우저에만 저장됩니다. 정기적으로 백업 파일을 저장해두세요.</p>
    <div class="btn-col">
      <button class="ghost" id="d-rename">✏ 참여자 표시 이름 바꾸기</button>
      <button class="ghost" id="d-export">💾 전체 백업 파일 저장 (.json)</button>
      <label class="ghost btn-like">📂 백업 파일 불러오기<input type="file" id="d-import" accept=".json,application/json" hidden></label>
      <button class="ghost danger" id="d-delete">🗑 이 참여자 삭제</button>
    </div>`);
  $('#d-rename').onclick = () => { if (!c) return; const n = prompt('표시 이름', c.label); if (n) { c.label = n.trim(); save(); render(); $('#modal').close(); } };
  $('#d-export').onclick = () => {
    const blob = new Blob([JSON.stringify({ app: 'ppp', version: 1, exported: new Date().toISOString(), cases: state.cases }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `평생과정설계_백업_${new Date().toISOString().slice(0, 10)}.json`; a.click();
  };
  $('#d-import').onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const list = Array.isArray(data.cases) ? data.cases : [];
      if (!list.length) throw new Error('참여자 데이터가 없습니다.');
      let added = 0;
      list.forEach(x => {
        if (!x || typeof x !== 'object' || !x.id) return;
        const i = state.cases.findIndex(y => y.id === x.id);
        if (i >= 0) state.cases[i] = x; else state.cases.push(x);
        added++;
      });
      state.currentId = list[0].id; save(); render(); $('#modal').close(); flash(`${added}명 불러옴`);
    } catch (err) { alert('불러오기 실패: ' + err.message); }
  };
  $('#d-delete').onclick = () => {
    if (!c) return;
    if (!confirm(`「${c.label}」의 모든 기록을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    state.cases = state.cases.filter(x => x.id !== c.id); state.currentId = state.cases[0]?.id || null; save(); render(); $('#modal').close();
  };
}

// ---------- 시작 ----------
document.addEventListener('DOMContentLoaded', () => {
  load();
  $$('.tab').forEach(t => t.onclick = () => { state.tab = t.dataset.tab; render(); window.scrollTo(0, 0); });
  $('#case-select').onchange = e => { state.currentId = e.target.value; save(); render(); };
  $('#add-case').onclick = addCase;
  $('#open-settings').onclick = openSettings;
  $('#open-data').onclick = openDataMenu;
  if (!state.cases.length) state.tab = 'guide';
  render();
});
