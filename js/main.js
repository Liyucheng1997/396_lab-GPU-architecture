// 主程序：渲染器、相机、章节切换、悬停拾取、讲解面板
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as kit from './kit.js';
import { chapters } from './chapters/index.js';

const stage = document.getElementById('stage');
const tooltip = document.getElementById('tooltip');
const $ = (id) => document.getElementById(id);

// ---------- 渲染器 ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x000000, 0);
stage.prepend(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.className = 'label-layer';
stage.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 800);
camera.position.set(20, 22, 26);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 2;
controls.maxDistance = 160;
controls.autoRotateSpeed = 0.6;

scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f99, 0.55));
const sun = new THREE.DirectionalLight(0xffffff, 1.45);
sun.position.set(18, 36, 14);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 120 });
sun.shadow.bias = -0.0004;
sun.shadow.radius = 4;
scene.add(sun);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ opacity: 0.16 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

let grid = null;
function buildGrid() {
  if (grid) scene.remove(grid);
  const dark = document.documentElement.dataset.theme === 'dark';
  grid = new THREE.GridHelper(200, 100, dark ? 0x2a2a2e : 0xd9d9de, dark ? 0x1a1a1d : 0xe6e6ea);
  grid.position.y = -0.01;
  grid.material.transparent = true;
  grid.material.opacity = 0.9;
  scene.add(grid);
}
buildGrid();

function resize() {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  renderer.setSize(w, h, false);
  labelRenderer.setSize(w, h);
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);

// ---------- 高亮框 ----------
const hl = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
  new THREE.LineBasicMaterial({ color: 0x0a84ff, depthTest: false, transparent: true, opacity: 0.95 })
);
hl.renderOrder = 999;
hl.visible = false;
scene.add(hl);
const hlFill = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshBasicMaterial({ color: 0x0a84ff, transparent: true, opacity: 0.14, depthWrite: false })
);
hlFill.visible = false;
scene.add(hlFill);

// ---------- 章节 ----------
let current = null; // { def, inst, index }
const nav = $('nav');

function renderNav() {
  nav.innerHTML = '';
  let lastGroup = null;
  chapters.forEach((c, i) => {
    if (c.group !== lastGroup) {
      lastGroup = c.group;
      const g = document.createElement('div');
      g.className = 'nav-group';
      g.textContent = c.group;
      nav.appendChild(g);
    }
    const b = document.createElement('button');
    b.className = 'nav-item';
    b.dataset.id = c.id;
    b.innerHTML = `<span class="nav-num">${String(i + 1).padStart(2, '0')}</span><span>${c.title}</span>${c.vendor ? `<span class="nav-dot ${c.vendor}"></span>` : ''}`;
    b.onclick = () => go(c.id);
    nav.appendChild(b);
  });
}

function disposeCurrent() {
  if (!current) return;
  current.inst.dispose?.();
  const root = current.inst.root;
  root.traverse((o) => {
    if (o.isCSS2DObject && o.element.parentNode) o.element.parentNode.removeChild(o.element);
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    if (o.material && !o.material.userData?.shared) {
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    }
  });
  scene.remove(root);
  kit.clearTweens();
  current = null;
}

// 控件工厂：章节用它们往面板里放分段按钮、滑块等
function makeUI(container) {
  const wrap = (labelText, valText) => {
    const w = document.createElement('div');
    if (labelText) {
      const l = document.createElement('div');
      l.className = 'ctl-label';
      l.innerHTML = `<span>${labelText}</span>${valText !== undefined ? `<span class="val">${valText}</span>` : ''}`;
      w.appendChild(l);
    }
    container.appendChild(w);
    return w;
  };
  return {
    seg(labelText, options, value, onChange) {
      const w = wrap(labelText);
      const s = document.createElement('div');
      s.className = 'seg';
      const set = (v) => s.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.v === String(v)));
      options.forEach((o) => {
        const b = document.createElement('button');
        b.dataset.v = String(o.v);
        b.textContent = o.t;
        b.onclick = () => {
          set(o.v);
          onChange(o.v);
        };
        s.appendChild(b);
      });
      set(value);
      w.appendChild(s);
      return { el: w, set };
    },
    slider(labelText, min, max, step, value, fmt, onChange) {
      const w = wrap(labelText, fmt(value));
      const r = document.createElement('input');
      r.type = 'range';
      r.className = 'range';
      Object.assign(r, { min, max, step, value });
      const val = w.querySelector('.val');
      r.oninput = () => {
        const v = Number(r.value);
        val.textContent = fmt(v);
        onChange(v);
      };
      w.appendChild(r);
      return { el: w, input: r, set: (v) => { r.value = v; val.textContent = fmt(v); } };
    },
    buttons(list) {
      const w = wrap();
      w.className = 'row-btns';
      const els = list.map((it) => {
        const b = document.createElement('button');
        b.className = 'btn btn-sm' + (it.primary ? ' btn-primary' : '');
        b.textContent = it.t;
        b.onclick = it.onClick;
        w.appendChild(b);
        return b;
      });
      return { el: w, buttons: els };
    },
    html(str) {
      const w = wrap();
      w.innerHTML = str;
      return w;
    },
  };
}

