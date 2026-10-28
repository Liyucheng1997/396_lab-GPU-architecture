// 01 一张显卡的构成：PCB、GPU、显存、供电、散热器的爆炸图
import { THREE, COL, mat, box, cyl, group, Batch, label, tween, rng } from '../kit.js';

const I = {
  die: { t: 'GPU 核心（芯片）', d: '显卡的大脑。这里以 RTX 5090 的 GB202 为例：750 mm²、约 922 亿个晶体管。', kv: [['工艺', 'TSMC 4N'], ['CUDA 核心', '21,760（启用）']], go: 'nv-die', clickText: '点击进入芯片内部 →' },
  sub: { t: '封装基板', d: '把芯片上数万个微小凸点“扇出”到 PCB 的焊球上，基板上还布满去耦电容，给芯片稳压。' },
  vram: { t: 'GDDR7 显存颗粒', d: '存放贴图、模型、帧缓冲和 AI 权重。每颗 2 GB、32-bit 位宽，16 颗拼成 32 GB / 512-bit。', kv: [['单颗', '2 GB · 32-bit'], ['速率', '28 Gbps'], ['总带宽', '512÷8×28 ≈ 1792 GB/s']] },
  stage: { t: '供电相（功率级 DrMOS）', d: '把 12 V 降到核心需要的约 1 V，同时提供数百安培电流。相数越多、规格越高，供电越稳，频率越能维持在高位。' },
  choke: { t: '电感', d: '和功率级配合，把开关电流平滑成稳定的直流。' },
  cap: { t: '电容', d: '储能与滤波，吸收负载瞬间变化带来的电压波动。' },
  pcie: { t: 'PCIe 5.0 x16 金手指', d: '插进主板插槽，与 CPU 交换数据（单向约 64 GB/s），并从插槽取电（最多 75 W）。' },
  bracket: { t: '挡板与显示接口', d: 'DisplayPort 2.1 ×3 + HDMI 2.1 ×1，画面从这里输出到显示器。' },
  power: { t: '12V-2×6（16-pin）供电接口', d: '为整卡提供最多 600 W 电力。RTX 5090 的整卡功耗（TBP）为 575 W。' },
  pcb: { t: 'PCB 电路板', d: '十几层铜箔走线把 GPU、显存与供电连起来。GPU 到每颗显存的走线要严格等长，才能跑 28 Gbps 以上的信号。' },
  smd: { t: '贴片元件', d: '电阻、电容、控制芯片等。' },
  back: { t: '背板', d: '保护 PCB、增加结构强度，防止重卡弯曲；部分型号也给背面元件散热。' },
  paste: { t: '导热膏 / 液态金属', d: '填补芯片与散热底座之间肉眼看不见的空隙，空气的导热能力极差。' },
  pad: { t: '导热垫', d: '给显存颗粒和供电元件导热，它们也会发热（GDDR7 单颗约几瓦）。' },
  vc: { t: '均热板 Vapor Chamber', d: '密封腔体内有少量液体，受热蒸发、遇冷凝结，把芯片上高度集中的热量迅速摊到整块铜底上。' },
  vrmPlate: { t: '供电散热板', d: '贴在供电元件上方，把功率级和电感的热量导入鳍片。' },
  pipe: { t: '热管', d: '同样靠液体相变传热，把热量从铜底“搬”到整片鳍片，导热能力是纯铜的几十到上百倍。' },
  fins: { t: '散热鳍片', d: '上百片薄铝片，极大地增加与空气的接触面积。风扇吹过鳍片带走热量。' },
  shroud: { t: '导风罩', d: '约束气流方向，也是外观设计的主体。' },
  fan: { t: '风扇', d: '把冷空气压过鳍片。多风扇显卡的中间风扇常反向旋转，减少相邻气流的相互干扰。' },
};

