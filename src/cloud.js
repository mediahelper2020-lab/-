/* ===== Supabase 로그인 · 클라우드 저장 =====
   Vercel 배포에서는 /api/config 로 Supabase 공개 설정을 받아 로그인 후 기록을 동기화한다.
   파일로 직접 열면(로컬 모드) 이 브라우저에만 저장한다. */
(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const STORE='sungminPPP_v2',OWNER='pppCloud_owner',MARK='pppCloud_savedAt',HASH='pppCloud_hash';
const SUPABASE_JS='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js';
const toast=(m,t)=>window.uxApp?.toast?window.uxApp.toast(m,t):console.log(m);
const ls={get:k=>{try{return localStorage.getItem(k)}catch(_){return null}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch(_){}},del:k=>{try{localStorage.removeItem(k)}catch(_){}}};
function h(html){const t=document.createElement('template');t.innerHTML=html.trim();const n=t.content.firstElementChild;n.setAttribute('data-ux','');return n;}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const cloud={mode:'checking',client:null,user:null,config:null,status:'',readyResolve:null};
cloud.ready=new Promise(r=>cloud.readyResolve=r);
window.PPPCloud=cloud;

/* 내용이 바뀌었는지 판단하기 위한 지문(저장 시각·화면 위치는 제외) */
function fingerprint(s){const c=Object.assign({},s);delete c.savedAt;delete c.uiPhase;delete c.originKey;delete c.demo;const t=JSON.stringify(c,(k,v)=>k==='updatedAt'?undefined:v);let x=5381;for(let i=0;i<t.length;i++)x=((x<<5)+x+t.charCodeAt(i))|0;return t.length+':'+x;}
const dirty=()=>fingerprint(state)!==ls.get(HASH);

/* ---------- 상단 표시 ---------- */
const chip=h(`<div class="cl-chip" hidden><span class="cl-dot"></span><span class="cl-text"></span><button type="button" class="cl-out">로그아웃</button></div>`);
function setStatus(kind,text){cloud.status=kind;chip.hidden=cloud.mode!=='cloud';chip.dataset.state=kind;$('.cl-text',chip).textContent=text;$('.cl-text',chip).title=cloud.user?.email||'';}
function placeChip(){const right=$('.ux-top-right');if(right&&!chip.isConnected)right.prepend(chip);}
chip.addEventListener('click',ev=>{if(ev.target.closest('.cl-out'))signOut();});

/* ---------- 로그인 화면 ---------- */
const gate=h(`<div class="cl-gate" role="dialog" aria-modal="true" aria-labelledby="clTitle" hidden><form class="cl-card" novalidate>
 <div class="cl-logo">🌱</div><h1 id="clTitle">성민복지관 평생과정설계</h1><p class="cl-sub">기록은 로그인한 계정에 안전하게 저장된다.</p>
 <label>이메일<input name="email" type="email" autocomplete="username" required></label>
 <label>비밀번호<input name="password" type="password" autocomplete="current-password" required minlength="6"></label>
 <div class="cl-err" role="alert"></div>
 <button type="submit" class="primary cl-main">로그인</button>
 <div class="cl-links"><button type="button" data-mode>처음이면 계정 만들기</button><button type="button" data-reset>비밀번호를 잊었다</button></div>
 <p class="cl-note">계정은 기관 관리자가 Supabase에서 만들거나, 가입을 허용한 경우 직접 만든다.</p><p class="cl-note cl-proj"></p></form></div>`);
let signup=false;
function showGate(msg){document.body.append(gate);gate.hidden=false;$('.cl-proj',gate).textContent='연결된 Supabase 프로젝트: '+projectRef();document.body.classList.add('cl-locked');const f=$('form',gate);$('.cl-err',gate).textContent=msg||'';setTimeout(()=>f.elements.namedItem('email').focus(),50);}
function hideGate(){gate.hidden=true;document.body.classList.remove('cl-locked');}
gate.addEventListener('click',async ev=>{
 const f=$('form',gate),E=k=>f.elements.namedItem(k);
 if(ev.target.closest('[data-mode]')){signup=!signup;$('.cl-main',gate).textContent=signup?'계정 만들기':'로그인';ev.target.textContent=signup?'이미 계정이 있다':'처음이면 계정 만들기';E('password').autocomplete=signup?'new-password':'current-password';return;}
 if(ev.target.closest('[data-reset]')){const email=E('email').value.trim();if(!email){$('.cl-err',gate).textContent='이메일을 먼저 입력한다.';return;}
  const {error}=await cloud.client.auth.resetPasswordForEmail(email,{redirectTo:location.origin});$('.cl-err',gate).innerHTML=error?explain(error):'비밀번호 재설정 메일을 보냈다. 메일함을 확인한다.';}
});
$('form',gate).addEventListener('submit',async ev=>{
 ev.preventDefault();const f=ev.target,E=k=>f.elements.namedItem(k),err=$('.cl-err',gate),btn=$('.cl-main',gate);
 const email=E('email').value.trim(),password=E('password').value;
 if(!email||password.length<6){err.textContent='이메일과 6자 이상의 비밀번호를 입력한다.';return;}
 btn.disabled=true;err.textContent='';
 try{
  const r=signup?await cloud.client.auth.signUp({email,password}):await cloud.client.auth.signInWithPassword({email,password});
  if(r.error)throw r.error;
  if(signup&&!r.data.session){err.textContent='가입 확인 메일을 보냈다. 메일의 링크를 누른 뒤 로그인한다.';return;}
  E('password').value='';await afterLogin(r.data.session);
 }catch(e){err.innerHTML=explain(e);}
 finally{btn.disabled=false;}
});

function explain(e){
 const m=String(e?.message||e||''),code=e?.code||'';
 const proj=projectRef();
 if(/email.*not.*confirm/i.test(m)||code==='email_not_confirmed')return '<b>이메일 확인이 안 된 계정이다.</b><br>Supabase → Authentication → Users에서 이 계정을 지우고 <b>Auto Confirm User</b>를 체크해서 다시 만든다. (또는 메일함의 확인 링크를 누른다)';
 if(/invalid login|invalid_credentials/i.test(m)||code==='invalid_credentials')return `<b>이메일 또는 비밀번호가 맞지 않다.</b><br>비밀번호가 맞다면, 계정을 만든 Supabase 프로젝트가 <b>${esc(proj)}</b>인지 확인한다. 다른 프로젝트에 만든 계정으로는 로그인할 수 없다.`;
 if(/invalid api key|no api key|apikey|jwt|unauthor/i.test(m))return '<b>Supabase 키가 맞지 않다.</b><br>Vercel의 SUPABASE_ANON_KEY에 같은 프로젝트의 <b>anon public</b> 키(eyJ…)를 넣고 Redeploy 한다.';
 if(/fetch|network|load failed/i.test(m))return `<b>Supabase에 연결하지 못했다.</b><br>지금 연결하려는 주소: <code>${esc(cloud.config?.supabaseUrl||'(없음)')}</code><br>Supabase → Project Settings → API(Data API)의 <b>Project URL</b>(https://○○○.supabase.co)과 같은지 확인한다. 프로젝트가 일시중지(Paused)된 경우 Supabase 대시보드에서 <b>Restore</b>를 누른다.`;
 if(/rate limit|too many/i.test(m))return '<b>시도가 너무 많았다.</b> 몇 분 뒤 다시 한다.';
 if(/signups? not allowed|signup.*disabled/i.test(m))return '<b>직접 가입이 꺼져 있다.</b> 관리자가 Supabase에서 계정을 만들어 준다.';
 return '로그인하지 못했다: '+esc(m);
}
function projectRef(){try{return new URL(cloud.config?.supabaseUrl||'').hostname.split('.')[0]||'(알 수 없음)';}catch(_){return '(알 수 없음)';}}

/* ---------- 동기화 ---------- */
async function pullRow(){const {data,error}=await cloud.client.from('ppp_workspaces').select('data,saved_at').eq('user_id',cloud.user.id).maybeSingle();if(error)throw error;return data;}
function applyCloud(row){
 const data=row.data||{};data.originKey=state.originKey;data.savedAt=new Date(Date.now()+1000).toISOString();
 ls.set(STORE,JSON.stringify(data));ls.set(MARK,row.saved_at);ls.set(HASH,fingerprint(data));
 if(window.uxApp)window.uxApp.skipSave=true;location.reload();
}
let pushing=false,pushTimer=null;
async function push(force=false){
 if(cloud.mode!=='cloud'||!cloud.user||pushing)return;
 if(!force&&!dirty()){setStatus('ok','☁ 저장됨 · '+time(ls.get(MARK)));return;}
 pushing=true;setStatus('saving','☁ 저장 중…');
 try{
  const remote=await pullRow();
  if(remote&&ls.get(MARK)&&remote.saved_at!==ls.get(MARK)&&!force){pushing=false;return conflict(remote);}
  const saved_at=new Date().toISOString();
  const {data,error}=await cloud.client.from('ppp_workspaces').upsert({user_id:cloud.user.id,data:state,saved_at,updated_at:saved_at}).select('saved_at').single();
  if(error)throw error;
  ls.set(MARK,data.saved_at);ls.set(HASH,fingerprint(state));setStatus('ok','☁ 저장됨 · '+time(data.saved_at));
 }catch(e){setStatus('err','☁ 저장 실패 · 다시 시도');console.warn(e);clearTimeout(pushTimer);pushTimer=setTimeout(()=>push(),15000);}
 finally{pushing=false;}
}
function schedulePush(){if(cloud.mode!=='cloud')return;clearTimeout(pushTimer);pushTimer=setTimeout(()=>push(),1800);}
function time(iso){try{return iso?new Date(iso).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}):'-';}catch(_){return '-';}}

