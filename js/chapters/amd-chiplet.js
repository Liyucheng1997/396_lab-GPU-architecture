// 09 RDNA 3 Navi 31：GCD + 6 个 MCD 的 Chiplet 封装
import { THREE, COL, box, group, Batch, label, tween, rng } from '../kit.js';
import { buildAmdDie, setPartsEnabled } from '../chips.js';

const SKUS = {
  xtx: { name: 'RX 7900 XTX', cu: 96, mcd: 6, mem: 24, bus: 384, ic: 96, gbps: 20, tbp: 355, boost: 2.5 },
  xt: { name: 'RX 7900 XT', cu: 84, mcd: 5, mem: 20, bus: 320, ic: 80, gbps: 20, tbp: 315, boost: 2.4 },
  gre: { name: 'RX 7900 GRE', cu: 80, mcd: 4, mem: 16, bus: 256, ic: 64, gbps: 18, tbp: 260, boost: 2.245 },
};

export default {
  id: 'amd-chiplet',
  group: 'AMD RDNA',
  vendor: 'a',
  title: 'Navi 31：小芯片（Chiplet）拼装',
  build(ctx) {
    const root = new THREE.Group();
    box(60, 0.2, 34, COL.pcb, { rough: 0.7, info: { t: 'PCB', d: '显卡电路板。' }, parent: root });
    box(44, 0.4, 22, COL.substrate, { y: 0.2, rough: 0.6, info: { t: '封装基板', d: 'GCD 与 6 颗 MCD 并排放在同一块有机基板上，通过高密度扇出布线（Infinity Fanout）互连。' }, parent: root });

    // GCD
    const gcdG = group(root, 0, 0.6, 0);
    const gcd = buildAmdDie(gcdG, { name: 'Navi 31 GCD', se: 6, wgp: 8, l2MB: 6, chiplet: true, node: 'TSMC N5', area: 304 }, { labels: true });
    gcdG.scale.set(0.8, 1, 0.8);
    const gcdHalfW = (gcd.W * 0.8) / 2;

    // MCD × 6
    const mcdB = new Batch({ rough: 0.45 });
    const mcds = [];
    const vramB = new Batch({ rough: 0.55 });
    const vrams = [];
    const traceB = new Batch({ rough: 0.3, metal: 0.8 });
    const mcdInfo = { t: 'MCD 内存缓存芯粒', d: 'Memory Cache Die：每颗 37.5 mm²（TSMC N6），装着 16 MB Infinity Cache 和 2 个 32-bit GDDR6 控制器。缓存和模拟 PHY 在新工艺上几乎不缩小，放在便宜的 N6 上更划算。', kv: [['Infinity Cache', '16 MB'], ['显存位宽', '64-bit'], ['工艺', 'TSMC N6']] };
    let n = 0;
    for (const s of [-1, 1]) {
      for (const z of [-5.4, 0, 5.4]) {
        const id = ++n;
        const x = s * (gcdHalfW + 0.6 + 3.75);
        const g = group(root, 0, 0, 0);
        const info = { ...mcdInfo, t: `MCD #${id} 内存缓存芯粒` };
        const parts = [mcdB.add(x, 0.6, z, 7.5, 0.4, 5.0, COL.die, info)];
        parts.push(mcdB.add(x - s * 3.25, 1.0, z, 0.7, 0.3, 4.4, COL.io, { t: 'Infinity Fanout 链路', d: 'MCD 与 GCD 之间的高速通道，每条约 900 GB/s。' }));
        parts.push(mcdB.add(x - s * 0.55, 1.0, z, 4.4, 0.4, 4.4, COL.ic, { t: 'Infinity Cache 16 MB', d: '6 颗 MCD 合计 96 MB。' }));
        parts.push(mcdB.add(x + s * 2.65, 1.0, z - 1.15, 1.5, 0.25, 2.0, COL.phy, { t: 'GDDR6 PHY（32-bit）', d: '连接一颗显存颗粒。' }));
        parts.push(mcdB.add(x + s * 2.65, 1.0, z + 1.15, 1.5, 0.25, 2.0, COL.phy, { t: 'GDDR6 PHY（32-bit）', d: '连接一颗显存颗粒。' }));
        const chips = [];
        for (const k of [0, 1]) {
          const cx = s * (23.6 + k * 2.0);
          chips.push(vramB.add(cx, 0.2, z, 1.4, 0.14, 1.2, COL.vram, { t: `GDDR6 显存（MCD #${id}）`, d: '每颗 2 GB、32-bit。每颗 MCD 带 2 颗，6 颗 MCD 共 12 颗 = 24 GB / 384-bit。' }));
          const x0 = gcdHalfW + 0.6 + 7.5;
          const len = 23.6 + k * 2.0 - 0.7 - x0;
          traceB.add(s * (x0 + len / 2), 0.2, z + (k ? 0.35 : -0.35), len, 0.02, 0.12, COL.gold, null);
        }
        mcds.push({ id, x, z, s, parts, chips, g });
        vrams.push(chips);
      }
    }
    const mcdMesh = mcdB.build(root);
    vramB.build(root);
    traceB.build(root);

    // 扇出链路：发光条
    const linkMat = new THREE.MeshStandardMaterial({ color: 0x0a84ff, emissive: 0x0a84ff, emissiveIntensity: 0.8, roughness: 0.4 });
    const links = mcds.map((m) => {
      const len = 1.4;
      const l = box(len, 0.08, 3.4, 0, { x: m.s * (gcdHalfW + 0.15 + len / 2 - 0.5), y: 0.6, z: m.z, material: linkMat, parent: root });
      l.userData.info = { t: 'Infinity Fanout 链路', d: '基板里的超高密度布线，把 GCD 与每颗 MCD 连起来。6 条合计峰值带宽约 5.3 TB/s。' };
      return l;
    });

    label('MCD × 6<small>每颗 16 MB + 64-bit</small>', mcds[0].x, 2.0, -9.0, { parent: root });
    label('GDDR6 × 12', 24.6, 1.0, -7.5, { parent: root });

    // ---- 型号切换 ----
    const r = rng(31);
    const order = gcd.wgps.map((_, i) => i).sort(() => r() - 0.5);
    let stats = null;
    let sku = 'xtx';
    function apply(key, t = 1) {
      const s = SKUS[key];
      const offW = (96 - s.cu) / 2;
      const offSet = new Set(order.slice(0, offW));
      gcd.wgps.forEach((w, i) => setPartsEnabled(gcd.batch, w.parts, !offSet.has(i), t));
      mcds.forEach((m, i) => {
        const enabled = s.mcd === 6 ? true : s.mcd === 5 ? i !== 5 : i !== 2 && i !== 5;
        setPartsEnabled(mcdB, m.parts, enabled, t);
        m.chips.forEach((c) => (enabled ? vramB.restore(c) : vramB.color(c, 0x55585f)));
        links[i].visible = enabled;
      });
      if (t >= 1 && stats) {
        const bw = (s.bus / 8) * s.gbps;
        stats.innerHTML = `<div class="card"><table class="tbl">
          <tr><td>计算单元</td><td class="num">${s.cu} CU · ${(s.cu * 64).toLocaleString()} 流处理器</td></tr>
          <tr><td>启用 MCD</td><td class="num">${s.mcd} / 6</td></tr>
          <tr><td>Infinity Cache</td><td class="num">${s.ic} MB</td></tr>
          <tr><td>显存</td><td class="num">${s.mem} GB · ${s.bus}-bit · ${s.gbps} Gbps</td></tr>
          <tr><td>显存带宽</td><td class="num">${bw} GB/s</td></tr>
          <tr><td>加速频率</td><td class="num">${s.boost} GHz</td></tr>
          <tr><td>整卡功耗</td><td class="num">${s.tbp} W</td></tr>
        </table></div>`;
      }
    }
    ctx.ui.seg('同一颗 Navi 31，不同型号', Object.entries(SKUS).map(([v, s]) => ({ v, t: s.name.replace('RX ', '') })), sku, (v) => {
      sku = v;
      tween(0.8, (t) => apply(v, t));
    });

    // ---- 爆炸视图 ----
    let ex = 0;
    const setEx = (v) => {
      ex = v;
      gcdG.position.y = 0.6 + v * 2.0;
      mcds.forEach((m, i) => {
        m.parts.forEach((pi) => {
          const it = mcdB.items[pi];
          if (it._y0 === undefined) {
            it._y0 = it.y;
            it._x0 = it.x;
          }
          mcdB.move(pi, { y: it._y0 + v * 4.0, x: it._x0 + m.s * v * 3.0 });
        });
        links[i].position.y = 0.64 + v * 3.0;
        links[i].scale.x = 1.4 + v * 2.6;
        links[i].position.x = m.s * (gcdHalfW + 0.15 + (1.4 + v * 2.6) / 2 - 0.5);
      });
      mcdMesh.computeBoundingSphere();
    };
    ctx.ui.buttons([
      { t: '拆开封装', onClick: () => { const f = ex; tween(1, (t) => setEx(f + (1 - f) * t)); } },
      { t: '合上', onClick: () => { const f = ex; tween(1, (t) => setEx(f * (1 - t))); } },
    ]);
    stats = ctx.ui.html('');
    apply(sku);

    return {
      root,
      view: { pos: [0, 44, 40], target: [0, 0, 1] },
      update(dt, t) {
        linkMat.emissiveIntensity = 0.5 + 0.5 * Math.sin(t * 4);
      },
      body: `
        <p>做大芯片越来越贵：面积翻倍，良率会下降得更厉害（见下一阶段“晶圆与良率”）。RDNA 3 的旗舰 <b>Navi 31</b> 因此把一颗大芯片拆成了 7 颗小芯片：</p>
        <ul>
          <li><b>1 颗 GCD</b>（图形计算芯粒，304 mm²，TSMC N5）：只放计算单元。</li>
          <li><b>6 颗 MCD</b>（内存缓存芯粒，各 37.5 mm²，TSMC N6）：每颗装 16 MB Infinity Cache + 64-bit 显存控制器。</li>
        </ul>
        <div class="card">
          <div class="card-title">为什么这样拆？</div>
          逻辑电路在新工艺上能缩小很多，但 <b>SRAM 缓存和模拟 PHY 几乎不缩</b>。把它们放到便宜的旧工艺上，昂贵的先进工艺只留给计算部分；小芯片的良率也更高。
        </div>
        <h3>代价</h3>
        <p>芯片之间的通信要额外耗电、增加延迟。到了 RDNA 4，AMD 的中端芯片 Navi 48 又回到了单片设计。NVIDIA 则在数据中心的 B200 上把两颗大芯片用 10 TB/s 的接口拼在一起——拆分与拼装，是今天大芯片共同的方向。</p>
        <h3>同一颗 Navi 31，三种型号</h3>
        <p>切换上方型号：7900 XT 关闭 1 颗 MCD（少 64-bit 位宽、16 MB 缓存、4 GB 显存），7900 GRE 关闭 2 颗。计算单元同样按 WGP 屏蔽。</p>`,
      legend: [
        [COL.fp32, '流处理器（CU）'],
        [COL.ic, 'Infinity Cache'],
        [COL.phy, 'GDDR6 PHY'],
        [COL.io, 'Fanout 链路 PHY'],
        [0x0a84ff, 'Infinity Fanout 互连'],
        [COL.off, '屏蔽的单元'],
      ],
    };
  },
};
