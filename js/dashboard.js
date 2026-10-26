// 대시보드 — 참여자 진행상황과 통계 (외부 차트 라이브러리 없이 SVG로 그림)

const STEPS = PROCESS.flatMap(ph => ph.steps.map(s => ({ ...s, phase: ph.phase })));
const PHASES = PROCESS.map(ph => ph.phase);
// 차트 색상: 범주형 팔레트(고정 순서, 색약 구분 검증된 순서) — 순위가 아니라 항목에 색을 고정
const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
const EVAL_LEVELS = ['달성', '부분 달성', '진행 중', '미달성', '목표 변경'];

state.dash = { worker: '', status: '' };

// ---------- 참여자별 계산 ----------
function caseProgress(c) {
  const p = c.process || {};
  const done = STEPS.filter(s => p[s.id]?.done);
  let last = -1; STEPS.forEach((s, i) => { if (p[s.id]?.done) last = i; });
  const next = STEPS.find((s, i) => i > last && !p[s.id]?.done) || null;
  const phase = last < 0 ? '시작 전' : (next ? STEPS[last].phase : '평가 완료');
  return { done: done.length, total: STEPS.length, pct: Math.round(done.length / STEPS.length * 100), phase, current: last >= 0 ? STEPS[last] : null, next };
}
function introRate(c) {
  let n = 0, t = 0;
  INTRO_SCHEMA.forEach(sec => { const [a, b] = sectionFilled(sec, c.intro || {}); n += a; t += b; });
  return t ? Math.round(n / t * 100) : 0;
}
function ageOf(c) {
  const m = String(c.intro?.birth || '').match(/(19|20)\d{2}/);
  return m ? new Date().getFullYear() - +m[0] : null;
}
function lastActivityEval(c) {
  return (c.activityLog || []).map(l => l.date).filter(Boolean).sort().pop() || '';
}
function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }
function supportYear(c) {
  if (!c.meta?.start) return '';
  const d = daysBetween(c.meta.start, today());
  return d < 0 ? '' : `${Math.floor(d / 365) + 1}년차`;
}
// 점검 필요: 진행중이면서 실천 단계 이후인데 활동평가가 90일 넘게 없음
function needsCheck(c) {
  if (c.meta?.status !== '진행중') return '';
  const pr = caseProgress(c);
  if (!['실천', '평가'].includes(pr.phase)) return '';
  const last = lastActivityEval(c);
  if (!last) return '활동평가 기록 없음';
  const d = daysBetween(last, today());
  return d > 90 ? `활동평가 ${d}일 경과` : '';
}

// 직접 등록한 일정 + 진행과정 단계 진행일(자동)
function allEvents() {
  const out = [];
  state.cases.forEach(c => {
    (c.events || []).forEach(e => out.push({ ...e, caseId: c.id, caseLabel: c.label, source: 'manual' }));
    STEPS.forEach(s => {
      const v = c.process?.[s.id];
      if (v?.date) out.push({ id: 'p_' + s.id, date: v.date, kind: s.phase === '계획' ? '지원회의' : s.phase, title: s.name, done: !!v.done, caseId: c.id, caseLabel: c.label, source: 'process' });
    });
  });
  return out.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
}

// ---------- 차트 ----------
function countBy(list, fn, order) {
  const m = new Map((order || []).map(k => [k, 0]));
  list.forEach(x => { const k = fn(x); if (k == null || k === '') return; m.set(k, (m.get(k) || 0) + 1); });
  return [...m].map(([label, value]) => ({ label, value }));
}
// 8개 초과 항목은 '기타'로 묶음 (색을 새로 만들지 않음)
function foldOther(data, max = 6) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  if (sorted.length <= max) return sorted;
  const rest = sorted.slice(max - 1).reduce((s, x) => s + x.value, 0);
  return [...sorted.slice(0, max - 1), { label: '기타', value: rest }];
}

