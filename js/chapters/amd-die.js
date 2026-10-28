// 07 AMD RDNA 4 Navi 48 整颗芯片
import { THREE, COL } from '../kit.js';
import { buildAmdDie, DIES } from '../chips.js';

export default {
  id: 'amd-die',
  group: 'AMD RDNA',
  vendor: 'a',
  title: 'Navi 48 整颗芯片',
  build(ctx) {
    const root = new THREE.Group();
    const die = buildAmdDie(root, DIES.NAVI48);
    const full = { pos: [0, 24, 21], target: [0, 0, 1] };
    const se0 = die.ses[0];
    const seView = { pos: [se0.x + 2.5, 8, se0.z + 8], target: [se0.x, 0.4, se0.z] };
    const w0 = se0.wgps[1];
    const wView = { pos: [w0.x + 0.8, 3.4, w0.z + 3.4], target: [w0.x, 0.5, w0.z] };
    die.ses.forEach((s) => {
      const info = die.batch.items[s.frame].info;
      info.onClick = () => ctx.view([s.x + 2.5, 8, s.z + 8], [s.x, 0.4, s.z]);
      info.clickText = '点击放大这个着色器引擎 →';
    });
    ctx.ui.seg(
      '观察层级',
      [
        { v: 'die', t: '整颗芯片' },
        { v: 'se', t: '一个 SE' },
        { v: 'wgp', t: '一个 WGP' },
      ],
      'die',
      (v) => {
        const vw = v === 'die' ? full : v === 'se' ? seView : wView;
        ctx.view(vw.pos, vw.target);
      }
    );

    return {
      root,
      view: full,
      body: `
        <p>RX 9070 XT / 9070 的核心 <b>Navi 48</b>，基于 RDNA 4 架构。它的面积不到 GB202 的一半——两章的模型使用相同比例尺，可以直接对比大小。</p>
        <div class="card formula">
          1 颗芯片 = 4 个着色器引擎（SE）<br>
          1 个 SE = 8 个 WGP + 图元单元 + 光栅器 + 渲染后端<br>
          1 个 WGP = 2 个 CU<br>
          1 个 CU = 64 个流处理器<br>
          ⇒ 4 × 8 × 2 × 64 = <b>4,096</b> 个流处理器
        </div>
        <h3>和 NVIDIA 的对应关系</h3>
        <table class="tbl">
          <tr><th>AMD</th><th>NVIDIA</th></tr>
          <tr><td>着色器引擎 SE</td><td>GPC</td></tr>
          <tr><td>WGP（2 个 CU）</td><td>SM</td></tr>
          <tr><td>流处理器</td><td>CUDA 核心</td></tr>
          <tr><td>Infinity Cache</td><td>（无对应，NVIDIA 用大 L2）</td></tr>
        </table>
        <h3>Infinity Cache：用缓存换位宽</h3>
        <p>两侧灰色的 <b>64 MB Infinity Cache</b> 是 AMD 的特色。Navi 48 的显存只有 256-bit GDDR6（640 GB/s），远少于 RTX 5090 的 1792 GB/s，但大部分访问在 Infinity Cache 里就命中了，不必去显存。更窄的位宽意味着更少的显存颗粒、更简单的 PCB，成本更低。</p>
        <table class="tbl">
          <tr><td>晶体管</td><td class="num">约 539 亿</td></tr>
          <tr><td>面积</td><td class="num">约 357 mm²</td></tr>
          <tr><td>工艺</td><td class="num">TSMC N4P</td></tr>
          <tr><td>光线加速器 / AI 加速器</td><td class="num">64 / 128</td></tr>
          <tr><td>L2 / Infinity Cache</td><td class="num">8 MB / 64 MB</td></tr>
        </table>
        <p class="muted" style="margin-top:10px">布局为按真实结构组织的示意图。点击着色器引擎外框放大，点击任意 CU 进入 WGP 内部。</p>`,
      legend: [
        [COL.fp32, '流处理器（SIMD32）'],
        [COL.tensor, 'AI 加速器'],
        [COL.rt, '光线加速器'],
        [COL.cache, 'L0 / LDS'],
        [COL.l2, 'L2 缓存'],
        [COL.ic, 'Infinity Cache'],
        [COL.sched, '命令处理器'],
        [COL.tex, '图元 / 光栅'],
        [COL.phy, '显存控制器'],
      ],
    };
  },
};
