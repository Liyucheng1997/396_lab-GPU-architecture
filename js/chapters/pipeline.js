// 03 一帧画面是怎么画出来的：图形渲染管线
import { THREE, COL, mat, box, group, Batch, label } from '../kit.js';

const G = 12; // 光栅网格 12×12
const triA = [[1.5, 1.0], [11.0, 3.5], [4.0, 11.2]];
const triB = [[6.5, 0.4], [11.6, 10.5], [1.0, 8.0]];
const colA = [new THREE.Color(0xff5a5a), new THREE.Color(0x45c97a), new THREE.Color(0x4a8dff)];
const colB = new THREE.Color(0xf5a524);

function bary(p, t) {
  const [a, b, c] = t;
  const d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
  const l1 = ((b[1] - c[1]) * (p[0] - c[0]) + (c[0] - b[0]) * (p[1] - c[1])) / d;
  const l2 = ((c[1] - a[1]) * (p[0] - c[0]) + (a[0] - c[0]) * (p[1] - c[1])) / d;
  return [l1, l2, 1 - l1 - l2];
}
const inside = (w) => w[0] >= 0 && w[1] >= 0 && w[2] >= 0;
const shadeA = (w) =>
  new THREE.Color(
    colA[0].r * w[0] + colA[1].r * w[1] + colA[2].r * w[2],
    colA[0].g * w[0] + colA[1].g * w[1] + colA[2].g * w[2],
    colA[0].b * w[0] + colA[1].b * w[1] + colA[2].b * w[2]
  );

const ST = [
  { t: '① 输入装配', hw: 'PolyMorph（N）<br>几何处理器（A）', info: { t: '输入装配 Input Assembly', d: '从显存读取模型的顶点数据（位置、法线、UV），按索引把它们组装成三角形。一个游戏角色往往有几万到几十万个顶点。' } },
  { t: '② 顶点着色', hw: 'SM / CU<br>着色器核心', info: { t: '顶点着色器 Vertex Shader', d: '对每个顶点运行一段小程序：乘以“模型→世界→相机→屏幕”的矩阵，算出它落在屏幕上的位置。每个顶点互相独立，几万个顶点并行算。' } },
  { t: '③ 光栅化', hw: '光栅引擎（N）<br>光栅器（A）', info: { t: '光栅化 Rasterization', d: '固定功能硬件：判断每个三角形覆盖了屏幕上哪些像素，生成“片段”（fragment），并插值出每个片段的深度、UV 等属性。' } },
  { t: '④ 像素着色', hw: 'SM / CU 着色器核心<br>+ 纹理单元', info: { t: '像素着色器 Pixel / Fragment Shader', d: '对每个片段运行着色程序：采样贴图、计算光照、阴影、材质……这是最吃算力的阶段，4K 画面每帧 830 万个像素。' } },
  { t: '⑤ 深度测试与混合', hw: 'ROP（N）<br>渲染后端 RB（A）', info: { t: 'ROP：深度测试与混合', d: '比较片段深度，离相机更近的才留下；透明物体按 alpha 混合。最后把颜色写入帧缓冲。' } },
  { t: '⑥ 帧缓冲 → 显示器', hw: '显存<br>→ 显示引擎', info: { t: '帧缓冲与输出', d: '一整帧画完后，显示引擎把帧缓冲里的图像发往显示器。144 Hz 意味着这一整条流水线每秒要跑 144 遍。' } },
];