const ctx = {
  THREE,
  kit,
  camera,
  controls,
  go: (id) => go(id),
  view: (pos, target, duration = 1.1) => flyTo(pos, target, duration),
  setBody: (html) => ($('p-body').innerHTML = html),
};

// 视角按 16:10 左右的舞台设计；舞台更窄时把相机往后拉，保证模型完整入画
function fitPos(pos, target) {
  const k = Math.pow(Math.max(1, 1.5 / camera.aspect), 0.85);
  const t = new THREE.Vector3(...target);
  return new THREE.Vector3(...pos).sub(t).multiplyScalar(k).add(t);
}

function flyTo(pos, target, duration = 1.1) {
  const p0 = camera.position.clone();
  const t0 = controls.target.clone();
  const p1 = fitPos(pos, target);
  const t1 = new THREE.Vector3(...target);
  return kit.tween(duration, (t) => {
    camera.position.lerpVectors(p0, p1, t);
    controls.target.lerpVectors(t0, t1, t);
  });
}

function go(id, { instant = false } = {}) {
  const index = Math.max(0, chapters.findIndex((c) => c.id === id));
  const def = chapters[index];
  disposeCurrent();
  hideHover();

  const controlsEl = $('p-controls');
  controlsEl.innerHTML = '';
  $('p-body').innerHTML = '';
  ctx.ui = makeUI(controlsEl);
  let inst;
  try {
    inst = def.build(ctx);
  } catch (err) {
    console.error(err);
    inst = { root: new THREE.Group(), body: `<p class="muted">这一章加载失败：${err.message}</p>` };
  }
  scene.add(inst.root);
  current = { def, inst, index };

  // 面板
  $('p-eyebrow').innerHTML = `${def.vendor ? `<span class="nav-dot ${def.vendor}" style="margin:0"></span>` : ''}${String(index + 1).padStart(2, '0')} · ${def.group}`;
  $('p-title').textContent = def.title;
  if (inst.body) $('p-body').innerHTML = inst.body;
  $('p-legend').innerHTML = (inst.legend || []).map(([c, n]) => `<div class="lg"><i style="background:${kit.hex(c)}"></i>${n}</div>`).join('');
  $('btn-prev').disabled = index === 0;
  $('btn-next').textContent = index === chapters.length - 1 ? '回到开头' : '下一章';
  const scroll = document.querySelector('.panel-scroll');
  scroll.scrollTop = 0;
  scroll.style.animation = 'none';
  void scroll.offsetWidth;
  scroll.style.animation = '';

  nav.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.id === def.id));
  nav.querySelector('.nav-item.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  if (location.hash.slice(1) !== def.id) history.replaceState(null, '', '#' + def.id);

  const v = inst.view || { pos: [20, 22, 26], target: [0, 0, 0] };
  if (instant) {
    camera.position.copy(fitPos(v.pos, v.target));
    controls.target.set(...v.target);
  } else {
    flyTo(v.pos, v.target, 1.2);
  }
}

// ---------- 悬停 / 点击 ----------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerPx = { x: 0, y: 0 };
let pointerDirty = false;
let pointerInside = false;
let hovered = null; // { info, box }
let downAt = null;

renderer.domElement.addEventListener('pointermove', (e) => {
  const r = renderer.domElement.getBoundingClientRect();
  pointerPx = { x: e.clientX - r.left, y: e.clientY - r.top };
  pointer.set((pointerPx.x / r.width) * 2 - 1, -(pointerPx.y / r.height) * 2 + 1);
  pointerDirty = true;
  pointerInside = true;
});
renderer.domElement.addEventListener('pointerleave', () => {
  pointerInside = false;
  hideHover();
});
renderer.domElement.addEventListener('pointerdown', (e) => {
  downAt = { x: e.clientX, y: e.clientY };
  $('hint').classList.add('hide');
});
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downAt) return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  downAt = null;
  if (moved > 5) return;
  const hit = pick();
  if (!hit) return;
  if (hit.info.onClick) hit.info.onClick(hit);
  else if (hit.info.go) go(hit.info.go);
});

const _box = new THREE.Box3();
const _m4 = new THREE.Matrix4();
const _unit = new THREE.Box3(new THREE.Vector3(-0.5, -0.5, -0.5), new THREE.Vector3(0.5, 0.5, 0.5));

