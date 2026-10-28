// 12 NVIDIA vs AMD：同尺度并排对比 SM 与 WGP，术语对照
import { THREE, COL, label } from '../kit.js';
import { buildSM, buildWGP } from '../chips.js';

export default {
  id: 'compare',
  group: '对比总结',
  title: 'NVIDIA 与 AMD 架构对照',
  build(ctx) {
    const root = new THREE.Group();
    const sm = buildSM(root, { x: -10.5, z: 0 });
    const wgp = buildWGP(root, { x: 10.5, z: 0 });
    void sm;
    void wgp;
    label('NVIDIA Blackwell SM<small>128 CUDA 核心</small>', -10.5, 1.6, 11, { cls: 'big', parent: root });
    label('AMD RDNA 4 WGP<small>128 流处理器（2 个 CU）</small>', 10.5, 1.6, 8.6, { cls: 'big', parent: root });

    let focus = 'both';
    ctx.ui.seg(
      '镜头',
      [
        { v: 'both', t: '并排' },
        { v: 'n', t: '看 SM' },
        { v: 'a', t: '看 WGP' },
      ],
      focus,
      (v) => {
        if (v === 'both') ctx.view([0, 34, 39], [0, 0, 1]);
        if (v === 'n') ctx.view([-10.5, 20, 19], [-10.5, 0, 0.5]);
        if (v === 'a') ctx.view([10.5, 19, 16], [10.5, 0, 0.3]);
      }
    );

    return {
      root,
      view: { pos: [0, 34, 39], target: [0, 0, 1] },
      body: `
        <p>两家的 GPU 原理相同——海量 SIMD 通道 + 多级缓存 + 专用加速单元，只是命名和取舍不同。一个 Blackwell SM 和一个 RDNA 4 WGP 的通道数刚好都是 128，可以直接对照：</p>
        <div class="card">
          <table class="tbl">
            <tr><th>概念</th><th>NVIDIA</th><th>AMD</th></tr>
            <tr><td>大分区</td><td>GPC</td><td>着色器引擎 SE</td></tr>
            <tr><td>计算模块</td><td>SM</td><td>WGP（= 2 个 CU）</td></tr>
            <tr><td>运算通道</td><td>CUDA 核心</td><td>流处理器</td></tr>
            <tr><td>线程组</td><td>Warp（32）</td><td>Wavefront（32 / 64）</td></tr>
            <tr><td>线程块</td><td>Thread Block / CTA</td><td>Workgroup</td></tr>
            <tr><td>块内共享存储</td><td>共享内存</td><td>LDS</td></tr>
            <tr><td>矩阵单元</td><td>Tensor Core</td><td>AI 加速器</td></tr>
            <tr><td>光追单元</td><td>RT Core</td><td>光线加速器</td></tr>
            <tr><td>大缓存</td><td>大容量 L2</td><td>L2 + Infinity Cache</td></tr>
            <tr><td>编程平台</td><td>CUDA</td><td>ROCm / HIP</td></tr>
            <tr><td>超分 / 帧生成</td><td>DLSS 4</td><td>FSR 4</td></tr>
          </table>
        </div>
        <h3>取舍上的差异</h3>
        <ul>
          <li><b>专用单元的比重</b>：NVIDIA 给 Tensor Core 和 RT Core 更多面积、更完整的功能（RT Core 独立完成 BVH 遍历），AI 与重度光追更强；AMD 更多复用 SIMD 通道，面积效率高、成本低。</li>
          <li><b>标量单元</b>：AMD 每个 CU 有独立的标量单元处理“所有线程都一样”的计算；NVIDIA 把这类工作交给编译器和统一的核心。</li>
          <li><b>缓存策略</b>：NVIDIA 把 L2 做大；AMD 加一层 Infinity Cache，用更窄、更便宜的显存位宽达到相近的有效带宽。</li>
          <li><b>封装</b>：AMD 在 RDNA 3 上率先在游戏卡用了 Chiplet；NVIDIA 游戏卡仍是单片大芯片。</li>
          <li><b>软件生态</b>：CUDA 起步早、库最完整，是 AI 与科学计算领域的事实标准；AMD 的 ROCm / HIP 在追赶，可以把 CUDA 代码较低成本地移植过去。</li>
        </ul>
        <div class="card">
          <div class="card-title">一句话总结</div>
          看显卡别只看 TFLOPS：<b>启用多少单元、频率多高、显存带宽和容量、缓存多大、功耗墙多高、专用单元多强、软件生态如何</b>，共同决定了它在你手里跑得多快。
        </div>`,
      legend: [
        [COL.sched, '调度 / 控制'],
        [COL.reg, '寄存器'],
        [COL.fp32, '运算通道'],
        [COL.int32, '双发射通道（AMD）'],
        [COL.tensor, 'Tensor / AI 加速器'],
        [COL.rt, 'RT Core / 光线加速器'],
        [COL.cache, '缓存 / 共享存储'],
        [COL.tex, '纹理单元'],
      ],
    };
  },
};
