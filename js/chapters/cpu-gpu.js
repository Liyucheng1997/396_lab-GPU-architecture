// 02 CPU vs GPU：少量大核 vs 海量小核，用“渲染一张图”来比赛
import { THREE, COL, Batch, group, label } from '../kit.js';

const N = 32; // 画面 32×32 像素
const PITCH = 0.32;
const EMPTY = 0x3a3d44;
const FLASH = 0xeaf3ff;

// 一张程序生成的小图：天空渐变 + 太阳 + 山
function pixelColor(px, py) {
  const u = px / (N - 1);
  const v = py / (N - 1); // 0 = 顶
  const c = new THREE.Color().setRGB(0.12 + 0.75 * v, 0.2 + 0.35 * v, 0.55 - 0.15 * v);
  const dx = u - 0.66;
  const dy = v - 0.52;
  if (dx * dx + dy * dy < 0.018) c.setRGB(1.0, 0.82, 0.35);
  const ridge = 0.68 + 0.08 * Math.sin(u * 9.0) + 0.05 * Math.sin(u * 23.0 + 1.3);
  if (v > ridge) c.setRGB(0.1 + 0.08 * (1 - v), 0.22 + 0.1 * (1 - v), 0.2);
  if (v > 0.9) c.setRGB(0.08, 0.15, 0.14);
  return c;
}

function buildScreen(parent, cx) {
  const b = new Batch({ rough: 0.6 });
  const idx = [];
  for (let py = 0; py < N; py++) {
    for (let px = 0; px < N; px++) {
      const x = cx - (N * PITCH) / 2 + PITCH * (px + 0.5);
      const y = 1.2 + (N - 1 - py) * PITCH;
      idx.push(b.add(x, y, -8.6, 0.27, 0.27, 0.06, EMPTY, { t: `像素 (${px}, ${py})`, d: '每个像素的颜色都要运行一遍“像素着色程序”来计算。像素之间互不依赖，非常适合并行。' }));
    }
  }
  b.add(cx, 0.9, -8.68, N * PITCH + 0.5, N * PITCH + 0.6, 0.06, 0x1d1e22, { t: '显示器（示意）', d: '1024 个像素需要计算。' });
  b.build(parent);
  return { b, idx };
}

