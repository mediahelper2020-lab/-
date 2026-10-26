// 참여자 관리 · 일정(캘린더) · 행복한 미래 이야기(연간 돌아보기)

// ---------- 참여자 관리 ----------
state.people = { q: '', status: '', phase: '' };

function renderPeople(main) {
  const f = state.people;
  const q = f.q.trim().toLowerCase();
  const list = state.cases.filter(c => {
    const pr = caseProgress(c);
    const hay = [c.label, c.intro?.name, c.meta?.worker, c.intro?.disability_type, c.meta?.memo].join(' ').toLowerCase();
    return (!q || hay.includes(q)) && (!f.status || c.meta?.status === f.status) && (!f.phase || pr.phase === f.phase);
  });
  main.innerHTML = `
    <div class="page-head">
      <div><h2>참여자 관리</h2><p class="muted">등록·수정·검색·삭제. 이름을 누르면 해당 참여자의 기록 화면으로 이동합니다.</p></div>
      <div class="btn-row">
        <button class="primary" id="p-add">+ 새 참여자 등록</button>
        <button class="ghost" id="p-sample">🧪 가상 예시 데이터</button>
        ${state.cases.some(c => c.sample) ? '<button class="ghost danger" id="p-unsample">예시 데이터 모두 지우기</button>' : ''}
      </div>
    </div>
    <div class="filters card" role="search">
      <label class="grow">검색 <input id="p-q" type="search" value="${esc(f.q)}" placeholder="이름, 담당자, 장애유형, 메모" aria-label="참여자 검색"></label>
      <label>상태 <select id="p-status"><option value="">전체</option>${CASE_STATUS.map(s => `<option ${f.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
      <label>현재 단계 <select id="p-phase"><option value="">전체</option>${['시작 전', ...PHASES, '평가 완료'].map(s => `<option ${f.phase === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
    </div>
    <p class="muted small" aria-live="polite">${list.length}명 / 전체 ${state.cases.length}명</p>
    <div class="tbl-wrap"><table class="grid status-tbl">
      <thead><tr><th>표시 이름</th><th>상태</th><th>참여 시작일</th><th>담당자</th><th>성별</th><th>장애유형</th><th>현재 단계</th><th>진행률</th><th>최근 수정</th><th>관리</th></tr></thead>
      <tbody>${list.map(c => {
        const pr = caseProgress(c);
        return `<tr>
          <th scope="row"><button class="linkish" data-open="${c.id}">${esc(c.label)}</button>${c.sample ? ' <span class="tag">예시</span>' : ''}</th>
          <td><span class="st st-${CASE_STATUS.indexOf(c.meta?.status)}">${esc(c.meta?.status)}</span></td>
          <td class="c">${esc(c.meta?.start || '-')}</td>
          <td>${esc(c.meta?.worker || '-')}</td>
          <td class="c">${esc(c.intro?.gender || '-')}</td>
          <td>${esc(c.intro?.disability_type || '-')}</td>
          <td>${pr.phase}</td>
          <td><div class="pbar"><i style="width:${pr.pct}%"></i></div><small>${pr.pct}%</small></td>
          <td class="c small">${esc((c.updated || '').slice(0, 10))}</td>
          <td class="c nowrap"><button class="ghost tiny" data-edit="${c.id}">수정</button>${Cloud.can('delete') ? ` <button class="ghost tiny danger" data-del="${c.id}">삭제</button>` : ''}</td>
        </tr>`;
      }).join('') || `<tr><td colspan="10" class="c muted">${state.cases.length ? '검색 결과가 없습니다. 검색어나 필터를 바꿔보세요.' : '등록된 참여자가 없습니다. [+ 새 참여자 등록]을 눌러주세요.'}</td></tr>`}</tbody>
    </table></div>`;

  const q$ = $('#p-q');
  q$.oninput = () => { f.q = q$.value; const pos = q$.selectionStart; renderPeople(main); const n = $('#p-q'); n.focus(); n.setSelectionRange(pos, pos); };
  $('#p-status').onchange = e => { f.status = e.target.value; renderPeople(main); };
  $('#p-phase').onchange = e => { f.phase = e.target.value; renderPeople(main); };
  $('#p-add').onclick = addCase;
  $('#p-sample').onclick = loadSampleData;
  $('#p-unsample')?.addEventListener('click', () => {
    if (!confirm('가상 예시 데이터를 모두 지울까요? 직접 등록한 참여자는 지워지지 않습니다.')) return;
    state.cases = state.cases.filter(c => !c.sample); state.currentId = state.cases[0]?.id || null; save(); render();
  });
  $$('[data-open]', main).forEach(b => b.onclick = () => { state.currentId = b.dataset.open; state.tab = 'process'; save(); render(); window.scrollTo(0, 0); });
  $$('[data-edit]', main).forEach(b => b.onclick = () => openCaseForm(state.cases.find(c => c.id === b.dataset.edit)));
  $$('[data-del]', main).forEach(b => b.onclick = () => {
    const c = state.cases.find(x => x.id === b.dataset.del);
    const typed = prompt(`「${c.label}」의 모든 기록(자기소개서·계획서·평가·일정)을 삭제합니다. 되돌릴 수 없습니다.\n삭제하려면 표시 이름을 그대로 입력하세요.`);
    if (typed === null) return;
    if (typed.trim() !== c.label) return alert('이름이 일치하지 않아 삭제하지 않았습니다.');
    state.cases = state.cases.filter(x => x.id !== c.id);
    if (state.currentId === c.id) state.currentId = state.cases[0]?.id || null;
    save(); render(); flash('삭제됨');
  });
}

// ---------- 일정 (캘린더) ----------
state.cal = { ym: today().slice(0, 7), sel: today() };

function renderCalendar(main) {
  const cal = state.cal;
  const [y, m] = cal.ym.split('-').map(Number);
  const first = new Date(y, m - 1, 1), days = new Date(y, m, 0).getDate();
  const startDow = (first.getDay() + 6) % 7; // 월요일 시작
  const events = allEvents();
  const byDate = {};
  events.forEach(e => { (byDate[e.date] = byDate[e.date] || []).push(e); });
  const pad = n => String(n).padStart(2, '0');
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push('<div class="cal-cell blank" aria-hidden="true"></div>');
  for (let d = 1; d <= days; d++) {
    const ds = `${cal.ym}-${pad(d)}`; const evs = byDate[ds] || [];
    cells.push(`<button class="cal-cell ${ds === today() ? 'today' : ''} ${ds === cal.sel ? 'sel' : ''}" data-day="${ds}" aria-label="${m}월 ${d}일, 일정 ${evs.length}건">
      <span class="dnum">${d}</span>
      ${evs.slice(0, 3).map(e => `<span class="cal-ev k${EVENT_KINDS.indexOf(e.kind) < 0 ? 7 : EVENT_KINDS.indexOf(e.kind)} ${e.done ? 'done' : ''}">${esc(e.caseLabel)} · ${esc(e.title)}</span>`).join('')}
      ${evs.length > 3 ? `<span class="more">+${evs.length - 3}건</span>` : ''}
    </button>`);
  }
  const selEvents = byDate[cal.sel] || [];
  main.innerHTML = `
    <div class="page-head">
      <div><h2>일정 · 캘린더</h2><p class="muted">지원회의·상담·실천활동·평가 일정을 기록합니다. 진행과정에 입력한 단계 진행일도 자동으로 표시됩니다.</p></div>
      <div class="btn-row"><button class="primary" id="ev-add">+ 일정 등록</button></div>
    </div>
    <div class="cal-layout">
      <section class="card">
        <div class="cal-head">
          <button class="ghost small" id="cal-prev" aria-label="이전 달">◀</button>
          <h3>${y}년 ${m}월</h3>
          <button class="ghost small" id="cal-next" aria-label="다음 달">▶</button>
          <button class="ghost small" id="cal-today">오늘</button>
        </div>
        <div class="cal-grid">${['월', '화', '수', '목', '금', '토', '일'].map(w => `<div class="cal-dow">${w}</div>`).join('')}${cells.join('')}</div>
      </section>
      <section class="card">
        <h3 class="fh">${cal.sel.replace(/-/g, '. ')} 일정</h3>
        ${selEvents.length ? `<ul class="ev-list">${selEvents.map(e => `<li>
          <time>${esc(e.time || '종일')}</time><span class="kind">${esc(e.kind)}</span>
          <span>${esc(e.title)}${e.memo ? `<br><small class="muted">${esc(e.memo)}</small>` : ''}</span><b>${esc(e.caseLabel)}</b>
          ${e.source === 'manual' ? `<span class="nowrap"><button class="ghost tiny" data-evedit="${e.caseId}|${e.id}">수정</button> <button class="ghost tiny danger" data-evdel="${e.caseId}|${e.id}">삭제</button></span>` : '<small class="muted">진행과정</small>'}
        </li>`).join('')}</ul>` : '<p class="chart-empty">이 날짜에 일정이 없습니다.</p>'}
        <button class="ghost" id="ev-add-day">+ 이 날짜에 일정 등록</button>
      </section>
    </div>`;
  const move = (k) => { const d = new Date(y, m - 1 + k, 1); cal.ym = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; renderCalendar(main); };
  $('#cal-prev').onclick = () => move(-1);
  $('#cal-next').onclick = () => move(1);
  $('#cal-today').onclick = () => { cal.ym = today().slice(0, 7); cal.sel = today(); renderCalendar(main); };
  $$('[data-day]', main).forEach(b => b.onclick = () => { cal.sel = b.dataset.day; renderCalendar(main); $(`[data-day="${cal.sel}"]`)?.focus(); });
  $('#ev-add').onclick = () => openEventForm({ date: cal.sel });
  $('#ev-add-day').onclick = () => openEventForm({ date: cal.sel });
  const find = (k) => { const [cid, eid] = k.split('|'); const c = state.cases.find(x => x.id === cid); return [c, c?.events.find(e => e.id === eid)]; };
  $$('[data-evedit]', main).forEach(b => b.onclick = () => { const [c, e] = find(b.dataset.evedit); openEventForm(e, c); });
  $$('[data-evdel]', main).forEach(b => b.onclick = () => {
    const [c, e] = find(b.dataset.evdel);
    if (!confirm(`「${e.title}」 일정을 삭제할까요?`)) return;
    c.events = c.events.filter(x => x !== e); persistFor(c); renderCalendar(main);
  });
}

// 특정 참여자 기록을 저장(현재 선택 참여자가 아닐 수 있음)
function persistFor(c) { c.updated = new Date().toISOString(); save(); }

function openEventForm(e = {}, c) {
  if (!state.cases.length) return alert('먼저 참여자를 등록해주세요.');
  const caseId = c?.id || state.currentId || state.cases[0].id;
  modal(e.id ? '일정 수정' : '일정 등록', `
    <div class="fields">
      <label class="f"><span>참여자 <b class="req">*</b></span><select id="ev-case" ${e.id ? 'disabled' : ''}>${state.cases.map(x => `<option value="${x.id}" ${x.id === caseId ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select></label>
      <label class="f"><span>구분</span><select id="ev-kind">${EVENT_KINDS.map(k => `<option ${e.kind === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
      <label class="f"><span>날짜 <b class="req">*</b></span><input type="date" id="ev-date" value="${esc(e.date || today())}"></label>
      <label class="f"><span>시간</span><input type="time" id="ev-time" value="${esc(e.time || '')}"></label>
      <label class="f wide"><span>제목 <b class="req">*</b></span><input id="ev-title" maxlength="60" value="${esc(e.title || '')}" placeholder="예: 통합회의, 도서관 이용 활동"></label>
      <label class="f wide"><span>메모 (장소·참석자 등)</span><textarea id="ev-memo" rows="2" maxlength="500">${esc(e.memo || '')}</textarea></label>
      <label class="chip"><input type="checkbox" id="ev-done" ${e.done ? 'checked' : ''}> 완료</label>
    </div>
    <p id="ev-err" class="err" role="alert"></p>`, [{
    label: '저장', onClick: () => {
      const date = $('#ev-date').value, title = $('#ev-title').value.trim();
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { $('#ev-err').textContent = '날짜를 입력해주세요.'; $('#ev-date').focus(); return false; }
      if (!title) { $('#ev-err').textContent = '제목을 입력해주세요.'; $('#ev-title').focus(); return false; }
      const target = c || state.cases.find(x => x.id === $('#ev-case').value);
      const data = { kind: $('#ev-kind').value, date, time: $('#ev-time').value, title, memo: $('#ev-memo').value.trim(), done: $('#ev-done').checked };
      if (e.id) Object.assign(e, data); else target.events.push({ id: uid(), ...data });
      persistFor(target);
      state.cal.sel = date; state.cal.ym = date.slice(0, 7);
      render(); flash('일정 저장됨');
    },
  }]);
  setTimeout(() => $('#ev-title').focus(), 50);
}

// ---------- 행복한 미래 이야기 (연간 돌아보기) ----------
function storyFields(year) {
  const prev = year - 1;
  return [
    { type: 'heading', text: `【 ${prev}년 돌아보기 】` },
    { type: 'textarea', id: 'dream', label: '나의 꿈', rows: 2 },
    { type: 'textarea', id: 'midGoal', label: '중장기 목표', rows: 2 },
    { type: 'grid', id: 'review_plan', label: '미래설계 실천 계획', cols: ['영역', '단기목표', '활동계획'], rows: 3 },
    { type: 'textarea', id: 'practice_story', label: '미래설계 실천 이야기 (변화, 어려움 등)', rows: 4 },
    { type: 'textarea', id: 'happy_moments', label: '나에게 행복했던 순간들 (사진 등)', hint: '사진은 앱에 저장하지 않습니다. 사진 설명이나 보관 위치를 적어주세요.', rows: 3 },
    { type: 'radio', id: 'score', label: '점수로 평가하기 (1~5점)', options: STORY_SCORE.map(String) },
    { type: 'text', id: 'score_note', label: '점수를 준 이유' },
    { type: 'heading', text: `【 ${year}년 달라진 정보 확인하기 】` },
    { type: 'check', id: 'changed', label: '달라진 정보에 체크하세요', options: STORY_CHANGE_ITEMS.map(x => x.label).filter(l => l !== '기타').concat('기타') },
    ...STORY_CHANGE_ITEMS.filter(x => x.id !== 'etc').map(x => x.week
      ? { type: 'grid', id: 'change_day', label: x.label, cols: WEEK, rowLabels: ['활동'] }
      : { type: 'textarea', id: 'change_' + x.id, label: x.label, rows: 2 }),
    { type: 'heading', text: `【 ${year}년 행복한 삶 실천하기 】` },
    { type: 'grid', id: 'priority', label: '우선순위별 미래설계 희망영역', cols: ['미래설계 희망영역', '내용', '필요한 도움'], rowLabels: ['1', '2', '3'] },
  ];
}

function renderStory(main) {
  const c = cur(); const year = +state.storyYear;
  const d = c.stories[year] = c.stories[year] || {};
  const years = [...new Set([...Object.keys(c.stories).map(Number), year, new Date().getFullYear()])].sort();
  const fields = storyFields(year);
  main.innerHTML = `
    <div class="page-head">
      <div><h2>《 ${esc(c.intro?.name || c.label)} 》의 행복한 미래 이야기</h2>
        <p class="muted">연 1회 실천과정 평가 때 작성합니다. 지난해를 돌아보고, 달라진 정보를 확인한 뒤, 올해의 우선순위를 정합니다.</p></div>
      <div class="btn-row">
        <label class="plan-meta-inline">작성 연도 <select id="st-year">${years.map(y => `<option ${y === year ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
        <button class="ghost small" id="st-newyear">+ 연도 추가</button>
      </div>
    </div>
    <div class="form-area">
      <div class="btn-row">
        <button class="ghost small" id="st-fill">실천계획서에서 꿈·목표·계획 가져오기</button>
        <span class="grow"></span>
        <button class="ghost small" id="st-print">🖨 인쇄 / PDF</button>
        <button class="ghost small" id="st-doc">📄 한글/워드 파일(.doc)</button>
      </div>
      <div class="fields">${fields.map(f => fieldHTML(f, d)).join('')}</div>
    </div>`;
  // 우선순위 표의 희망영역 칸은 8대 영역 중에서 고를 수 있게 안내
  $$('[data-id^="priority__"][data-id$="__0"]', main).forEach(el => el.setAttribute('placeholder', '예: 직업, 주거 (8대 영역)'));
  bindFields(main, d);
  $('#st-year').onchange = e => { state.storyYear = +e.target.value; renderStory(main); };
  $('#st-newyear').onclick = () => {
    const v = prompt('추가할 연도 (예: 2027)', String(Math.max(...years) + 1));
    if (v === null) return;
    const n = +v; if (!Number.isInteger(n) || n < 2000 || n > 2100) return alert('2000~2100 사이의 연도를 입력해주세요.');
    state.storyYear = n; c.stories[n] = c.stories[n] || {}; save(); renderStory(main);
  };
  $('#st-fill').onclick = () => {
    const p = c.plan;
    const has = d.dream || d.midGoal || Object.keys(d).some(k => k.startsWith('review_plan__') && d[k]);
    if (has && !confirm('이미 적힌 「돌아보기」 내용이 실천계획서 내용으로 바뀝니다. 계속할까요?')) return;
    d.dream = p.dream || ''; d.midGoal = p.midGoal || '';
    Object.keys(d).filter(k => k.startsWith('review_plan__')).forEach(k => delete d[k]);
    const rows = (p.domains || []).filter(r => r.goal || r.plan);
    d.review_plan__n = Math.max(3, rows.length);
    rows.forEach((r, i) => { d[`review_plan__${i}__0`] = r.area; d[`review_plan__${i}__1`] = r.goal; d[`review_plan__${i}__2`] = r.plan; });
    save(); renderStory(main); flash('실천계획서 내용을 가져왔습니다');
  };
  const html = () => `<h1>《 ${esc(c.intro?.name || c.label)} 》 의 행복한 미래 이야기</h1><p class="sub">${year}년 작성</p><table class="doc">${fieldsDocRows(fields, d)}</table>`;
  $('#st-print').onclick = () => printDoc(html());
  $('#st-doc').onclick = () => downloadDoc(`행복한미래이야기_${c.label}_${year}.doc`, html());
}
