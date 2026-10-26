/* ===== 아바타 마을 홈 · 다중 AI 모델(ChatGPT·Gemini·Claude) 레이어 ===== */
(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const has=v=>String(v??'').trim().length>0;
const toast=(m,t)=>window.uxApp?.toast?window.uxApp.toast(m,t):window.alert(m);
function h(html){const t=document.createElement('template');t.innerHTML=html.trim();const n=t.content.firstElementChild;n.setAttribute('data-ux','');return n;}
function fire(el){el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}

/* =====================================================================
   1. 아바타
   ===================================================================== */
const SKIN=['#f8d9c0','#f1c7a1','#d9a47a','#a8714c'];
const HAIRC=['#2d2420','#5b3a29','#a0672f','#d8b071','#8a8f98','#c2554a'];
const OUTFIT=['#3d6b5a','#5a7fa8','#c4723f','#8a6bb0','#d6a43a','#c4566e','#4f8f8a','#6b6f7a'];
const HAIR=[['short','짧은 머리'],['long','긴 머리'],['bob','단발'],['curly','곱슬'],['bun','올림머리'],['spiky','삐죽'],['none','민머리']];
const ACC=[['none','없음'],['glasses','안경'],['hat','모자'],['cap','야구모자'],['ribbon','리본'],['headphones','헤드폰'],['flower','꽃핀']];
const FACE=[['smile','웃음'],['grin','활짝'],['calm','차분'],['wink','윙크']];

function hash(s){let x=0;for(const c of String(s))x=(x*31+c.charCodeAt(0))>>>0;return x;}
function defaultAvatar(name){const n=hash(name);return {skin:SKIN[n%4],hair:HAIR[(n>>2)%6][0],hairColor:HAIRC[(n>>5)%6],outfit:OUTFIT[(n>>8)%8],acc:ACC[(n>>11)%7][0],face:FACE[(n>>14)%4][0]};}
function randomAvatar(){const p=a=>a[Math.floor(Math.random()*a.length)];return {skin:p(SKIN),hair:p(HAIR)[0],hairColor:p(HAIRC),outfit:p(OUTFIT),acc:p(ACC)[0],face:p(FACE)[0]};}
function avatarOf(u){return Object.assign(defaultAvatar(u?.name||''),u?.avatar||{});}

function avatarSVG(a){
 const s=a.skin,hc=a.hairColor,o=a.outfit,dark='#2f2a28';
 const back={long:`<path d="M13 26 Q12 54 18 58 L46 58 Q52 54 51 26 Z" fill="${hc}"/>`,bun:`<circle cx="32" cy="7" r="7" fill="${hc}"/>`}[a.hair]||'';
 const front={
  short:`<path d="M15 27 Q15 9 32 9 Q49 9 49 27 Q44 18 32 18 Q22 18 15 27Z" fill="${hc}"/>`,
  long:`<path d="M14 30 Q13 9 32 9 Q51 9 50 30 Q46 17 32 17 Q19 17 14 30Z" fill="${hc}"/>`,
  bob:`<path d="M13 40 Q11 9 32 9 Q53 9 51 40 L46 40 Q47 22 40 18 Q30 23 18 21 Q17 30 18 40Z" fill="${hc}"/>`,
  curly:`<g fill="${hc}"><circle cx="18" cy="20" r="6"/><circle cx="25" cy="13" r="6.5"/><circle cx="33" cy="11" r="7"/><circle cx="41" cy="13" r="6.5"/><circle cx="47" cy="20" r="6"/><circle cx="15" cy="27" r="4.5"/><circle cx="49" cy="27" r="4.5"/></g>`,
  bun:`<path d="M15 27 Q15 10 32 10 Q49 10 49 27 Q44 18 32 18 Q22 18 15 27Z" fill="${hc}"/>`,
  spiky:`<path d="M15 26 L14 14 L21 18 L22 8 L28 15 L32 6 L36 15 L42 8 L43 18 L50 14 L49 26 Q44 19 32 19 Q21 19 15 26Z" fill="${hc}"/>`,
  none:''}[a.hair]||'';
 const eyes=a.face==='wink'?`<circle cx="26" cy="30" r="2.2" fill="${dark}"/><path d="M35 30 q3 -2.5 6 0" stroke="${dark}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`
  :a.face==='calm'?`<path d="M23.5 30 q2.5 2 5 0 M35.5 30 q2.5 2 5 0" stroke="${dark}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`
  :`<circle cx="26" cy="30" r="2.3" fill="${dark}"/><circle cx="38" cy="30" r="2.3" fill="${dark}"/><circle cx="26.8" cy="29.2" r=".7" fill="#fff"/><circle cx="38.8" cy="29.2" r=".7" fill="#fff"/>`;
 const mouth=a.face==='grin'?`<path d="M27 36 q5 6 10 0 z" fill="#b54a45"/>`:a.face==='calm'?`<path d="M29 37 q3 1.5 6 0" stroke="${dark}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`:`<path d="M27.5 36 q4.5 4 9 0" stroke="${dark}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
 const acc={
  glasses:`<g fill="none" stroke="#2f3b46" stroke-width="1.6"><circle cx="26" cy="30" r="5"/><circle cx="38" cy="30" r="5"/><path d="M31 30 h2 M21 29 l-5 -2 M43 29 l5 -2"/></g>`,
  hat:`<path d="M10 19 Q32 13 54 19 Q32 23 10 19Z" fill="${o}"/><path d="M19 18 Q19 4 32 4 Q45 4 45 18Z" fill="${o}"/><rect x="19" y="14" width="26" height="3.5" fill="#fff" opacity=".55"/>`,
  cap:`<path d="M16 21 Q16 7 32 7 Q48 7 48 21Z" fill="${o}"/><path d="M40 19 Q52 18 57 22 Q48 24 40 22Z" fill="${o}"/><circle cx="32" cy="7.5" r="1.8" fill="#fff"/>`,
  ribbon:`<g transform="translate(45 13)"><path d="M0 0 L-8 -5 L-8 5Z M0 0 L8 -5 L8 5Z" fill="#e0607a"/><circle r="2.4" fill="#c44462"/></g>`,
  headphones:`<path d="M13 30 Q13 7 32 7 Q51 7 51 30" fill="none" stroke="#3c4450" stroke-width="3"/><rect x="9" y="25" width="7" height="12" rx="3" fill="${o}"/><rect x="48" y="25" width="7" height="12" rx="3" fill="${o}"/>`,
  flower:`<g transform="translate(18 15)"><circle cx="0" cy="-4" r="3" fill="#f2b84b"/><circle cx="4" cy="0" r="3" fill="#f2b84b"/><circle cx="0" cy="4" r="3" fill="#f2b84b"/><circle cx="-4" cy="0" r="3" fill="#f2b84b"/><circle r="2.3" fill="#d06a3c"/></g>`,
  none:''}[a.acc]||'';
 return `<svg viewBox="0 0 64 84" aria-hidden="true"><ellipse cx="32" cy="81" rx="15" ry="3" fill="#00000026"/><g class="vc-body"><g class="vc-flip">
 ${back}
 <rect x="23" y="64" width="7" height="15" rx="3" fill="#3f4651"/><rect x="34" y="64" width="7" height="15" rx="3" fill="#3f4651"/>
 <ellipse cx="26.5" cy="79" rx="5" ry="2.6" fill="#2a2e35"/><ellipse cx="37.5" cy="79" rx="5" ry="2.6" fill="#2a2e35"/>
 <rect x="11" y="47" width="8" height="16" rx="4" fill="${o}"/><rect x="45" y="47" width="8" height="16" rx="4" fill="${o}"/>
 <circle cx="15" cy="64" r="3.6" fill="${s}"/><circle cx="49" cy="64" r="3.6" fill="${s}"/>
 <path d="M18 50 Q18 44 26 44 L38 44 Q46 44 46 50 L46 68 L18 68 Z" fill="${o}"/>
 <path d="M27 44 L32 50 L37 44" fill="#fff" opacity=".65"/>
 <rect x="28.5" y="38" width="7" height="7" fill="${s}"/>
 <circle cx="32" cy="27" r="17.5" fill="${s}"/>
 <circle cx="14.6" cy="29" r="3" fill="${s}"/><circle cx="49.4" cy="29" r="3" fill="${s}"/>
 ${front}${eyes}
 <circle cx="21.5" cy="35" r="2.8" fill="#f08c8c" opacity=".45"/><circle cx="42.5" cy="35" r="2.8" fill="#f08c8c" opacity=".45"/>
 ${mouth}${acc}
 </g></g></svg>`;
}

/* =====================================================================
   2. 이용자별 진행 정보
   ===================================================================== */
const ZONES=[
 {key:'plaza',name:'마을 광장',sub:'새로 온 친구',ico:'⛲',x:[40,175],y:[400,500],sign:[108,268]},
 {key:'counseling',name:'이야기집',sub:'상담 · 자기소개서',ico:'🏡',x:[215,365],y:[395,500],sign:[290,190]},
 {key:'plan',name:'회의마루',sub:'지원계획 · 지원회의',ico:'🏛️',x:[405,585],y:[395,500],sign:[495,175]},
 {key:'practice',name:'실천 놀이터',sub:'실천 · 일상 속 활동',ico:'🎡',x:[625,790],y:[395,500],sign:[707,190]},
 {key:'evaluation',name:'전망대',sub:'모니터링 · 변화 살피기',ico:'🔭',x:[830,960],y:[395,500],sign:[895,150]},
];
const TRACK=['상담','사전회의','통합회의','컨퍼런스회의','확정회의','단기계획','실천','모니터링'];

function userMeetings(name){
 return state.meetings.filter(m=>m.client===name&&m.snapshot).slice()
  .sort((a,b)=>String(b.updatedAt||b.date||'').localeCompare(String(a.updatedAt||a.date||'')));
}
function liveSnap(m){
 if(!m)return null;
 if(m.id===state.activeMeetingId)return {forms:state.forms||{},current:state.current||1,practice:state.practice||{},evaluation:state.evaluation||{}};
 return m.snapshot;
}
function progressOf(name){
 const ms=userMeetings(name),m=ms[0],s=liveSnap(m);
 if(!s)return {meeting:null,meetings:ms,done:[],doneCount:0,zone:0,next:'첫 지원회의 시작',snap:null};
 const f=s.forms||{},cur=s.current||1;
 const filled=n=>Object.entries(f[n]||{}).some(([k,v])=>!k.startsWith('common_')&&has(v));
 const done=[cur>1||filled(1),cur>2,cur>3,cur>4,cur>5,cur>=6&&filled(6),!!s.practice?.completed,!!s.evaluation?.completed];
 const first=done.indexOf(false);
 const zone=first<0?4:first===0?1:first<=5?2:first===6?3:4;
 return {meeting:m,meetings:ms,done,doneCount:done.filter(Boolean).length,zone,next:first<0?'모든 단계 완료 🏆':TRACK[first],snap:s};
}
function latestPlanOf(s){
 if(!s)return {};let out={};
 for(let n=2;n<=6;n++)out=Object.assign(out,s.forms?.[n]||{});
 const intro=s.forms?.[1]||{};if(!out.plan_dream)out.plan_dream=intro.dream||'';
 return out;
}
const LEVEL_NAMES=['씨앗','새싹','떡잎','줄기','잎새','꽃봉오리','꽃','열매','큰나무'];
function levelOf(p){return {lv:p.doneCount+1,name:LEVEL_NAMES[Math.min(p.doneCount,8)],pct:Math.round(p.doneCount/8*100)};}

/* =====================================================================
   3. 마을 장면
   ===================================================================== */
const SCENE=`<svg class="vl-bg" viewBox="0 0 1000 540" preserveAspectRatio="none" aria-hidden="true">
<defs><linearGradient id="vlSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe6ef"/><stop offset="1" stop-color="#f3eedd"/></linearGradient>
<linearGradient id="vlGrass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9d3a4"/><stop offset="1" stop-color="#94b980"/></linearGradient></defs>
<rect width="1000" height="540" fill="url(#vlSky)"/>
<circle cx="905" cy="70" r="44" fill="#f4dc9c"/><circle cx="905" cy="70" r="60" fill="#f4dc9c" opacity=".3"/>
<g fill="#fff" opacity=".85"><ellipse cx="160" cy="70" rx="56" ry="17"/><ellipse cx="200" cy="58" rx="36" ry="16"/><ellipse cx="560" cy="52" rx="60" ry="15"/><ellipse cx="600" cy="42" rx="34" ry="14"/></g>
<path d="M0 250 Q130 180 280 235 T560 220 T820 228 T1000 205 L1000 540 L0 540Z" fill="#c9dcb3"/>
<path d="M0 300 Q160 250 330 290 T700 280 T1000 270 L1000 540 L0 540Z" fill="url(#vlGrass)"/>
<path d="M-10 470 Q120 420 250 455 T500 450 T750 455 T1010 440 L1010 500 Q860 520 750 500 T500 505 T250 510 T-10 520Z" fill="#e8d6aa" opacity=".9"/>
<!-- 광장 분수 -->
<g transform="translate(108 360)"><ellipse rx="52" ry="14" cy="30" fill="#a8c7d4"/><ellipse rx="52" ry="14" cy="26" fill="#cfe4ec" stroke="#9ab3bd" stroke-width="3"/><rect x="-6" y="-14" width="12" height="40" fill="#d8d2c2"/><ellipse cy="-14" rx="20" ry="6" fill="#d8d2c2"/><path d="M0 -40 Q-14 -24 -18 -14 M0 -40 Q14 -24 18 -14 M0 -46 L0 -14" stroke="#9fd0e6" stroke-width="3" fill="none" stroke-linecap="round"/></g>
<g transform="translate(40 330)"><rect x="-5" y="0" width="10" height="40" fill="#8a6a4a"/><circle cy="-10" r="30" fill="#7fae74"/><circle cx="-14" cy="2" r="18" fill="#8fbc80"/></g>
<!-- 이야기집 -->
<g transform="translate(290 300)"><rect x="-70" y="-60" width="140" height="95" rx="6" fill="#fbf1de" stroke="#cdb48a" stroke-width="3"/><path d="M-86 -56 L0 -118 L86 -56Z" fill="#c4723f"/><rect x="-16" y="-8" width="32" height="43" rx="15" fill="#8a5a3a"/><rect x="-55" y="-40" width="30" height="26" rx="4" fill="#bfe0ec" stroke="#cdb48a" stroke-width="3"/><rect x="25" y="-40" width="30" height="26" rx="4" fill="#bfe0ec" stroke="#cdb48a" stroke-width="3"/><rect x="38" y="-112" width="16" height="30" fill="#a75d33"/></g>
<!-- 회의마루 -->
<g transform="translate(495 300)"><rect x="-95" y="22" width="190" height="14" fill="#d8d2c2"/><rect x="-85" y="-62" width="170" height="86" fill="#f4f1e6" stroke="#c9c1a8" stroke-width="3"/><path d="M-102 -60 L0 -122 L102 -60Z" fill="#5f8a74"/><circle cy="-82" r="12" fill="#f4dc9c"/>${[-68,-34,0,34,68].map(x=>`<rect x="${x-6}" y="-56" width="12" height="78" fill="#e6dfcb"/>`).join('')}<rect x="-16" y="-14" width="32" height="38" rx="3" fill="#7a5a3f"/></g>
<!-- 실천 놀이터 -->
<g transform="translate(707 320)"><circle cy="-60" r="58" fill="none" stroke="#c4723f" stroke-width="5"/>${[0,45,90,135].map(a=>`<line x1="${Math.cos(a*Math.PI/180)*-58}" y1="${-60+Math.sin(a*Math.PI/180)*-58}" x2="${Math.cos(a*Math.PI/180)*58}" y2="${-60+Math.sin(a*Math.PI/180)*58}" stroke="#d8a37c" stroke-width="3"/>`).join('')}${[0,60,120,180,240,300].map(a=>`<rect x="${Math.cos(a*Math.PI/180)*58-9}" y="${-60+Math.sin(a*Math.PI/180)*58-6}" width="18" height="14" rx="4" fill="${['#e0607a','#5a7fa8','#d6a43a','#8a6bb0','#4f8f8a','#c4723f'][a/60]}"/>`).join('')}<path d="M-30 30 L0 -60 L30 30" stroke="#8a6a4a" stroke-width="7" fill="none"/><circle cy="-60" r="8" fill="#8a6a4a"/></g>
<g transform="translate(790 340)"><rect x="-4" y="-10" width="8" height="45" fill="#8a6a4a"/><circle cy="-22" r="24" fill="#7fae74"/></g>
<!-- 전망대 -->
<g transform="translate(895 320)"><path d="M-34 30 L-20 -110 L20 -110 L34 30Z" fill="#ece3cf" stroke="#c9b68e" stroke-width="3"/><rect x="-34" y="-128" width="68" height="20" rx="4" fill="#8a6bb0"/><path d="M-40 -128 L0 -158 L40 -128Z" fill="#6f5796"/><rect x="-10" y="-90" width="20" height="24" rx="10" fill="#bfe0ec"/><rect x="-12" y="0" width="24" height="30" rx="11" fill="#7a5a3f"/></g>
<!-- 꽃 -->
<g>${[[180,520],[380,512],[600,515],[820,520],[960,505],[60,505]].map(([x,y],i)=>`<g transform="translate(${x} ${y})"><circle r="4" fill="${['#e0607a','#f2b84b','#fff','#8a6bb0','#f2b84b','#e0607a'][i]}"/><circle r="1.6" fill="#c4723f"/></g>`).join('')}</g>
</svg>`;

const village={timers:[],chars:new Map(),filter:'',zoneFilter:-1,mode:window.Village3D?'3d':'pending',v3:null};
/* 3D 모듈(Three.js)이 준비되면 3D, 못 불러오면 2D 그림으로 보여준다. */
function setMode(m){if(village.mode===m)return;village.mode=m;const st=$('#avatarVillage .vl-stage');if(st)buildStage(st);renderVillage();}
window.addEventListener('village3d-ready',()=>setMode('3d'));
window.addEventListener('village3d-failed',()=>setMode('2d'));
setTimeout(()=>{if(village.mode==='pending')setMode('2d');},9000);

function buildStage(stage){
 if(village.v3){village.v3.dispose();village.v3=null;}
 village.chars.forEach(c=>{clearTimeout(c.t1);clearTimeout(c.t2);});village.chars.clear();
 stage.innerHTML='';stage.className='vl-stage';
 if(village.mode==='3d'){
  stage.classList.add('is3d');
  village.v3=window.Village3D.createVillage(stage,{zones:ZONES,onPick:name=>openCard(name),onZone:z=>{village.zoneFilter=village.zoneFilter===z?-1:z;applyFilter();}});
  stage.append(h(`<div class="vl3d-help">🖱 끌어서 돌리기 · 휠/두 손가락으로 확대 · 캐릭터를 누르면 기록 보기</div>`));
 }else if(village.mode==='pending'){
  stage.classList.add('is3d');stage.append(h(`<div class="vl3d-loading"><span class="ai-spin"></span> 3D 마을을 짓는 중…</div>`));
 }else{
  stage.innerHTML=SCENE;
  ZONES.forEach((z,i)=>stage.append(h(`<button type="button" class="vl-sign" data-zone="${i}" style="left:${z.sign[0]/10}%;top:${z.sign[1]/5.4}%"><b>${z.ico} ${z.name}</b><small>${z.sub}</small><em></em></button>`)));
 }
 stage.classList.toggle('show-bubbles',!!$('#avatarVillage [data-act=bubbles]')?.checked);
}

function ensureVillage(){
 const home=$('#homeDashboard');if(!home)return null;
 let box=$('#avatarVillage');
 if(!box){
  box=h(`<section id="avatarVillage" aria-label="아바타 마을"><div class="vl-hud"><div><span class="home-kicker">OUR VILLAGE · 평생과정설계</span><h1>우리 마을에 오신 것을 환영해요</h1><p>캐릭터를 누르면 그 사람의 진행 상황과 기록을 모두 볼 수 있다. 캐릭터는 지금 단계의 장소에서 지낸다.</p></div><div class="vl-btns"><span class="vl-count"></span><button type="button" class="secondary" data-act="ai">🤖 AI 모델</button><button type="button" class="primary" data-act="add">＋ 대상자 등록</button></div></div>
  <div class="vl-wrap"><div class="vl-stage" role="group" aria-label="마을 지도"></div></div>
  <div class="vl-tools"><input type="search" placeholder="이름으로 찾기" aria-label="마을에서 이름 찾기"><label><input type="checkbox" data-act="bubbles"> 말풍선 항상 보기</label><button type="button" class="secondary" data-act="spin" style="padding:6px 12px">🔄 천천히 돌아보기</button><button type="button" class="secondary" data-act="reset" style="padding:6px 12px">⌂ 처음 시점</button><span style="margin-left:auto">팻말을 누르면 그 장소에 있는 사람만 표시한다</span></div></section>`);
  home.prepend(box);
  const stage=$('.vl-stage',box);buildStage(stage);
  box.addEventListener('click',ev=>{
   const act=ev.target.closest('[data-act]')?.dataset.act;
   if(act==='add')openAvatarEditor();
   if(act==='ai')AI.openSettings();
   if(act==='spin'&&village.v3){village.spin=!village.spin;village.v3.spin(village.spin);}
   if(act==='reset'&&village.v3)village.v3.resetView();
   const sign=ev.target.closest('.vl-sign');
   if(sign&&village.mode==='2d'){const z=Number(sign.dataset.zone);village.zoneFilter=village.zoneFilter===z?-1:z;applyFilter();}
   const ch=ev.target.closest('.vchar');if(ch)openCard(ch.dataset.name);
  });
  $('input[type=search]',box).addEventListener('input',ev=>{village.filter=ev.target.value.trim();applyFilter();});
  $('[data-act=bubbles]',box).addEventListener('change',ev=>{stage.classList.toggle('show-bubbles',ev.target.checked);village.v3?.bubbles(ev.target.checked);});
 }
 return box;
}
function applyFilter(){
 const q=village.filter;
 if(village.v3){village.v3.setFilter({q,zone:village.zoneFilter});return;}
 village.chars.forEach((c,name)=>c.el.classList.toggle('dim',(q&&!name.includes(q))||(village.zoneFilter>=0&&c.zone!==village.zoneFilter)));
 $$('.vl-sign').forEach(s=>s.classList.toggle('on',Number(s.dataset.zone)===village.zoneFilter));
}
function randIn(z){return [z.x[0]+Math.random()*(z.x[1]-z.x[0]),z.y[0]+Math.random()*(z.y[1]-z.y[0])];}
function place(c,x,y,dur){
 const el=c.el;el.style.setProperty('--dur',dur+'s');
 if(x<c.x-1)el.classList.add('left');else if(x>c.x+1)el.classList.remove('left');
 el.style.left=(x/10)+'%';el.style.top=(y/5.4)+'%';el.style.zIndex=Math.round(y);
 c.x=x;c.y=y;
}
function walk(c){
 if(!document.body.contains(c.el))return;
 if($('#homeDashboard')?.hidden||document.hidden){clearTimeout(c.t2);c.t2=setTimeout(()=>walk(c),3000);return;}
 const z=ZONES[c.zone],[x,y]=randIn(z),d=Math.hypot(x-c.x,y-c.y),dur=Math.max(1.2,d/45);
 c.el.classList.add('walk');place(c,x,y,dur);
 clearTimeout(c.t1);clearTimeout(c.t2);
 c.t1=setTimeout(()=>c.el.classList.remove('walk'),dur*1000);
 c.t2=setTimeout(()=>walk(c),dur*1000+1500+Math.random()*4500);
}
function renderVillage(){
 const box=ensureVillage();if(!box)return;
 const stage=$('.vl-stage',box),users=allUsers();
 $('.vl-count',box).textContent=`👥 마을 주민 ${users.length}명`;
 let empty=$('.vl-empty',stage);
 if(!users.length&&!empty)stage.append(h(`<div class="vl-empty"><b>아직 주민이 없다</b><br>첫 번째 대상자를 등록하고<br>아바타를 골라본다.<br><button type="button" class="primary" data-act="add">＋ 대상자 등록</button></div>`));
 else if(users.length&&empty)empty.remove();
 if(village.mode==='pending')return;
 if(village.mode==='3d'){
  village.v3.setPeople(users.map(u=>{const p=progressOf(u.name),lv=levelOf(p);const bubble=`Lv.${lv.lv} ${lv.name} · ${p.next==='모든 단계 완료 🏆'?p.next:'다음: '+p.next}`;
   return {name:u.name,avatar:avatarOf(u),zone:p.zone,bubble,label:`${u.name} · ${ZONES[p.zone].name} · ${bubble} · 눌러서 기록 보기`};}));
  return;
 }
 const seen=new Set(),counts=[0,0,0,0,0];
 users.forEach(u=>{
  const p=progressOf(u.name),lv=levelOf(p);seen.add(u.name);counts[p.zone]++;
  let c=village.chars.get(u.name);
  const bubble=`Lv.${lv.lv} ${lv.name} · ${p.next==='모든 단계 완료 🏆'?p.next:'다음: '+p.next}`;
  const look=JSON.stringify(avatarOf(u));
  if(!c){
   const el=h(`<button type="button" class="vchar" data-name="${e(u.name)}"></button>`);
   stage.append(el);c={el,x:0,y:0,zone:p.zone,look:''};village.chars.set(u.name,c);
   const [x,y]=randIn(ZONES[p.zone]);place(c,x,y,0);
   c.t2=setTimeout(()=>walk(c),300+Math.random()*2500);
  }
  if(c.look!==look){c.el.innerHTML=avatarSVG(avatarOf(u))+`<span class="vc-name"></span><span class="vc-bubble"></span>`;c.look=look;}
  $('.vc-name',c.el).textContent=u.name;$('.vc-bubble',c.el).textContent=bubble;
  c.el.setAttribute('aria-label',`${u.name} · ${ZONES[p.zone].name} · ${bubble} · 눌러서 기록 보기`);
  if(c.zone!==p.zone){c.zone=p.zone;walk(c);}
 });
 village.chars.forEach((c,name)=>{if(!seen.has(name)){clearTimeout(c.t1);clearTimeout(c.t2);c.el.remove();village.chars.delete(name);}});
 $$('.vl-sign',box).forEach((s,i)=>$('em',s).textContent=counts[i]||'');
 applyFilter();
}

/* 3D 미리보기: 쓸 수 있으면 3D, 아니면 2D 그림 */
function mountPreview(dlg,el,av){
 if(!window.Village3D||!el)return null;
 try{el.innerHTML='';el.classList.add('is3d');const pv=window.Village3D.createPreview(el,av);(dlg._pvs=dlg._pvs||[]).push(pv);return pv;}catch(_){el.innerHTML=avatarSVG(av);return null;}
}
function disposePreviews(dlg){(dlg._pvs||[]).forEach(p=>{try{p.dispose()}catch(_){}});dlg._pvs=[];}

/* =====================================================================
   4. 캐릭터 카드 (진행 상황 · 기록)
   ===================================================================== */
const cardDlg=h(`<dialog class="vl-dialog" aria-label="캐릭터 카드"></dialog>`);document.body.append(cardDlg);
cardDlg.addEventListener('close',()=>{disposePreviews(cardDlg);cardDlg.innerHTML='';});
cardDlg.addEventListener('click',ev=>{if(ev.target===cardDlg)cardDlg.close();});
function userIndex(name){return allUsers().findIndex(u=>u.name===name);}
function openCard(name){
 const u=allUsers().find(x=>x.name===name)||{name},p=progressOf(name),lv=levelOf(p),a=avatarOf(u);
 const plan=latestPlanOf(p.snap),practice=p.snap?.practice?.form||{},evalf=p.snap?.evaluation?.form||{};
 const firstOpen=p.done.indexOf(false);
 const age=u.birth?calculateAge(u.birth,'만 나이'):'';
 const domainTiles=domains.map((d,i)=>{
  const goal=plan['short_'+i],st=practice['status_'+i],dec=evalf['decision_'+i],imp=evalf['implementation_'+i];
  const pills=[st&&st!=='미시작'?st:'',imp&&imp!=='미확인'?imp:'',dec&&dec!=='미정'?dec:''].filter(Boolean);
  return `<div class="vc-domain"><b>${e(d)}</b><p>${goal?e(goal):'<span style="color:#9aa496">단기목표 미작성</span>'}</p><div class="ux-pills">${pills.map(x=>`<span class="ux-pill">${e(x)}</span>`).join('')}</div></div>`;}).join('');
 const timeline=p.meetings.length?p.meetings.map(m=>{const s=m.step||1;return `<div class="vc-tl ${m.id===state.activeMeetingId?'active':''}"><div><b>${e(m.type||'지원회의')}</b><small>${e(m.date||'날짜 미입력')} · 현재 ${e(s===1?'상담':steps[s-1]?.name||'')} · ${e(m.status||'진행중')}${m.manager?' · 담당 '+e(m.manager):''}</small></div><button type="button" class="secondary" data-open="${e(m.id)}">열기</button></div>`;}).join('')
  :`<div class="vc-empty">아직 시작한 지원회의가 없다. 아래 <b>첫 지원회의 시작</b>을 누르면 상담과 지원계획 기록을 만들 수 있다.</div>`;
 cardDlg.innerHTML=`<button type="button" class="vd-x" aria-label="닫기" data-x>×</button><div class="vcard">
 <div class="vcard-side"><div class="vc-big">${avatarSVG(a)}</div><h2>${e(name)}</h2>
  <div class="vc-meta">${[age?'만 '+e(age)+'세':'',e(u.age||''),u.gender?e(u.gender):''].filter(Boolean).join(' · ')||'기본정보 미입력'}<br>${u.manager?'담당 '+e(u.manager):''}</div>
  <div class="vc-level">Lv.${lv.lv} · ${lv.name}</div><div class="vc-xp" role="progressbar" aria-valuenow="${lv.pct}" aria-valuemin="0" aria-valuemax="100" aria-label="진행률"><i style="width:${lv.pct}%"></i></div><div class="small">${p.doneCount} / 8 단계 · ${e(ZONES[p.zone].ico+' '+ZONES[p.zone].name)}에 있다</div>
  <div class="vc-side-btns">
   ${p.meeting?`<button type="button" class="primary" data-go="resume">이어서 작성하기 →</button>`:`<button type="button" class="primary" data-go="start">첫 지원회의 시작</button>`}
   ${p.meeting?`<button type="button" class="secondary" data-go="counseling">상담 · 자기소개서</button><button type="button" class="secondary" data-go="practice">실천 기록</button><button type="button" class="secondary" data-go="evaluation">모니터링</button><button type="button" class="secondary" data-go="start">새 지원회의 시작</button>`:''}
   <button type="button" class="ghost" data-go="avatar">🎨 아바타 · 정보 수정</button>
  </div></div>
 <div class="vcard-main">
  <h3>🧭 진행 단계</h3><div class="vc-track">${TRACK.map((t,i)=>`<span class="${p.done[i]?'done':i===firstOpen?'now':''}">${t}</span>`).join('')}</div>
  <h3>🌟 꿈과 희망</h3><div class="vc-dream">${has(plan.plan_dream)?e(plan.plan_dream):'아직 작성된 꿈과 희망이 없다.'}${has(plan.mid_goal)?`\n\n<b>중장기목표</b>\n${e(plan.mid_goal)}`:''}</div>
  <h3>🗺️ 8개 영역 현황</h3><div class="vc-domains">${domainTiles}</div>
  <h3>📒 기록 (지원회의 이력 ${p.meetings.length}건)</h3><div class="vc-timeline">${timeline}</div>
  ${u.support?`<h3>💬 의사소통 방법과 필요한 지원</h3><div class="vc-dream">${e(u.support)}</div>`:''}
  ${p.meeting?`<h3>✨ AI 진행 요약</h3><p class="small" style="margin:0">지금까지의 기록을 바탕으로 진행 상황과 다음에 할 일을 정리한다. 이름·연락처 등은 보내지 않는다.</p><button type="button" class="ai-btn" data-go="ai" style="margin-top:8px">✨ AI로 진행 요약 보기</button><div class="vc-ai-slot"></div>`:''}
 </div></div>`;
 cardDlg.onclick=ev=>{
  if(ev.target===cardDlg||ev.target.closest('[data-x]')){cardDlg.close();return;}
  const open=ev.target.closest('[data-open]')?.dataset.open;if(open){cardDlg.close();openMeeting(open);return;}
  const go=ev.target.closest('[data-go]')?.dataset.go;if(!go)return;
  if(go==='ai'){summarizePerson(name,p,ev.target.closest('button'));return;}
  cardDlg.close();
  if(go==='avatar'){openAvatarEditor(name);return;}
  if(go==='start'){ensureUser(name);startForUser(userIndex(name));return;}
  openMeeting(p.meeting.id);
  if(go==='counseling'||go==='practice'||go==='evaluation')switchPhase(go);
 };
 cardDlg.showModal();
 mountPreview(cardDlg,$('.vc-big',cardDlg),a);
}
function ensureUser(name){hubState();if(!state.users.some(u=>u.name===name)){state.users.push({name});persist();}}

/* =====================================================================
   5. 대상자 등록 · 아바타 꾸미기
   ===================================================================== */
const editDlg=h(`<dialog class="vl-dialog" aria-label="아바타 만들기"></dialog>`);document.body.append(editDlg);
editDlg.addEventListener('close',()=>{disposePreviews(editDlg);editDlg.innerHTML='';});
function openAvatarEditor(name){
 hubState();
 const existing=name?(state.users.find(u=>u.name===name)||allUsers().find(u=>u.name===name)||{name}):null;
 const u=existing||{};let av=existing?avatarOf(existing):randomAvatar();
 const sw=(key,list)=>`<div class="vb-swatches" data-k="${key}">${list.map(c=>`<button type="button" data-v="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}</div>`;
 const op=(key,list)=>`<div class="vb-opts" data-k="${key}">${list.map(([v,l])=>`<button type="button" data-v="${v}">${l}</button>`).join('')}</div>`;
 const ages=(typeof lifecycleReference!=='undefined'?lifecycleReference[0].map(x=>x.age):[]);
 editDlg.innerHTML=`<button type="button" class="vd-x" aria-label="닫기" data-x>×</button><form class="vb" novalidate>
 <div class="vb-preview"><div data-preview></div><b data-pname style="display:block;font-size:18px;color:#244f40;margin-top:6px">${e(u.name||'이름')}</b><button type="button" class="secondary" data-rand style="margin-top:12px">🎲 무작위로 고르기</button></div>
 <div><h2>${existing?'아바타 · 정보 수정':'새 대상자 등록'}</h2><p class="small" style="margin:0 0 6px">마을에서 보일 캐릭터를 함께 골라본다. 당사자가 직접 고르면 더 좋다.</p>
  <div class="vb-fields">
   <div class="field"><label>이름 *</label><input name="name" required value="${e(u.name||'')}" ${existing?'readonly':''} placeholder="이름 또는 별칭"></div>
   <div class="field"><label>성별</label><select name="gender"><option value="">선택 안 함</option>${['남','여','기타'].map(g=>`<option ${u.gender===g?'selected':''}>${g}</option>`).join('')}</select></div>
   <div class="field"><label>생년월일</label><input type="date" name="birth" value="${e(u.birth||'')}" max="${calendarToday()}"></div>
   <div class="field"><label>생애주기</label><select name="age"><option value="">선택 안 함</option>${ages.map(a=>`<option ${u.age===a?'selected':''}>${e(a)}</option>`).join('')}</select></div>
   <div class="field"><label>담당자</label><input name="manager" value="${e(u.manager||'')}"></div>
   <div class="field"><label>선호하는 의사소통 방법과 필요한 지원</label><input name="support" value="${e(u.support||'')}"></div>
  </div>
  <div class="vb-row"><b>피부색</b>${sw('skin',SKIN)}</div>
  <div class="vb-row"><b>머리 모양</b>${op('hair',HAIR)}</div>
  <div class="vb-row"><b>머리 색</b>${sw('hairColor',HAIRC)}</div>
  <div class="vb-row"><b>옷 색</b>${sw('outfit',OUTFIT)}</div>
  <div class="vb-row"><b>표정</b>${op('face',FACE)}</div>
  <div class="vb-row"><b>꾸미기</b>${op('acc',ACC)}</div>
  <div class="actions"><button type="button" class="secondary" data-x>취소</button><button type="submit" class="primary">${existing?'저장':'마을에 등록하기'}</button></div>
 </div></form>`;
 const form=$('form',editDlg),F=k=>form.elements.namedItem(k);
 let pv=null;
 const sync=()=>{if(pv)pv.set(av);else $('[data-preview]',editDlg).innerHTML=avatarSVG(av);$$('[data-k]',editDlg).forEach(g=>$$('button',g).forEach(b=>b.classList.toggle('on',b.dataset.v===av[g.dataset.k])));};
 editDlg.onclick=ev=>{
  if(ev.target===editDlg||ev.target.closest('[data-x]')){editDlg.close();return;}
  if(ev.target.closest('[data-rand]')){av=randomAvatar();sync();return;}
  const b=ev.target.closest('[data-k] button');if(b){av[b.parentElement.dataset.k]=b.dataset.v;sync();}
 };
 F('name').addEventListener('input',()=>$('[data-pname]',editDlg).textContent=F('name').value||'이름');
 form.onsubmit=ev=>{
  ev.preventDefault();const name=F('name').value.trim();
  if(!name){toast('이름을 입력해야 한다.','warn');F('name').focus();return;}
  if(!existing&&allUsers().some(x=>x.name===name)){toast('같은 이름의 대상자가 있다. 캐릭터를 눌러 수정한다.','warn');return;}
  const prev=state.users.find(x=>x.name===name)||{};
  const rec=Object.assign({},prev,{name,gender:F('gender').value,birth:F('birth').value,age:F('age').value,manager:F('manager').value.trim(),support:F('support').value.trim(),avatar:av,ageBasis:prev.ageBasis||'만 나이'});
  const i=state.users.findIndex(x=>x.name===name);if(i>=0)state.users[i]=rec;else state.users.push(rec);
  persist();editDlg.close();renderVillage();
  toast(existing?`${name}님의 정보를 저장했다.`:`${name}님이 마을에 왔다! 캐릭터를 누르면 기록을 볼 수 있다.`);
 };
 sync();editDlg.showModal();pv=mountPreview(editDlg,$('[data-preview]',editDlg),av);setTimeout(()=>(existing?$('[data-k=hair] button',editDlg):F('name')).focus(),30);
}
/* 이용자 관리 화면에서 정보를 고쳐도 아바타가 사라지지 않게 한다. */
const baseSaveUser=window.saveUser;
window.saveUser=function(i){
 const name=document.getElementById('uName')?.value.trim();const prev=(state.users||[]).find(u=>u.name===name);const av=prev?.avatar;
 baseSaveUser(i);
 const now=(state.users||[]).find(u=>u.name===name);if(now&&av&&!now.avatar){now.avatar=av;persist();}
};

/* =====================================================================
   6. AI — ChatGPT · Gemini · Claude 다중 모델
   ===================================================================== */
const PROVIDERS={
 openai:{name:'ChatGPT (OpenAI)',short:'ChatGPT',env:'OPENAI_API_KEY'},
 gemini:{name:'Gemini (Google)',short:'Gemini',env:'GEMINI_API_KEY'},
 anthropic:{name:'Claude (Anthropic)',short:'Claude',env:'ANTHROPIC_API_KEY'},
};
const SYSTEM=`당신은 발달장애인 평생과정설계(PPP: 사람중심 계획)를 돕는 숙련된 사회복지사이다.
- 당사자의 꿈·강점·선호에서 출발하고, 결핍보다 "힘과 필요"의 언어로 쓴다.
- 기록에 없는 사실, 진단, 수치를 지어내지 않는다. 불분명하면 "(확인 필요)"라고 쓴다.
- 당사자 표현과 가족·지원자 해석을 구분한다.
- 목표는 당사자가 이해할 수 있는 쉬운 말로, 실천계획은 누가·언제·어디서·무엇을 구체적으로 쓴다.
- 지역사회 자원(주민센터, 도서관, 복지관, 동호회, 시민옹호인, 활동지원사 등)을 활용한다.
- 문서체("~한다", "~이다")로 쓴다. 개인을 식별할 수 있는 정보는 쓰지 않고 "당사자"로 부른다.`;

/* API 키는 Vercel 환경변수에만 있다. 브라우저는 /api/models 로 쓸 수 있는 모델 목록을 받고 /api/ai 로 요청한다. */
const AI={
 list:null,defaultId:null,error:'',
 async models(force){
  if(this.list&&!force)return this.list;
  if(location.protocol==='file:'){this.error='파일로 직접 연 화면에서는 AI를 쓸 수 없다. Vercel에 배포한 주소에서 쓴다.';return this.list=[];}
  try{const r=await fetch('/api/models',{cache:'no-store'});if(!r.ok)throw new Error(r.status);const d=await r.json();this.list=d.models||[];this.defaultId=d.defaultId;this.error=this.list.length?'':'Vercel 환경변수에 AI API 키가 아직 없다.';}
  catch(_){this.list=[];this.error='AI 서버(/api)에 연결하지 못했다. Vercel 배포 주소에서 열었는지 확인한다.';}
  return this.list;
 },
 usable(){return this.list||[];},
 async call(model,prompt){
  const token=await window.PPPCloud?.token?.();
  if(!token)throw new Error('AI를 쓰려면 로그인이 필요하다. (Vercel에 SUPABASE_URL · SUPABASE_ANON_KEY 를 등록했는지 확인한다.)');
  let res,data;
  try{res=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({model:model.id,system:SYSTEM,prompt})});data=await res.json().catch(()=>({}));}
  catch(err){throw new Error('AI 서버에 연결하지 못했다. 인터넷 연결을 확인한다.\n('+err.message+')');}
  if(!res.ok)throw new Error(data.error||`AI 호출 실패 (${res.status})`);
  return String(data.text||'').trim();
 },
 openSettings,pick,run
};
window.PPPAI=AI;

/* ----- 모델 안내 (설정은 Vercel 환경변수에서 한다) ----- */
const setDlg=h(`<dialog class="ai-dialog" aria-label="AI 모델"></dialog>`);document.body.append(setDlg);
setDlg.addEventListener('close',()=>{setDlg.innerHTML='';});
async function openSettings(){
 setDlg.innerHTML=`<h2>🤖 AI 모델</h2><div class="ai-status"><span class="ai-spin"></span>모델 목록을 확인하는 중…</div>`;setDlg.showModal();
 const models=await AI.models(true);
 const byP=Object.keys(PROVIDERS).map(p=>({p,on:models.some(m=>m.provider===p)}));
 setDlg.innerHTML=`<h2>🤖 AI 모델</h2><p class="ai-note" style="margin:0">API 키는 <b>Vercel 환경변수</b>에만 저장되어 브라우저로 나오지 않는다. AI 작성 버튼을 누를 때마다 아래 모델 중에서 고른다.</p>
 <div class="ai-set-sec"><h3>연결 상태</h3><table class="ai-list"><tbody>${byP.map(x=>`<tr><td><span class="ai-prov" data-p="${x.p}">${PROVIDERS[x.p].short}</span><b>${PROVIDERS[x.p].name}</b></td><td>${x.on?'<b style="color:#2c6a45">● 사용 가능</b>':`<span class="ai-note">키 없음 · <code>${PROVIDERS[x.p].env}</code></span>`}</td></tr>`).join('')}</tbody></table>
 ${AI.error?`<div class="ai-err" style="margin-top:10px">${e(AI.error)}</div>`:''}</div>
 <div class="ai-set-sec"><h3>사용할 수 있는 모델 (${models.length}개)</h3><table class="ai-list"><tbody>${models.map(m=>`<tr><td><span class="ai-prov" data-p="${m.provider}">${PROVIDERS[m.provider]?.short||m.provider}</span><b>${e(m.label)}</b><br><small class="ai-note">${e(m.model)}${m.id===AI.defaultId?' · ★ 기본':''}</small></td><td><button type="button" data-test-id="${e(m.id)}">연결 테스트</button></td></tr>`).join('')||'<tr><td class="ai-note">아직 없다.</td></tr>'}</tbody></table>
 <div data-test class="ai-note"></div></div>
 <details class="ai-set-sec"><summary><b>모델 추가 · 변경 방법 (관리자)</b></summary><ol class="ai-note" style="padding-left:18px">
  <li>Vercel 프로젝트 → <b>Settings → Environment Variables</b></li>
  <li><code>OPENAI_API_KEY</code>, <code>GEMINI_API_KEY</code>, <code>ANTHROPIC_API_KEY</code> 중 가진 키를 넣는다.</li>
  <li>모델 버전을 직접 정하려면 <code>AI_MODELS</code>에 JSON으로 넣는다.<br><code>[{"provider":"openai","model":"gpt-5-mini","label":"GPT-5 mini"},{"provider":"anthropic","model":"claude-sonnet-5-5","label":"Claude Sonnet"}]</code></li>
  <li>기본 모델은 <code>AI_DEFAULT_MODEL</code>(예: <code>gpt-5-mini</code>)로 정한다.</li>
  <li>저장 후 <b>Deployments → Redeploy</b> 해야 반영된다.</li></ol></details>
 <div class="actions"><button type="button" class="primary" data-close>닫기</button></div>`;
 setDlg.onclick=async ev=>{
  const t=ev.target;
  if(t===setDlg||t.closest('[data-close]')){setDlg.close();return;}
  const tid=t.closest('[data-test-id]')?.dataset.testId;
  if(tid){const m=models.find(x=>x.id===tid),out=$('[data-test]',setDlg);out.innerHTML=`<div class="ai-status"><span class="ai-spin"></span>${e(m.label)} 연결 확인 중…</div>`;
   try{const r=await AI.call(m,'"연결 성공"이라고만 답한다.');out.innerHTML=`<p style="color:#2c6a45;font-weight:800">✅ ${e(m.label)} 연결 성공 — ${e(r.slice(0,60))}</p>`;}
   catch(err){out.innerHTML=`<div class="ai-err">❌ ${e(err.message)}</div>`;}}
 };
 refreshAiBar();
}

/* ----- 모델 고르기 → 실행 → 결과 확인 ----- */
const runDlg=h(`<dialog class="ai-dialog" aria-label="AI 작성"></dialog>`);document.body.append(runDlg);
runDlg.addEventListener('close',()=>{runDlg.innerHTML='';});
let lastModelId='';
async function pick(title){
 const models=await AI.models();
 return new Promise(resolve=>{
  if(!models.length){
   runDlg.innerHTML=`<h2>${e(title)}</h2><div class="vc-empty">${e(AI.error||'사용할 수 있는 AI 모델이 없다.')}<br>관리자가 Vercel 환경변수에 ChatGPT · Gemini · Claude API 키를 등록하면 바로 쓸 수 있다.</div><div class="actions"><button type="button" class="secondary" data-c>닫기</button><button type="button" class="primary" data-s>AI 모델 안내 보기</button></div>`;
   runDlg.onclick=ev=>{if(ev.target.closest('[data-s]')){runDlg.close();openSettings();}else if(ev.target===runDlg||ev.target.closest('[data-c]'))runDlg.close();};
   runDlg.onclose=()=>resolve(null);runDlg.showModal();return;
  }
  const sel=models.find(m=>m.id===lastModelId)?.id||models.find(m=>m.id===AI.defaultId)?.id||models[0].id;
  runDlg.innerHTML=`<h2>${e(title)}</h2><p class="ai-note" style="margin:0">어떤 언어모델로 작성할까? 같은 내용을 다른 모델로 다시 써서 비교할 수도 있다.</p>
  <div class="ai-models" role="radiogroup">${models.map(m=>`<label class="ai-model"><input type="radio" name="aiModel" value="${m.id}" ${m.id===sel?'checked':''}><span><span class="ai-prov" data-p="${m.provider}">${PROVIDERS[m.provider]?.short||m.provider}</span><b>${e(m.label)}</b><small>${e(m.model)}</small></span></label>`).join('')}</div>
  <div class="ai-note">🔒 이름·생년월일·연락처·주소·함께하는 사람 정보는 보내지 않는다. 자유서술 칸에 쓴 개인정보는 보내지므로 확인한다.</div>
  <div class="actions"><button type="button" class="secondary" data-cfg>모델 안내</button><button type="button" class="secondary" data-c>취소</button><button type="button" class="ai-btn primary-ai" data-go>✨ 작성하기</button></div>`;
  let chosen=null;
  runDlg.onclick=ev=>{
   if(ev.target===runDlg||ev.target.closest('[data-c]')){runDlg.close();return;}
   if(ev.target.closest('[data-cfg]')){runDlg.close();openSettings();return;}
   if(ev.target.closest('[data-go]')){const id=$('input[name=aiModel]:checked',runDlg)?.value;chosen=models.find(m=>m.id===id);lastModelId=id;runDlg.onclose=null;resolve(chosen);}
  };
  runDlg.onclose=()=>resolve(null);
  runDlg.showModal();
 });
}
/* 실행: prompt → 모델 선택 → 결과 미리보기(render) → 적용 */
async function run({title,prompt,render,apply,applyLabel='적용하기',extraButtons=''}){
 const model=await pick(title);if(!model)return;
 if(!runDlg.open)runDlg.showModal();
 runDlg.innerHTML=`<h2>${e(title)}</h2><div class="ai-status"><span class="ai-spin"></span>${e(model.label)}이(가) 작성하는 중…</div>`;
 let text;
 try{text=await AI.call(model,prompt);}
 catch(err){
  runDlg.innerHTML=`<h2>${e(title)}</h2><div class="ai-err">${e(err.message)}</div><div class="actions"><button type="button" class="secondary" data-c>닫기</button><button type="button" class="ai-btn" data-again>다른 모델로 다시</button></div>`;
  runDlg.onclick=ev=>{if(ev.target.closest('[data-c]')||ev.target===runDlg)runDlg.close();if(ev.target.closest('[data-again]')){runDlg.close();run({title,prompt,render,apply,applyLabel,extraButtons});}};
  return;
 }
 const view=render(text);
 runDlg.innerHTML=`<h2>${e(title)}</h2><p class="ai-note" style="margin:0 0 10px"><span class="ai-prov" data-p="${model.provider}">${PROVIDERS[model.provider]?.short||model.provider}</span>${e(model.label)} 작성 · 적용하기 전에 반드시 읽고 고친다.</p>${view.html}
 <div class="actions"><button type="button" class="secondary" data-c>닫기</button><button type="button" class="secondary" data-again>다른 모델로 다시</button>${extraButtons}${apply?`<button type="button" class="ai-btn primary-ai" data-apply>${e(applyLabel)}</button>`:''}</div>`;
 runDlg.onclick=ev=>{
  if(ev.target===runDlg||ev.target.closest('[data-c]')){runDlg.close();return;}
  if(ev.target.closest('[data-again]')){runDlg.close();run({title,prompt,render,apply,applyLabel,extraButtons});return;}
  const b=ev.target.closest('[data-apply],[data-apply2]');
  if(b&&apply){if(apply(view,b.hasAttribute('data-apply2')?'fill':'all',runDlg)!==false){runDlg.close();toast('AI 작성 내용을 넣었다. 꼭 읽고 고친다.');}}
 };
}
function parseJSON(text){const m=String(text).match(/\{[\s\S]*\}/);if(!m)throw new Error('JSON 없음');return JSON.parse(m[0]);}

/* ----- 개인정보를 뺀 기록 요약 ----- */
const PRIVATE=new Set(['common_client','common_date','common_manager','name','phone','emergency','address','birth','writer','supporter','people','intro_date','ai_prompt','record_date','age_years']);
const IND=['청소와 정리하기','빨래하기','쓰레기 버리기','음식 만들기','단정하게 옷 입기','멋내기','고장난 물건 대처하기','사람들과 대화하기','친구들과 친하게 지내기','이웃과 함께 살기','가족과 친하게 지내기','지역사회시설 이용하기','휴대전화·메신저 사용하기','원하는 곳으로 외출하기'];
const LBL={oneword:'“나”를 한마디로',gender:'성별',lifecycle:'생애주기',disability_type:'장애유형',disability_feature:'장애특성',activity_support:'활동지원서비스',vision:'시력',body:'키/몸무게',religion:'종교 및 종교활동',nickname:'별명',personality:'성격 및 기타',goodat:'내가 잘하는 것',memory:'좋아하는 이야기·추억',liked_me:'사람들이 좋아하는 나의 모습',likes:'좋아하는 것',dislikes:'싫어하는 것·어렵게 하는 것',comfort:'나를 편안하게 하는 방법',soothe:'위로를 주는 방법',events:'기념하는 행사',friends:'친구·지인과 함께 하는 방법',orgs:'소속 기관·활동',daily:'하루 일과',routine:'나만의 규칙(루틴)',weekly:'주간 활동',happiness:'내가 생각하는 행복',dream:'나의 꿈',desired_daily:'기대하는 일상',ai_analysis:'기존 상담 분석',ai_review:'담당자 검토',
 plan_dream:'꿈과 희망',mid_goal:'중장기목표',important:'내가 중요하게 생각하는 것',need:'나에게 필요한 것',success:'성공경험',overall:'종합기록'};
const PAT={domain_now:'현재 경험·상황',domain_future:'희망하는 미래',domain_help:'필요한 도움',hope:'희망하는 미래',area:'영역',short:'단기목표',action:'실천계획',note:'비고',ind:'',date:'실천일/기간',status:'진행상태',supporter:'함께한 사람',actual:'실제로 실행한 내용',voice:'당사자의 의견과 반응',support:'어려움과 제공한 지원',next:'다음 실천',implementation:'실천 여부',fit:'현재 삶과 목표 확인',evidence:'실천 근거',change:'삶·선택·만족도 변화',environment:'가족·환경 변화',decision:'유지·조정 방향',followup:'다음 계획'};
const EMPTYV=new Set(['','미시작','미확인','미정']);
function label(k){const m=k.match(/^(.*)_(\d+)$/);if(m&&m[1]==='ind')return IND[m[2]]||k;if(m&&PAT[m[1]]!==undefined&&domains[m[2]])return domains[m[2]]+' · '+PAT[m[1]];return LBL[k]||null;}
function scrub(text,names){let t=String(text);names.filter(n=>n&&n.length>1).forEach(n=>{t=t.split(n).join('당사자');});return t;}
function summarize(obj,names,skip=()=>false){
 return Object.entries(obj||{}).filter(([k,v])=>!PRIVATE.has(k)&&!k.startsWith('reference_age')&&!skip(k)&&!EMPTYV.has(String(v??'').trim())&&!(k.startsWith('area_'))).map(([k,v])=>{const l=label(k);return l?`- ${l}: ${scrub(String(v).trim(),names)}`:null;}).filter(Boolean).join('\n');
}
function currentNames(){const intro=state.forms?.[1]||{};const m=state.meetings.find(x=>x.id===state.activeMeetingId);return [intro.name,intro.common_client,m?.client,...(state.users||[]).map(u=>u.name)].filter(Boolean);}

/* ----- 작업별 AI 기능 ----- */
const STAGE_HINT={2:'사전회의: 꿈과 히스토리를 공유한다. 꿈과 희망, 중요하게 생각하는 것, 필요한 것, 성공경험, 영역별 희망하는 미래를 정리한다.',3:'통합회의: 힘과 필요를 찾는다. 중요하게 생각하는 것·필요한 것·성공경험을 충분히 정리하고 영역별 단기목표·실천계획 초안을 쓴다.',4:'컨퍼런스회의: 꿈과 희망을 토대로 중장기목표와 영역별 방향을 협의한다.',5:'확정회의: 중장기목표와 영역 우선순위를 확정하고 영역별 단기목표·실천계획으로 연결한다.',6:'단기계획 수립: 단기목표(2년)와 해당연도 실천계획을 구체적인 일정·담당·장소로 쓴다.'};
function domField(k){return $(`#formArea [data-key="${CSS.escape(k)}"]`);}
function setField(k,v){const el=domField(k);if(!el)return false;el.value=v;fire(el);return true;}

function aiCounseling(){
 const names=currentNames(),v=Object.assign({},state.forms?.[1]||{},collect());
 const body=summarize(v,names,k=>k.startsWith('ai_'));
 if(!body){toast('상담 1~6번 내용을 먼저 작성해야 한다.','warn');return;}
 const prompt=`아래 평생과정설계 상담(자기소개서) 기록만 근거로 분석한다.
결과는 다음 순서로 쓴다.
① 당사자의 꿈과 희망
② 강점·성공경험·중요하게 여기는 것
③ 필요한 지원과 환경
④ 8개 영역(교육·보건의료·문화여가·직업·결혼·관계·주거·법적지원·소득재정)별 희망과 지원 방향
⑤ 지원회의에서 당사자에게 더 확인할 질문 5개
각 항목에는 근거가 된 기록을 짧게 함께 쓴다.

[상담 기록]
${body}`;
 run({title:'✨ AI 상담내용 분석',prompt,render:t=>({text:t,html:`<textarea class="ai-result">${e(t)}</textarea>`}),
  apply:(view,_m,dlg)=>{const t=$('.ai-result',dlg).value;const p=domField('ai_prompt');if(p&&!has(p.value)){p.value='[웹앱에서 AI로 바로 분석함]\n'+prompt;fire(p);}const el=domField('ai_analysis');if(!el){toast('상담 화면에서 사용한다.','warn');return false;}el.value=t;fire(el);el.scrollIntoView({block:'center',behavior:'smooth'});},
  applyLabel:'분석 결과 칸에 넣기'});
}

function aiPlan(){
 const n=activeStep,names=currentNames();
 const intro=summarize(state.forms?.[1]||{},names,k=>k==='ai_prompt');
 const now=summarize(collect(),names);
 if(!intro&&!now){toast('상담(자기소개서)이나 계획 내용을 먼저 작성해야 한다.','warn');return;}
 const keys=['plan_dream','mid_goal','important','need','success',...domains.flatMap((d,i)=>[...(n<=3?['hope_'+i]:[]),'short_'+i,'action_'+i,'note_'+i])].filter(k=>domField(k));
 const spec=keys.map(k=>`"${k}": "${label(k)||k}"`).join(',\n  ');
 const prompt=`평생과정설계 「미래설계 실천계획서」 ${steps[n-1].name} 단계 초안을 쓴다.
${STAGE_HINT[n]||''}

[상담·자기소개서 기록]
${intro||'(없음)'}

[현재 계획서에 적힌 내용]
${now||'(없음)'}

규칙:
- 현재 계획서 내용이 있으면 그 뜻을 살려 다듬고 보완한다.
- 기록에 근거가 없는 영역은 빈 문자열("")로 둔다.
- 단기목표는 2년 안에 확인할 수 있게, 실천계획은 "- "로 시작하는 2~3줄로 쓴다.
- 반드시 아래 키만 가진 JSON 객체 하나만 출력한다. 다른 설명은 쓰지 않는다.
{
  ${spec}
}`;
 run({title:`✨ AI 계획서 초안 · ${steps[n-1].name}`,prompt,
  render:t=>{let obj;try{obj=parseJSON(t);}catch(_){return {obj:null,html:`<div class="ai-err">AI 응답을 표로 읽지 못했다. 아래 원문을 복사해 쓰거나 다른 모델로 다시 해본다.</div><textarea class="ai-result">${e(t)}</textarea>`};}
   const rows=keys.filter(k=>has(obj[k])).map(k=>`<tr><th>${e(label(k)||k)}</th><td class="old">${e(domField(k)?.value||'')||'<i>비어 있음</i>'}</td><td>${e(obj[k])}</td></tr>`).join('');
   return {obj,html:`<div class="ai-preview"><table><thead><tr><th>항목</th><th>지금</th><th>AI 초안</th></tr></thead><tbody>${rows||'<tr><td colspan="3">제안된 내용이 없다.</td></tr>'}</tbody></table></div>`};},
  extraButtons:`<button type="button" class="ai-btn" data-apply2>빈 칸만 채우기</button>`,
  apply:(view,mode)=>{if(!view.obj)return false;let n2=0;keys.forEach(k=>{const v=view.obj[k];if(!has(v))return;const el=domField(k);if(!el)return;if(mode==='fill'&&has(el.value))return;el.value=String(v);fire(el);n2++;});toast(`${n2}개 항목에 넣었다.`);},
  applyLabel:'모두 바꾸기'});
}

function aiFollowup(){
 const evaluation=activePhase==='evaluation',names=currentNames(),bucket=state[activePhase]||{};
 const plan=summarize(bucket.plan||{},names,k=>/^(hope|note)_/.test(k));
 const rec=summarize(collect(),names,k=>k==='overall');
 if(!rec){toast('영역별 기록을 먼저 작성해야 한다.','warn');return;}
 const prompt=evaluation?`평생과정설계 모니터링 기록을 바탕으로 「종합의견과 다음 지원회의에서 논의할 사항」을 쓴다.
① 영역별 실천 여부와 삶의 변화 요약 ② 잘된 점과 어려웠던 점 ③ 유지·조정이 필요한 목표 ④ 다음 지원회의 논의 안건 순서로 쓴다.

[계획]
${plan}

[모니터링 기록]
${rec}`:`평생과정설계 실천 기록을 바탕으로 「주요 성과와 추가 지원이 필요한 사항」을 쓴다.
① 영역별 주요 실천과 당사자 반응 ② 성과 ③ 어려움과 추가로 필요한 지원 ④ 다음 실천 제안 순서로 쓴다.

[계획]
${plan}

[실천 기록]
${rec}`;
 run({title:evaluation?'✨ AI 모니터링 종합의견':'✨ AI 실천 종합기록',prompt,render:t=>({html:`<textarea class="ai-result">${e(t)}</textarea>`}),
  apply:(view,_m,dlg)=>{const el=domField('overall');if(!el)return false;el.value=$('.ai-result',dlg).value;fire(el);el.scrollIntoView({block:'center',behavior:'smooth'});},applyLabel:'종합기록 칸에 넣기'});
}

function aiPolish(el){
 const lbl=el.closest('.field')?.querySelector('label')?.textContent?.trim()||label(el.dataset.key)||'내용';
 if(!has(el.value)){toast('먼저 내용을 적은 뒤 다듬는다.','info');return;}
 const prompt=`다음은 평생과정설계 문서의 「${lbl}」 칸이다. 뜻과 사실은 그대로 두고, 당사자와 가족이 읽기 쉬운 짧고 분명한 문장으로 다듬는다. 다듬은 글만 출력한다.\n\n${scrub(el.value,currentNames())}`;
 run({title:`✨ AI 다듬기 · ${lbl}`,prompt,render:t=>({html:`<p class="ai-note">지금 글</p><div class="vc-dream" style="max-height:160px;overflow:auto">${e(el.value)}</div><p class="ai-note">다듬은 글 (고칠 수 있음)</p><textarea class="ai-result" style="min-height:180px">${e(t)}</textarea>`}),
  apply:(view,_m,dlg)=>{el.value=$('.ai-result',dlg).value;fire(el);},applyLabel:'이 글로 바꾸기'});
}

function summarizePerson(name,p,btn){
 const s=p.snap;if(!s)return;
 const names=[name,...currentNames()];
 const parts=[];
 const intro=summarize(s.forms?.[1]||{},names,k=>k.startsWith('ai_'));if(intro)parts.push('[상담]\n'+intro);
 const plan=summarize(latestPlanOf(s),names,k=>/^hope_/.test(k));if(plan)parts.push('[지원계획]\n'+plan);
 const pr=summarize(s.practice?.form||{},names);if(pr)parts.push('[실천]\n'+pr);
 const ev=summarize(s.evaluation?.form||{},names);if(ev)parts.push('[모니터링]\n'+ev);
 const prompt=`평생과정설계 진행 상황을 담당 사회복지사가 한눈에 볼 수 있게 요약한다.
완료 단계: ${TRACK.filter((t,i)=>p.done[i]).join(', ')||'없음'} / 다음 단계: ${p.next}
① 지금까지의 진행 (3줄) ② 당사자의 꿈과 핵심 목표 ③ 잘 되고 있는 것 ④ 살펴볼 점 ⑤ 다음에 할 일 3가지 순서로, 짧게 쓴다.

${parts.join('\n\n')||'(기록 없음)'}`;
 cardDlg.close();
 run({title:`✨ AI 진행 요약 · ${name}`,prompt,render:t=>({html:`<div class="vc-ai-out">${e(t)}</div>`}),apply:null,
  extraButtons:`<button type="button" class="secondary" onclick="navigator.clipboard&&navigator.clipboard.writeText(this.closest('dialog').querySelector('.vc-ai-out').textContent)">복사</button>`});
}

/* ----- 작성 화면 AI 막대 · 글상자 다듬기 버튼 ----- */
const aiBar=h(`<div id="aiBar" class="no-print" hidden><span class="ai-label">✨ AI 도우미</span><span data-btns></span><button type="button" class="ai-btn" data-cfg>⚙ 모델 설정</button><span class="ai-hint">글상자를 누르면 「✨ 다듬기」가 나타난다</span></div>`);
const notice=$('#notice');if(notice)notice.after(aiBar);
function refreshAiBar(){
 const ws=$('#workspace');const active=ws&&ws.classList.contains('active');
 let btns='';
 if(active&&activePhase==='counseling')btns=`<button type="button" class="ai-btn primary-ai" data-a="counseling">✨ AI 상담내용 분석</button>`;
 else if(active&&activePhase==='plan'&&activeStep>=2)btns=`<button type="button" class="ai-btn primary-ai" data-a="plan">✨ AI 계획서 초안 (${e(steps[activeStep-1].name)})</button>`;
 else if(active&&(activePhase==='practice'||activePhase==='evaluation'))btns=`<button type="button" class="ai-btn primary-ai" data-a="followup">✨ AI ${activePhase==='practice'?'실천':'모니터링'} 종합의견</button>`;
 aiBar.hidden=!btns;$('[data-btns]',aiBar).innerHTML=btns;
 const n=AI.usable().length;$('[data-cfg]',aiBar).textContent=AI.list===null?'🤖 AI 모델':n?`🤖 모델 ${n}개`:'🤖 AI 준비 안 됨';
}
aiBar.addEventListener('click',ev=>{
 const a=ev.target.closest('[data-a]')?.dataset.a;
 if(a==='counseling')aiCounseling();else if(a==='plan')aiPlan();else if(a==='followup')aiFollowup();
 if(ev.target.closest('[data-cfg]'))openSettings();
});
const polishBtn=h(`<button type="button" id="aiPolish" hidden>✨ 다듬기</button>`);document.body.append(polishBtn);
let polishTarget=null;
const formArea=$('#formArea');
formArea?.addEventListener('focusin',ev=>{
 const t=ev.target;if(t.tagName!=='TEXTAREA'||!t.dataset.key||/^ai_prompt$/.test(t.dataset.key))return;
 polishTarget=t;const r=t.getBoundingClientRect();
 polishBtn.style.left=(window.scrollX+r.right-92)+'px';polishBtn.style.top=(window.scrollY+r.top-14)+'px';polishBtn.hidden=false;
});
formArea?.addEventListener('focusout',()=>setTimeout(()=>{if(document.activeElement!==polishBtn)polishBtn.hidden=true;},150));
polishBtn.addEventListener('mousedown',ev=>ev.preventDefault());
polishBtn.addEventListener('click',()=>{polishBtn.hidden=true;if(polishTarget)aiPolish(polishTarget);});

/* 상담 7번의 안내 문구를 직접 연결 방식에 맞게 바꾼다. */
function patchCounselingNotice(){
 const box=$('[data-key="ai_prompt"]',formArea)?.closest('.sectionbody');if(!box||$('[data-ai-direct]',box))return;
 const note=$('.notice',box);if(note)note.innerHTML='<b>AI로 바로 분석</b>을 누르면 등록한 ChatGPT·Gemini·Claude 모델 중 하나를 골라 1~6번 내용을 분석한다. 이름·연락처·주소·생년월일·함께하는 사람 정보는 보내지 않는다. 요청문을 복사해 다른 곳에서 쓰는 기존 방식도 그대로 쓸 수 있다.';
 const acts=$('.actions',box);if(acts)acts.prepend(h(`<button type="button" class="ai-btn primary-ai" data-ai-direct>✨ AI로 바로 분석</button>`));
}
formArea?.addEventListener('click',ev=>{if(ev.target.closest('[data-ai-direct]'))aiCounseling();});

/* =====================================================================
   7. 기존 화면과 연결
   ===================================================================== */
['openStep','renderFollowup','switchPhase','closeWorkspace','openMeeting'].forEach(fn=>{
 const base=window[fn];if(typeof base!=='function')return;
 window[fn]=function(){const r=base.apply(this,arguments);refreshAiBar();patchCounselingNotice();return r;};
});
const baseOpenHome=window.openHome;
window.openHome=function(){const r=baseOpenHome.apply(this,arguments);refreshAiBar();renderVillage();return r;};
const basePersist=window.persist;
let villageQueued=false;
window.persist=function(){const r=basePersist.apply(this,arguments);if(!villageQueued&&!$('#homeDashboard')?.hidden){villageQueued=true;requestAnimationFrame(()=>{villageQueued=false;renderVillage();});}return r;};

/* 사이드바에 AI 설정 바로가기 */
const navEl=$('.sidebar .nav');if(navEl)navEl.append(h(`<a role="button" tabindex="0">🤖 AI 모델</a>`));
navEl?.lastElementChild?.addEventListener('click',openSettings);
navEl?.lastElementChild?.addEventListener('keydown',ev=>{if(ev.key==='Enter')openSettings();});
/* 상단 메뉴에도 추가 */
const menu=$('#uxMenu');if(menu){const b=h(`<button type="button" role="menuitem">🤖 AI 모델</button>`);b.onclick=()=>{menu.hidden=true;openSettings();};menu.prepend(b);}

renderVillage();refreshAiBar();patchCounselingNotice();
AI.models().then(refreshAiBar);
})();