function donut(title, data, { note = '', unit = '명' } = {}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const shown = data.filter(d => d.value > 0);
  if (!total) return `<figure class="chart"><figcaption>${esc(title)}</figcaption><p class="chart-empty">아직 집계할 기록이 없습니다.</p></figure>`;
  const R = 70, r = 44, C = 80;
  const pt = (a, rad) => [C + rad * Math.sin(a), C - rad * Math.cos(a)];
  let a0 = 0;
  const paths = data.map((d, i) => {
    if (!d.value) return '';
    const tip = `${d.label}: ${d.value}${unit} (${Math.round(d.value / total * 100)}%)`;
    const color = SERIES[i % SERIES.length];
    if (d.value === total) {
      return `<g data-tip="${esc(tip)}"><circle cx="${C}" cy="${C}" r="${(R + r) / 2}" fill="none" stroke="${color}" stroke-width="${R - r}"/></g>`;
    }
    const a1 = a0 + d.value / total * Math.PI * 2;
    const big = a1 - a0 > Math.PI ? 1 : 0;
    const [x0, y0] = pt(a0, R), [x1, y1] = pt(a1, R), [x2, y2] = pt(a1, r), [x3, y3] = pt(a0, r);
    a0 = a1;
    return `<path data-tip="${esc(tip)}" d="M${x0},${y0} A${R},${R} 0 ${big} 1 ${x1},${y1} L${x2},${y2} A${r},${r} 0 ${big} 0 ${x3},${y3} Z" fill="${color}" stroke="var(--card)" stroke-width="2"/>`;
  }).join('');
  const legend = data.map((d, i) => `<li><i style="background:${SERIES[i % SERIES.length]}"></i><span>${esc(d.label)}</span><b>${d.value}</b><small>${Math.round(d.value / total * 100)}%</small></li>`).join('');
  const desc = shown.map(d => `${d.label} ${d.value}${unit}`).join(', ');
  return `<figure class="chart">
    <figcaption>${esc(title)}</figcaption>
    <div class="donut-wrap">
      <svg viewBox="0 0 160 160" class="donut" role="img" aria-label="${esc(title)}: ${esc(desc)}">${paths}
        <text x="80" y="78" text-anchor="middle" class="donut-total">${total}</text>
        <text x="80" y="96" text-anchor="middle" class="donut-unit">${unit === '명' ? '전체(명)' : '전체(' + unit + ')'}</text>
      </svg>
      <ul class="legend">${legend}</ul>
    </div>
    ${note ? `<p class="chart-note">${esc(note)}</p>` : ''}
  </figure>`;
}

function bars(title, data, { note = '', unit = '명', max } = {}) {
  const top = max || Math.max(1, ...data.map(d => d.value));
  const any = data.some(d => d.value);
  return `<figure class="chart">
    <figcaption>${esc(title)}</figcaption>
    ${any ? `<ul class="hbars" role="list">${data.map(d => `<li data-tip="${esc(`${d.label}: ${d.value}${unit}`)}">
      <span class="hb-label">${esc(d.label)}</span>
      <span class="hb-track"><i style="width:${d.value / top * 100}%"></i></span>
      <b class="hb-val">${d.value}${unit}</b></li>`).join('')}</ul>` : '<p class="chart-empty">아직 집계할 기록이 없습니다.</p>'}
    ${note ? `<p class="chart-note">${esc(note)}</p>` : ''}
  </figure>`;
}