function pick() {
  if (!current) return null;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(current.inst.root, true);
  for (const h of hits) {
    if (!h.object.visible) continue;
    if (h.object.isInstancedMesh) {
      const info = h.object.userData.infos?.[h.instanceId];
      if (info) {
        h.object.getMatrixAt(h.instanceId, _m4);
        const b = _unit.clone().applyMatrix4(_m4).applyMatrix4(h.object.matrixWorld);
        return { info, box: b, object: h.object, instanceId: h.instanceId };
      }
      continue;
    }
    let o = h.object;
    while (o && !o.userData.info) o = o.parent;
    if (o && o.userData.info) {
      if (o.userData.info.passThrough) continue;
      return { info: o.userData.info, box: _box.clone().setFromObject(o), object: o };
    }
  }
  return null;
}

function hideHover() {
  hovered = null;
  hl.visible = false;
  hlFill.visible = false;
  tooltip.classList.remove('show');
  renderer.domElement.style.cursor = '';
}

function showHover(hit) {
  hovered = hit;
  const size = hit.box.getSize(new THREE.Vector3());
  const c = hit.box.getCenter(new THREE.Vector3());
  const pad = Math.max(0.03, Math.min(size.x, size.z) * 0.02);
  hl.scale.set(size.x + pad, size.y + pad, size.z + pad);
  hl.position.copy(c);
  hlFill.scale.copy(hl.scale);
  hlFill.position.copy(c);
  hl.visible = hlFill.visible = true;
  const i = hit.info;
  const kv = i.kv ? `<div class="tt-kv">${i.kv.map(([k, v]) => `<span>${k}</span><span>${v}</span>`).join('')}</div>` : '';
  const click = i.go || i.onClick ? `<div class="tt-click">${i.clickText || '点击进入 →'}</div>` : '';
  tooltip.innerHTML = `<div class="tt-title">${i.t}</div>${i.d ? `<div class="tt-desc">${i.d}</div>` : ''}${kv}${click}`;
  tooltip.classList.add('show');
  renderer.domElement.style.cursor = i.go || i.onClick ? 'pointer' : 'default';
}

function placeTooltip() {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  const tw = tooltip.offsetWidth;
  const th = tooltip.offsetHeight;
  let x = pointerPx.x + 16;
  let y = pointerPx.y + 16;
  if (x + tw > w - 8) x = pointerPx.x - tw - 16;
  if (y + th > h - 8) y = pointerPx.y - th - 16;
  tooltip.style.left = Math.max(8, x) + 'px';
  tooltip.style.top = Math.max(8, y) + 'px';
}

// ---------- 顶栏按钮 ----------
$('btn-theme').onclick = () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem('gpu3d-theme', next);
  } catch (e) {}
  buildGrid();
};
let labelsOn = true;
$('btn-labels').classList.add('on');
$('btn-labels').onclick = () => {
  labelsOn = !labelsOn;
  stage.classList.toggle('labels-off', !labelsOn);
  $('btn-labels').classList.toggle('on', labelsOn);
};
$('btn-rotate').onclick = () => {
  controls.autoRotate = !controls.autoRotate;
  $('btn-rotate').classList.toggle('on', controls.autoRotate);
};
$('btn-reset').onclick = () => {
  const v = current?.inst.view;
  if (v) flyTo(v.pos, v.target, 0.9);
};
$('btn-prev').onclick = () => current && current.index > 0 && go(chapters[current.index - 1].id);
$('btn-next').onclick = () => current && go(chapters[(current.index + 1) % chapters.length].id);
window.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea')) return;
  if (e.key === 'ArrowRight' || e.key === 'PageDown') $('btn-next').click();
  if (e.key === 'ArrowLeft' || e.key === 'PageUp') $('btn-prev').click();
});
window.addEventListener('hashchange', () => {
  const id = location.hash.slice(1);
  if (current && id && id !== current.def.id) go(id);
});

// ---------- 主循环 ----------
const clock = new THREE.Clock();
let elapsed = 0;
function loop() {
  const dt = Math.min(0.05, clock.getDelta());
  elapsed += dt;
  kit.tick(dt);
  controls.update();
  current?.inst.update?.(dt, elapsed);
  if (pointerInside && (pointerDirty || controls.autoRotate)) {
    pointerDirty = false;
    const hit = pick();
    if (hit) {
      showHover(hit);
      placeTooltip();
    } else if (hovered) hideHover();
  }
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
  requestAnimationFrame(loop);
}

renderNav();
resize();
go(location.hash.slice(1) || chapters[0].id, { instant: true });
$('loading').classList.add('done');
setTimeout(() => $('hint').classList.add('hide'), 9000);
loop();