const conflictDlg=h(`<dialog class="ai-dialog" aria-label="저장 충돌"></dialog>`);document.body.append(conflictDlg);
function conflict(remote){
 conflictDlg.innerHTML=`<h2>☁ 다른 곳에서 저장한 기록이 있다</h2><p class="ai-note">다른 기기나 창에서 <b>${esc(new Date(remote.saved_at).toLocaleString('ko-KR'))}</b>에 저장한 기록이 클라우드에 있고, 이 기기에도 아직 올리지 않은 수정이 있다. 어느 쪽을 쓸지 고른다.</p>
 <div class="actions"><button type="button" class="secondary" data-c="later">나중에</button><button type="button" class="secondary" data-c="cloud">클라우드 기록 불러오기</button><button type="button" class="primary" data-c="local">이 기기 기록으로 덮어쓰기</button></div>
 <p class="ai-note">덮어쓰기 전에 ⋯ 메뉴의 「백업 파일 내보내기」로 이 기기 기록을 저장해 둘 수 있다.</p>`;
 conflictDlg.onclick=ev=>{const c=ev.target.closest('[data-c]')?.dataset.c;if(!c)return;conflictDlg.close();
  if(c==='cloud')applyCloud(remote);else if(c==='local')push(true);else setStatus('err','☁ 올리지 않은 수정 있음');};
 setStatus('err','☁ 충돌 · 선택 필요');conflictDlg.showModal();
}

