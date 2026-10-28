// 08 RDNA 4 WGP 内部：wave32 / wave64 / 双发射 / 矩阵 / 光追
import { THREE, COL, label } from '../kit.js';
import { buildWGP } from '../chips.js';

const WHITE = new THREE.Color(0xffffff);

export default {
  id: 'amd-wgp',
  group: 'AMD RDNA',
  vendor: 'a',
  title: 'WGP 内部：CU、SIMD 与双发射',
  build(ctx) {
    const root = new THREE.Group();
    const w = buildWGP(root);
    const b = w.batch;
    const L = (t, x, z, y = 1.3) => label(t, x, y, z, { parent: root });
    L('指令缓存（共享）', -4.45, -6.6, 0.9);
    L('标量缓存（共享）', 4.45, -6.6, 0.9);
    L('LDS 128 KB', 0, 0.55, 1.2);
    L('CU 1', -4.85, -7.6, 0.6);
    L('CU 2', 4.85, -7.6, 0.6);
    L('调度器', -4.85, -5.0);
    L('标量单元', -6.7, -4.2);
    L('SGPR', -3.0, -4.2);
    L('VGPR', -6.7, -3.2);
    L('SIMD32 ×2', -4.85, -0.5, 1.4);
    L('AI 加速器', -6.7, 2.5);
    L('光线加速器', -6.7, 3.5);
    L('纹理 ×4', -3.0, 3.5);
    L('L0 缓存', -4.85, 4.4, 0.9);
    const status = label('', 0, 2.2, -8.2, { cls: 'counter', parent: root });

    const glow = (i, k) => b.color(i, b.items[i].color.clone().lerp(WHITE, Math.max(0, Math.min(1, k)) * 0.85));
    const pulse = (ph, a, z) => (ph >= a && ph <= z ? Math.sin(((ph - a) / (z - a)) * Math.PI) : 0);
    const all = [...w.lanes.flat(), ...w.dual.flat(), ...w.ai, ...w.ra, ...w.vgpr, ...w.sched, ...w.salu, ...w.tex];
    let mode = 'w32';
    ctx.ui.seg(
      '执行动画',
      [
        { v: 'w32', t: 'wave32' },
        { v: 'w64', t: 'wave64' },
        { v: 'dual', t: '双发射' },
        { v: 'ai', t: '矩阵（AI）' },
        { v: 'ray', t: '光线追踪' },
        { v: 'off', t: '暂停' },
      ],
      mode,
      (v) => {
        mode = v;
        all.forEach((i) => b.restore(i));
      }
    );
    const STATUS = {
      w32: 'wave32：一个 SIMD32 一拍执行完 32 个线程的一条指令',
      w64: 'wave64：64 个线程分成前后两半，在同一个 SIMD32 上分两拍执行',
      dual: '双发射：两条互不依赖的指令同一拍发出，上层浅蓝通道一起工作',
      ai: 'WMMA 矩阵指令：AI 加速器与向量通道协同完成矩阵乘加',
      ray: '光线加速器做包围盒 / 三角形求交，着色器负责遍历调度与着色',
    };

    return {
      root,
      view: { pos: [1, 20, 17], target: [0, 0, 0.3] },
      update(dt, t) {
        if (mode === 'off') {
          status.element.style.display = 'none';
          return;
        }
        status.element.style.display = '';
        status.element.innerHTML = STATUS[mode];
        const cyc = 1.0;
        for (let s = 0; s < 4; s++) {
          const cu = s >> 1;
          const ph = (t / cyc + s * 0.21) % 1;
          const lanes = w.lanes[s];
          const dual = w.dual[s];
          glow(w.sched[cu], pulse((t / cyc + cu * 0.4) % 1, 0, 0.2));
          glow(w.salu[cu], pulse((t / cyc + cu * 0.4) % 1, 0.1, 0.35) * (mode === 'ai' ? 0 : 1));
          if (mode === 'w32') {
            glow(w.vgpr[s], pulse(ph, 0.15, 0.5));
            lanes.forEach((i, k) => glow(i, pulse(ph, 0.3 + Math.floor(k / 4) * 0.012, 0.75)));
            dual.forEach((i) => glow(i, 0));
          } else if (mode === 'w64') {
            glow(w.vgpr[s], pulse(ph, 0.1, 0.9));
            lanes.forEach((i) => glow(i, Math.max(pulse(ph, 0.2, 0.5), pulse(ph, 0.55, 0.85))));
            dual.forEach((i) => glow(i, 0));
          } else if (mode === 'dual') {
            glow(w.vgpr[s], pulse(ph, 0.15, 0.5));
            lanes.forEach((i) => glow(i, pulse(ph, 0.3, 0.75)));
            dual.forEach((i) => glow(i, pulse(ph, 0.3, 0.75)));
          } else if (mode === 'ai') {
            glow(w.vgpr[s], pulse(ph, 0.05, 0.95));
            glow(w.ai[s], pulse(ph, 0.15, 0.95));
            lanes.forEach((i) => glow(i, pulse(ph, 0.2, 0.9) * 0.45));
            dual.forEach((i) => glow(i, 0));
          } else if (mode === 'ray') {
            lanes.forEach((i, k) => glow(i, pulse(ph, 0.55 + (k % 4) * 0.02, 0.95) * 0.8));
            dual.forEach((i) => glow(i, 0));
            glow(w.vgpr[s], pulse(ph, 0.5, 0.95));
          }
        }
        for (let cu = 0; cu < 2; cu++) {
          const ph = (t / 1.2 + cu * 0.5) % 1;
          glow(w.ra[cu], mode === 'ray' ? 0.35 + 0.65 * Math.abs(Math.sin(t * 5 + cu)) : 0);
          w.tex.slice(cu * 4, cu * 4 + 4).forEach((i) => glow(i, mode === 'ray' || mode === 'off' ? 0 : pulse(ph, 0.6, 0.95) * (mode === 'ai' ? 0 : 1)));
        }
      },
      body: `
        <p><b>WGP</b>（Work Group Processor）是 RDNA 的“车间”，由两个 <b>CU</b> 组成。一个 WGP 有 128 个流处理器——和一个 Blackwell SM 的 128 个 CUDA 核心规模相当。</p>
        <div class="card formula">
          1 个 CU = 2 个 SIMD32 = 64 个流处理器<br>
          + 标量单元 + 1 个光线加速器<br>
          + 2 个 AI 加速器 + 4 个纹理单元
        </div>
        <h3>AMD 的三个特色</h3>
        <ul>
          <li><b>标量单元</b>：wavefront 里所有线程都一样的计算（循环计数、地址基址）只算一次，节省向量通道。</li>
          <li><b>wave32 与 wave64</b>：游戏多用 wave32，计算任务可用 wave64，后者在 SIMD32 上分两拍执行。</li>
          <li><b>双发射</b>：RDNA 3 起每条通道在满足条件时同一拍可多执行一条运算，所以 AMD 标称的 TFLOPS 会翻倍（RX 9070 XT 约 48.7 TFLOPS，否则约 24 TFLOPS）。实际游戏里能凑出双发射的指令有限，所以<b>不能直接拿 TFLOPS 比较两家的性能</b>。</li>
        </ul>
        <h3>光追与 AI 的做法不同</h3>
        <p>NVIDIA 的 RT Core 自己完成整个 BVH 遍历；AMD 的光线加速器主要负责求交测试，遍历的调度有一部分仍由着色器程序完成。RDNA 4 把每个 CU 的求交吞吐翻倍，光追性能比 RDNA 3 有大幅提升。AI 方面，RDNA 4 的 AI 加速器新增 FP8 和稀疏化，用于 FSR 4。</p>
        <p class="muted">切换上方动画对比不同执行方式。</p>`,
      legend: [
        [COL.sched, '指令调度'],
        [0xf7c46c, '标量单元'],
        [COL.reg, 'VGPR / SGPR'],
        [COL.fp32, 'SIMD32 通道'],
        [COL.int32, '双发射通道'],
        [COL.tensor, 'AI 加速器'],
        [COL.rt, '光线加速器'],
        [COL.tex, '纹理单元'],
        [COL.cache, 'L0 / LDS / 指令缓存'],
      ],
    };
  },
};
