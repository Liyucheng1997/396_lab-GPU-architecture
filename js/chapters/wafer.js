// 10 晶圆与良率：为什么大芯片贵、为什么会有“屏蔽版”
import { THREE, cyl, group, Batch, label, tween, rng } from '../kit.js';

const R = 15; // 300 mm 晶圆，1 单位 = 10 mm
const EDGE = 0.3; // 边缘 3 mm 不可用
const DIE_OPTS = {
  gb202: { name: 'GB202', area: 750, note: 'RTX 5090 / RTX PRO 6000', salvage: 3 },
  navi48: { name: 'Navi 48', area: 357, note: 'RX 9070 XT / 9070 / 9070 GRE', salvage: 3 },
  gb206: { name: 'GB206', area: 181, note: 'RTX 5060 Ti / 5060', salvage: 2 },
  mcd: { name: 'Navi 31 MCD', area: 37.5, note: '小芯片：缓存 + 显存控制器', salvage: 0 },
};
const C_FULL = 0x3d8bfd;
const C_CUT = 0x9cc3f7;
const C_BAD = 0x54575e;
const C_WAIT = 0x8e9199;

export default {
  id: 'wafer',
  group: '为什么差别那么大',
  title: '晶圆与良率',
  build(ctx) {
    const root = new THREE.Group();
    const wafer = cyl(R, R, 0.3, 0xb8bcc6, { rough: 0.18, metal: 0.95, seg: 128, info: { t: '300 mm 硅晶圆', d: '一片晶圆要经过上千道工序、耗时约 3 个月才能完成。先进工艺（4 nm 级）一片的代工价格据业界估算在 1.5–2 万美元左右。' }, parent: root });
    void wafer;
    const notch = cyl(0.5, 0.5, 0.32, 0x8e9199, { z: R, rough: 0.5, parent: root });
    void notch;
    const statsEl = ctx.ui.html('');

    let dieKey = 'gb202';
    let density = 0.1; // 缺陷 / cm²
    let seed = 5;
    let layer = null;
    let timer = 0;

    function rebuild(animate = true) {
      if (layer) {
        layer.traverse((o) => {
          if (o.isCSS2DObject && o.element.parentNode) o.element.parentNode.removeChild(o.element);
          if (o.isInstancedMesh) o.material.dispose();
        });
        root.remove(layer);
      }
      layer = group(root, 0, 0.3, 0);
      const opt = DIE_OPTS[dieKey];
      const wmm = Math.sqrt(opt.area / 1.25);
      const w = wmm / 10;
      const d = (wmm * 1.25) / 10;
      const gap = 0.05;
      // 找一个放得最多的网格偏移
      let best = null;
      for (const ox of [0, 0.5]) {
        for (const oz of [0, 0.5]) {
          const list = [];
          const nx = Math.ceil(R / (w + gap)) + 1;
          const nz = Math.ceil(R / (d + gap)) + 1;
          for (let i = -nx; i <= nx; i++) {
            for (let j = -nz; j <= nz; j++) {
              const cx = (i + ox) * (w + gap);
              const cz = (j + oz) * (d + gap);
              const far = Math.hypot(Math.abs(cx) + w / 2, Math.abs(cz) + d / 2);
              if (far <= R - EDGE) list.push([cx, cz]);
            }
          }
          if (!best || list.length > best.length) best = list;
        }
      }
      // 撒缺陷：泊松过程，均匀分布在晶圆上
      const r = rng(seed);
      const areaCm2 = Math.PI * 15 * 15;
      const lambda = density * areaCm2;
      let nDef = 0;
      // 用正态近似生成泊松数
      nDef = Math.max(0, Math.round(lambda + Math.sqrt(lambda) * (r() + r() + r() - 1.5) * 2));
      const defects = [];
      for (let k = 0; k < nDef; k++) {
        const a = r() * Math.PI * 2;
        const rr = R * Math.sqrt(r());
        defects.push([Math.cos(a) * rr, Math.sin(a) * rr]);
      }
      // 分类
      const dies = best.map(([cx, cz]) => ({ cx, cz, comp: 0, crit: 0 }));
      for (const [x, z] of defects) {
        for (const die of dies) {
          if (Math.abs(x - die.cx) <= w / 2 && Math.abs(z - die.cz) <= d / 2) {
            const v = (z - (die.cz - d / 2)) / d;
            const critical = opt.salvage === 0 || (v > 0.42 && v < 0.58) || v < 0.08 || v > 0.92;
            if (critical) die.crit++;
            else die.comp++;
            break;
          }
        }
      }
      let full = 0;
      let cut = 0;
      let bad = 0;
      const db = new Batch({ rough: 0.35, metal: 0.4 });
      dies.forEach((die) => {
        let cls;
        if (die.crit > 0 || die.comp > opt.salvage) cls = 'bad';
        else if (die.comp > 0) cls = 'cut';
        else cls = 'full';
        die.cls = cls;
        if (cls === 'full') full++;
        else if (cls === 'cut') cut++;
        else bad++;
        const info =
          cls === 'full'
            ? { t: '完整芯片', d: `没有任何缺陷，可以做成满血型号（${opt.note.split(' / ')[0]} 一级）。`, kv: [['缺陷', '0']] }
            : cls === 'cut'
              ? { t: '可回收：做成屏蔽版', d: '缺陷落在 SM / CU 阵列里。把坏掉的那几个单元熔断屏蔽，芯片照样能卖，只是核心少一些。', kv: [['计算区缺陷', die.comp]] }
              : { t: opt.salvage === 0 ? '报废' : '报废（或降级到更低型号）', d: die.crit ? '缺陷落在 L2 / 调度器 / 显存控制器等无法屏蔽的关键区域。' : '缺陷太多，屏蔽后剩下的单元不够任何型号的规格。', kv: [['关键区缺陷', die.crit], ['计算区缺陷', die.comp]] };
        die.idx = db.add(die.cx, 0, die.cz, w, 0.06, d, C_WAIT, info);
      });
      db.build(layer);
      const defB = new Batch({ rough: 0.4 });
      const defIdx = defects.map(([x, z]) => defB.add(x, 3.0, z, 0.14, 0.14, 0.14, 0xff453a, { t: '缺陷', d: '一粒灰尘、一次光刻偏差，都可能让落点处的晶体管失效。缺陷密度通常用“个 / cm²”衡量。' }));
      defB.build(layer);

      const finish = () => {
        dies.forEach((die) => db.color(die.idx, die.cls === 'full' ? C_FULL : die.cls === 'cut' ? C_CUT : C_BAD));
      };
      if (animate) {
        tween(0.9, (t) => {
          defIdx.forEach((i, k) => defB.move(i, { y: 0.08 + (1 - t) * (2.6 + (k % 7) * 0.15) }));
          if (t >= 1) {
            defB.refreshBounds();
            finish();
          }
        });
      } else {
        defIdx.forEach((i) => defB.move(i, { y: 0.08 }));
        defB.refreshBounds();
        finish();
      }

      const total = dies.length;
      const A = opt.area / 100;
      const yModel = Math.exp(-density * A);
      const waferCost = 18000;
      const pct = (x) => ((x / total) * 100).toFixed(0) + '%';
      statsEl.innerHTML = `<div class="card">
        <div class="card-title">${opt.name} · ${opt.area} mm² · ${opt.note}</div>
        <table class="tbl">
          <tr><td>每片晶圆可切</td><td class="num">${total} 颗</td></tr>
          <tr><td><span class="dot" style="background:${'#' + new THREE.Color(C_FULL).getHexString()}"></span>完整芯片</td><td class="num">${full} · ${pct(full)}</td></tr>
          <tr><td><span class="dot" style="background:${'#' + new THREE.Color(C_CUT).getHexString()}"></span>屏蔽后可用</td><td class="num">${cut} · ${pct(cut)}</td></tr>
          <tr><td><span class="dot off"></span>报废</td><td class="num">${bad} · ${pct(bad)}</td></tr>
          <tr><td>理论良率 e<sup>−D·A</sup></td><td class="num">${(yModel * 100).toFixed(0)}%</td></tr>
          <tr><td>每颗可用芯片的晶圆成本</td><td class="num">≈ $${full + cut ? Math.round(waferCost / (full + cut)).toLocaleString() : '—'}</td></tr>
        </table>
        <div class="muted" style="margin-top:6px">按一片晶圆 1.8 万美元估算，仅为示意；不含封装、测试和显存。</div>
      </div>`;
    }

    ctx.ui.seg('芯片', Object.entries(DIE_OPTS).map(([v, o]) => ({ v, t: o.name })), dieKey, (v) => {
      dieKey = v;
      rebuild();
    });
    ctx.ui.slider('缺陷密度', 0.02, 0.3, 0.01, density, (v) => v.toFixed(2) + ' 个/cm²', (v) => {
      density = v;
      clearTimeout(timer);
      timer = setTimeout(() => rebuild(false), 120);
    });
    ctx.ui.buttons([{ t: '重新撒缺陷', primary: true, onClick: () => { seed++; rebuild(); } }]);
    rebuild();
    label('300 mm 晶圆', 0, 0.8, R + 1.2, { cls: 'big', parent: root });

    return {
      root,
      view: { pos: [0, 30, 21], target: [0, 0, 0.5] },
      body: `
        <p>芯片是在圆形的硅晶圆上一次做出几十到几百颗，再切开。制造过程中总会落下随机的<b>缺陷</b>，落在哪颗芯片上，哪颗芯片就可能出问题。</p>
        <h3>面积越大，越容易“中奖”</h3>
        <p>良率近似为 <code>e<sup>−D×A</sup></code>（D 是缺陷密度，A 是芯片面积）。面积翻倍，完好的概率不是减半，而是<b>指数级下降</b>。再加上大芯片在圆形晶圆边缘浪费更多，GB202 这样的巨型芯片单颗成本远高于小芯片。切换上方的芯片对比。</p>
        <div class="card">
          <div class="card-title">屏蔽：把残次品变成另一个型号</div>
          GPU 由大量重复的 SM / CU 组成。缺陷若只是坏了其中几个，就把它们<b>熔断屏蔽</b>，芯片照样能用，只是核心少一点——这就是同一颗芯片能卖成好几个型号的原因：
          <ul style="margin:6px 0 0">
            <li>完整 GB202 → RTX PRO 6000（188/192 SM）</li>
            <li>屏蔽更多的 GB202 → RTX 5090（170 SM）</li>
            <li>完整 Navi 48 → RX 9070 XT；屏蔽版 → RX 9070 / 9070 GRE</li>
          </ul>
        </div>
        <p>而缺陷若落在 L2、调度器、显存控制器等只有一份的关键区域，往往无法挽救。厂商还会测试每颗芯片能稳定跑多高的频率、漏电多少——这叫<b>芯片分档（binning）</b>。</p>
        <p class="muted">缺陷分布与分类规则为简化模型，真实晶圆的缺陷并不完全均匀。</p>`,
      legend: [
        [C_FULL, '完整芯片'],
        [C_CUT, '屏蔽后可用'],
        [C_BAD, '报废'],
        [0xff453a, '缺陷'],
      ],
    };
  },
};
