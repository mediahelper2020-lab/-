// Supabase DB 연동 — 로그인, 역할 확인, 참여자 기록 동기화, 직원 관리
// 접근 권한은 DB의 RLS 정책(supabase/migrations)이 최종 판단하고, 화면은 그 결과를 따릅니다.

const ROLE_LABEL = { admin: '관리자', manager: '팀장', worker: '담당자', viewer: '열람', pending: '승인 대기' };

const Cloud = {
  client: null, user: null, profile: null, members: [], cases: null,
  synced: new Map(), // id → { version, json } : 마지막으로 DB와 맞춘 상태
  queue: Promise.resolve(), status: '', idleTimer: null,

  config() {
    const c = window.PPP_CONFIG || {};
    return { url: (c.supabaseUrl || '').trim(), key: (c.supabaseAnonKey || '').trim(), idle: +c.idleLogoutMinutes || 30 };
  },
  enabled() { const c = this.config(); return !!(c.url && c.key); },
  role() { return this.profile?.role || 'pending'; },
  can(action) {
    if (!this.enabled()) return true;
    const r = this.role();
    if (action === 'delete') return r === 'admin';
    if (action === 'write') return ['admin', 'manager', 'worker'].includes(r);
    if (action === 'assign') return ['admin', 'manager'].includes(r);
    return false;
  },

  // service_role / secret 키가 들어오면 실행 거부 (브라우저에 노출되면 RLS가 무력화됨)
  keyIsSecret(key) {
    if (/^sb_secret_/i.test(key)) return true;
    try { return JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'service_role'; } catch { return false; }
  },

  // 시작: true = 로그인·승인 완료, false = 로그인/안내 화면 표시 중
  async start() {
    const { url, key } = this.config();
    if (this.keyIsSecret(key)) { this.screen('설정 오류', '<p class="err">js/config.js에 <b>service_role(Secret) 키</b>가 들어 있습니다. 즉시 삭제하고 Supabase에서 키를 재발급(Rotate)한 뒤 anon(Publishable) 키를 넣어주세요.</p>'); return false; }
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url.replace(/\/$/, '')) && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url)) {
      this.screen('설정 오류', '<p class="err">js/config.js의 supabaseUrl 형식이 올바르지 않습니다. 예: https://abcd1234.supabase.co</p>'); return false;
    }
    if (!window.supabase?.createClient) { this.screen('연결 오류', '<p class="err">DB 연결 모듈을 불러오지 못했습니다. 새로고침해 주세요.</p>'); return false; }
    const linkType = /type=(invite|recovery)/.exec(location.hash)?.[1]; // 초대·재설정 메일 링크로 들어온 경우
    this.client = window.supabase.createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    const { data } = await this.client.auth.getSession();
    if (!data.session) { this.loginScreen(); return false; }
    this.user = data.session.user;
    if (linkType) { this.passwordScreen(linkType); return false; }
    this.client.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') location.reload(); });
    return this.loadAll();
  },

  async loadAll() {
    const { data: prof, error } = await this.client.from('profiles').select('id, org_id, role, display_name').eq('id', this.user.id).single();
    if (error || !prof) { this.screen('프로필 오류', `<p class="err">내 정보를 불러오지 못했습니다. (${esc(error?.message || '프로필 없음')})</p>${this.logoutBtn()}`); return false; }
    this.profile = prof;
    if (prof.role === 'pending' || !prof.org_id) {
      this.screen('승인 대기 중', `<p><b>${esc(this.user.email)}</b> 계정은 아직 기관에 등록되지 않았습니다.</p><p>기관 관리자에게 [데이터 관리 → 직원 관리]에서 이 이메일을 추가해 달라고 요청하세요. 승인 전에는 어떤 기록도 볼 수 없습니다.</p>${this.logoutBtn()}`);
      return false;
    }
    const [{ data: rows, error: e2 }, { data: mem }] = await Promise.all([
      this.client.from('cases').select('id, label, status, assigned_to, is_sample, data, version').order('created_at'),
      this.client.from('profiles').select('id, role, display_name').order('display_name'),
    ]);
    if (e2) { this.screen('불러오기 오류', `<p class="err">기록을 불러오지 못했습니다: ${esc(e2.message)}</p>${this.logoutBtn()}`); return false; }
    this.members = (mem || []).filter(m => m.role !== 'pending');
    this.synced.clear();
    this.cases = rows.map(r => {
      const c = normalizeCase({ ...r.data, id: r.id, label: r.label, sample: r.is_sample });
      c.meta.status = r.status; c.meta.assignee = r.assigned_to;
      c.meta.worker = this.memberName(r.assigned_to) || c.meta.worker;
      this.synced.set(r.id, { version: r.version, json: this.json(c) });
      return c;
    });
    document.body.classList.add('cloud');
    // 열람 전용: 화면 일부만 다시 그려지는 경우까지 항상 잠금 유지
    if (!this.can('write') && !this.roObserver) {
      this.roObserver = new MutationObserver(() => this.applyReadOnly($('#main')));
      this.roObserver.observe($('#main'), { childList: true, subtree: true });
    }
    this.watchIdle();
    setTimeout(() => this.offerLocalImport(), 300);
    return true;
  },

  memberName(id) { const m = this.members.find(x => x.id === id); return m ? (m.display_name || '이름 미등록') : ''; },
  json(c) { const { updated, ...rest } = c; return JSON.stringify(rest); },
  row(c) {
    const { id, label, sample, ...data } = c;
    return { id, label, status: c.meta?.status || '진행중', assigned_to: c.meta?.assignee || this.user.id, is_sample: !!sample, data };
  },

  // 변경된 참여자만 DB에 반영 (순서대로 한 번에 하나씩)
  sync() { this.queue = this.queue.then(() => this.syncNow()).catch(() => {}); return this.queue; },
  async syncNow() {
    if (!this.can('write')) return;
    this.setStatus('saving');
    let failed = '', conflict = false;
    for (const c of state.cases) {
      const json = this.json(c), prev = this.synced.get(c.id);
      if (prev && prev.json === json) continue;
      const row = this.row(c);
      const q = prev
        ? this.client.from('cases').update(row).eq('id', c.id).eq('version', prev.version).select('version')
        : this.client.from('cases').insert(row).select('version');
      const { data, error } = await q;
      if (error) { failed = this.errText(error); continue; }
      if (!data?.length) { conflict = true; continue; }
      this.synced.set(c.id, { version: data[0].version, json });
    }
    const ids = new Set(state.cases.map(c => c.id));
    for (const id of [...this.synced.keys()].filter(id => !ids.has(id))) {
      const { data, error } = await this.client.from('cases').delete().eq('id', id).select('id');
      if (error || !data?.length) { failed = error ? this.errText(error) : '삭제 권한이 없습니다(관리자만 삭제 가능).'; continue; }
      this.synced.delete(id);
    }
    if (conflict) {
      this.setStatus('error');
      alert('다른 직원이 같은 참여자 기록을 먼저 수정했거나, 수정 권한이 없습니다.\n최신 내용으로 다시 불러옵니다. (방금 입력한 내용은 다시 입력해 주세요)');
      return this.reload();
    }
    if (failed) { this.setStatus('error'); alert('DB 저장 실패: ' + failed); return this.reload(); }
    this.setStatus('ok');
  },
  errText(e) {
    if (e.code === '42501' || /row-level security|permission denied/i.test(e.message)) return '권한이 없습니다. (' + e.message + ')';
    if (e.code === '23514') return '입력값이 DB 규칙에 맞지 않습니다(이름 30자 이내, 상태값, 크기 등).';
    return e.message;
  },
  async reload() {
    if (await this.loadAll()) { this.status = ''; load(); render(); }
  },

  setStatus(s) { this.status = s; this.renderBadge(); },
  renderBadge() {
    let el = $('#cloud-badge');
    if (!this.enabled()) { el?.remove(); return; }
    if (!el) {
      el = document.createElement('span'); el.id = 'cloud-badge';
      el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
      $('.case-bar').prepend(el);
    }
    if (!this.profile) { el.textContent = ''; return; }
    const st = { saving: '저장 중…', ok: '☁ 저장됨', error: '⚠ 저장 실패' }[this.status] || '☁ DB 연결';
    el.className = 'cloud-badge ' + (this.status || '');
    el.innerHTML = `<span>${esc(this.memberName(this.user.id) || this.user.email)} · ${ROLE_LABEL[this.role()]}</span><b>${st}</b>`;
  },

  // 열람 전용(viewer): 입력칸 잠금, 추가 버튼 숨김 (DB에서도 RLS로 차단됨)
  applyReadOnly(root) {
    if (!this.enabled() || this.can('write')) return;
    $$('input, textarea, select', root).forEach(el => { if (!el.closest('.filters, .plan-meta-inline, .cal-head')) el.disabled = true; });
    $$('#p-add, #p-sample, #p-unsample, #ev-add, #ev-add-day, [data-edit], [data-evedit], [data-evdel], .ai-btn, [data-addrow], #add-domain, #add-log, #st-newyear, #st-fill, #offline-draft', root).forEach(b => b.remove());
    $('#add-case')?.remove();
    if (!$('.ro-note', root)) root.insertAdjacentHTML('afterbegin', '<p class="warn ro-note" role="status">👀 열람 전용 계정입니다. 기록을 볼 수만 있고 수정할 수 없습니다.</p>');
  },

  // ---------- 담당자 지정 (참여자 등록·수정 폼) ----------
  assigneeField(m) {
    const me = this.user.id, sel = m.assignee || me;
    const staff = this.members.filter(x => ['admin', 'manager', 'worker'].includes(x.role));
    if (!this.can('assign')) return `<label class="f"><span>담당 사회복지사</span><input value="${esc(this.memberName(sel) || '본인')}" disabled><input type="hidden" id="cf-assignee" value="${esc(sel)}"></label>`;
    return `<label class="f"><span>담당 사회복지사</span><select id="cf-assignee">${staff.map(x => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(x.display_name || '이름 미등록')} (${ROLE_LABEL[x.role]})</option>`).join('')}</select></label>`;
  },
  readAssignee() {
    const id = $('#cf-assignee').value;
    return { assignee: id, worker: this.memberName(id) };
  },

  // ---------- 데이터 관리 메뉴 확장 ----------
  decorateDataMenu() {
    if (!this.enabled()) return;
    if (!this.can('delete')) $('#d-delete')?.remove();
    if (!this.can('write')) { $('#d-import')?.closest('label')?.remove(); $('#d-rename')?.remove(); }
    const col = $('#modal-body .btn-col');
    col.insertAdjacentHTML('beforeend', `
      <button class="ghost" id="d-profile">🙍 내 표시 이름 바꾸기</button>
      ${this.role() === 'admin' ? '<button class="ghost" id="d-members">👥 직원 관리 (권한)</button>' : ''}
      <button class="ghost" id="d-logout">🔒 로그아웃</button>`);
    $('#d-logout').onclick = () => this.logout();
    $('#d-profile').onclick = async () => {
      const n = prompt('직원 목록·담당자에 표시될 이름 (30자 이내)', this.memberName(this.user.id));
      if (n === null) return;
      const name = n.trim().slice(0, 30);
      if (!name) return alert('이름을 입력해주세요.');
      const { error } = await this.client.from('profiles').update({ display_name: name }).eq('id', this.user.id);
      if (error) return alert('변경 실패: ' + this.errText(error));
      $('#modal').close(); this.reload(); flash('이름 변경됨');
    };
    $('#d-members')?.addEventListener('click', () => setTimeout(() => this.openMembers(), 50));
  },

  async openMembers() {
    const { data, error } = await this.client.from('profiles').select('id, role, display_name, created_at').order('created_at');
    if (error) return alert('직원 목록을 불러오지 못했습니다: ' + this.errText(error));
    const me = this.user.id;
    modal('직원 관리 (권한)', `
      <p class="muted small">관리자: 전체 보기·수정·삭제·직원 관리 / 팀장: 전체 보기·수정 / 담당자: 본인 담당 참여자만 / 열람: 전체 보기만</p>
      <div class="tbl-wrap"><table class="grid status-tbl"><thead><tr><th>이름</th><th>역할</th><th></th></tr></thead><tbody>
        ${data.map(p => `<tr><td>${esc(p.display_name || '이름 미등록')}${p.id === me ? ' (나)' : ''}</td>
          <td>${p.id === me ? ROLE_LABEL[p.role] : `<select data-role="${p.id}" aria-label="${esc(p.display_name)} 역할">${['manager', 'worker', 'viewer', 'admin'].map(r => `<option value="${r}" ${p.role === r ? 'selected' : ''}>${ROLE_LABEL[r]}</option>`).join('')}</select>`}</td>
          <td>${p.id === me ? '' : `<button class="ghost tiny danger" data-remove="${p.id}">기관에서 제외</button>`}</td></tr>`).join('')}
      </tbody></table></div>
      <h3 class="fh">직원 추가</h3>
      <p class="muted small">① Supabase 대시보드 → Authentication → Users → <b>Invite user</b>로 초대 메일 발송 → ② 직원이 메일 링크로 비밀번호 설정 → ③ 아래에 이메일과 역할을 입력해 추가</p>
      <div class="fields">
        <label class="f"><span>직원 이메일</span><input id="m-email" type="email" autocomplete="off"></label>
        <label class="f"><span>역할</span><select id="m-role"><option value="worker">담당자</option><option value="manager">팀장</option><option value="viewer">열람</option></select></label>
      </div>
      <p id="m-err" class="err" role="alert"></p>`, [{
      label: '직원 추가', onClick: () => {
        const email = $('#m-email').value.trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { $('#m-err').textContent = '이메일 형식을 확인해주세요.'; $('#m-email').focus(); return false; }
        this.client.rpc('add_member', { member_email: email, member_role: $('#m-role').value }).then(({ error }) => {
          if (error) { $('#m-err').textContent = this.errText(error); return; }
          flash('직원을 추가했습니다'); this.openMembers();
        });
        return false;
      },
    }]);
    $$('[data-role]').forEach(s => s.onchange = async () => {
      const { error } = await this.client.from('profiles').update({ role: s.value }).eq('id', s.dataset.role);
      if (error) { alert('변경 실패: ' + this.errText(error)); return this.openMembers(); }
      flash('역할 변경됨'); this.reload();
    });
    $$('[data-remove]').forEach(b => b.onclick = async () => {
      if (!confirm('이 직원을 기관에서 제외할까요? 제외하면 어떤 기록도 볼 수 없게 됩니다. 담당하던 참여자는 담당자가 비워집니다.')) return;
      const { error } = await this.client.from('profiles').update({ org_id: null, role: 'pending' }).eq('id', b.dataset.remove);
      if (error) return alert('제외 실패: ' + this.errText(error));
      flash('제외됨'); this.openMembers(); this.reload();
    });
  },

  // 이 브라우저(로컬 모드)에 남아 있던 기록을 DB로 옮기기
  offerLocalImport() {
    let local = [];
    try { local = JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch {}
    if (!local.length || !this.can('write')) return;
    if (!confirm(`이 브라우저에 DB 연결 전 기록 ${local.length}명이 남아 있습니다.\nDB로 옮길까요? (옮긴 뒤 이 브라우저의 기록은 삭제됩니다)`)) return;
    local.forEach(x => { if (x?.id && !state.cases.some(c => c.id === x.id)) state.cases.push(normalizeCase(x)); });
    this.sync().then(() => { if (this.status === 'ok') { try { localStorage.removeItem(STORE_KEY); } catch {} flash('DB로 옮겼습니다'); render(); } });
  },

  // ---------- 자동 로그아웃 ----------
  watchIdle() {
    const reset = () => {
      clearTimeout(this.idleTimer);
      this.idleTimer = setTimeout(() => { alert(`${this.config().idle}분 동안 사용하지 않아 개인정보 보호를 위해 로그아웃합니다.`); this.logout(); }, this.config().idle * 60000);
    };
    if (this.idleWatching) return reset();
    this.idleWatching = true;
    ['pointerdown', 'keydown', 'scroll'].forEach(ev => window.addEventListener(ev, reset, { passive: true }));
    reset();
  },
  async logout() {
    await this.queue;
    state.cases = []; this.cases = null;
    await this.client.auth.signOut();
    location.reload();
  },
  logoutBtn() { return '<button class="ghost" data-logout>로그아웃</button>'; },

  // ---------- 로그인 · 비밀번호 화면 ----------
  screen(title, html) {
    $('.tabs').hidden = true; $('.case-bar').hidden = true;
    $('#main').innerHTML = `<section class="auth-box card"><h2>${esc(title)}</h2>${html}</section>`;
    $('[data-logout]')?.addEventListener('click', () => this.logout());
  },
  loginScreen() {
    this.screen('로그인', `
      <p class="muted">기관에서 초대받은 계정으로 로그인하세요. 참여자 기록은 로그인한 직원의 권한 범위에서만 보입니다.</p>
      <form id="login-form" class="fields" novalidate>
        <label class="f wide"><span>이메일</span><input id="lg-email" type="email" autocomplete="username" required></label>
        <label class="f wide"><span>비밀번호</span><input id="lg-pw" type="password" autocomplete="current-password" required></label>
        <p id="lg-err" class="err f wide" role="alert"></p>
        <div class="btn-row f wide"><button class="primary" type="submit">로그인</button><button class="ghost" type="button" id="lg-reset">비밀번호를 잊었어요</button></div>
      </form>`);
    const err = (m, el) => { $('#lg-err').textContent = m; el?.focus(); };
    $('#lg-email').focus();
    $('#login-form').onsubmit = async (e) => {
      e.preventDefault();
      const email = $('#lg-email').value.trim(), password = $('#lg-pw').value;
      if (!email) return err('이메일을 입력해주세요.', $('#lg-email'));
      if (!password) return err('비밀번호를 입력해주세요.', $('#lg-pw'));
      const btn = e.submitter; btn.disabled = true;
      const { error } = await this.client.auth.signInWithPassword({ email, password });
      btn.disabled = false;
      if (error) return err(/invalid/i.test(error.message) ? '이메일 또는 비밀번호가 맞지 않습니다.' : error.message, $('#lg-pw'));
      location.reload();
    };
    $('#lg-reset').onclick = async () => {
      const email = $('#lg-email').value.trim();
      if (!email) return err('비밀번호 재설정 메일을 받을 이메일을 먼저 입력해주세요.', $('#lg-email'));
      await this.client.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      err('등록된 이메일이면 재설정 메일이 발송됩니다. 메일의 링크를 눌러주세요.');
    };
  },
  passwordScreen(type) {
    this.screen(type === 'invite' ? '처음 오셨네요 — 비밀번호 설정' : '새 비밀번호 설정', `
      <form id="pw-form" class="fields" novalidate>
        <label class="f wide"><span>새 비밀번호 (10자 이상, 영문·숫자 포함)</span><input id="pw1" type="password" autocomplete="new-password"></label>
        <label class="f wide"><span>새 비밀번호 확인</span><input id="pw2" type="password" autocomplete="new-password"></label>
        <label class="f wide"><span>직원 표시 이름 (예: 홍길동)</span><input id="pw-name" maxlength="30"></label>
        <p id="pw-err" class="err f wide" role="alert"></p>
        <div class="f wide"><button class="primary" type="submit">저장하고 시작하기</button></div>
      </form>`);
    $('#pw1').focus();
    $('#pw-form').onsubmit = async (e) => {
      e.preventDefault();
      const p1 = $('#pw1').value, p2 = $('#pw2').value, name = $('#pw-name').value.trim();
      const err = (m, el) => { $('#pw-err').textContent = m; el.focus(); };
      if (p1.length < 10 || !/[a-z]/i.test(p1) || !/\d/.test(p1)) return err('비밀번호는 10자 이상, 영문과 숫자를 포함해야 합니다.', $('#pw1'));
      if (p1 !== p2) return err('비밀번호 확인이 일치하지 않습니다.', $('#pw2'));
      const { error } = await this.client.auth.updateUser({ password: p1 });
      if (error) return err(error.message, $('#pw1'));
      if (name) await this.client.from('profiles').update({ display_name: name.slice(0, 30) }).eq('id', this.user.id);
      history.replaceState(null, '', location.pathname);
      location.reload();
    };
  },
};
