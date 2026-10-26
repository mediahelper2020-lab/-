/* ===== 3D 아바타 마을 (Three.js) =====
   window.Village3D = { createVillage(container, opts), createPreview(container, avatar) } */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const PI = Math.PI;
const matCache = new Map();
function mat(color, opt = {}) {
  const key = color + JSON.stringify(opt);
  if (!opt.unique && matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({ color, roughness: opt.rough ?? 0.62, metalness: opt.metal ?? 0, flatShading: !!opt.flat, emissive: opt.emissive || 0x000000, emissiveIntensity: opt.ei ?? 1, transparent: !!opt.transparent, opacity: opt.opacity ?? 1, side: opt.side ?? THREE.FrontSide });
  if (!opt.unique) matCache.set(key, m);
  return m;
}
function mesh(geo, material, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, material); m.position.set(x, y, z);
  m.castShadow = shadow; m.receiveShadow = true; return m;
}
function disposeTree(obj) {
  obj.traverse(o => { if (o.isMesh) { o.geometry?.dispose(); const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => { if (m && m.userData.own) m.dispose(); }); } });
}

/* ---------------------------------------------------------------- 아바타 */
function buildAvatar(a, { own = false } = {}) {
  // own=true: 캐릭터마다 재질을 따로 만들어 투명도 조절(흐리게)이 가능하게 한다.
  const M = (c, o = {}) => { const m = mat(c, { ...o, unique: own, transparent: own }); if (own) m.userData.own = true; return m; };
  const skin = M(a.skin, { rough: .7 }), outfit = M(a.outfit, { rough: .55 }), hair = M(a.hairColor, { rough: .5 }),
    dark = M('#3a404c'), shoe = M('#2a2e35'), white = M('#ffffff'), ink = M('#2b2622'), pink = M('#f08c8c', { rough: .9 });
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const parts = { root, body };

  // 다리 (엉덩이 축으로 흔든다)
  const legGeo = new THREE.CapsuleGeometry(.14, .34, 4, 12);
  ['L', 'R'].forEach((s, i) => {
    const pivot = new THREE.Group(); pivot.position.set(i ? .16 : -.16, .62, 0);
    pivot.add(mesh(legGeo, dark, 0, -.26, 0));
    const sh = mesh(new THREE.SphereGeometry(.16, 16, 10), shoe, 0, -.5, .05); sh.scale.set(1, .6, 1.35); pivot.add(sh);
    body.add(pivot); parts['leg' + s] = pivot;
  });
  // 몸통
  const torso = mesh(new THREE.CapsuleGeometry(.38, .42, 6, 18), outfit, 0, 1.02, 0); torso.scale.set(1, 1, .82); body.add(torso);
  const collar = mesh(new THREE.TorusGeometry(.2, .05, 8, 20), white, 0, 1.36, 0); collar.rotation.x = PI / 2; body.add(collar);
  const pocket = mesh(new RoundedBoxGeometry(.22, .14, .04, 2, .03), M(a.outfit, { rough: .3 }), 0, .9, .32, false); body.add(pocket);
  // 팔 (어깨 축)
  const armGeo = new THREE.CapsuleGeometry(.11, .36, 4, 12);
  ['L', 'R'].forEach((s, i) => {
    const pivot = new THREE.Group(); pivot.position.set(i ? .47 : -.47, 1.3, 0); pivot.rotation.z = i ? -.12 : .12;
    pivot.add(mesh(armGeo, outfit, 0, -.25, 0));
    pivot.add(mesh(new THREE.SphereGeometry(.12, 14, 10), skin, 0, -.52, 0));
    body.add(pivot); parts['arm' + s] = pivot;
  });
  // 머리
  const head = new THREE.Group(); head.position.y = 1.86; body.add(head); parts.head = head;
  const skull = mesh(new THREE.SphereGeometry(.52, 32, 24), skin); skull.scale.set(1, .96, .94); head.add(skull);
  [-1, 1].forEach(sx => head.add(mesh(new THREE.SphereGeometry(.11, 12, 10), skin, sx * .51, -.02, 0)));
  // 눈 · 볼 · 입
  const eye = (x) => { const g = new THREE.Group(); g.position.set(x, .03, .45); const e = mesh(new THREE.SphereGeometry(.065, 14, 10), ink, 0, 0, 0, false); e.scale.set(1, 1.35, .6); g.add(e); g.add(mesh(new THREE.SphereGeometry(.022, 8, 6), white, .02, .03, .035, false)); return g; };
  const arc = (r, t) => { const m = mesh(new THREE.TorusGeometry(r, t, 6, 18, PI), ink, 0, 0, 0, false); return m; };
  if (a.face === 'wink') { head.add(eye(-.17)); const w = arc(.07, .017); w.position.set(.17, .02, .47); head.add(w); }
  else if (a.face === 'calm') { [-.17, .17].forEach(x => { const w = arc(.07, .017); w.position.set(x, .04, .47); w.rotation.z = PI; head.add(w); }); }
  else { head.add(eye(-.17)); head.add(eye(.17)); }
  [-.29, .29].forEach(x => { const b = mesh(new THREE.SphereGeometry(.075, 12, 8), pink, x, -.12, .41, false); b.scale.set(1, .6, .3); b.material = pink; head.add(b); });
  if (a.face === 'grin') { const m = mesh(new THREE.CircleGeometry(.1, 18, PI, PI), M('#b54a45'), 0, -.13, .5, false); head.add(m); }
  else { const m = arc(a.face === 'calm' ? .06 : .085, .018); m.position.set(0, a.face === 'calm' ? -.17 : -.13, .48); m.rotation.z = PI; head.add(m); }
  // 머리카락
  const cap = (r = .55, th = .52) => { const m = mesh(new THREE.SphereGeometry(r, 32, 16, 0, 2 * PI, 0, PI * th), hair); m.rotation.x = -.28; m.position.y = .02; return m; };
  const style = a.hair;
  if (style === 'short' || style === 'bun' || style === 'spiky') head.add(cap());
  if (style === 'long') { head.add(cap(.56, .55)); const b = mesh(new THREE.CapsuleGeometry(.43, .55, 6, 16), hair, 0, -.42, -.2); b.scale.set(1, 1, .55); head.add(b); }
  if (style === 'bob') {
    head.add(cap(.56, .5));
    const side = mesh(new THREE.SphereGeometry(.575, 32, 16, PI / 2 + .95, 2 * PI - 1.9, PI * .38, PI * .3), M(a.hairColor, { side: THREE.DoubleSide })); head.add(side);
  }
  if (style === 'curly') {
    for (let i = 0; i < 16; i++) { const t = i / 16 * 2 * PI, up = i % 2 ? .25 : .45; const r = .5;
      const p = new THREE.Vector3(Math.cos(t) * r * Math.cos(up), Math.sin(up) * r + .08, Math.sin(t) * r * Math.cos(up) - .05);
      if (p.z > .3 && p.y < .3) continue; head.add(mesh(new THREE.SphereGeometry(.17, 12, 10), hair, p.x, p.y, p.z)); }
    head.add(mesh(new THREE.SphereGeometry(.3, 16, 12), hair, 0, .42, -.05));
  }
  if (style === 'bun') head.add(mesh(new THREE.SphereGeometry(.22, 16, 12), hair, 0, .58, -.12));
  if (style === 'spiky') for (let i = 0; i < 9; i++) { const t = i / 9 * 2 * PI; const c = mesh(new THREE.ConeGeometry(.11, .34, 8), hair, Math.cos(t) * .32, .42, Math.sin(t) * .32 - .06); c.lookAt(Math.cos(t) * 2, 2.2, Math.sin(t) * 2 - .06); c.rotateX(PI / 2); head.add(c); }
  // 꾸미기
  const acc = a.acc;
  if (acc === 'glasses') { const g = M('#2f3b46', { metal: .3, rough: .3 }); [-.17, .17].forEach(x => head.add(mesh(new THREE.TorusGeometry(.13, .022, 8, 24), g, x, .03, .5, false))); head.add(mesh(new THREE.CylinderGeometry(.015, .015, .1, 6), g, 0, .05, .51, false).rotateZ(PI / 2)); }
  if (acc === 'hat') { head.add(mesh(new THREE.CylinderGeometry(.82, .82, .05, 32), outfit, 0, .36, 0)); head.add(mesh(new THREE.CylinderGeometry(.42, .5, .42, 28), outfit, 0, .58, 0)); head.add(mesh(new THREE.CylinderGeometry(.505, .505, .1, 28), white, 0, .43, 0)); }
  if (acc === 'cap') { const c = mesh(new THREE.SphereGeometry(.56, 28, 14, 0, 2 * PI, 0, PI / 2), outfit, 0, .08, 0); c.rotation.x = -.15; head.add(c); const v = mesh(new THREE.CylinderGeometry(.34, .34, .04, 24, 1, false, -PI / 2, PI), outfit, 0, .14, .38); head.add(v); head.add(mesh(new THREE.SphereGeometry(.05, 8, 6), white, 0, .63, 0)); }
  if (acc === 'ribbon') { const r = M('#e0607a'); const g = new THREE.Group(); g.position.set(.33, .42, .12); g.rotation.z = -.4; [-1, 1].forEach(s => { const c = mesh(new THREE.ConeGeometry(.12, .24, 12), r, s * .12, 0, 0); c.rotation.z = s * PI / 2; g.add(c); }); g.add(mesh(new THREE.SphereGeometry(.06, 10, 8), M('#c44462'))); head.add(g); }
  if (acc === 'headphones') { const band = mesh(new THREE.TorusGeometry(.58, .045, 8, 28, PI), dark, 0, .02, 0); head.add(band); [-1, 1].forEach(s => { const c = mesh(new THREE.CylinderGeometry(.16, .16, .12, 20), outfit, s * .58, 0, 0); c.rotation.z = PI / 2; head.add(c); }); }
  if (acc === 'flower') { const g = new THREE.Group(); g.position.set(-.34, .4, .26); for (let i = 0; i < 5; i++) { const t = i / 5 * 2 * PI; g.add(mesh(new THREE.SphereGeometry(.065, 10, 8), M('#f2b84b'), Math.cos(t) * .08, Math.sin(t) * .08, 0)); } g.add(mesh(new THREE.SphereGeometry(.05, 8, 6), M('#d06a3c'), 0, 0, .03)); head.add(g); }
  return parts;
}