async function afterLogin(session){
 cloud.user=session.user;
 const owner=ls.get(OWNER);
 if(owner&&owner!==cloud.user.id){ // 다른 계정의 기록이 이 기기에 남아 있으면 지우고 시작한다.
  ls.del(STORE);ls.del(MARK);ls.del(HASH);ls.set(OWNER,cloud.user.id);if(window.uxApp)window.uxApp.skipSave=true;location.reload();return;}
 ls.set(OWNER,cloud.user.id);
 setStatus('saving','☁ 불러오는 중…');
 let row=null;
 try{row=await pullRow();}catch(e){hideGate();setStatus('err','☁ 연결 실패 · 이 기기에만 저장 중');toast('클라우드에 연결하지 못했다. 이 기기에 저장하고 나중에 다시 올린다.','warn');cloud.readyResolve();return;}
 hideGate();placeChip();
 if(row){
  if(row.saved_at!==ls.get(MARK)){ // 다른 곳에서 바뀌었거나 이 기기에서 처음 연다
   if(ls.get(MARK)&&dirty())return conflict(row),cloud.readyResolve();
   return applyCloud(row);
  }
  if(dirty())schedulePush();else setStatus('ok','☁ 저장됨 · '+time(row.saved_at));
 }else push(true);
 cloud.readyResolve();
}
async function signOut(){
 const wipe=confirm('로그아웃한다.\n\n이 기기에 남은 기록도 지울까? (공용 PC라면 「확인」을 누른다. 기록은 클라우드에 남아 있다.)');
 if(dirty())await push();
 await cloud.client.auth.signOut();
 if(wipe){ls.del(STORE);ls.del(MARK);ls.del(HASH);ls.del(OWNER);}
 if(window.uxApp)window.uxApp.skipSave=true;location.reload();
}
cloud.signOut=signOut;
cloud.token=async()=>{if(cloud.mode!=='cloud')return null;const {data}=await cloud.client.auth.getSession();return data.session?.access_token||null;};

/* persist 할 때마다 클라우드 저장 예약 */
const basePersist=window.persist;
window.persist=function(){const r=basePersist.apply(this,arguments);schedulePush();return r;};
window.addEventListener('online',()=>schedulePush());
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&cloud.mode==='cloud'&&dirty())push();});

/* ---------- 시작 ---------- */
function loadScript(src){return new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>no(new Error('스크립트를 불러오지 못했다'));s.setAttribute('data-ux','');document.head.append(s);});}
async function start(){
 if(location.protocol==='file:'){cloud.mode='local';cloud.readyResolve();return;}
 let cfg=null;
 try{const r=await fetch('/api/config',{cache:'no-store'});if(r.ok)cfg=await r.json();}catch(_){}
 cloud.config=cfg;
 if(!cfg?.supabaseUrl||!cfg?.supabaseAnonKey){cloud.mode='local';cloud.readyResolve();return;}
 cloud.mode='cloud';placeChip();setStatus('saving','☁ 연결 중…');
 try{await loadScript(SUPABASE_JS);}catch(e){cloud.mode='local';chip.hidden=true;toast('Supabase 연결 도구를 불러오지 못했다. 이 기기에만 저장한다.','warn');cloud.readyResolve();return;}
 cloud.client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,storageKey:'pppCloud_auth'}});
 const {data}=await cloud.client.auth.getSession();
 if(data.session)await afterLogin(data.session);else showGate();
 cloud.client.auth.onAuthStateChange((ev,session)=>{if(ev==='SIGNED_OUT'&&cloud.user){cloud.user=null;showGate('로그아웃되었다. 다시 로그인한다.');}if(ev==='PASSWORD_RECOVERY'){const p=prompt('새 비밀번호(6자 이상)를 입력한다.');if(p&&p.length>=6)cloud.client.auth.updateUser({password:p}).then(({error})=>toast(error?error.message:'비밀번호를 바꿨다.'));}});
}
start();
})();
