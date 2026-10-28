// 11 同一颗芯片，不同显卡：启用单元、位宽、频率、功耗决定了型号差距
import { THREE, COL, box, group, Batch, label, tween, rng, hex } from '../kit.js';
import { buildNvDie, buildAmdDie, setPartsEnabled, DIES } from '../chips.js';

// units：NVIDIA 为 SM 数，AMD 为 CU 数；cache：L2（N）或 Infinity Cache（A），MB
const SKUS = [
  { id: 'pro6000', name: 'RTX PRO 6000', die: 'GB202', units: 188, boost: 2.617, mem: 96, bus: 512, gbps: 28, cache: 128, tbp: 600, clam: true, note: '工作站卡：几乎满血的 GB202，96 GB 显存（3 GB 颗粒双面贴装）。' },
  { id: '5090', name: 'RTX 5090', die: 'GB202', units: 170, boost: 2.407, mem: 32, bus: 512, gbps: 28, cache: 96, tbp: 575, note: '同一颗 GB202，屏蔽了 22 个 SM 和 32 MB L2。' },
  { id: '5080', name: 'RTX 5080', die: 'GB203', units: 84, boost: 2.617, mem: 16, bus: 256, gbps: 30, cache: 64, tbp: 360, note: '满血 GB203。SM 只有 5090 的一半，频率更高。' },
  { id: '5070ti', name: 'RTX 5070 Ti', die: 'GB203', units: 70, boost: 2.452, mem: 16, bus: 256, gbps: 28, cache: 48, tbp: 300, note: '屏蔽版 GB203：少 14 个 SM，显存速率和 L2 也降了一档。' },
  { id: '5070', name: 'RTX 5070', die: 'GB205', units: 48, boost: 2.512, mem: 12, bus: 192, gbps: 28, cache: 48, tbp: 250, note: 'GB205 屏蔽 1 个 TPC，192-bit 位宽。' },
  { id: '5060ti', name: 'RTX 5060 Ti 16G', die: 'GB206', units: 36, boost: 2.572, mem: 16, bus: 128, gbps: 28, cache: 32, tbp: 180, clam: true, note: '满血 GB206。16 GB 版在 PCB 背面多贴一组颗粒（双面贴装），位宽仍是 128-bit。' },
  { id: '5060', name: 'RTX 5060', die: 'GB206', units: 30, boost: 2.497, mem: 8, bus: 128, gbps: 28, cache: 32, tbp: 145, note: '屏蔽 3 个 TPC 的 GB206。' },
  { id: '9070xt', name: 'RX 9070 XT', die: 'NAVI48', units: 64, boost: 2.97, mem: 16, bus: 256, gbps: 20, cache: 64, tbp: 304, note: '满血 Navi 48。' },
  { id: '9070', name: 'RX 9070', die: 'NAVI48', units: 56, boost: 2.52, mem: 16, bus: 256, gbps: 20, cache: 64, tbp: 220, note: '屏蔽 4 个 WGP，频率和功耗墙都更低——显存完全一样。' },
  { id: '9070gre', name: 'RX 9070 GRE', die: 'NAVI48', units: 48, boost: 2.79, mem: 12, bus: 192, gbps: 18, cache: 48, tbp: 220, note: '屏蔽 8 个 WGP，还关掉了 2 个显存控制器和对应的 16 MB Infinity Cache。' },
  { id: '9060xt16', name: 'RX 9060 XT 16G', die: 'NAVI44', units: 32, boost: 3.13, mem: 16, bus: 128, gbps: 20, cache: 32, tbp: 160, clam: true, note: '满血 Navi 44，16 GB 版双面贴装。' },
  { id: '9060xt8', name: 'RX 9060 XT 8G', die: 'NAVI44', units: 32, boost: 3.13, mem: 8, bus: 128, gbps: 20, cache: 32, tbp: 150, note: '与 16G 版芯片完全相同，只是少了一半显存——显存不够的游戏里会明显掉帧。' },
];

const isN = (s) => DIES[s.die].vendor === 'n';
const shaders = (s) => s.units * (isN(s) ? 128 : 64);
const tflops = (s) => (shaders(s) * 2 * s.boost * (isN(s) ? 1 : 2)) / 1000; // AMD 按官方口径（含双发射）
const bw = (s) => (s.bus / 8) * s.gbps;
const MAX = { tf: Math.max(...SKUS.map(tflops)), bw: Math.max(...SKUS.map(bw)), mem: 32, tbp: 600 };

