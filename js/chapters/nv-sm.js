// 06 Blackwell SM 内部，带指令执行动画
import { THREE, COL, label } from '../kit.js';
import { buildSM } from '../chips.js';

const WHITE = new THREE.Color(0xffffff);

export default {
  id: 'nv-sm',
  group: 'NVIDIA Blackwell',
  vendor: 'n',
  title: 'SM 内部：CUDA / Tensor / RT Core',
  build(ctx) {
    const root = new THREE.Group();
    const sm = buildSM(root);
    const b = sm.batch;
    const L = (t, x, z, y = 1.3) => label(t, x, y, z, { parent: root });
    L('Warp 调度器', -3.85, -7.15);
    L('寄存器堆 64 KB', -3.85, -5.65);
    L('32 × CUDA 核心', -3.85, -3.8, 1.2);
    L('Tensor Core', -5.75, -1.64, 1.6);
    L('LD/ST · SFU', -1.2, -1.6);
    L('L1 指令缓存', 0, -9.1, 0.9);
    L('L1 / 共享内存 128 KB', 0, 8.05, 1.1);
    L('纹理单元 ×4', -4, 9.35, 1.0);
    L('RT Core', 3.8, 9.35, 1.3);
    L('分区 1', -3.85, -8.6, 0.8);
    L('分区 2', 3.85, -8.6, 0.8);
    L('分区 3', -3.85, -0.8, 0.8);
    L('分区 4', 3.85, -0.8, 0.8);
    const status = label('', 0, 2.2, -10.6, { cls: 'counter', parent: root });

    let mode = 'fp32';
    const glow = (i, k) => {
      const it = b.items[i];
      b.color(i, it.color.clone().lerp(WHITE, Math.max(0, Math.min(1, k)) * 0.85));
    };
    const pulse = (ph, a, z) => (ph >= a && ph <= z ? Math.sin(((ph - a) / (z - a)) * Math.PI) : 0);
    const all = [...sm.scheds, ...sm.dispatch, ...sm.regs, ...sm.cores.flat(), ...sm.tensors, ...sm.ldst, ...sm.sfu, ...sm.tmu, sm.rt, sm.l1];
    const restoreAll = () => all.forEach((i) => b.restore(i));
    let warpIds = [0, 0, 0, 0];
    let lastPh = [0, 0, 0, 0];

    ctx.ui.seg(
      '执行动画',
      [
        { v: 'fp32', t: '着色（FP32）' },
        { v: 'tensor', t: '矩阵（AI）' },
        { v: 'rt', t: '光线追踪' },
        { v: 'off', t: '暂停' },
      ],
      mode,
      (v) => {
        mode = v;
        restoreAll();
      }
    );

    const STATUS = {
      fp32: '每个分区每周期挑一个 warp，32 个核心同时执行同一条指令',
      tensor: 'Tensor Core 执行矩阵乘加，寄存器源源不断地供数',
      rt: 'RT Core 遍历 BVH、求交；着色器核心处理命中后的着色',
      off: '',
    };

    return {
      root,
      view: { pos: [2, 21, 21], target: [0, 0, 0.5] },
      update(dt, t) {
        if (mode === 'off') {
          status.element.style.display = 'none';
          return;
        }
        status.element.style.display = '';
        const cyc = mode === 'fp32' ? 0.9 : 1.4;
        const parts = [];
        for (let p = 0; p < 4; p++) {
          const ph = (t / cyc + p * 0.23) % 1;
          if (ph < lastPh[p]) warpIds[p] = (warpIds[p] + 1 + ((p * 5 + warpIds[p] * 3) % 4)) % 12;
          lastPh[p] = ph;
          if (mode === 'fp32') {
            glow(sm.scheds[p], pulse(ph, 0.0, 0.25));
            glow(sm.dispatch[p], pulse(ph, 0.12, 0.35));
            glow(sm.regs[p], pulse(ph, 0.2, 0.55));
            sm.cores[p].forEach((i, k) => glow(i, pulse(ph, 0.32 + (k % 8) * 0.012, 0.75 + (k % 8) * 0.012)));
            sm.sfu.slice(p * 4, p * 4 + 4).forEach((i) => glow(i, pulse(ph, 0.55, 0.85) * (warpIds[p] % 3 === 0 ? 1 : 0)));
            sm.ldst.slice(p * 4, p * 4 + 4).forEach((i) => glow(i, pulse(ph, 0.7, 0.98)));
          } else if (mode === 'tensor') {
            glow(sm.scheds[p], pulse(ph, 0.0, 0.2));
            glow(sm.regs[p], pulse(ph, 0.1, 0.9));
            glow(sm.tensors[p], pulse(ph, 0.2, 0.95));
            sm.cores[p].forEach((i) => glow(i, 0));
          } else {
            glow(sm.scheds[p], pulse(ph, 0.0, 0.2));
            sm.cores[p].forEach((i, k) => glow(i, pulse(ph, 0.6 + (k % 4) * 0.02, 0.95)));
            sm.ldst.slice(p * 4, p * 4 + 4).forEach((i) => glow(i, pulse(ph, 0.1, 0.4)));
          }
          parts.push(`W${warpIds[p]}`);
        }
        const g = (t / 1.4) % 1;
        if (mode === 'rt') {
          glow(sm.rt, 0.35 + 0.65 * Math.abs(Math.sin(t * 5)));
          glow(sm.l1, pulse(g, 0.0, 0.5));
          sm.tmu.forEach((i) => glow(i, pulse(g, 0.5, 0.9)));
        } else if (mode === 'fp32') {
          glow(sm.l1, pulse((t / 0.9) % 1, 0.7, 1));
          sm.tmu.forEach((i) => glow(i, pulse((t / 0.9) % 1, 0.6, 0.95)));
          glow(sm.rt, 0);
        } else {
          glow(sm.rt, 0);
          glow(sm.l1, pulse(g, 0.0, 0.3));
        }
        status.element.innerHTML = `${STATUS[mode]}<small>正在执行：${parts.join(' · ')}</small>`;
      },
      body: `
        <p><b>SM</b>（Streaming Multiprocessor）是 NVIDIA GPU 的“车间”。GB202 有 192 个这样的车间，每个车间分成 <b>4 个分区</b>，每个分区是一条完整的生产线：</p>
        <div class="card formula">
          调度器 选一个 warp<br>
          → 分发单元 送出指令<br>
          → 寄存器堆 读出 32 个线程的操作数<br>
          → 32 个核心 同时计算<br>
          → 结果写回寄存器
        </div>
        <h3>三种运算单元</h3>
        <ul>
          <li><b>CUDA 核心</b>（蓝）：通用 FP32 / INT32，每周期一次乘加。所有着色器、物理、后处理都跑在这里。</li>
          <li><b>Tensor Core</b>（紫）：只做矩阵乘加，但吞吐是 CUDA 核心的数十倍。DLSS 4、帧生成、本地跑大模型靠它。</li>
          <li><b>RT Core</b>（绿）：光线追踪专用的固定功能硬件，替着色器做 BVH 遍历和三角形求交。</li>
        </ul>
        <h3>延迟隐藏</h3>
        <p>每个分区同时驻留最多十几个 warp（标签上的 W 编号）。某个 warp 要等显存数据时，调度器下个周期就换另一个 warp——<b>只要驻留的 warp 足够多，核心就几乎不会闲着</b>。所以寄存器堆要做得很大：每个驻留线程的寄存器都必须一直留在这里。</p>
        <h3>Blackwell 的变化</h3>
        <p>相比上代 Ada，Blackwell 让全部 128 个核心都能执行 INT32（Ada 只有一半），Tensor Core 新增 FP4，并加入面向“神经着色器”的调度改进。</p>
        <p class="muted">切换上方动画，看不同工作负载点亮哪些单元。</p>`,
      legend: [
        [COL.sched, 'Warp 调度 / 分发'],
        [COL.reg, '寄存器堆'],
        [COL.fp32, 'CUDA 核心'],
        [COL.tensor, 'Tensor Core'],
        [COL.ldst, 'LD/ST'],
        [COL.sfu, 'SFU'],
        [COL.cache, 'L0 / L1 缓存'],
        [COL.tex, '纹理单元'],
        [COL.rt, 'RT Core'],
      ],
    };
  },
};