/* ---------------------------------------------------------------- 공통 렌더러 */
function makeRenderer(container, alpha) {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.domElement.style.display = 'block'; r.domElement.style.width = '100%'; r.domElement.style.height = '100%';
  container.append(r.domElement); return r;
}
function lights(scene, size = 26) {
  scene.add(new THREE.HemisphereLight('#dff1ff', '#9a8a62', 1.15));
  const sun = new THREE.DirectionalLight('#fff3dd', 2.3); sun.position.set(14, 24, 12);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = .03;
  Object.assign(sun.shadow.camera, { left: -size, right: size, top: size, bottom: -size, near: 1, far: 80 });
  scene.add(sun);
  const fill = new THREE.DirectionalLight('#ffd7b0', .5); fill.position.set(-12, 8, -10); scene.add(fill);
}

/* ---------------------------------------------------------------- 마을 */
const ZONE3D = [
  { center: [0, 4.6], r: 2.3, building: [0, 1.2], sign: [0, 3.9, 1.2] },        // 마을 광장
  { center: [-7.6, .6], r: 2.0, building: [-11.2, -3.2], sign: [-9.6, 6.6, -1.8] }, // 이야기집
  { center: [-3.4, -5.4], r: 2.0, building: [-4.6, -10.4], sign: [-4.2, 7.2, -8.6] }, // 회의마루
  { center: [3.6, -5.4], r: 2.0, building: [5.4, -10.6], sign: [6.6, 4.2, -7.4] },  // 실천 놀이터
  { center: [8, .6], r: 2.0, building: [11.6, -2.6], sign: [10.2, 5.4, -.6] },   // 전망대
];