export default {
  id: 'cpu-gpu',
  group: '基础',
  title: 'CPU 与 GPU 的根本区别',
  build(ctx) {
    const root = new THREE.Group();

    // ---------- CPU ----------
    const cpuX = -9.5;
    const cb = new Batch({ rough: 0.45 });
    cb.add(cpuX, 0, 0, 14, 0.4, 12.4, COL.die, { t: 'CPU 芯片（示意：8 核）', d: '少量“全能型”大核心。每个核心有复杂的控制逻辑（分支预测、乱序执行）和大缓存，单个任务跑得极快。' });
    cb.add(cpuX, 0.4, 0, 13.4, 0.4, 2.0, COL.l2, { t: 'L3 共享缓存', d: 'CPU 用大量面积做缓存，尽量让数据“随叫随到”，降低单个任务的延迟。' });
    const cpuCores = [];
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 4; c++) {
        const x = cpuX - 4.8 + c * 3.2;
        const z = r ? 3.45 : -3.45;
        const coreInfo = { t: `CPU 核心 ${r * 4 + c + 1}`, d: '一个大核心：约一半面积是控制逻辑和缓存，真正做运算的 ALU 只占一小部分。', kv: [['频率', '约 5 GHz'], ['擅长', '复杂分支、低延迟']] };
        cb.add(x, 0.4, z, 3.0, 0.12, 4.3, COL.frame, coreInfo);
        cb.add(x, 0.52, z - 1.3, 2.7, 0.55, 1.4, COL.sched, { t: '控制单元（大）', d: '取指、译码、分支预测、乱序执行调度……这些让 CPU 能飞快地跑复杂、跳来跳去的代码。' });
        const alus = [];
        for (let k = 0; k < 4; k++) alus.push(cb.add(x - 0.99 + k * 0.66, 0.52, z + 0.1, 0.55, 0.5, 0.7, COL.fp32, { t: 'ALU 运算单元', d: 'CPU 每个核心只有少量运算单元（这里画 4 个，另有 SIMD 向量单元）。' }));
        cb.add(x, 0.52, z + 0.85, 2.7, 0.3, 0.45, COL.int32, { t: 'SIMD 向量单元', d: 'AVX 等向量指令，一次处理 8~16 个数，是 CPU 的“小号并行”。' });
        cb.add(x, 0.52, z + 1.6, 2.7, 0.4, 0.8, COL.cache, { t: 'L1 / L2 缓存', d: '每核独享的缓存，访问只要几个周期。' });
        cpuCores.push(alus);
      }
    }
    cb.build(root);

    // ---------- GPU ----------
    const gpuX = 9.5;
    const gb = new Batch({ rough: 0.45 });
    gb.add(gpuX, 0, 0, 14, 0.4, 12.4, COL.die, { t: 'GPU 芯片（示意：16 个 SM × 64 核）', d: '成百上千个简单的小核心，控制逻辑被很多核心共用。单个线程慢，但能同时跑上万个线程。' });
    const gpuAlus = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const x = gpuX - 4.95 + c * 3.3;
        const z = -4.3 + r * 2.87;
        gb.add(x, 0.4, z, 3.15, 0.1, 2.72, COL.frame, { t: `SM ${r * 4 + c + 1}`, d: '一个计算模块：一套调度器带着几十个核心一起干活——同一条指令，同时作用在许多不同的数据上（SIMT）。' });
        gb.add(x, 0.5, z - 1.13, 3.0, 0.3, 0.3, COL.sched, { t: '调度器（小、共享）', d: '一个调度器同时指挥 32 个线程执行同一条指令，控制成本被摊薄。' });
        for (let a = 0; a < 64; a++) {
          const ax = x - 1.26 + (a % 8) * 0.36;
          const az = z - 0.78 + Math.floor(a / 8) * 0.235;
          gpuAlus.push(gb.add(ax, 0.5, az, 0.27, 0.32, 0.17, COL.fp32, { t: 'CUDA 核心 / 流处理器', d: '极简的运算通道，只会按调度器的命令做乘加。数量是 GPU 的力量来源。' }));
        }
        gb.add(x, 0.5, z + 1.13, 3.0, 0.22, 0.3, COL.cache, { t: '共享缓存', d: '缓存远比 CPU 小，GPU 靠“切换线程”而不是“大缓存”来掩盖内存延迟。' });
      }
    }
    gb.build(root);

    const cpuScr = buildScreen(root, cpuX);
    const gpuScr = buildScreen(root, gpuX);
    const lc = label('CPU · 8 个大核', cpuX, 0.9, 6.6, { cls: 'big', parent: root });
    const lg = label('GPU · 1024 个小核', gpuX, 0.9, 6.6, { cls: 'big', parent: root });
    const cntC = label('', cpuX, 12.4, -8.6, { cls: 'counter', parent: root });
    const cntG = label('', gpuX, 12.4, -8.6, { cls: 'counter', parent: root });
    void lc;
    void lg;

    // ---------- 比赛逻辑 ----------
    const colors = [];
    for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) colors.push(pixelColor(px, py));
    // 串行模式：8×8 个 4×4 的方块，按蛇形顺序一个接一个
    const tiles = [];
    for (let ty = 0; ty < 8; ty++) {
      for (let k = 0; k < 8; k++) {
        const tx = ty % 2 ? 7 - k : k;
        const pix = [];
        for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) pix.push((ty * 4 + y) * N + tx * 4 + x);
        tiles.push(pix);
      }
    }

    let mode = 'parallel';
    const MODES = {
      parallel: { cpu: { per: 8, dt: 0.035 }, gpu: { per: 256, dt: 0.12 } },
      serial: { cpu: { dt: 0.06 }, gpu: { dt: 0.17 } },
    };
    const racers = {
      cpu: { scr: cpuScr, batch: cb, alus: cpuCores.flat(), cnt: cntC, name: 'CPU' },
      gpu: { scr: gpuScr, batch: gb, alus: gpuAlus, cnt: cntG, name: 'GPU' },
    };
    let flashes = [];
    let pause = 0;

    function reset() {
      for (const r of Object.values(racers)) {
        r.done = 0;
        r.acc = 0;
        r.time = 0;
        r.finished = false;
        r.scr.idx.forEach((i) => r.scr.b.color(i, EMPTY));
      }
      flashes.forEach(([b, i]) => b.restore(i));
      flashes = [];
      pause = 0;
    }

    function flash(b, list) {
      list.forEach((i) => {
        b.color(i, FLASH);
        flashes.push([b, i, 0.07]);
      });
    }

    function stepRacer(key, r) {
      const total = mode === 'parallel' ? N * N : tiles.length;
      if (r.done >= total) return;
      if (mode === 'parallel') {
        const per = MODES.parallel[key].per;
        for (let k = 0; k < per && r.done < total; k++, r.done++) r.scr.b.color(r.scr.idx[r.done], colors[r.done]);
        if (key === 'cpu') flash(r.batch, cpuCores.map((a) => a[(r.done / 8) % 4 | 0]));
        else flash(r.batch, gpuAlus.filter((_, i) => i % 4 === (r.done / 256 - 1) % 4));
      } else {
        tiles[r.done].forEach((p) => r.scr.b.color(r.scr.idx[p], colors[p]));
        r.done++;
        flash(r.batch, key === 'cpu' ? [cpuCores[0][0]] : [gpuAlus[0]]);
      }
    }

    function counterText(r) {
      const total = mode === 'parallel' ? N * N : tiles.length;
      const unit = mode === 'parallel' ? '像素' : '步';
      const ok = r.done >= total;
      return `${ok ? '<span class="dot ok"></span>' : ''}${r.name} · ${r.done} / ${total} ${unit} · ${r.time.toFixed(2)} 秒`;
    }

    ctx.ui.seg(
      '比赛项目',
      [
        { v: 'parallel', t: '并行：渲染 1024 个像素' },
        { v: 'serial', t: '串行：64 步依赖计算' },
      ],
      mode,
      (v) => {
        mode = v;
        reset();
      }
    );
    ctx.ui.buttons([{ t: '重新开始', primary: true, onClick: reset }]);
    reset();

    return {
      root,
      view: { pos: [0, 20, 34], target: [0, 4.6, -2.5] },
      update(dt) {
        flashes = flashes.filter((f) => {
          f[2] -= dt;
          if (f[2] <= 0) {
            f[0].restore(f[1]);
            return false;
          }
          return true;
        });
        const total = mode === 'parallel' ? N * N : tiles.length;
        let all = true;
        for (const [key, r] of Object.entries(racers)) {
          if (r.done < total) {
            all = false;
            r.time += dt;
            r.acc += dt;
            const step = MODES[mode][key].dt;
            while (r.acc >= step && r.done < total) {
              r.acc -= step;
              stepRacer(key, r);
            }
          }
          r.cnt.element.innerHTML = counterText(r);
        }
        if (all) {
          pause += dt;
          if (pause > 2.5) reset();
        }
      },
      body: `
        <p>CPU 和 GPU 都是“算东西的芯片”，但设计目标截然相反：</p>
        <div class="card">
          <table class="tbl">
            <tr><th></th><th>CPU</th><th>GPU</th></tr>
            <tr><td>核心</td><td>几个到几十个<b>大核</b></td><td>上万个<b>小核</b></td></tr>
            <tr><td>面积花在</td><td>控制逻辑 + 大缓存</td><td>运算单元</td></tr>
            <tr><td>追求</td><td><b>低延迟</b>：一件事尽快做完</td><td><b>高吞吐</b>：单位时间做完最多的事</td></tr>
            <tr><td>擅长</td><td>操作系统、游戏逻辑、复杂分支</td><td>像素、顶点、矩阵、AI</td></tr>
          </table>
        </div>
        <h3>SIMT：一条指令，成千上万份数据</h3>
        <p>画面里每个像素的计算公式都一样，只是输入不同。GPU 把 <b>32 个线程</b>编成一组（NVIDIA 叫 <b>warp</b>，AMD 叫 <b>wavefront</b>），一个调度器发一条指令，32 个核心同时执行。控制逻辑被摊薄，芯片面积就能大量堆运算单元。</p>
        <h3>为什么 GPU 不怕内存慢？</h3>
        <p>读一次显存要等几百个周期。CPU 用大缓存和乱序执行硬扛；GPU 的办法是<b>同时挂着很多 warp</b>：这一组在等数据，就立刻切到另一组，运算单元始终有活干。</p>
        <p>切到“串行”项目试试：每一步都依赖上一步的结果，GPU 再多的核心也只能闲着，频率更高、控制更聪明的 CPU 反而更快。</p>
        <p class="muted">动画速度为示意。真实差距：RTX 5090 的 FP32 峰值约 105 TFLOPS，而一颗 16 核桌面 CPU 大约只有 2–3 TFLOPS。</p>`,
      legend: [
        [COL.sched, '控制 / 调度'],
        [COL.fp32, '运算单元'],
        [COL.cache, '缓存'],
        [COL.l2, '大缓存 L3'],
      ],
    };
  },
};
