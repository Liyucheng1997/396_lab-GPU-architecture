// 04 线程层级与存储层级
import { THREE, COL, group, Batch, label } from '../kit.js';

const MEM = {
  n: [
    { n: '寄存器', s: '256 KB / SM · 全卡约 42 MB', l: '≈ 1 周期', c: COL.reg, d: '每个线程私有的变量。整卡寄存器总量比 L1 还大，因为要同时容纳十几万个线程的上下文。' },
    { n: 'L1 / 共享内存', s: '128 KB / SM', l: '≈ 30 周期', c: COL.cache, d: 'SM 内共享。共享内存由程序员显式管理，线程块内的线程用它交换数据。' },
    { n: 'L2 缓存', s: '96 MB（RTX 5090）', l: '≈ 数百周期', c: COL.l2, d: '全芯片共享。Ada / Blackwell 把 L2 做得很大，用来减少对显存的访问。' },
    { n: '显存 GDDR7', s: '32 GB · 1792 GB/s', l: '≈ 数百纳秒', c: 0x3a3d44, d: '容量最大、带宽最高，但距离最远、延迟最高。512-bit × 28 Gbps ÷ 8 = 1792 GB/s。' },
    { n: '系统内存（经 PCIe）', s: 'PCIe 5.0 x16 · ≈ 64 GB/s', l: '≈ 微秒级', c: COL.io, d: '显存放不下时要从内存搬数据，带宽只有显存的几十分之一——这就是“爆显存”后帧数暴跌的原因。' },
  ],
  a: [
    { n: 'VGPR / SGPR 寄存器', s: '每 SIMD 一份', l: '≈ 1 周期', c: COL.reg, d: '向量寄存器每条通道私有；标量寄存器整个 wavefront 共享。' },
    { n: 'L0 缓存 + LDS', s: 'LDS 128 KB / WGP', l: '≈ 数十周期', c: COL.cache, d: 'L0 是每个 CU 的第一级缓存；LDS 由程序员显式管理，相当于共享内存。' },
    { n: 'L2 缓存', s: '8 MB（RX 9070 XT）', l: '≈ 数百周期', c: COL.l2, d: '全芯片共享的二级缓存。' },
    { n: 'Infinity Cache（L3）', s: '64 MB', l: '介于 L2 与显存之间', c: COL.ic, d: 'AMD 的特色：在 L2 和显存之间再加一层大缓存。命中时不必访问显存，让 256-bit 的显存也能获得远超 640 GB/s 的“有效带宽”。' },
    { n: '显存 GDDR6', s: '16 GB · 640 GB/s', l: '≈ 数百纳秒', c: 0x3a3d44, d: '256-bit × 20 Gbps ÷ 8 = 640 GB/s。' },
    { n: '系统内存（经 PCIe）', s: 'PCIe 5.0 x16 · ≈ 64 GB/s', l: '≈ 微秒级', c: COL.io, d: '显存不够时才会用到，非常慢。' },
  ],
};