function buildWorld(scene, anim) {
  const grass = mat('#9cc483', { flat: true }), grass2 = mat('#b2d396', { flat: true }), dirt = mat('#a27b55', { flat: true }), sand = mat('#ead7a8'), stone = mat('#d9d3c4');
  // 떠 있는 섬
  const top = mesh(new THREE.CylinderGeometry(18.5, 18, 1.2, 64), grass, 0, -.6, 0); scene.add(top);
  const rim = mesh(new THREE.CylinderGeometry(18.2, 13, 3.4, 40, 1), dirt, 0, -2.9, 0, false); scene.add(rim);
  const under = mesh(new THREE.ConeGeometry(13, 7, 30), mat('#8d6948', { flat: true }), 0, -8.1, 0, false); under.rotation.x = PI; scene.add(under);
  for (let i = 0; i < 14; i++) { const t = i / 14 * 2 * PI; const rk = mesh(new THREE.DodecahedronGeometry(.7 + Math.random() * .8), mat('#b9a98b', { flat: true }), Math.cos(t) * 17.4, -.9, Math.sin(t) * 17.4, false); scene.add(rk); }
  // 광장 바닥과 오솔길(디딤돌)
  const plaza = mesh(new THREE.CylinderGeometry(4.6, 4.6, .12, 48), sand, 0, .02, 2.2, false); plaza.receiveShadow = true; scene.add(plaza);
  const curve = new THREE.CatmullRomCurve3([[-7.6, .6], [-5.6, -2.8], [-3.4, -5.4], [0, -6.2], [3.6, -5.4], [5.8, -2.8], [8, .6]].map(([x, z]) => new THREE.Vector3(x, .05, z)));
  const spokes = [[[0, 2.2], [-7.6, .6]], [[0, 2.2], [-3.4, -5.4]], [[0, 2.2], [3.6, -5.4]], [[0, 2.2], [8, .6]]];
  const stoneGeo = new THREE.CylinderGeometry(.42, .46, .1, 10);
  curve.getSpacedPoints(34).forEach(p => { const s = mesh(stoneGeo, stone, p.x + (Math.random() - .5) * .3, .06, p.z + (Math.random() - .5) * .3, false); s.rotation.y = Math.random() * PI; scene.add(s); });
  spokes.forEach(([a, b]) => { for (let t = .32; t < .95; t += .12) { const s = mesh(stoneGeo, stone, a[0] + (b[0] - a[0]) * t, .06, a[1] + (b[1] - a[1]) * t, false); scene.add(s); } });
  ZONE3D.slice(1).forEach(z => { const pad = mesh(new THREE.CylinderGeometry(2.6, 2.6, .08, 36), grass2, z.center[0], .02, z.center[1], false); scene.add(pad); });

  // 분수 (광장)
  const f = new THREE.Group(); f.position.set(0, 0, 1.2); scene.add(f);
  f.add(mesh(new THREE.CylinderGeometry(1.7, 1.85, .5, 32), stone, 0, .25, 0));
  const water = mesh(new THREE.CylinderGeometry(1.5, 1.5, .1, 32), mat('#8fd0e8', { rough: .1, metal: .1, emissive: '#2a6f8a', ei: .15 }), 0, .46, 0, false); f.add(water);
  f.add(mesh(new THREE.CylinderGeometry(.22, .3, 1.3, 16), stone, 0, 1.05, 0));
  f.add(mesh(new THREE.CylinderGeometry(.75, .55, .18, 24), stone, 0, 1.7, 0));
  const jet = mesh(new THREE.ConeGeometry(.28, 1, 16, 1, true), mat('#bfe8f6', { transparent: true, opacity: .7, rough: .1 }), 0, 2.25, 0, false); f.add(jet);
  anim.push(t => { jet.scale.y = 1 + Math.sin(t * 4) * .12; water.material.emissiveIntensity = .15 + Math.sin(t * 2) * .05; });
  [[-2.8, 4.8], [2.8, 4.8]].forEach(([x, z]) => { const b = new THREE.Group(); b.position.set(x, 0, z); b.rotation.y = x < 0 ? .5 : -.5; b.add(mesh(new RoundedBoxGeometry(1.5, .12, .5, 2, .04), mat('#b07a4f'), 0, .5, 0)); b.add(mesh(new RoundedBoxGeometry(1.5, .4, .1, 2, .04), mat('#b07a4f'), 0, .8, -.22)); [-.6, .6].forEach(lx => b.add(mesh(new THREE.BoxGeometry(.1, .5, .4), mat('#6d5440'), lx, .25, 0))); scene.add(b); });

  // 이야기집 (상담)
  { const g = new THREE.Group(); g.position.set(-11.2, 0, -3.2); g.rotation.y = .75; scene.add(g);
    g.add(mesh(new RoundedBoxGeometry(5, 3.4, 4, 3, .18), mat('#fbf1de'), 0, 1.7, 0));
    const roof = mesh(new THREE.ConeGeometry(4.1, 2.4, 4), mat('#c4723f', { flat: true }), 0, 4.6, 0); roof.rotation.y = PI / 4; roof.scale.set(1.05, 1, .85); g.add(roof);
    g.add(mesh(new RoundedBoxGeometry(1.1, 1.8, .2, 2, .08), mat('#8a5a3a'), 0, .9, 2.02));
    g.add(mesh(new THREE.SphereGeometry(.07, 8, 6), mat('#e8c46a', { metal: .6, rough: .3 }), .35, .9, 2.15));
    [-1.55, 1.55].forEach(x => { g.add(mesh(new RoundedBoxGeometry(1, .9, .16, 2, .05), mat('#bfe0ec', { emissive: '#ffe7a8', ei: .25 }), x, 2, 2.02)); g.add(mesh(new THREE.BoxGeometry(1.1, .08, .2), mat('#cdb48a'), x, 1.5, 2.06)); });
    g.add(mesh(new RoundedBoxGeometry(.6, 1.6, .6, 2, .06), mat('#a75d33'), 1.3, 5, -.6));
    for (let i = -2; i <= 2; i++) g.add(mesh(new RoundedBoxGeometry(.14, .7, .14, 1, .03), mat('#e9dcc2'), i * .7, .35, 3.4));
    g.add(mesh(new THREE.BoxGeometry(3, .1, .08), mat('#e9dcc2'), 0, .55, 3.4));
    const smoke = [0, 1, 2].map(i => { const s = mesh(new THREE.SphereGeometry(.28, 10, 8), mat('#ffffff', { transparent: true, opacity: .6 }), 1.3, 6, -.6, false); g.add(s); return s; });
    anim.push(t => smoke.forEach((s, i) => { const k = (t * .35 + i / 3) % 1; s.position.y = 6 + k * 2.4; s.position.x = 1.3 + k * .6; s.scale.setScalar(.6 + k * 1.2); s.material.opacity = .55 * (1 - k); }));
  }
  // 회의마루 (지원계획)
  { const g = new THREE.Group(); g.position.set(-4.6, 0, -10.4); g.rotation.y = .25; scene.add(g);
    g.add(mesh(new RoundedBoxGeometry(6.4, .5, 4.6, 2, .1), stone, 0, .25, 0));
    g.add(mesh(new RoundedBoxGeometry(5.8, .3, 4, 2, .08), mat('#e8e2d0'), 0, .62, 0));
    for (let i = 0; i < 5; i++) [-1.6, 1.6].forEach(z => g.add(mesh(new THREE.CylinderGeometry(.24, .28, 3, 14), mat('#f6f2e6'), -2.4 + i * 1.2, 2.25, z)));
    g.add(mesh(new RoundedBoxGeometry(6.2, .4, 4.2, 2, .08), mat('#f1ead6'), 0, 3.95, 0));
    const shape = new THREE.Shape(); shape.moveTo(-3.3, 0); shape.lineTo(3.3, 0); shape.lineTo(0, 1.6); shape.closePath();
    const ped = mesh(new THREE.ExtrudeGeometry(shape, { depth: 4.4, bevelEnabled: false }), mat('#5f8a74', { flat: true }), 0, 4.15, -2.2); g.add(ped);
    g.add(mesh(new THREE.CylinderGeometry(1.2, 1.2, .12, 28), mat('#a97a52'), 0, 1.45, 0));
    g.add(mesh(new THREE.CylinderGeometry(.14, .2, .7, 10), mat('#7a5a3f'), 0, 1.05, 0));
    for (let i = 0; i < 6; i++) { const t = i / 6 * 2 * PI; g.add(mesh(new RoundedBoxGeometry(.5, .5, .5, 2, .08), mat(['#c4723f', '#5a7fa8', '#d6a43a', '#8a6bb0', '#4f8f8a', '#c4566e'][i]), Math.cos(t) * 1.75, 1.02, Math.sin(t) * 1.75)); }
    const flag = mesh(new THREE.BoxGeometry(.9, .55, .04), mat('#e3bc72'), .5, 6.6, 0); g.add(mesh(new THREE.CylinderGeometry(.04, .04, 1.5, 6), mat('#6d5440'), 0, 6.2, 0)); g.add(flag);
    anim.push(t => { flag.rotation.y = Math.sin(t * 2.4) * .25; });
  }
  // 실천 놀이터 (관람차 · 그네)
  { const g = new THREE.Group(); g.position.set(5.4, 0, -10.6); g.rotation.y = -.2; scene.add(g);
    const leg = mat('#8a6a4a'); [-1, 1].forEach(s => { const a = mesh(new THREE.CylinderGeometry(.13, .18, 6.4, 8), leg, s * 1.3, 2.9, .9); a.rotation.z = s * .22; g.add(a); const b = a.clone(); b.position.z = -.9; g.add(b); });
    const wheel = new THREE.Group(); wheel.position.set(0, 5.9, 0); g.add(wheel);
    wheel.add(mesh(new THREE.TorusGeometry(3, .1, 8, 48), mat('#c4723f')));
    wheel.add(mesh(new THREE.TorusGeometry(2.2, .06, 8, 40), mat('#d8a37c')));
    wheel.add(mesh(new THREE.CylinderGeometry(.35, .35, 2.1, 16), mat('#6d5440'), 0, 0, 0).rotateX(PI / 2));
    const cabins = [];
    for (let i = 0; i < 8; i++) { const t = i / 8 * 2 * PI; const sp = mesh(new THREE.CylinderGeometry(.05, .05, 3, 6), mat('#d8a37c'), Math.cos(t) * 1.5, Math.sin(t) * 1.5, 0); sp.rotation.z = t + PI / 2; wheel.add(sp);
      const cab = new THREE.Group(); cab.position.set(Math.cos(t) * 3, Math.sin(t) * 3, 0); wheel.add(cab);
      cab.add(mesh(new RoundedBoxGeometry(.75, .7, .75, 2, .14), mat(['#e0607a', '#5a7fa8', '#d6a43a', '#8a6bb0'][i % 4]), 0, -.45, 0)); cab.add(mesh(new THREE.ConeGeometry(.5, .3, 8), mat('#fff6e6'), 0, -.02, 0)); cabins.push(cab); }
    anim.push(t => { wheel.rotation.z = t * .25; cabins.forEach(c => c.rotation.z = -wheel.rotation.z); });
    const sw = new THREE.Group(); sw.position.set(3.6, 0, 2); sw.rotation.y = -.6; g.add(sw);
    [-1, 1].forEach(s => sw.add(mesh(new THREE.CylinderGeometry(.08, .08, 2.6, 8), leg, s * 1, 1.3, 0)));
    sw.add(mesh(new THREE.CylinderGeometry(.08, .08, 2.2, 8), leg, 0, 2.6, 0).rotateZ(PI / 2));
    const seat = new THREE.Group(); seat.position.y = 2.6; sw.add(seat);
    [-.3, .3].forEach(x => seat.add(mesh(new THREE.CylinderGeometry(.02, .02, 1.7, 4), mat('#555'), x, -.85, 0)));
    seat.add(mesh(new RoundedBoxGeometry(.8, .1, .4, 2, .03), mat('#c4566e'), 0, -1.7, 0));
    anim.push(t => { seat.rotation.x = Math.sin(t * 1.8) * .45; });
  }
  // 전망대 (모니터링)
  { const g = new THREE.Group(); g.position.set(11.6, 0, -2.6); scene.add(g);
    g.add(mesh(new THREE.CylinderGeometry(1.5, 2.1, 7.4, 10), mat('#ece3cf', { flat: true }), 0, 3.7, 0));
    for (let i = 0; i < 3; i++) g.add(mesh(new THREE.CylinderGeometry(1.95 - i * .2, 1.98 - i * .2, .16, 10), mat('#c9b68e'), 0, 1.8 + i * 2, 0));
    g.add(mesh(new THREE.CylinderGeometry(2.3, 2.3, .3, 20), mat('#8a6bb0'), 0, 7.55, 0));
    for (let i = 0; i < 12; i++) { const t = i / 12 * 2 * PI; g.add(mesh(new THREE.CylinderGeometry(.06, .06, .7, 6), mat('#f6f2e6'), Math.cos(t) * 2.15, 8, Math.sin(t) * 2.15)); }
    g.add(mesh(new THREE.TorusGeometry(2.15, .06, 6, 32), mat('#f6f2e6'), 0, 8.35, 0).rotateX(PI / 2));
    g.add(mesh(new THREE.ConeGeometry(2.6, 2.4, 10), mat('#6f5796', { flat: true }), 0, 9.9, 0));
    const star = mesh(new THREE.OctahedronGeometry(.35), mat('#f4dc9c', { emissive: '#f4c45c', ei: .8 }), 0, 11.4, 0); g.add(star);
    anim.push(t => { star.rotation.y = t; star.position.y = 11.4 + Math.sin(t * 2) * .12; });
    const scope = new THREE.Group(); scope.position.set(.9, 8.2, 1.2); scope.rotation.set(-.3, .6, 0); g.add(scope);
    scope.add(mesh(new THREE.CylinderGeometry(.12, .2, 1.1, 12), mat('#3c4450', { metal: .5, rough: .3 })).rotateX(PI / 2));
    g.add(mesh(new RoundedBoxGeometry(1.1, 1.6, .2, 2, .08), mat('#7a5a3f'), 0, .8, 1.98).rotateY(0));
    [[-1, 3], [1, 5]].forEach(([s, y]) => g.add(mesh(new RoundedBoxGeometry(.6, .7, .12, 2, .05), mat('#bfe0ec', { emissive: '#ffe7a8', ei: .3 }), s * .5, y, 1.75 - y * .07)));
  }
  // 나무 · 꽃 · 가로등 · 구름
  const leafs = ['#7fae74', '#8fbc80', '#6f9e64', '#9cc483'].map(c => mat(c, { flat: true })), trunk = mat('#8a6a4a', { flat: true });
  const treeSpots = [[-15, 5], [-13.5, 9], [-9, 11], [-16, -2], [-15, -8], [-10, -13], [-1, -15], [9, -14.5], [14.5, -8], [16, 2], [14, 8], [9.5, 11.5], [-4.5, 12.5], [4.5, 13], [-6, -14], [1, -12.8], [12.5, -11.5], [-12.5, -11]];
  treeSpots.forEach(([x, z], i) => { const t = new THREE.Group(); t.position.set(x, 0, z); const s = .8 + ((i * 37) % 10) / 20; t.scale.setScalar(s); t.rotation.y = i;
    t.add(mesh(new THREE.CylinderGeometry(.2, .3, 1.4, 6), trunk, 0, .7, 0));
    if (i % 3 === 0) { t.add(mesh(new THREE.ConeGeometry(1.2, 2, 7), leafs[i % 4], 0, 2.2, 0)); t.add(mesh(new THREE.ConeGeometry(.9, 1.6, 7), leafs[(i + 1) % 4], 0, 3.1, 0)); }
    else { t.add(mesh(new THREE.IcosahedronGeometry(1.25, 0), leafs[i % 4], 0, 2.4, 0)); t.add(mesh(new THREE.IcosahedronGeometry(.8, 0), leafs[(i + 2) % 4], .7, 2.1, .3)); }
    scene.add(t); });
  const petals = ['#e0607a', '#f2b84b', '#ffffff', '#8a6bb0', '#f08c8c'].map(c => mat(c)); const flowerGeo = new THREE.SphereGeometry(.12, 8, 6), stemGeo = new THREE.CylinderGeometry(.02, .02, .3, 4);
  for (let i = 0; i < 70; i++) { const a = Math.random() * 2 * PI, r = 6 + Math.random() * 11; const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (ZONE3D.some(zn => Math.hypot(zn.building[0] - x, zn.building[1] - z) < 4.2 || Math.hypot(zn.center[0] - x, zn.center[1] - z) < 2.8)) continue;
    scene.add(mesh(stemGeo, mat('#5f8a54'), x, .15, z, false)); scene.add(mesh(flowerGeo, petals[i % 5], x, .32, z, false)); }
  [[-3.6, 6.4], [3.6, 6.4], [-6, -2.4], [6.2, -2.4]].forEach(([x, z]) => { const l = new THREE.Group(); l.position.set(x, 0, z); l.add(mesh(new THREE.CylinderGeometry(.07, .1, 2.6, 8), mat('#3c4450'), 0, 1.3, 0)); l.add(mesh(new THREE.SphereGeometry(.26, 14, 10), mat('#fff3c4', { emissive: '#ffd77a', ei: .9 }), 0, 2.75, 0, false)); scene.add(l); });
  const cloudMat = mat('#ffffff', { rough: 1, flat: true }); const clouds = [];
  for (let i = 0; i < 7; i++) { const c = new THREE.Group(); [[0, 0, 0, 1.4], [1.3, -.2, .2, 1], [-1.2, -.3, 0, 1.1], [.4, .5, -.2, 1]].forEach(([x, y, z, r]) => c.add(mesh(new THREE.IcosahedronGeometry(r, 1), cloudMat, x, y, z, false)));
    c.position.set(-30 + i * 10, 9 + (i % 3) * 2.5, -22 + (i % 2) * 8 - (i % 3) * 4); c.scale.setScalar(.8 + (i % 3) * .3); scene.add(c); clouds.push(c); }
  anim.push((t, dt) => clouds.forEach((c, i) => { c.position.x += dt * (.4 + i % 3 * .15); if (c.position.x > 34) c.position.x = -34; }));
  // 새 두 마리
  const birds = [0, 1].map(i => { const b = new THREE.Group(); const w = mat('#5b4a3f'); [-1, 1].forEach(s => { const wing = mesh(new THREE.ConeGeometry(.12, .7, 4), w, s * .3, 0, 0, false); wing.rotation.z = s * PI / 2; b.add(wing); }); scene.add(b); return b; });
  anim.push(t => birds.forEach((b, i) => { const a = t * .25 + i * PI; b.position.set(Math.cos(a) * 16, 12 + Math.sin(t + i) * .8, Math.sin(a) * 10 - 4); b.rotation.y = -a; b.children.forEach((w, k) => w.rotation.x = Math.sin(t * 9 + k) * .5); }));
}

