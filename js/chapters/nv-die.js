// 05 NVIDIA Blackwell GB202 整颗芯片
import { THREE, COL } from '../kit.js';
import { buildNvDie, DIES } from '../chips.js';

export default {
  id: 'nv-die',
  group: 'NVIDIA Blackwell',
  vendor: 'n',
  title: 'GB202 整颗芯片',
  build(ctx) {
    const root = new THREE.Group();
    const die = buildNvDie(root, DIES.GB202);
    const full = { pos: [0, 30, 26], target: [0, 0, 1] };
    const gpc0 = die.gpcs[1];
    const gpcView = { pos: [gpc0.x + 3, 9, gpc0.z + 9], target: [gpc0.x, 0.4, gpc0.z] };
    const tpc0 = gpc0.tpcs[2];
    const tpcView = { pos: [tpc0.x + 0.8, 3.4, tpc0.z + 3.4], target: [tpc0.x, 0.5, tpc0.z] };

    // 点击 GPC 外框：镜头飞过去
    die.gpcs.forEach((g) => {
      const info = die.batch.items[g.frame].info;
      info.onClick = () => ctx.view([g.x + 3, 9, g.z + 9], [g.x, 0.4, g.z]);
      info.clickText = '点击放大这个 GPC →';
    });

    ctx.ui.seg(
      '观察层级',
      [
        { v: 'die', t: '整颗芯片' },
        { v: 'gpc', t: '一个 GPC' },
        { v: 'tpc', t: '一个 TPC' },
      ],
      'die',
      (v) => {
        const vw = v === 'die' ? full : v === 'gpc' ? gpcView : tpcView;
        ctx.view(vw.pos, vw.target);
      }
    );

    return {
      root,
      view: full,
      body: `
        <p>RTX 5090 的心脏 <b>GB202</b>，是 NVIDIA 消费级最大的芯片。它像一座城市，按层级组织：</p>
        <div class="card formula">
          1 颗芯片 = 12 个 GPC<br>
          1 个 GPC = 8 个 TPC + 光栅引擎 + ROP<br>
          1 个 TPC = 2 个 SM + PolyMorph 引擎<br>
          1 个 SM = 128 个 CUDA 核心<br>
          ⇒ 12 × 8 × 2 × 128 = <b>24,576</b> 个 CUDA 核心
        </div>
        <h3>芯片上的“城区”</h3>
        <ul>
          <li><b>GPC</b>（图形处理簇）：每个都是能独立完成光栅化的“迷你 GPU”。</li>
          <li><b>L2 缓存</b>（中间横带）：128 MB，全芯片共享。</li>
          <li><b>GigaThread 引擎</b>：总调度，把任务分发给各个 SM。</li>
          <li><b>显存控制器</b>（上下边缘）：16 个 × 32-bit = 512-bit。</li>
          <li><b>I/O</b>（左右两侧）：PCIe 5.0、显示输出、视频编解码。</li>
        </ul>
        <div class="card">
          <div class="card-title">RTX 5090 并没有用满这颗芯片</div>
          完整 GB202 有 192 个 SM，RTX 5090 只开启 <b>170 个</b>（21,760 核心），L2 也只开 96 MB。因为在这么大的芯片上，几乎每颗都有一些瑕疵——下一阶段的“晶圆与良率”会讲为什么。
        </div>
        <table class="tbl">
          <tr><td>晶体管</td><td class="num">约 922 亿</td></tr>
          <tr><td>面积</td><td class="num">约 750 mm²</td></tr>
          <tr><td>工艺</td><td class="num">TSMC 4N</td></tr>
          <tr><td>Tensor Core / RT Core</td><td class="num">768 / 192</td></tr>
          <tr><td>ROP</td><td class="num">192</td></tr>
        </table>
        <p class="muted" style="margin-top:10px">布局为按真实结构组织的示意图，不是芯片显微照片的精确复刻。点击 GPC 外框放大，点击任意 SM 进入它的内部。</p>`,
      legend: [
        [COL.fp32, 'CUDA 核心（SM 分区）'],
        [COL.tensor, 'Tensor Core'],
        [COL.rt, 'RT Core'],
        [COL.cache, 'L1 / 共享内存'],
        [COL.l2, 'L2 缓存'],
        [COL.sched, 'GigaThread 调度'],
        [COL.tex, '光栅引擎'],
        [COL.phy, '显存控制器'],
        [COL.io, 'PCIe / 显示 / 媒体'],
      ],
    };
  },
};