// 마우스·키보드 공통 툴팁
function bindTips(root) {
  let tip = $('#viz-tip');
  if (!tip) { tip = document.createElement('div'); tip.id = 'viz-tip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip); }
  $$('[data-tip]', root).forEach(el => {
    el.addEventListener('pointermove', e => {
      tip.textContent = el.dataset.tip; tip.style.opacity = 1;
      const z = +(document.body.dataset.zoom || 1);
      tip.style.left = (e.clientX / z + 12) + 'px'; tip.style.top = (e.clientY / z + 12) + 'px';
    });
    el.addEventListener('pointerleave', () => { tip.style.opacity = 0; });
  });
}

// ---------- 화면 ----------
function renderDashboard(main) {
  if (!state.cases.length) {
    main.innerHTML = `<div class="empty">
      <h2>클로드복지관 평생과정설계 기록관리</h2>
      <p>참여자를 등록하면 진행상황과 통계가 이 화면에 표시됩니다.</p>
      <div class="btn-row" style="justify-content:center">
        <button class="primary" id="e-add">+ 새 참여자 등록</button>
        <button class="ghost" id="e-sample">🧪 가상 예시 데이터 불러오기 (교육용)</button>
        <button class="ghost" id="e-guide">사용안내 보기</button>
      </div>
      <p class="muted small">예시 데이터는 모두 가상 인물이며, [참여자 관리]에서 한 번에 지울 수 있습니다.</p></div>`;
    $('#e-add').onclick = addCase;
    $('#e-sample').onclick = loadSampleData;
    $('#e-guide').onclick = () => { state.tab = 'guide'; render(); };
    return;
  }
  const f = state.dash;
  const workers = [...new Set(state.cases.map(c => c.meta?.worker).filter(Boolean))].sort();
  const list = state.cases.filter(c => (!f.worker || c.meta?.worker === f.worker) && (!f.status || c.meta?.status === f.status));
  const prog = new Map(list.map(c => [c.id, caseProgress(c)]));
  const active = list.filter(c => c.meta?.status === '진행중');
  const avg = (arr) => arr.length ? Math.round(arr.reduce((s, x) => s + x, 0) / arr.length) : 0;
  const ym = today().slice(0, 7);
  const listIds = new Set(list.map(c => c.id));
  const events = allEvents().filter(e => listIds.has(e.caseId));
  const monthEvents = events.filter(e => e.date.startsWith(ym));
  const upcoming = events.filter(e => e.date >= today() && daysBetween(today(), e.date) <= 30 && !e.done).slice(0, 8);
  const checks = list.map(c => ({ c, why: needsCheck(c) })).filter(x => x.why);
  const lb = lastBackup();
  const backupWarn = !lb || daysBetween(lb, today()) > 14;

  // 집계
  const phaseData = countBy(list, c => prog.get(c.id).phase, ['시작 전', ...PHASES, '평가 완료']);
  const statusData = countBy(list, c => c.meta?.status, CASE_STATUS);
  const genderData = countBy(list, c => c.intro?.gender || '미입력', ['남', '여', '미입력']);
  const disData = foldOther(countBy(list, c => (c.intro?.disability_type || '미입력').trim()));
  const ageData = countBy(list, c => { const a = ageOf(c); return a == null ? '미입력' : a < 20 ? '10대' : a >= 50 ? '50대 이상' : `${Math.floor(a / 10) * 10}대`; }, ['10대', '20대', '30대', '40대', '50대 이상', '미입력']);
  const prio1 = DOMAINS.map(d => ({ label: d, value: list.filter(c => (c.plan?.domains || []).find(r => r.goal)?.area === d).length }));
  const goalsBy = DOMAINS.map(d => ({ label: d, value: list.reduce((s, c) => s + (c.plan?.domains || []).filter(r => r.area === d && r.goal).length, 0) }));
  const evalAll = list.flatMap(c => (c.evals || []).map(e => e?.level).filter(Boolean));
  const evalData = EVAL_LEVELS.map(l => ({ label: l, value: evalAll.filter(x => x === l).length }));
  const stepData = STEPS.map(s => ({ label: `${s.phase}·${s.name}`, value: list.filter(c => c.process?.[s.id]?.done).length }));
  const achieved = evalAll.length ? Math.round(evalAll.filter(x => x === '달성').length / evalAll.length * 100) : null;

  main.innerHTML = `
    <div class="page-head">
      <div><h2>대시보드</h2><p class="muted">기준일 ${today()} · 참여자 ${list.length}명${f.worker || f.status ? ' (필터 적용)' : ''}</p></div>
      <div class="filters" role="group" aria-label="대시보드 필터">
        <label>담당자 <select id="f-worker"><option value="">전체</option>${workers.map(w => `<option ${f.worker === w ? 'selected' : ''}>${esc(w)}</option>`).join('')}</select></label>
        <label>상태 <select id="f-status"><option value="">전체</option>${CASE_STATUS.map(s => `<option ${f.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
        <button class="ghost small" id="dash-print">🖨 인쇄 / PDF</button>
      </div>
    </div>
    ${backupWarn ? `<div class="warn banner" role="status">💾 마지막 백업: <b>${esc(lb || '기록 없음')}</b> — 기록은 이 브라우저에만 저장됩니다. <button class="ghost small" id="dash-backup">지금 백업하기</button></div>` : ''}

    <section class="kpis" aria-label="주요 지표">
      <div class="kpi"><span>전체 참여자</span><b>${list.length}<small>명</small></b><em>진행중 ${active.length} · 보류 ${list.filter(c => c.meta?.status === '보류').length}</em></div>
      <div class="kpi"><span>평균 진행률</span><b>${avg([...prog.values()].map(p => p.pct))}<small>%</small></b><em>전체 ${STEPS.length}단계 기준</em></div>
      <div class="kpi"><span>자기소개서 평균 작성률</span><b>${avg(list.map(introRate))}<small>%</small></b><em>입력된 항목 비율</em></div>
      <div class="kpi"><span>실천과정 목표 달성률</span><b>${achieved == null ? '–' : achieved}<small>${achieved == null ? '' : '%'}</small></b><em>평가 ${evalAll.length}건 중 ‘달성’</em></div>
      <div class="kpi"><span>이번 달 일정</span><b>${monthEvents.length}<small>건</small></b><em>앞으로 30일 ${upcoming.length}건</em></div>
      <div class="kpi ${checks.length ? 'alert' : ''}"><span>점검 필요</span><b>${checks.length}<small>명</small></b><em>활동평가 90일 경과 등</em></div>
    </section>

    <section class="charts">
      ${donut('현재 단계별 참여자', phaseData, { note: '완료한 단계 중 가장 앞선 단계 기준' })}
      ${donut('참여 상태', statusData)}
      ${donut('성별', genderData)}
      ${donut('장애유형', disData, { note: '자기소개서 ‘장애유형’ 기준' })}
      ${donut('연령대', ageData, { note: '생년월일의 연도 기준' })}
      ${donut('실천과정 평가 달성도', evalData, { unit: '건', note: '⑤ 평가 화면의 영역별 달성도' })}
      ${bars('1순위 희망영역', prio1, { note: '실천계획서 영역표의 첫 번째(우선순위 1) 영역' })}
      ${bars('영역별 단기목표 수', goalsBy, { unit: '건' })}
    </section>

    <section class="card">
      <h3 class="fh">참여자별 진행 현황</h3>
      <div class="tbl-wrap"><table class="grid status-tbl">
        <thead><tr><th>참여자</th><th>상태</th><th>담당자</th><th>현재 단계</th><th>다음 단계</th><th style="min-width:150px">진행률</th><th>자기소개서</th><th>단기목표</th><th>최근 활동평가</th><th>지원기간</th><th></th></tr></thead>
        <tbody>${list.map(c => {
          const p = prog.get(c.id); const why = needsCheck(c);
          return `<tr>
            <th scope="row">${esc(c.label)}${c.sample ? ' <span class="tag">예시</span>' : ''}</th>
            <td><span class="st st-${CASE_STATUS.indexOf(c.meta?.status)}">${esc(c.meta?.status)}</span></td>
            <td>${esc(c.meta?.worker || '-')}</td>
            <td>${p.current ? `<b>${p.phase}</b> · ${esc(p.current.name)}` : '<span class="muted">시작 전</span>'}</td>
            <td>${p.next ? esc(p.next.name) : '<span class="muted">-</span>'}</td>
            <td><div class="pbar" data-tip="${p.done}/${p.total} 단계 완료"><i style="width:${p.pct}%"></i></div><small>${p.pct}% (${p.done}/${p.total})</small></td>
            <td class="c">${introRate(c)}%</td>
            <td class="c">${(c.plan?.domains || []).filter(r => r.goal).length}건</td>
            <td class="c">${esc(lastActivityEval(c) || '-')}${why ? `<br><small class="danger">⚠ ${esc(why)}</small>` : ''}</td>
            <td class="c">${esc(supportYear(c))}</td>
            <td class="c"><button class="ghost tiny" data-open="${c.id}">열기</button></td>
          </tr>`;
        }).join('') || '<tr><td colspan="11" class="c muted">조건에 맞는 참여자가 없습니다.</td></tr>'}</tbody>
      </table></div>
    </section>

    <div class="two-col">
      ${bars('단계별 완료 인원', stepData, { max: Math.max(1, list.length), note: '진행과정에서 ‘완료’ 체크한 인원' })}
      <section class="card">
        <h3 class="fh">다가오는 일정 (30일)</h3>
        ${upcoming.length ? `<ul class="ev-list">${upcoming.map(e => `<li><time>${e.date.slice(5).replace('-', '/')}${e.time ? ' ' + esc(e.time) : ''}</time><span class="kind">${esc(e.kind)}</span><span>${esc(e.title)}</span><b>${esc(e.caseLabel)}</b></li>`).join('')}</ul>` : '<p class="chart-empty">예정된 일정이 없습니다. [📅 일정]에서 등록하세요.</p>'}
        <h3 class="fh">점검 필요 참여자</h3>
        ${checks.length ? `<ul class="ev-list">${checks.map(x => `<li><span class="danger">⚠</span><b>${esc(x.c.label)}</b><span>${esc(x.why)}</span><button class="ghost tiny" data-open="${x.c.id}" data-to="eval">평가 기록</button></li>`).join('')}</ul>` : '<p class="chart-empty">점검이 필요한 참여자가 없습니다.</p>'}
      </section>
    </div>
    <p class="note-pink">※ 미래설계 지원 3년(지원회의 1년, 실천 2년) 후 미래설계 자조활동으로 연계 예정</p>`;

  $('#f-worker').onchange = e => { f.worker = e.target.value; renderDashboard(main); };
  $('#f-status').onchange = e => { f.status = e.target.value; renderDashboard(main); };
  $('#dash-print').onclick = () => window.print();
  $('#dash-backup')?.addEventListener('click', openDataMenu);
  $$('[data-open]', main).forEach(b => b.onclick = () => { state.currentId = b.dataset.open; state.tab = b.dataset.to || 'process'; save(); render(); window.scrollTo(0, 0); });
  bindTips(main);
}