/* ---------------------------------------------------------------- 마을 만들기 */
function createVillage(container, opts = {}) {
  const zonesMeta = opts.zones || [];
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#cfe6f1'); scene.fog = new THREE.Fog('#dcebf2', 48, 95);
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 300);
  const renderer = makeRenderer(container, false);
  lights(scene);
  const anim = []; buildWorld(scene, anim);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = .07; controls.enablePan = false;
  controls.minDistance = 16; controls.maxDistance = 58; controls.minPolarAngle = .45; controls.maxPolarAngle = 1.2;
  const HOME_T = new THREE.Vector3(0, 1.4, -2.8), HOME_DIR = new THREE.Vector3(0, 21, 30).normalize(), HOME_D = 38;
  let fitK = 1;
  function resetView() { controls.target.copy(HOME_T); camera.position.copy(HOME_T).addScaledVector(HOME_DIR, HOME_D * fitK); }
  resetView();
  controls.autoRotateSpeed = .5;

  // 화면 위 팻말 · 이름표
  const overlay = document.createElement('div'); overlay.className = 'vl3d-overlay'; container.append(overlay);
  const signs = zonesMeta.map((z, i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'vl-sign'; b.dataset.zone = i; b.innerHTML = `<b>${z.ico} ${z.name}</b><small>${z.sub}</small><em></em>`; b.onclick = () => opts.onZone?.(i); overlay.append(b); return b; });

  const people = new Map(); const ray = new THREE.Raycaster(); const ptr = new THREE.Vector2(); let hovered = null;
  const ringGeo = new THREE.RingGeometry(.5, .68, 32), ringMat = new THREE.MeshBasicMaterial({ color: '#e3bc72', transparent: true, opacity: .9, side: THREE.DoubleSide });

  function randIn(zi) { const z = ZONE3D[zi]; const a = Math.random() * 2 * PI, r = Math.sqrt(Math.random()) * z.r; return new THREE.Vector3(z.center[0] + Math.cos(a) * r, 0, z.center[1] + Math.sin(a) * r); }
  function addPerson(p) {
    const parts = buildAvatar(p.avatar, { own: true }); const root = parts.root; root.scale.setScalar(1.45);
    const start = randIn(p.zone); root.position.copy(start); root.rotation.y = Math.random() * 2 * PI; scene.add(root);
    const ring = new THREE.Mesh(ringGeo, ringMat); ring.rotation.x = -PI / 2; ring.position.y = .06; ring.visible = false; root.add(ring);
    root.traverse(o => { if (o.isMesh) o.userData.person = p.name; });
    const tag = document.createElement('button'); tag.type = 'button'; tag.className = 'vc3d-tag'; tag.innerHTML = `<span class="vc-bubble"></span><span class="vc-name"></span>`; tag.onclick = () => opts.onPick?.(p.name); overlay.append(tag);
    const st = { ...p, parts, root, ring, tag, target: start.clone(), wait: Math.random() * 2, phase: Math.random() * 10, look: JSON.stringify(p.avatar), dim: false };
    people.set(p.name, st); return st;
  }
  function removePerson(st) { scene.remove(st.root); disposeTree(st.root); st.tag.remove(); people.delete(st.name); }
  function setPeople(list) {
    const seen = new Set(); const counts = zonesMeta.map(() => 0);
    list.forEach(p => { seen.add(p.name); counts[p.zone] = (counts[p.zone] || 0) + 1;
      let st = people.get(p.name);
      if (st && st.look !== JSON.stringify(p.avatar)) { const pos = st.root.position.clone(), rot = st.root.rotation.y; removePerson(st); st = addPerson(p); st.root.position.copy(pos); st.root.rotation.y = rot; st.target.copy(pos); }
      if (!st) st = addPerson(p);
      if (st.zone !== p.zone) { st.zone = p.zone; st.target = randIn(p.zone); st.wait = 0; }
      Object.assign(st, { bubble: p.bubble, label: p.label });
      st.tag.querySelector('.vc-name').textContent = p.name; st.tag.querySelector('.vc-bubble').textContent = p.bubble; st.tag.setAttribute('aria-label', p.label || p.name);
    });
    [...people.values()].forEach(st => { if (!seen.has(st.name)) removePerson(st); });
    signs.forEach((s, i) => s.querySelector('em').textContent = counts[i] || '');
    applyFilter();
  }
  let filter = { q: '', zone: -1 };
  function applyFilter() {
    people.forEach(st => { const dim = (filter.q && !st.name.includes(filter.q)) || (filter.zone >= 0 && st.zone !== filter.zone);
      if (dim !== st.dim) { st.dim = dim; st.root.traverse(o => { if (o.isMesh && o.material.userData.own) o.material.opacity = dim ? .18 : 1; }); st.tag.classList.toggle('dim', dim); } });
    signs.forEach((s, i) => s.classList.toggle('on', i === filter.zone));
  }
  function setFilter(f) { filter = { ...filter, ...f }; applyFilter(); }
  function bubbles(on) { overlay.classList.toggle('show-bubbles', on); }

  // 포인터
  function pick(ev) { const r = renderer.domElement.getBoundingClientRect(); ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ptr, camera); const hit = ray.intersectObjects([...people.values()].map(p => p.root), true).find(h => h.object.userData.person); return hit ? people.get(hit.object.userData.person) : null; }
  let downAt = null;
  renderer.domElement.addEventListener('pointerdown', ev => { downAt = [ev.clientX, ev.clientY]; controls.autoRotate = false; });
  renderer.domElement.addEventListener('pointerup', ev => { if (!downAt || Math.hypot(ev.clientX - downAt[0], ev.clientY - downAt[1]) > 6) return; const p = pick(ev); if (p) opts.onPick?.(p.name); });
  renderer.domElement.addEventListener('pointermove', ev => { if (ev.buttons) return; const p = pick(ev); if (p !== hovered) { if (hovered) { hovered.ring.visible = false; hovered.tag.classList.remove('hover'); } hovered = p; if (p) { p.ring.visible = true; p.tag.classList.add('hover'); } renderer.domElement.style.cursor = p ? 'pointer' : 'grab'; } });
  renderer.domElement.style.cursor = 'grab';

  // 크기
  function resize() { const w = container.clientWidth, h = container.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.fov = 36; camera.updateProjectionMatrix();
    const k = camera.aspect < 1.3 ? Math.min(1.9, 1.3 / camera.aspect) : 1; if (Math.abs(k - fitK) > .05) { fitK = k; controls.maxDistance = 58 * k; resetView(); } }
  const ro = new ResizeObserver(resize); ro.observe(container); resize();

  // 애니메이션
  const clock = new THREE.Clock(); const v = new THREE.Vector3(); let visible = true;
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; }); io.observe(container);
  function project(obj3, y, el) { v.set(obj3.x, y, obj3.z).project(camera); const w = container.clientWidth, h = container.clientHeight;
    if (v.z > 1) { el.style.visibility = 'hidden'; return; } el.style.visibility = ''; el.style.transform = `translate(-50%,-100%) translate(${(v.x * .5 + .5) * w}px,${(-v.y * .5 + .5) * h}px)`; }
  const tmp = new THREE.Vector3();
  renderer.setAnimationLoop(() => {
    if (!visible || document.hidden || !container.isConnected) { clock.getDelta(); return; }
    const dt = Math.min(clock.getDelta(), .05), t = clock.elapsedTime;
    anim.forEach(f => f(t, dt));
    people.forEach(st => {
      const { root, parts } = st; const pos = root.position; tmp.subVectors(st.target, pos); tmp.y = 0; const d = tmp.length();
      let walking = false;
      if (st.wait > 0) st.wait -= dt;
      else if (d > .08) { walking = true; tmp.normalize(); const sp = 1.15 * dt; pos.addScaledVector(tmp, Math.min(sp, d));
        const want = Math.atan2(tmp.x, tmp.z); let diff = want - root.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff)); root.rotation.y += diff * Math.min(1, dt * 8); }
      else { st.wait = 1.5 + Math.random() * 5; st.target = randIn(st.zone); }
      const ph = t * 8 + st.phase;
      if (walking) { parts.legL.rotation.x = Math.sin(ph) * .65; parts.legR.rotation.x = -Math.sin(ph) * .65; parts.armL.rotation.x = -Math.sin(ph) * .55; parts.armR.rotation.x = Math.sin(ph) * .55; parts.body.position.y = Math.abs(Math.sin(ph)) * .07; parts.head.rotation.z = 0; }
      else { const k = Math.min(1, dt * 6); parts.legL.rotation.x *= 1 - k; parts.legR.rotation.x *= 1 - k; parts.armL.rotation.x *= 1 - k;
        const wave = (Math.sin(t * .7 + st.phase) > .93); parts.armR.rotation.x = wave ? -2.6 + Math.sin(t * 12) * .25 : parts.armR.rotation.x * (1 - k); parts.armR.rotation.z = wave ? -.4 : -.12;
        parts.body.position.y = Math.sin(t * 2 + st.phase) * .025; parts.head.rotation.z = Math.sin(t * 1.3 + st.phase) * .06; }
      if (st.ring.visible) st.ring.rotation.z = t;
      project(pos, 4.35, st.tag); st.tag.style.zIndex = String(1000 + Math.round(pos.z * 10));
    });
    zonesMeta.forEach((z, i) => { const s = ZONE3D[i].sign; project({ x: s[0], z: s[2] }, s[1], signs[i]); });
    controls.update(); renderer.render(scene, camera);
  });
  function dispose() { renderer.setAnimationLoop(null); ro.disconnect(); io.disconnect(); controls.dispose(); people.forEach(removePerson); scene.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); overlay.remove(); }
  function focusOn(name) { const st = people.get(name); if (!st) return; controls.target.lerp(new THREE.Vector3(st.root.position.x, 1.2, st.root.position.z), .6); }
  function spin(on) { controls.autoRotate = on; }
  return { setPeople, setFilter, bubbles, dispose, resize, focusOn, spin, resetView };
}

