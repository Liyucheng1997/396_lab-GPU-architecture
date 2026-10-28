// 建模工具箱：配色、批量方块（InstancedMesh）、单体部件、标签、补间动画
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

export { THREE };

// 3D 内容的功能配色：每种颜色对应一类硬件单元（见每章图例）
export const COL = {
  die: 0x26282e, // 硅片底色
  dieEdge: 0x3a3d45,
  frame: 0x34373f, // GPC / SE 外框
  fp32: 0x3d8bfd, // CUDA 核心 / 流处理器
  int32: 0x7fb2ff,
  tensor: 0x8b6cf0, // Tensor Core / AI 加速器
  rt: 0x34c46e, // RT Core / 光线加速器
  sched: 0xf5a524, // 调度 / 控制逻辑
  reg: 0x4fb8c4, // 寄存器堆
  cache: 0xc9ccd3, // L0 / L1 / LDS
  l2: 0x9aa0aa, // L2
  ic: 0x7f8794, // Infinity Cache
  phy: 0xc8a25a, // 显存控制器 / PHY
  io: 0x6e7380, // PCIe / 显示 / 媒体
  tex: 0xe8746a, // 纹理 / 光栅 / ROP
  sfu: 0x5f9df7,
  ldst: 0x9bb7d4,
  off: 0x4a4d55, // 被屏蔽的单元
  pcb: 0x1d2420,
  substrate: 0x4b5a3c,
  vram: 0x1f2024,
  copper: 0xc27a4a,
  gold: 0xd4a64a,
  alu: 0xd8dbe2,
  metal: 0xb9bdc6,
};

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
UNIT_BOX.userData.shared = true;

const matCache = new Map();
export function mat(color, { rough = 0.55, metal = 0.1, opacity = 1, emissive = 0, emissiveIntensity = 1 } = {}) {
  const key = [color, rough, metal, opacity, emissive, emissiveIntensity].join('|');
  if (!matCache.has(key)) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, transparent: opacity < 1, opacity, emissive, emissiveIntensity });
    m.userData.shared = true;
    matCache.set(key, m);
  }
  return matCache.get(key);
}

// 单个方块：y 是底面高度（方便"摆在"芯片表面上）
export function box(w, h, d, color, o = {}) {
  const m = new THREE.Mesh(UNIT_BOX, o.material || mat(color, o));
  m.scale.set(w, h, d);
  m.position.set(o.x || 0, (o.y || 0) + h / 2, o.z || 0);
  m.castShadow = o.shadow !== false;
  m.receiveShadow = true;
  if (o.info) m.userData.info = o.info;
  if (o.parent) o.parent.add(m);
  return m;
}

export function cyl(rTop, rBot, h, color, o = {}) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, o.seg || 24);
  const m = new THREE.Mesh(g, o.material || mat(color, o));
  m.position.set(o.x || 0, (o.y || 0) + h / 2, o.z || 0);
  m.castShadow = true;
  m.receiveShadow = true;
  if (o.info) m.userData.info = o.info;
  if (o.parent) o.parent.add(m);
  return m;
}

export function group(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (parent) parent.add(g);
  return g;
}

// 大量同类方块合并成一个 InstancedMesh：一次绘制成千上万个单元
export class Batch {
  constructor({ rough = 0.5, metal = 0.08, emissive = false } = {}) {
    this.items = [];
    this.opts = { rough, metal, emissive };
    this.mesh = null;
  }
  add(x, y, z, w, h, d, color, info) {
    this.items.push({ x, y, z, w, h, d, color: new THREE.Color(color), info });
    return this.items.length - 1;
  }
  build(parent) {
    const n = Math.max(1, this.items.length);
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: this.opts.rough, metalness: this.opts.metal });
    const mesh = new THREE.InstancedMesh(UNIT_BOX, material, n);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.mesh = mesh;
    this.items.forEach((it, i) => {
      this._write(i);
      mesh.setColorAt(i, it.color);
    });
    if (!this.items.length) mesh.count = 0;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.userData.infos = this.items.map((it) => it.info);
    mesh.userData.batch = this;
    if (parent) parent.add(mesh);
    return mesh;
  }
  _write(i) {
    const it = this.items[i];
    _m.compose(_v.set(it.x, it.y + it.h / 2, it.z), _q, _s.set(it.w, it.h, it.d));
    this.mesh.setMatrixAt(i, _m);
  }
  // 运行时修改某个单元的颜色 / 位置 / 尺寸
  color(i, c) {
    _c.set(c);
    this.mesh.setColorAt(i, _c);
    this.mesh.instanceColor.needsUpdate = true;
  }
  restore(i) {
    this.mesh.setColorAt(i, this.items[i].color);
    this.mesh.instanceColor.needsUpdate = true;
  }
  move(i, patch) {
    Object.assign(this.items[i], patch);
    this._write(i);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  refreshBounds() {
    this.mesh.computeBoundingSphere();
  }
}
const _m = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

// 屏幕上的文字标签（HTML，始终清晰）
export function label(text, x, y, z, { cls = '', parent } = {}) {
  const el = document.createElement('div');
  el.className = 'lbl ' + cls;
  el.innerHTML = text;
  const o = new CSS2DObject(el);
  o.position.set(x, y, z);
  o.center.set(0.5, 1);
  if (parent) parent.add(o);
  return o;
}

// 补间：main.js 每帧调用 tick
const tweens = new Set();
export const ease = {
  out: (t) => 1 - Math.pow(1 - t, 3),
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  linear: (t) => t,
};
export function tween(duration, fn, e = ease.inOut) {
  return new Promise((resolve) => {
    tweens.add({ t: 0, duration, fn, e, resolve });
  });
}
export function tick(dt) {
  for (const tw of tweens) {
    tw.t = Math.min(1, tw.t + dt / tw.duration);
    tw.fn(tw.e(tw.t));
    if (tw.t >= 1) {
      tweens.delete(tw);
      tw.resolve();
    }
  }
}
export function clearTweens() {
  tweens.clear();
}

// 可复现的伪随机数（让"哪个单元被屏蔽"每次一致）
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const hex = (c) => '#' + new THREE.Color(c).getHexString();