export default {
  id: 'board',
  group: '基础',
  title: '一张显卡的构成',
  build(ctx) {
    const root = new THREE.Group();
    const L = 30;
    const Wd = 12;
    const gx = -3;
    const r = rng(7);

    // ---- 背板 ----
    const back = group(root, 0, 0, 0);
    box(L, 0.15, Wd, 0x2c2f35, { rough: 0.45, metal: 0.7, info: I.back, parent: back });
    for (let k = 0; k < 6; k++) box(0.5, 0.02, 7, 0x1d1f23, { x: 6 + k * 1.2, y: 0.15, rough: 0.6, info: I.back, parent: back });

    // ---- PCB 层 ----
    const pcbG = group(root, 0, 0.25, 0);
    box(L, 0.16, Wd, COL.pcb, { rough: 0.7, info: I.pcb, parent: pcbG });
    const T = 0.16;
    box(5.2, 0.12, 5.2, COL.substrate, { x: gx, y: T, rough: 0.6, info: I.sub, parent: pcbG });
    const die = box(2.5, 0.12, 3.0, 0x30343c, { x: gx, y: T + 0.12, rough: 0.18, metal: 0.85, info: I.die, parent: pcbG });
    const smd = new Batch({ rough: 0.5 });
    for (let k = 0; k < 64; k++) {
      const a = (k / 64) * Math.PI * 2;
      const rr = 2.15 + (k % 2) * 0.22;
      smd.add(gx + Math.cos(a) * rr * 0.95, T + 0.12, Math.sin(a) * rr * 0.95, 0.12, 0.06, 0.08, k % 3 ? 0xb08a5a : 0x3a3a3a, I.cap);
    }
    // 显存 16 颗
    const vram = new Batch({ rough: 0.55 });
    const chipXZ = [];
    for (const z of [-3.55, 3.55]) for (let k = -2; k <= 2; k++) chipXZ.push([gx + k * 1.7, z, 1.4, 1.2]);
    for (const x of [gx - 3.75, gx + 3.75]) for (const z of [-1.6, 0, 1.6]) chipXZ.push([x, z, 1.2, 1.4]);
    chipXZ.forEach(([x, z, w, d], i) => vram.add(x, T, z, w, 0.12, d, COL.vram, { ...I.vram, t: `GDDR7 显存颗粒 #${i + 1} / 16` }));
    vram.build(pcbG);
    // 供电
    const vrm = new Batch({ rough: 0.5, metal: 0.3 });
    for (let k = 0; k < 9; k++) {
      const x = 4.6 + k * 1.0;
      for (const s of [-1, 1]) {
        vrm.add(x, T, s * 1.0, 0.6, 0.12, 0.6, 0x15161a, I.stage);
        vrm.add(x, T, s * 2.25, 0.82, 0.45, 0.82, 0x6d7078, I.choke);
      }
    }
    for (let k = 0; k < 3; k++) {
      vrm.add(gx - 6.2 - k * 1.0, T, -3.6, 0.6, 0.12, 0.6, 0x15161a, { ...I.stage, t: '显存供电相' });
      vrm.add(gx - 6.2 - k * 1.0, T, -2.4, 0.82, 0.45, 0.82, 0x6d7078, I.choke);
    }
    vrm.build(pcbG);
    for (let k = 0; k < 9; k++) {
      for (const s of [-1, 1]) cyl(0.24, 0.24, 0.55, 0x2a2b30, { x: 4.6 + k * 1.0, y: T, z: s * 3.6, rough: 0.35, metal: 0.6, info: I.cap, parent: pcbG });
    }
    for (let k = 0; k < 140; k++) {
      const x = r() * 27 - 13;
      const z = r() * 11 - 5.5;
      const nearGpu = Math.abs(x - gx) < 4.6 && Math.abs(z) < 4.8;
      const nearVrm = x > 3.9 && Math.abs(z) < 4.0;
      if (nearGpu || nearVrm) continue;
      smd.add(x, T, z, 0.16 + r() * 0.2, 0.06, 0.1 + r() * 0.14, r() > 0.5 ? 0x8c8f96 : 0x24262a, I.smd);
    }
    smd.build(pcbG);
    // 金手指
    const fingers = new Batch({ rough: 0.25, metal: 0.95 });
    for (let k = 0; k < 36; k++) fingers.add(-10.2 + k * 0.24, T, 5.55, 0.16, 0.012, 0.8, COL.gold, I.pcie);
    fingers.build(pcbG);
    // 挡板与接口
    box(0.12, 3.9, Wd + 0.4, 0xb9bdc6, { x: -L / 2 - 0.15, y: -0.1, rough: 0.35, metal: 0.9, info: I.bracket, parent: pcbG });
    [-3.8, -1.6, 0.6, 2.8].forEach((z, i) => box(0.14, 0.5, i === 3 ? 1.5 : 1.7, 0x111214, { x: -L / 2 - 0.2, y: 0.55, z, info: I.bracket, parent: pcbG }));
    for (let k = 0; k < 7; k++) box(0.14, 2.0, 0.35, 0x8b8f97, { x: -L / 2 - 0.2, y: 1.3, z: -4.5 + k * 1.5, info: I.bracket, parent: pcbG });
    // 16-pin
    box(1.9, 0.75, 0.75, 0x141518, { x: 8, y: T, z: -5.45, info: I.power, parent: pcbG });
    pcbG.add(label('GPU 芯片', gx, 1.1, 0));
    pcbG.add(label('显存 ×16', gx, 0.8, -3.6));
    pcbG.add(label('供电 VRM', 8.6, 1.2, 0));
    pcbG.add(label('PCIe 金手指', -6, 0.5, 5.8));
    pcbG.add(label('16-pin 供电', 8, 1.3, -5.5));
    pcbG.add(label('显示接口', -L / 2 - 0.2, 4.1, 0));

    // ---- 导热层 ----
    const thermal = group(root, 0, 0.53, 0);
    box(2.4, 0.03, 2.9, 0xc9ccd3, { x: gx, y: 0.1, rough: 0.9, info: I.paste, parent: thermal });
    const padM = { rough: 0.9, info: I.pad, parent: thermal };
    for (const z of [-3.55, 3.55]) box(8.2, 0.08, 1.3, 0x8fa4b8, { ...padM, x: gx, z });
    for (const x of [gx - 3.75, gx + 3.75]) box(1.3, 0.08, 4.6, 0x8fa4b8, { ...padM, x });
    for (const s of [-1, 1]) box(9.0, 0.08, 0.7, 0x8fa4b8, { ...padM, x: 8.6, z: s * 1.0 });

    // ---- 均热板 + 热管 ----
    const vcG = group(root, 0, 0.66, 0);
    box(9.2, 0.3, 9.2, COL.copper, { x: gx, rough: 0.28, metal: 0.95, info: I.vc, parent: vcG });
    box(9.6, 0.22, 6.0, 0x9aa0aa, { x: 8.6, y: 0.08, rough: 0.35, metal: 0.85, info: I.vrmPlate, parent: vcG });
    const pipeMat = mat(0xc58357, { rough: 0.25, metal: 0.95 });
    for (const z of [-3.2, -1.6, 0, 1.6, 3.2]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-14.2, 2.4, z),
        new THREE.Vector3(-13.2, 0.7, z),
        new THREE.Vector3(-10, 0.42, z),
        new THREE.Vector3(gx, 0.42, z),
        new THREE.Vector3(9, 0.42, z),
        new THREE.Vector3(13.2, 0.7, z),
        new THREE.Vector3(14.2, 2.4, z),
      ]);
      const p = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.22, 12, false), pipeMat);
      p.castShadow = true;
      p.userData.info = I.pipe;
      vcG.add(p);
    }
    vcG.add(label('均热板', gx, 0.9, 4.6));
    vcG.add(label('热管 ×5', 12.5, 2.0, 3.2));

    // ---- 鳍片 ----
    const finG = group(root, 0, 1.05, 0);
    const fins = new Batch({ rough: 0.35, metal: 0.85 });
    for (let k = 0; k < 112; k++) fins.add(-14.4 + k * 0.26, 0, 0, 0.05, 2.5, 11.4, 0xc3c7cf, I.fins);
    fins.build(finG);
    finG.add(label('散热鳍片 ×112', 0, 3.0, -5.7));

    // ---- 导风罩 + 风扇 ----
    const topG = group(root, 0, 3.65, 0);
    const shape = new THREE.Shape();
    const hw = 15.2;
    const hd = 6.2;
    const rc = 0.8;
    shape.moveTo(-hw + rc, -hd);
    shape.lineTo(hw - rc, -hd);
    shape.quadraticCurveTo(hw, -hd, hw, -hd + rc);
    shape.lineTo(hw, hd - rc);
    shape.quadraticCurveTo(hw, hd, hw - rc, hd);
    shape.lineTo(-hw + rc, hd);
    shape.quadraticCurveTo(-hw, hd, -hw, hd - rc);
    shape.lineTo(-hw, -hd + rc);
    shape.quadraticCurveTo(-hw, -hd, -hw + rc, -hd);
    const fanX = [-10, 0, 10];
    for (const fx of fanX) {
      const hole = new THREE.Path();
      hole.absarc(fx, 0, 4.6, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    }
    const shroudGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.35, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 2, curveSegments: 48 });
    shroudGeo.rotateX(-Math.PI / 2);
    const shroud = new THREE.Mesh(shroudGeo, mat(0x2b2d32, { rough: 0.38, metal: 0.65 }));
    shroud.castShadow = true;
    shroud.userData.info = I.shroud;
    topG.add(shroud);
    for (const s of [-1, 1]) box(30.4, 1.0, 0.12, 0x2b2d32, { y: -1.0, z: s * 6.15, rough: 0.4, metal: 0.6, info: I.shroud, parent: topG });
    const fans = [];
    const bladeMat = mat(0x1d1e22, { rough: 0.55, metal: 0.1 });
    fanX.forEach((fx, fi) => {
      const fan = group(topG, fx, 0.0, 0);
      fan.userData.info = I.fan;
      fan.userData.dir = fi === 1 ? -1 : 1;
      const hub = cyl(1.25, 1.25, 0.5, 0x232428, { y: -0.2, rough: 0.4, parent: fan });
      hub.userData.info = I.fan;
      cyl(0.8, 0.8, 0.02, 0x3a3d44, { y: 0.3, rough: 0.3, metal: 0.6, parent: fan });
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2;
        const pivot = group(fan, 0, 0.05, 0);
        pivot.rotation.y = a;
        const blade = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.05, 1.5), bladeMat);
        blade.position.set(2.75, 0, 0);
        blade.rotation.x = 0.5 * fan.userData.dir;
        blade.rotation.y = 0.18;
        blade.castShadow = true;
        pivot.add(blade);
      }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(4.45, 0.08, 8, 64), mat(0x3a3d44, { rough: 0.4, metal: 0.5 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.05;
      fan.add(ring);
      fans.push(fan);
    });
    topG.add(label('风扇 ×3', 10, 1.2, -4.8));

    // ---- 爆炸控制 ----
    const layers = [
      [pcbG, 0.25, 2.2],
      [thermal, 0.53, 3.9],
      [vcG, 0.66, 5.6],
      [finG, 1.05, 7.6],
      [topG, 3.65, 10.6],
    ];
    let e = 1;
    const applyExplode = (v) => {
      e = v;
      layers.forEach(([g, base, dy]) => (g.position.y = base + dy * v));
    };
    applyExplode(1);
    const slider = ctx.ui.slider('爆炸程度', 0, 1, 0.01, 1, (v) => (v === 0 ? '组装' : Math.round(v * 100) + '%'), applyExplode);
    const animTo = (to) => {
      const from = e;
      tween(1.2, (t) => {
        applyExplode(from + (to - from) * t);
        slider.set(e);
      });
    };
    ctx.ui.buttons([
      { t: '拆开', onClick: () => animTo(1) },
      { t: '组装', onClick: () => animTo(0) },
      { t: '只看 PCB', onClick: () => { animTo(1); ctx.view([-2, 22, 14], [-1, 2, 0]); } },
    ]);

    return {
      root,
      view: { pos: [27, 27, 33], target: [0, 5.5, 0] },
      update(dt) {
        fans.forEach((f) => (f.rotation.y += dt * 3.2 * f.userData.dir));
      },
      body: `
        <p>显卡 = <b>GPU 芯片</b> + <b>显存</b> + <b>供电</b> + <b>散热</b> + <b>PCB 与接口</b>。真正做计算的只有中间那块指甲盖大小的芯片，其余部件都在为它“供血、供粮、降温”。</p>
        <h3>各部分的角色</h3>
        <ul>
          <li><b>GPU 芯片</b>：成千上万个小运算核心，负责算画面和 AI。</li>
          <li><b>显存（VRAM）</b>：GPU 专用的高速内存，围在芯片四周，走线越短越快。</li>
          <li><b>供电（VRM）</b>：把 12 V 变成约 1 V、数百安培的大电流。</li>
          <li><b>散热</b>：导热膏 → 均热板 → 热管 → 鳍片 → 风扇，一路把几百瓦热量送进空气。</li>
        </ul>
        <div class="card">
          <div class="card-title">同一颗 GPU，不同品牌为什么有差别？</div>
          显卡厂商（华硕、微星、技嘉等）拿到同一颗芯片后，自己设计 PCB、供电和散热：
          <ul style="margin:6px 0 0">
            <li>散热更大 → 温度更低 → <b>加速频率维持得更久</b></li>
            <li>功耗墙（TBP）设得更高 → 高负载时频率更高</li>
            <li>供电相数与用料 → 稳定性和超频空间</li>
          </ul>
          <div class="muted" style="margin-top:6px">桌面卡之间通常只差几个百分点，噪音和温度差距反而更明显。笔记本显卡差距大得多：同名型号的功耗可以相差好几倍，笔记本 RTX 5090 甚至用的是更小的 GB203 芯片。</div>
        </div>
        <p class="muted">拖动滑块拆开 / 组装；点击中间的 GPU 芯片进入它的内部。</p>`,
      legend: [
        [0x30343c, 'GPU 芯片'],
        [COL.vram, '显存颗粒'],
        [0x6d7078, '供电电感'],
        [COL.copper, '均热板 / 热管'],
        [0xc3c7cf, '散热鳍片'],
        [COL.gold, 'PCIe 金手指'],
      ],
    };
  },
};