/* ---------------------------------------------------------------- 미리보기 (카드 · 아바타 만들기) */
function createPreview(container, avatar) {
  const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(30, 1, .1, 50); camera.position.set(0, 1.55, 6.4); camera.lookAt(0, 1.25, 0);
  const renderer = makeRenderer(container, true); lights(scene, 4);
  const ground = mesh(new THREE.CircleGeometry(1.3, 40), new THREE.ShadowMaterial({ opacity: .25 }), 0, 0, 0, false); ground.rotation.x = -PI / 2; scene.add(ground);
  let parts = null, dragging = false, lastX = 0, rotY = .35, auto = true;
  function set(a) { if (parts) { scene.remove(parts.root); disposeTree(parts.root); } parts = buildAvatar(a); scene.add(parts.root); }
  set(avatar);
  const el = renderer.domElement; el.style.cursor = 'grab'; el.style.touchAction = 'pan-y';
  el.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; auto = false; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => { if (!dragging) return; rotY += (e.clientX - lastX) * .012; lastX = e.clientX; });
  el.addEventListener('pointerup', () => { dragging = false; });
  function resize() { const w = container.clientWidth, h = container.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  const ro = new ResizeObserver(resize); ro.observe(container); resize();
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => { const dt = Math.min(clock.getDelta(), .05), t = clock.elapsedTime; if (!parts) return;
    if (auto) rotY += dt * .5; parts.root.rotation.y = rotY;
    parts.body.position.y = Math.sin(t * 2) * .03; parts.head.rotation.z = Math.sin(t * 1.3) * .06;
    const wave = (t % 6) < 1.4; parts.armR.rotation.x = wave ? -2.6 + Math.sin(t * 12) * .25 : parts.armR.rotation.x * .9; parts.armR.rotation.z = wave ? -.4 : -.12;
    renderer.render(scene, camera); });
  return { set, dispose() { renderer.setAnimationLoop(null); ro.disconnect(); if (parts) disposeTree(parts.root); renderer.dispose(); renderer.forceContextLoss(); el.remove(); } };
}

function webglOK() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (_) { return false; } }
if (webglOK()) { window.Village3D = { createVillage, createPreview }; window.dispatchEvent(new Event('village3d-ready')); }
else window.dispatchEvent(new Event('village3d-failed'));