export default {
  id: 'hierarchy',
  group: '基础',
  title: '线程与存储的层级',
  build(ctx) {
    const root = new THREE.Group();

    // ---------- 线程层级（前排） ----------
    const tz = 7.5;
    const tb = new Batch({ rough: 0.45 });
    const thInfo = { t: '线程 Thread', d: '执行一次着色程序的最小单位，比如“算一个像素”。每个线程跑在一条核心通道上，有自己的寄存器。' };
    tb.add(-13, 0, tz, 0.5, 0.5, 0.5, COL.fp32, thInfo);
    const warpInfo = { t: 'Warp（NVIDIA）/ Wavefront（AMD）', d: '32 个线程绑成一组，同一时刻执行同一条指令（AMD 也支持 64 线程的 wave64）。如果组内线程走了 if/else 的不同分支，两边要依次执行，效率减半——这叫“分支发散”。' };
    for (let k = 0; k < 32; k++) tb.add(-8.2 + (k % 8) * 0.48, 0, tz - 0.8 + Math.floor(k / 8) * 0.52, 0.38, 0.38, 0.38, COL.fp32, warpInfo);
    const blkInfo = { t: '线程块 Block（N）/ 工作组 Workgroup（A）', d: '若干个 warp 组成一个线程块，整块被分配到同一个 SM / WGP 上，可以通过共享内存（LDS）交换数据、互相同步。这里画的是 8 个 warp = 256 个线程。' };
    for (let k = 0; k < 256; k++) {
      const w = Math.floor(k / 32);
      tb.add(-0.2 + (k % 16) * 0.24, 0, tz - 1.9 + Math.floor(k / 16) * 0.24, 0.19, 0.19 + (w % 2) * 0.06, 0.19, w % 2 ? COL.fp32 : COL.int32, blkInfo);
    }
    const gridInfo = { t: '网格 Grid（一次内核启动）', d: '一次绘制或计算任务会派发成千上万个线程块，GigaThread 引擎（N）/ 命令处理器（A）把它们分发到全芯片所有 SM / WGP 上。' };
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) tb.add(7.8 + c * 1.75, 0, tz - 1.75 + r * 1.75, 1.5, 0.3, 1.5, (r + c) % 2 ? COL.fp32 : COL.int32, gridInfo);
    tb.build(root);
    label('线程<small>1</small>', -13, 0.9, tz + 0.6, { parent: root });
    label('Warp / Wavefront<small>32 线程</small>', -6.5, 0.9, tz + 1.4, { parent: root });
    label('线程块 / 工作组<small>→ 1 个 SM / WGP</small>', 1.6, 0.9, tz + 2.4, { parent: root });
    label('网格<small>→ 整颗 GPU</small>', 10.4, 0.9, tz + 2.4, { parent: root });
    const arrows = new Batch({ rough: 0.6 });
    for (const x of [-11, -3.0, 5.6]) arrows.add(x, 0, tz, 1.1, 0.06, 0.12, 0x8e8e93, null);
    arrows.build(root);

    // ---------- 存储金字塔（后排） ----------
    let pyr = null;
    let packets = [];
    let layers = [];
    function buildPyramid(v) {
      if (pyr) {
        pyr.traverse((o) => {
          if (o.isCSS2DObject && o.element.parentNode) o.element.parentNode.removeChild(o.element);
          if (o.isInstancedMesh) o.material.dispose();
        });
        root.remove(pyr);
      }
      pyr = group(root, 0, 0, -3.5);
      const list = MEM[v];
      const n = list.length;
      const b = new Batch({ rough: 0.5 });
      layers = [];
      let y = 0;
      for (let k = n - 1; k >= 0; k--) {
        const m = list[k];
        const w = 3 + (k / (n - 1)) * 13;
        const d = 2 + (k / (n - 1)) * 5.5;
        b.add(0, y, 0, w, 0.9, d, m.c, { t: m.n, d: m.d, kv: [['容量', m.s], ['延迟', m.l]] });
        label(`${m.n}<small>${m.s} · ${m.l}</small>`, w / 2 + 0.4, y + 0.75, d / 2, { parent: pyr });
        layers.unshift({ y: y + 0.45, w, d });
        y += 1.05;
      }
      label(v === 'n' ? 'NVIDIA · RTX 5090' : 'AMD · RX 9070 XT', 0, y + 0.9, 0, { cls: 'big', parent: pyr });
      // 数据小方块：越靠上越快
      packets = [];
      for (let k = 0; k < 14; k++) packets.push({ i: b.add(0, 0, 0, 0.26, 0.26, 0.26, 0xffd60a, null), u: k / 14, lane: (k % 7) - 3 });
      b.build(pyr);
      pyr.userData.b = b;
      pyr.userData.top = y;
    }
    let vendor = 'n';
    buildPyramid(vendor);
    ctx.ui.seg('存储层级', [{ v: 'n', t: 'NVIDIA Blackwell' }, { v: 'a', t: 'AMD RDNA 4' }], vendor, (v) => {
      vendor = v;
      buildPyramid(v);
    });

    return {
      root,
      view: { pos: [3, 19, 35], target: [0, 2.4, 1] },
      update(dt) {
        const b = pyr.userData.b;
        const top = pyr.userData.top;
        packets.forEach((p) => {
          // 底层慢、顶层快：速度随高度增加
          const speed = 0.08 + 0.5 * p.u * p.u;
          p.u += dt * speed;
          if (p.u > 1) p.u = 0;
          const y = p.u * (top - 0.4);
          b.move(p.i, { x: p.lane * 0.32, y, z: layers[layers.length - 1].d / 2 + 0.4 - p.u * (layers[layers.length - 1].d / 2 - 0.8) });
        });
      },
      body: `
        <h3 style="margin-top:0">线程是怎么组织的</h3>
        <p>写 GPU 程序时你只描述“一个线程做什么”，然后一次启动几十万个。硬件把它们层层打包：</p>
        <ul>
          <li><b>线程</b> → 一条核心通道</li>
          <li><b>Warp / Wavefront</b>（32 个）→ 一个调度器，一起执行同一条指令</li>
          <li><b>线程块 / 工作组</b> → 一个 SM / WGP，可共享内存</li>
          <li><b>网格</b> → 整颗 GPU</li>
        </ul>
        <h3>存储为什么要分层</h3>
        <p>越靠近核心的存储越快、越小、越贵。一次显存访问的时间够核心做几百次运算，所以 GPU 的性能很大程度上取决于<b>数据能不能留在上层</b>。</p>
        <div class="card">
          <div class="card-title">两家的思路不同</div>
          NVIDIA 从 Ada 开始把 <b>L2 做到几十上百 MB</b>；AMD 从 RDNA 2 开始在 L2 和显存之间加了一层 <b>Infinity Cache</b>。目的相同：拦住尽量多的显存访问，让较窄的显存位宽也够用。切换上面的按钮对比两边的层级。
        </div>
        <p class="muted">延迟为数量级示意，不同型号、不同频率下会有差异。</p>`,
      legend: [
        [COL.reg, '寄存器'],
        [COL.cache, 'L0 / L1 / LDS'],
        [COL.l2, 'L2'],
        [COL.ic, 'Infinity Cache'],
        [0x3a3d44, '显存'],
        [COL.io, 'PCIe / 内存'],
      ],
    };
  },
};