export default {
  id: 'sku',
  group: '为什么差别那么大',
  title: '同一颗芯片，不同显卡',
  build(ctx) {
    const root = new THREE.Group();
    let stage = null;
    let cur = null; // { dieKey, h, chips }

    function buildStage(dieKey) {
      if (stage) {
        stage.traverse((o) => {
          if (o.isCSS2DObject && o.element.parentNode) o.element.parentNode.removeChild(o.element);
          if (o.isInstancedMesh) o.material.dispose();
        });
        root.remove(stage);
      }
      stage = group(root);
      const cfg = DIES[dieKey];
      const dieG = group(stage, 0, 1.05, 0);
      const h = cfg.vendor === 'n' ? buildNvDie(dieG, cfg) : buildAmdDie(dieG, cfg);
      box(h.W + 10, 0.2, h.D + 10, 0x1e3a2b, { y: 0.6, rough: 0.8, info: { t: 'PCB', d: '显存颗粒围绕芯片排布，每颗对应一个 32-bit 显存控制器。' }, parent: stage });
      box(h.W + 2.4, 0.25, h.D + 2.4, COL.substrate, { y: 0.8, rough: 0.6, info: { t: '封装基板', d: '' }, parent: stage });
      // 每个显存控制器外侧放一颗显存（正面），双面贴装时背面再放一颗
      const vb = new Batch({ rough: 0.35, metal: 0.3 });
      const chips = h.mcs.map(([mi], k) => {
        const it = h.batch.items[mi];
        const z = Math.sign(it.z) * (h.D / 2 + 3.0);
        const info = { t: `显存颗粒 · 通道 ${k + 1}`, d: '每颗显存连接一个 32-bit 控制器。颗粒数 × 32 = 位宽；颗粒数 × 单颗容量 = 显存容量。' };
        return {
          front: vb.add(it.x, 0.8, z, 1.4, 0.16, 1.2, 0x2e3036, info),
          back: vb.add(it.x, 0.44, z, 1.4, 0.14, 1.2, COL.vram, { ...info, t: `背面显存颗粒（双面贴装）· 通道 ${k + 1}`, d: '双面贴装（clamshell）：两颗颗粒共享同一个 32-bit 通道，容量翻倍，带宽不变。' }),
        };
      });
      vb.build(stage);
      const capL = label('', 0, 1.2, h.D / 2 + 4.6, { cls: 'big', parent: stage });
      cur = { dieKey, h, chips, vb, capL };
    }

    function apply(s, t = 1) {
      const { h, chips, vb } = cur;
      const cfg = DIES[s.die];
      const r = rng(s.id.length * 7 + s.units);
      const units = cfg.vendor === 'n' ? h.tpcs : h.wgps;
      const offCount = units.length - s.units / 2;
      const order = units.map((_, i) => i).sort(() => r() - 0.5);
      const off = new Set(order.slice(0, offCount));
      units.forEach((u, i) => setPartsEnabled(h.batch, u.parts, !off.has(i), t));
      const mcOn = s.bus / 32;
      // 关闭的控制器取两侧末端，保持对称
      const mcOff = new Set();
      for (let k = 0; mcOff.size < h.mcs.length - mcOn; k++) {
        mcOff.add(h.mcs.length / 2 - 1 - k);
        if (mcOff.size < h.mcs.length - mcOn) mcOff.add(h.mcs.length - 1 - k);
      }
      h.mcs.forEach((p, i) => setPartsEnabled(h.batch, p, !mcOff.has(i), t, false));
      const slices = cfg.vendor === 'n' ? h.l2 : h.ic;
      const per = (cfg.vendor === 'n' ? cfg.l2MB : cfg.icMB) / slices.length;
      const sliceOn = s.cache / per;
      slices.forEach((p, i) => setPartsEnabled(h.batch, p, i % (slices.length / 2) < sliceOn / 2, t, false));
      if (t < 1) return;
      chips.forEach((c, i) => {
        const on = !mcOff.has(i);
        vb.move(c.front, { h: on ? 0.16 : 0.02 });
        vb.color(c.front, on ? 0x2e3036 : 0x5a5d64);
        vb.move(c.back, { h: on && s.clam ? 0.14 : 0.0001 });
        vb.items[c.front].info.t = on ? `显存颗粒 · 通道 ${i + 1}` : `空焊盘 · 通道 ${i + 1}`;
      });
      cur.capL.element.innerHTML = `${s.name}<small>${cfg.name} · ${s.units} / ${units.length * 2} ${cfg.vendor === 'n' ? 'SM' : 'CU'} · ${s.bus}-bit</small>`;
    }

    // ---- 面板 ----
    let vendor = 'n';
    let sel = SKUS[1];
    ctx.ui.seg('厂商', [{ v: 'n', t: 'NVIDIA RTX 50 / PRO' }, { v: 'a', t: 'AMD RX 9000' }], vendor, (v) => {
      vendor = v;
      select(SKUS.find((s) => DIES[s.die].vendor === v));
    });
    const listEl = ctx.ui.html('');
    const statEl = ctx.ui.html('');
    function renderList() {
      const groups = {};
      SKUS.filter((s) => DIES[s.die].vendor === vendor).forEach((s) => (groups[s.die] ||= []).push(s));
      listEl.innerHTML = `<div class="sku-list">${Object.entries(groups)
        .map(
          ([d, list]) =>
            `<div class="sku-group">${DIES[d].name} · ${DIES[d].area} mm²</div>` +
            list.map((s) => `<button class="sku-btn${s === sel ? ' active' : ''}" data-id="${s.id}"><span>${s.name}</span><small>${s.units} ${isN(s) ? 'SM' : 'CU'} · ${s.mem} GB</small></button>`).join('')
        )
        .join('')}</div>`;
      listEl.querySelectorAll('.sku-btn').forEach((b) => (b.onclick = () => select(SKUS.find((s) => s.id === b.dataset.id))));
    }
    function renderStats(s) {
      const bar = (name, v, max, txt) => `<div class="bar-row"><span class="bar-name">${name}</span><span class="bar-track"><span class="bar-fill" style="width:${Math.min(100, (v / max) * 100).toFixed(1)}%"></span></span><span class="bar-val">${txt}</span></div>`;
      const tf = tflops(s);
      statEl.innerHTML = `<div class="card">
        <div class="card-title">${s.name}</div>
        <div style="font-size:12.5px;line-height:1.6;margin-bottom:10px">${s.note}</div>
        <div class="bars">
          ${bar('FP32 峰值', tf, MAX.tf, tf.toFixed(1) + ' TFLOPS')}
          ${bar('显存带宽', bw(s), MAX.bw, bw(s).toLocaleString() + ' GB/s')}
          ${bar('显存容量', s.mem, MAX.mem, s.mem + ' GB')}
          ${bar('整卡功耗', s.tbp, MAX.tbp, s.tbp + ' W')}
        </div>
        <table class="tbl" style="margin-top:10px">
          <tr><td>${isN(s) ? 'CUDA 核心' : '流处理器'}</td><td class="num">${shaders(s).toLocaleString()}</td></tr>
          <tr><td>加速频率</td><td class="num">${s.boost.toFixed(2)} GHz</td></tr>
          <tr><td>显存</td><td class="num">${s.bus}-bit · ${s.gbps} Gbps</td></tr>
          <tr><td>${isN(s) ? 'L2 缓存' : 'Infinity Cache'}</td><td class="num">${s.cache} MB</td></tr>
        </table>
        <div class="muted" style="margin-top:8px">FP32 = 核心数 × 2 × 频率${isN(s) ? '' : ' × 2（AMD 官方口径含双发射）'}；带宽 = 位宽 ÷ 8 × 速率。</div>
      </div>`;
    }
    function select(s) {
      sel = s;
      renderList();
      renderStats(s);
      if (!cur || cur.dieKey !== s.die) {
        buildStage(s.die);
        apply(s);
        const k = Math.max(cur.h.W, cur.h.D);
        ctx.view([0, k * 1.15 + 4, k * 0.95 + 6], [0, 0, 1.5]);
      } else {
        tween(0.7, (t) => apply(s, t));
      }
    }
    renderList();
    renderStats(sel);
    buildStage(sel.die);
    apply(sel);

    return {
      root,
      view: { pos: [0, 40, 36], target: [0, 0, 1.5] },
      body: `
        <p>同样叫“RTX 50 系列”，最贵和最便宜的型号性能能差 4 倍以上。拆开看，差别来自这几个旋钮：</p>
        <div class="card formula">
          算力 ≈ 启用单元数 × 每单元核心数 × 频率 × 2<br>
          带宽 = 显存位宽 ÷ 8 × 显存速率
        </div>
        <ol style="padding-left:18px;margin:0 0 12px">
          <li><b>芯片大小</b>：GB202 / GB203 / GB205 / GB206 是四颗不同的芯片，SM 数量从 192 到 36。</li>
          <li><b>屏蔽多少</b>：同一颗芯片按良率分档，屏蔽掉一部分 SM / CU（模型里灰色压扁的单元）。</li>
          <li><b>显存位宽</b>：控制器数量决定位宽，位宽决定能贴几颗显存、带宽多大。</li>
          <li><b>缓存</b>：L2 / Infinity Cache 也会随型号削减。</li>
          <li><b>频率与功耗墙</b>：RX 9070 和 9070 XT 显存一样，差在单元数、频率和 220 W 对 304 W 的功耗墙。</li>
          <li><b>显存容量</b>：容量不够时数据要走 PCIe，帧数会断崖式下跌（8G 与 16G 的区别）。</li>
        </ol>
        <div class="card">
          <div class="card-title">纸面参数 ≠ 实际性能</div>
          RTX 5090 的 SM 和位宽都是 5080 的 2 倍，但 4K 游戏里大约只快一半：游戏无法把所有核心喂满，频率更低，还常常受 CPU 限制。跨厂商更不能直接比 TFLOPS——AMD 的数字含双发射，而 RX 9070 XT（约 49 TFLOPS）的游戏表现大致与 RTX 5070 Ti（约 44 TFLOPS）同级。
        </div>
        <p class="muted">规格为公开的参考设计数据，非公版显卡的频率和功耗会有差异。屏蔽的具体是哪几个单元每颗芯片都不同，模型里是随机示意。</p>`,
      legend: [
        [COL.fp32, '启用的 SM / CU'],
        [COL.off, '被屏蔽的单元'],
        [COL.phy, '显存控制器'],
        [COL.vram, '显存颗粒'],
        [COL.l2, 'L2'],
        [COL.ic, 'Infinity Cache'],
      ],
    };
  },
};