export default {
  id: 'pipeline',
  group: '基础',
  title: '一帧画面是怎么画出来的',
  build(ctx) {
    const root = new THREE.Group();
    const X = (i) => -16 + i * 6.4;
    const PL = 5.0;

    // 平台 + 轨道
    const base = new Batch({ rough: 0.5 });
    ST.forEach((s, i) => {
      base.add(X(i), 0, 0, PL, 0.3, PL, COL.frame, s.info);
      label(s.t, X(i), 0.35, PL / 2 + 0.3, { cls: 'big', parent: root });
      label(s.hw, X(i), -0.25, PL / 2 + 1.25, { cls: 'plain', parent: root });
    });
    base.add(0, 0, 1.9, 6.4 * 5 + 2, 0.32, 0.25, 0x5a5e68, { t: '数据流', d: '顶点 → 三角形 → 片段 → 像素，一级一级往下传。各阶段同时在处理不同的数据，像工厂流水线。' });
    base.build(root);

    // ① 顶点点云
    const ico = new THREE.IcosahedronGeometry(1.5, 1);
    const pos = ico.getAttribute('position');
    const seen = new Set();
    const verts = [];
    for (let k = 0; k < pos.count; k++) {
      const key = [pos.getX(k), pos.getY(k), pos.getZ(k)].map((v) => v.toFixed(3)).join();
      if (!seen.has(key)) {
        seen.add(key);
        verts.push(new THREE.Vector3(pos.getX(k), pos.getY(k), pos.getZ(k)));
      }
    }
    const s1 = group(root, X(0), 2.5, -0.4);
    const vb = new Batch({ rough: 0.4 });
    verts.forEach((v) => vb.add(v.x, v.y - 0.08, v.z, 0.16, 0.16, 0.16, COL.fp32, { t: '顶点', d: '只有位置等属性的一个点。顶点之间靠索引连成三角形。' }));
    vb.build(s1);

    // ② 线框 + 变换
    const s2 = group(root, X(1), 2.5, -0.4);
    const wire = new THREE.LineSegments(new THREE.WireframeGeometry(ico), new THREE.LineBasicMaterial({ color: 0x3d8bfd }));
    s2.add(wire);
    const solid = new THREE.Mesh(ico, mat(0x8b6cf0, { rough: 0.5, opacity: 0.25 }));
    solid.userData.info = ST[1].info;
    s2.add(solid);

    // ③④⑤ 网格
    const P = 0.32;
    const gridAt = (i, colorFn, zOff = 0, info) => {
      const b = new Batch({ rough: 0.6 });
      for (let gy = 0; gy < G; gy++) {
        for (let gx = 0; gx < G; gx++) {
          const p = [gx + 0.5, gy + 0.5];
          const c = colorFn(p);
          if (c === undefined) continue; // 透明格子：不画
          b.add(X(i) - (G * P) / 2 + P * (gx + 0.5), 0.7 + gy * P, -0.6 + zOff, 0.28, 0.28, 0.05, c ?? 0x2f3238, info);
        }
      }
      b.build(root);
      return b;
    };
    gridAt(2, (p) => (inside(bary(p, triA)) ? COL.tex : null), 0, { t: '片段（被三角形覆盖的像素）', d: '像素中心落在三角形内部，就生成一个片段，交给像素着色器。' });
    const triLine = (tri, x, zz, color) => {
      const pts = tri.map(([u, v]) => new THREE.Vector3(x - (G * P) / 2 + u * P, 0.7 + v * P, zz));
      const g = new THREE.BufferGeometry().setFromPoints([...pts, pts[0]]);
      const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color, depthTest: false }));
      l.renderOrder = 5;
      root.add(l);
    };
    triLine(triA, X(2), -0.55, 0xffffff);
    gridAt(3, (p) => {
      const w = bary(p, triA);
      return inside(w) ? shadeA(w) : null;
    }, 0, { t: '着色后的片段', d: '每个片段按三个顶点颜色插值（真实游戏里还要采样贴图、算光照）。' });
    // ⑤ 两层：后面的三角形 B + 前面的三角形 A
    gridAt(4, (p) => (inside(bary(p, triB)) ? colB : null), -1.0, { t: '远处物体的片段（深度大）', d: '被近处物体挡住的部分会在深度测试中被丢弃。' });
    gridAt(4, (p) => {
      const w = bary(p, triA);
      return inside(w) ? shadeA(w) : undefined;
    }, 0.2, { t: '近处物体的片段（深度小）', d: '深度更小，通过深度测试，覆盖后面的颜色。' });
    // ⑥ 显示器
    const mon = group(root, X(5), 0.3, -0.6);
    box(4.6, 0.25, 1.2, 0x2a2c31, { y: 0, rough: 0.4, metal: 0.5, parent: mon });
    box(0.4, 0.8, 0.3, 0x2a2c31, { y: 0.2, rough: 0.4, metal: 0.5, parent: mon });
    box(4.6, 4.2, 0.18, 0x15161a, { y: 0.9, z: 0.0, rough: 0.3, metal: 0.4, info: ST[5].info, parent: mon });
    const fb = new Batch({ rough: 0.7 });
    const PP = 0.34;
    for (let gy = 0; gy < G; gy++) {
      for (let gx = 0; gx < G; gx++) {
        const p = [gx + 0.5, gy + 0.5];
        const wa = bary(p, triA);
        let c = new THREE.Color(0x101a2c);
        if (inside(bary(p, triB))) c = colB;
        if (inside(wa)) c = shadeA(wa);
        fb.add(-(G * PP) / 2 + PP * (gx + 0.5), 1.0 + gy * PP, 0.1, 0.33, 0.33, 0.02, c, { t: '帧缓冲中的像素', d: '最终画面。这张 12×12 的“图”只是示意，4K 是 3840×2160。' });
      }
    }
    fb.build(mon);

    // 光线追踪支线
    const rt = group(root, X(3), 0, -7.2);
    box(PL, 0.3, 4.2, COL.frame, { info: { t: '光线追踪（另一条路）', d: '不再“把三角形投到屏幕上”，而是从相机向每个像素发射光线，找它先撞到哪个三角形，再递归追踪反射、阴影光线。最难的是在几百万个三角形里快速找到交点。' }, parent: rt });
    const bvh = [
      [0, 2.3, 0, 4.0, 3.2, 3.0, 0x34c46e],
      [-1.0, 1.6, 0, 1.7, 1.5, 2.4, 0x34c46e],
      [1.0, 2.6, 0, 1.7, 1.6, 2.4, 0x34c46e],
      [-1.4, 1.3, -0.4, 0.7, 0.7, 0.9, 0x8fe3b0],
      [-0.6, 1.9, 0.4, 0.7, 0.7, 0.9, 0x8fe3b0],
      [1.3, 2.9, 0.3, 0.7, 0.7, 0.9, 0x8fe3b0],
    ];
    bvh.forEach(([x, y, z, w, hh, d, c]) => {
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, hh, d)), new THREE.LineBasicMaterial({ color: c }));
      e.position.set(x, y + 0.3, z);
      rt.add(e);
    });
    const tri = box(0.5, 0.5, 0.5, 0xffffff, { x: 1.3, y: 2.95, z: 0.3, info: { t: '命中的三角形', d: 'RT Core / 光线加速器用硬件完成“光线 × 包围盒”和“光线 × 三角形”测试。' }, parent: rt });
    void tri;
    const rayGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-2.8, 4.8, 1.5), new THREE.Vector3(1.3, 3.2, 0.3)]);
    rt.add(new THREE.Line(rayGeo, new THREE.LineBasicMaterial({ color: 0xffd60a })));
    label('光线追踪：BVH 包围盒树', 0, 4.9, 0, { parent: rt });
    label('RT Core（N）/ 光线加速器（A）', 0, 0.35, 2.4, { cls: 'plain', parent: rt });

    // 流动的数据包
    const flow = new Batch({ rough: 0.4 });
    const packets = [];
    for (let k = 0; k < 26; k++) {
      packets.push({ i: flow.add(0, 0.32, 1.9, 0.26, 0.26, 0.26, COL.fp32, null), u: k / 26 });
    }
    flow.build(root);
    const segColor = [COL.fp32, COL.tensor, COL.tex, 0xff7a7a, 0x45c97a];
    const x0 = X(0);
    const x1 = X(5);

    return {
      root,
      view: { pos: [0, 18, 42], target: [0, 1.4, -2] },
      update(dt, t) {
        s1.rotation.y = t * 0.4;
        s2.rotation.y = t * 0.4;
        s2.rotation.x = Math.sin(t * 0.6) * 0.25;
        packets.forEach((p) => {
          p.u = (p.u + dt * 0.06) % 1;
          const x = x0 + (x1 - x0) * p.u;
          const seg = Math.min(4, Math.floor(p.u * 5));
          flow.move(p.i, { x });
          flow.color(p.i, segColor[seg]);
        });
      },
      body: `
        <p>游戏每一帧画面，都要经过一条叫做<b>渲染管线</b>的流水线。3D 模型由许多三角形组成，GPU 要把它们“压”成屏幕上的像素。</p>
        <ol style="padding-left:18px;margin:0 0 12px">
          <li><b>输入装配</b>：读取顶点，拼成三角形。</li>
          <li><b>顶点着色</b>：每个顶点乘矩阵，算出在屏幕上的位置。</li>
          <li><b>光栅化</b>：找出三角形盖住了哪些像素。</li>
          <li><b>像素着色</b>：给每个像素算颜色——贴图、光照、阴影。</li>
          <li><b>深度测试与混合</b>：近的挡住远的，写进帧缓冲。</li>
          <li><b>显示</b>：整帧送往显示器。</li>
        </ol>
        <div class="card">
          <div class="card-title">统一着色器</div>
          ②和④在同一批 CUDA 核心 / 流处理器上运行——硬件不分“顶点核”和“像素核”，哪里活多就去哪里。而③⑤是<b>固定功能硬件</b>，只做一件事，但效率极高。
        </div>
        <h3>光线追踪与 AI</h3>
        <p>现代 GPU 在这条管线旁又加了两条支线：<b>光线追踪</b>（RT Core / 光线加速器负责在 BVH 包围盒树里找交点）和 <b>AI 超分辨率 / 帧生成</b>（Tensor Core / AI 加速器）。DLSS、FSR 4 先用较低分辨率渲染，再用神经网络放大，这就是为什么开了它们帧数能翻几倍。</p>`,
      legend: [
        [COL.fp32, '顶点'],
        [COL.tensor, '三角形'],
        [COL.tex, '片段'],
        [COL.rt, 'BVH 包围盒'],
      ],
    };
  },
};
