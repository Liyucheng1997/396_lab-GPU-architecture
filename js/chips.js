// 芯片模型库：NVIDIA SM / AMD WGP 精细模型，以及按参数生成的整颗芯片
// 坐标约定：x 向右，z 向“图纸下方”（靠近观众），y 向上；尺寸大致按真实面积比例（1 单位 ≈ 1 mm）
import { THREE, COL, Batch, group, label } from './kit.js';

// ====================== 文案 ======================
export const INFO = {
  sm: { t: 'SM 流式多处理器', d: 'Streaming Multiprocessor，NVIDIA GPU 的基本计算模块。Blackwell 每个 SM 有 128 个 CUDA 核心、4 个第五代 Tensor Core、1 个第四代 RT Core。', kv: [['CUDA 核心', '128'], ['Tensor Core', '4'], ['RT Core', '1'], ['寄存器', '256 KB'], ['L1 / 共享内存', '128 KB']] },
  part: { t: 'SM 分区（处理块）', d: '每个 SM 分成 4 个分区。每个分区有自己的调度器、寄存器堆和 32 个核心，每个周期可以给一个 warp（32 个线程）发射一条指令。' },
  l0i: { t: 'L0 指令缓存', d: '分区私有的指令缓存，存放马上要执行的指令。' },
  warp: { t: 'Warp 调度器', d: '从驻留在本分区的十几个 warp 里挑一个“操作数已就绪”的发射。某个 warp 在等显存数据时立刻换下一个——GPU 靠海量线程轮流上场来隐藏延迟，而不是像 CPU 那样靠大缓存和乱序执行。' },
  dispatch: { t: '分发单元', d: '把选中的指令送到对应的执行单元：FP32/INT32 核心、SFU、LD/ST 或 Tensor Core。' },
  rf: { t: '寄存器堆 64 KB', d: '16384 个 32 位寄存器，存放每个线程的局部变量，约 1 个周期就能读到。整颗 SM 共 256 KB，比 L1 还大——因为要同时养活上千个线程。' },
  core: { t: 'CUDA 核心（FP32 / INT32）', d: '最基本的运算通道：每周期完成一次乘加 FMA（= 2 次浮点运算）。Blackwell 的 128 个核心都能在 FP32 和 INT32 之间切换（Ada 只有一半可以）。', kv: [['每分区', '32 个'], ['每 SM', '128 个']] },
  tensor: { t: '第五代 Tensor Core', d: '专做矩阵乘加 D = A×B + C，一条指令算完一整块小矩阵。支持 FP4 / FP6 / FP8 / FP16 / BF16 / TF32 等格式，DLSS、帧生成和 AI 推理都靠它。' },
  ldst: { t: 'LD/ST 加载存储单元 ×4', d: '计算地址、从共享内存 / L1 / 显存读写数据。' },
  sfu: { t: 'SFU 特殊函数单元 ×4', d: '计算 sin、cos、倒数、平方根、指数等超越函数，比用普通核心拼凑快得多。' },
  l1i: { t: 'L1 指令缓存', d: 'SM 内 4 个分区共享的指令缓存。' },
  l1: { t: 'L1 数据缓存 / 共享内存 128 KB', d: '同一 SM 的线程共享。可以按需划分为硬件管理的 L1 缓存和程序员显式使用的共享内存（Shared Memory），线程块里的线程用它交换数据。' },
  tmu: { t: '纹理单元 TMU ×4', d: '纹理寻址与过滤（双线性、三线性、各向异性），把贴图采样成颜色。' },
  rt: { t: '第四代 RT Core', d: '用硬件完成光线追踪最耗时的两件事：遍历 BVH 包围盒树、做光线与三角形的相交测试。Blackwell 新增三角形簇相交与线性扫掠球体（毛发）等能力，服务于 Mega Geometry。' },

  wgp: { t: 'WGP 工作组处理器', d: 'Work Group Processor，RDNA 的基本构建块：2 个 CU 共享指令缓存、标量缓存和 128 KB LDS。地位相当于 NVIDIA 的 SM。', kv: [['CU', '2'], ['流处理器', '128'], ['AI 加速器', '4'], ['光线加速器', '2'], ['LDS', '128 KB']] },
  cu: { t: 'CU 计算单元', d: 'Compute Unit：2 个 SIMD32（共 64 个流处理器）、1 个光线加速器、2 个 AI 加速器、4 个纹理单元、L0 缓存和标量单元。', kv: [['流处理器', '64'], ['AI 加速器', '2'], ['光线加速器', '1'], ['纹理单元', '4']] },
  asched: { t: '指令调度器', d: '从驻留的多个 wavefront 中挑选指令，发往 SIMD、标量单元或纹理 / 内存单元。' },
  salu: { t: '标量单元 SALU', d: '处理一个 wavefront 内所有线程都相同的计算（循环计数、地址基址、分支条件），只算一次，不必 32 条通道重复算。这是 AMD 架构的一大特色。' },
  sgpr: { t: '标量寄存器 SGPR', d: '存放整个 wavefront 共用的值，供标量单元使用。' },
  vgpr: { t: '向量寄存器堆 VGPR', d: '每条通道（线程）私有的寄存器，相当于 NVIDIA 的寄存器堆。每个 SIMD 一份。' },
  lane: { t: 'SIMD32 向量通道', d: '32 条 FP32 通道：一个周期执行一个 wave32 的一条指令。wave64 通常分两拍执行（部分指令可借双发射单周期完成）。', kv: [['每 SIMD', '32 条'], ['每 CU', '64 条（流处理器）']] },
  dual: { t: '双发射（Dual-Issue）', d: 'RDNA 3 起，满足条件时每条通道同一周期可多执行一条 FP32 运算。所以 AMD 标称 TFLOPS 会翻倍，但游戏里能凑出双发射的指令比例有限。' },
  ai: { t: 'AI 加速器', d: '配合 SIMD 执行 WMMA 矩阵指令。RDNA 4 加入 FP8 与结构化稀疏，FSR 4 的机器学习超分依赖它。' },
  ra: { t: '光线加速器 Ray Accelerator', d: '硬件完成光线与包围盒 / 三角形的相交测试。RDNA 4 为第三代：相交测试吞吐翻倍，并支持定向包围盒（OBB）。BVH 遍历的调度仍有一部分由着色器程序完成。' },
  atex: { t: '纹理单元 ×4', d: '纹理寻址、采样与过滤。' },
  l0: { t: 'L0 向量缓存', d: '每个 CU 私有的第一级数据缓存。' },
  lds: { t: 'LDS 本地数据共享 128 KB', d: 'Local Data Share，相当于 NVIDIA 的共享内存，同一工作组的线程用来交换数据。WGP 内两个 CU 共享。' },
  icache: { t: '指令缓存', d: 'WGP 内两个 CU 共享。' },
  scache: { t: '标量数据缓存', d: 'WGP 内两个 CU 共享，供标量单元读取常量和地址。' },
};

// ====================== NVIDIA Blackwell SM（精细） ======================
export function buildSM(parent, { x = 0, y = 0, z = 0 } = {}) {
  const g = group(parent, x, y, z);
  const b = new Batch();
  const top = 0.3;
  const h = { cores: [], tensors: [], scheds: [], regs: [], dispatch: [], sfu: [], ldst: [], rt: null, tmu: [], l1: null, batch: b, group: g };
  b.add(0, 0, 0, 16, top, 20, COL.frame, INFO.sm);
  b.add(0, top, -9.1, 15.2, 0.3, 0.9, COL.cache, INFO.l1i);

  for (let p = 0; p < 4; p++) {
    const px = p % 2 ? 3.85 : -3.85;
    const pz0 = p < 2 ? -8.3 : -0.5;
    b.add(px, top, pz0 + 3.8, 7.4, 0.1, 7.6, 0x3b3f48, { ...INFO.part, t: `SM 分区 ${p + 1} / 4` });
    const y1 = top + 0.1;
    let cz = pz0 + 0.25;
    const row = (hh, dd, color, info, w = 7.0) => {
      const i = b.add(px, y1, cz + dd / 2, w, hh, dd, color, info);
      cz += dd + 0.15;
      return i;
    };
    row(0.25, 0.45, COL.cache, INFO.l0i);
    h.scheds.push(row(0.45, 0.6, COL.sched, INFO.warp));
    h.dispatch.push(row(0.3, 0.4, 0xf7c46c, INFO.dispatch));
    h.regs.push(row(0.55, 1.0, COL.reg, INFO.rf));
    const cores = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 8; c++) {
        cores.push(b.add(px - 3.5 + 0.4375 + c * 0.875, y1, cz + 0.25 + r * 0.66, 0.7, 0.45, 0.5, COL.fp32, INFO.core));
      }
    }
    h.cores.push(cores);
    cz += 4 * 0.66 + 0.1;
    h.tensors.push(b.add(px - 1.9, y1, cz + 0.62, 3.2, 0.85, 1.25, COL.tensor, INFO.tensor));
    for (let k = 0; k < 4; k++) {
      h.ldst.push(b.add(px + 0.55 + k * 0.82, y1, cz + 0.28, 0.66, 0.38, 0.5, COL.ldst, INFO.ldst));
      h.sfu.push(b.add(px + 0.55 + k * 0.82, y1, cz + 0.95, 0.66, 0.38, 0.5, COL.sfu, INFO.sfu));
    }
  }
  h.l1 = b.add(0, top, 8.05, 15.2, 0.5, 1.3, COL.cache, INFO.l1);
  for (let k = 0; k < 4; k++) h.tmu.push(b.add(-6.6 + k * 1.75, top, 9.35, 1.5, 0.45, 0.8, COL.tex, INFO.tmu));
  h.rt = b.add(3.8, top, 9.35, 7.4, 0.75, 0.8, COL.rt, INFO.rt);
  b.build(g);
  return h;
}

// ====================== AMD RDNA 4 WGP（精细） ======================
export function buildWGP(parent, { x = 0, y = 0, z = 0 } = {}) {
  const g = group(parent, x, y, z);
  const b = new Batch();
  const top = 0.3;
  const h = { lanes: [], dual: [], ai: [], ra: [], vgpr: [], sched: [], salu: [], tex: [], batch: b, group: g };
  b.add(0, 0, 0, 18, top, 14.6, COL.frame, INFO.wgp);
  b.add(-4.45, top, -6.6, 8.5, 0.3, 0.9, COL.cache, INFO.icache);
  b.add(4.45, top, -6.6, 8.5, 0.3, 0.9, COL.cache, INFO.scache);
  b.add(0, top, 0.55, 1.1, 0.55, 12.0, COL.cache, INFO.lds);

  for (let cu = 0; cu < 2; cu++) {
    const cx = cu ? 4.85 : -4.85;
    const y1 = top + 0.1;
    b.add(cx, top, 0.55, 7.7, 0.1, 12.0, 0x3b3f48, { ...INFO.cu, t: `CU 计算单元 ${cu + 1} / 2` });
    let cz = -5.3;
    h.sched.push(b.add(cx, y1, cz + 0.3, 7.3, 0.45, 0.6, COL.sched, INFO.asched));
    cz += 0.75;
    h.salu.push(b.add(cx - 1.85, y1, cz + 0.35, 3.6, 0.4, 0.7, 0xf7c46c, INFO.salu));
    b.add(cx + 1.85, y1, cz + 0.35, 3.6, 0.4, 0.7, 0x7fd0d8, INFO.sgpr);
    cz += 0.85;
    for (let s = 0; s < 2; s++) {
      const sx = cx + (s ? 1.85 : -1.85);
      const simd = `SIMD ${s + 1}`;
      h.vgpr.push(b.add(sx, y1, cz + 0.5, 3.6, 0.55, 1.0, COL.reg, { ...INFO.vgpr, t: `向量寄存器堆 VGPR · ${simd}` }));
      const lanes = [];
      const dual = [];
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 4; c++) {
          const lx = sx - 1.8 + 0.45 + c * 0.9;
          const lz = cz + 1.15 + 0.29 + r * 0.6;
          lanes.push(b.add(lx, y1, lz, 0.72, 0.38, 0.46, COL.fp32, INFO.lane));
          dual.push(b.add(lx, y1 + 0.42, lz, 0.46, 0.16, 0.3, COL.int32, INFO.dual));
        }
      }
      h.lanes.push(lanes);
      h.dual.push(dual);
      h.ai.push(b.add(sx, y1, cz + 6.2, 3.6, 0.7, 0.8, COL.tensor, { ...INFO.ai, t: `AI 加速器 · ${simd}` }));
    }
    cz += 6.75;
    h.ra.push(b.add(cx - 1.85, y1, cz + 0.45, 3.6, 0.7, 0.9, COL.rt, INFO.ra));
    for (let k = 0; k < 4; k++) h.tex.push(b.add(cx + 0.45 + k * 0.82, y1, cz + 0.45, 0.66, 0.45, 0.9, COL.tex, INFO.atex));
    cz += 1.05;
    b.add(cx, y1, cz + 0.3, 7.3, 0.35, 0.6, COL.cache, INFO.l0);
  }
  b.build(g);
  return h;
}

// ====================== 芯片缩略单元 ======================
// 一个 SM 的缩略模型（用在整颗芯片上）：返回它所有零件的 batch 下标
function smMini(b, x, y, z, info) {
  const parts = [];
  parts.push(b.add(x, y, z, 0.92, 0.1, 1.78, 0x40444d, info));
  for (let p = 0; p < 4; p++) {
    const px = x + (p % 2 ? 0.22 : -0.22);
    const pz = z - 0.5 + (p < 2 ? 0 : 0.62);
    parts.push(b.add(px, y + 0.1, pz - 0.06, 0.4, 0.2, 0.42, COL.fp32, info));
    parts.push(b.add(px, y + 0.1, pz + 0.24, 0.4, 0.26, 0.14, COL.tensor, info));
  }
  parts.push(b.add(x - 0.18, y + 0.1, z + 0.7, 0.5, 0.14, 0.28, COL.cache, info));
  parts.push(b.add(x + 0.27, y + 0.1, z + 0.7, 0.3, 0.24, 0.28, COL.rt, info));
  return parts;
}

// 一个 CU 的缩略模型
function cuMini(b, x, y, z, info) {
  const parts = [];
  parts.push(b.add(x, y, z, 0.92, 0.1, 1.9, 0x40444d, info));
  for (let s = 0; s < 2; s++) {
    const sx = x + (s ? 0.21 : -0.21);
    parts.push(b.add(sx, y + 0.1, z - 0.3, 0.38, 0.22, 0.9, COL.fp32, info));
    parts.push(b.add(sx, y + 0.1, z + 0.33, 0.38, 0.26, 0.22, COL.tensor, info));
  }
  parts.push(b.add(x - 0.2, y + 0.1, z + 0.68, 0.42, 0.24, 0.3, COL.rt, info));
  parts.push(b.add(x + 0.22, y + 0.1, z + 0.68, 0.36, 0.14, 0.3, COL.cache, info));
  return parts;
}

// 屏蔽 / 启用一组零件（颜色变灰、高度压扁）
export function setPartsEnabled(b, parts, on, t = 1, keepBase = true) {
  const off = new THREE.Color(COL.off);
  parts.forEach((i, k) => {
    const it = b.items[i];
    if (it._h0 === undefined) it._h0 = it.h;
    if (it._c0 === undefined) it._c0 = it.color.clone();
    if (k === 0 && keepBase) return; // 底座保留
    const target = on ? 1 : 0;
    const cur = it._on ?? 1;
    const v = cur + (target - cur) * t;
    if (t >= 1) it._on = target;
    b.move(i, { h: Math.max(0.02, it._h0 * (0.12 + 0.88 * v)) });
    b.color(i, off.clone().lerp(it._c0, v));
  });
}

// ====================== 按参数生成整颗 NVIDIA 芯片 ======================
// cfg: { name, gpc, tpc, mc, l2Slices, l2MB, transistors, area, node }
export function buildNvDie(parent, cfg, { labels = true } = {}) {
  const g = group(parent);
  const b = new Batch({ rough: 0.45 });
  const cols = Math.ceil(cfg.gpc / 2);
  const tpcRows = Math.ceil(cfg.tpc / 2);
  const gpcW = 4.4;
  const gpcD = 1.1 + tpcRows * 1.95 + 0.2;
  const side = 1.5;
  const W = cols * (gpcW + 0.2) + side * 2 + 0.4;
  const band = 3.0;
  const edge = 1.2;
  const D = gpcD * 2 + band + edge * 2 + 0.6;
  const dieInfo = { t: `${cfg.name} 芯片`, d: `${cfg.node} 工艺，约 ${cfg.transistors} 个晶体管，面积约 ${cfg.area} mm²。`, kv: [['GPC', cfg.gpc], ['TPC', cfg.gpc * cfg.tpc], ['SM', cfg.gpc * cfg.tpc * 2], ['CUDA 核心', (cfg.gpc * cfg.tpc * 256).toLocaleString()], ['L2 缓存', cfg.l2MB + ' MB'], ['显存位宽', cfg.mc * 32 + '-bit']] };
  b.add(0, 0, 0, W, 0.4, D, COL.die, dieInfo);
  const y0 = 0.4;
  const h = { group: g, batch: b, W, D, tpcs: [], gpcs: [], mcs: [], l2: [], labels: [] };

  // 显存控制器：上下边缘
  const perSide = cfg.mc / 2;
  const mcW = (W - 2.4) / perSide;
  for (let s = 0; s < 2; s++) {
    for (let k = 0; k < perSide; k++) {
      const x = -W / 2 + 1.2 + mcW * (k + 0.5);
      const z = (s ? 1 : -1) * (D / 2 - edge / 2 - 0.1);
      h.mcs.push([b.add(x, y0, z, mcW - 0.25, 0.22, edge - 0.2, COL.phy, { t: `显存控制器 #${h.mcs.length + 1}`, d: '32-bit GDDR7 内存控制器与 PHY（物理接口）。控制器数量 × 32 = 显存位宽，直接决定显存带宽。', kv: [['位宽', '32-bit'], ['总位宽', cfg.mc * 32 + '-bit']] })]);
    }
  }
  // 中央：L2 切片 + GigaThread / 交叉开关
  const hub = 4.2;
  const half = cfg.l2Slices / 2;
  const l2W = (W - side * 2 - hub - 0.6) / 2 / half;
  for (let s = 0; s < 2; s++) {
    for (let k = 0; k < half; k++) {
      const x = (s ? 1 : -1) * (hub / 2 + 0.15 + l2W * (k + 0.5));
      h.l2.push([b.add(x, y0, 0, l2W - 0.12, 0.35, band - 0.5, COL.l2, { t: 'L2 缓存切片', d: `全芯片共享的二级缓存，共 ${cfg.l2MB} MB。所有 SM 的显存读写都先经过这里，命中就不必去慢得多的显存。`, kv: [['每片', cfg.l2MB / cfg.l2Slices + ' MB'], ['总容量', cfg.l2MB + ' MB']] })]);
    }
  }
  b.add(0, y0, 0, hub, 0.5, band - 0.5, COL.sched, { t: 'GigaThread 引擎 + 交叉开关', d: '全局调度器：把成千上万个线程块（CTA）分配到各个 SM；交叉开关（Crossbar）把所有 GPC 连到 L2 和显存控制器。' });
  // 两侧：I/O
  const ioD = D - edge * 2 - 0.6;
  b.add(-W / 2 + side / 2 + 0.15, y0, -ioD / 4, side - 0.3, 0.3, ioD / 2 - 0.2, COL.io, { t: 'PCIe 5.0 主机接口', d: 'GPU 与 CPU / 主板通信的通道。x16 带宽约 64 GB/s（单向），比显存带宽小几十倍。' });
  b.add(-W / 2 + side / 2 + 0.15, y0, ioD / 4, side - 0.3, 0.3, ioD / 2 - 0.2, COL.io, { t: '显示引擎', d: '把帧缓冲里的画面编码成 DisplayPort 2.1 / HDMI 2.1 信号输出到显示器。' });
  b.add(W / 2 - side / 2 - 0.15, y0, -ioD / 4, side - 0.3, 0.3, ioD / 2 - 0.2, COL.io, { t: 'NVENC 视频编码器', d: '硬件视频编码（H.264 / HEVC / AV1），直播与录屏不占用 CUDA 核心。' });
  b.add(W / 2 - side / 2 - 0.15, y0, ioD / 4, side - 0.3, 0.3, ioD / 2 - 0.2, COL.io, { t: 'NVDEC 视频解码器', d: '硬件视频解码。' });

  // GPC
  let gi = 0;
  for (let row = 0; row < 2; row++) {
    const n = row === 0 ? cols : cfg.gpc - cols;
    for (let c = 0; c < n; c++) {
      const gx = -W / 2 + side + 0.3 + (gpcW + 0.2) * (c + 0.5);
      const gz = (row ? 1 : -1) * (band / 2 + 0.1 + gpcD / 2);
      const gIndex = gi++;
      const gInfo = { t: `GPC ${gIndex + 1} 图形处理簇`, d: `Graphics Processing Cluster：一个“迷你 GPU”，含 1 个光栅引擎、ROP 和 ${cfg.tpc} 个 TPC（${cfg.tpc * 2} 个 SM）。`, kv: [['TPC', cfg.tpc], ['SM', cfg.tpc * 2], ['CUDA 核心', cfg.tpc * 256]] };
      const frame = b.add(gx, y0, gz, gpcW, 0.08, gpcD, COL.frame, gInfo);
      const fz = row ? gz + gpcD / 2 - 0.6 : gz - gpcD / 2 + 0.6; // 光栅引擎放在靠芯片边缘一侧
      const raster = b.add(gx - 0.8, y0 + 0.08, fz, 2.6, 0.3, 0.8, COL.tex, { t: '光栅引擎 Raster Engine', d: '把三角形转换成像素片段（光栅化），并做早期剔除。每个 GPC 一个。' });
      const rop = b.add(gx + 1.35, y0 + 0.08, fz, 1.5, 0.3, 0.8, 0xf09a8f, { t: 'ROP 渲染输出单元', d: '深度测试、颜色混合、抗锯齿，把最终像素写入帧缓冲。Blackwell 每个 GPC 16 个 ROP。' });
      const gpc = { frame, raster, rop, x: gx, z: gz, tpcs: [] };
      h.gpcs.push(gpc);
      for (let t = 0; t < cfg.tpc; t++) {
        const tc = t % 2;
        const tr = Math.floor(t / 2);
        const tx = gx + (tc ? 1.03 : -1.03);
        const tz0 = row ? gz - gpcD / 2 + 0.2 : gz - gpcD / 2 + 1.2;
        const tz = tz0 + tr * 1.95 + 0.95;
        const tInfo = { t: `TPC 纹理处理簇（GPC ${gIndex + 1}）`, d: '每个 TPC = 2 个 SM + 1 个 PolyMorph 引擎（处理顶点获取、曲面细分、视口变换）。NVIDIA 通常以 TPC 为单位屏蔽残缺单元。' };
        const parts = [b.add(tx, y0 + 0.08, tz, 2.0, 0.05, 1.9, 0x30333a, tInfo)];
        const smInfo = { ...INFO.sm, t: `SM（GPC ${gIndex + 1} · TPC ${t + 1}）`, go: 'nv-sm', clickText: '点击查看 SM 内部 →' };
        parts.push(...smMini(b, tx - 0.49, y0 + 0.13, tz - 0.02, smInfo));
        parts.push(...smMini(b, tx + 0.49, y0 + 0.13, tz - 0.02, smInfo).slice(0));
        const tpc = { parts, gpc: gIndex, x: tx, z: tz };
        h.tpcs.push(tpc);
        gpc.tpcs.push(tpc);
      }
    }
  }
  b.build(g);

  if (labels) {
    h.labels.push(label(`${cfg.name}<small>${cfg.area} mm²</small>`, 0, 1.6, -D / 2 - 0.2, { cls: 'big', parent: g }));
    h.labels.push(label(`GPC × ${cfg.gpc}`, h.gpcs[0].x, 1.2, h.gpcs[0].z, { parent: g }));
    h.labels.push(label(`L2 ${cfg.l2MB} MB`, -hub / 2 - 2.5, 1.0, 0, { parent: g }));
    h.labels.push(label('GigaThread', 0, 1.1, 0, { parent: g }));
    h.labels.push(label(`显存控制器 ${cfg.mc}×32-bit`, 0, 0.9, D / 2 - edge / 2, { parent: g }));
  }
  return h;
}

// ====================== 按参数生成整颗 AMD 芯片 ======================
// cfg: { name, se, wgp, mc, icSlices, icMB, l2MB, chiplet }
export function buildAmdDie(parent, cfg, { labels = true } = {}) {
  const g = group(parent);
  const b = new Batch({ rough: 0.45 });
  const cols = Math.ceil(cfg.se / 2);
  const wRows = Math.ceil(cfg.wgp / 4);
  const seW = 4 * 2.2 + 0.3;
  const seD = 0.9 + wRows * 2.25 + 0.35;
  const side = cfg.chiplet ? 1.2 : 1.9;
  const W = cols * (seW + 0.2) + side * 2 + 0.4;
  const band = 2.4;
  const edge = cfg.chiplet ? 0.5 : 1.1;
  const D = seD * 2 + band + edge * 2 + 0.6;
  const cuTotal = cfg.se * cfg.wgp * 2;
  const dieInfo = cfg.chiplet
    ? { t: `${cfg.name} GCD 图形计算芯粒`, d: '只保留计算部分：着色器引擎、L2、命令处理器、媒体与显示。显存控制器和 Infinity Cache 被拆到了旁边的 MCD 上。', kv: [['SE', cfg.se], ['CU', cuTotal], ['流处理器', (cuTotal * 64).toLocaleString()], ['L2', cfg.l2MB + ' MB'], ['工艺', cfg.node]] }
    : { t: `${cfg.name} 芯片`, d: `${cfg.node} 工艺，约 ${cfg.transistors} 个晶体管，面积约 ${cfg.area} mm²，单片式设计。`, kv: [['着色器引擎', cfg.se], ['WGP', cfg.se * cfg.wgp], ['CU', cuTotal], ['流处理器', (cuTotal * 64).toLocaleString()], ['L2', cfg.l2MB + ' MB'], ['Infinity Cache', cfg.icMB + ' MB'], ['显存位宽', cfg.mc * 32 + '-bit']] };
  b.add(0, 0, 0, W, 0.4, D, COL.die, dieInfo);
  const y0 = 0.4;
  const h = { group: g, batch: b, W, D, wgps: [], ses: [], mcs: [], ic: [], labels: [] };

  if (!cfg.chiplet) {
    const perSide = cfg.mc / 2;
    const mcW = (W - 2.4) / perSide;
    for (let s = 0; s < 2; s++) {
      for (let k = 0; k < perSide; k++) {
        const x = -W / 2 + 1.2 + mcW * (k + 0.5);
        const z = (s ? 1 : -1) * (D / 2 - edge / 2 - 0.1);
        h.mcs.push([b.add(x, y0, z, mcW - 0.25, 0.22, edge - 0.2, COL.phy, { t: `GDDR6 显存控制器 #${h.mcs.length + 1}`, d: '32-bit 内存控制器与 PHY。控制器数量 × 32 = 显存位宽。', kv: [['总位宽', cfg.mc * 32 + '-bit']] })]);
      }
    }
    // Infinity Cache：左右两侧
    const per = cfg.icSlices / 2;
    const icD = (D - edge * 2 - 0.6) / per;
    for (let s = 0; s < 2; s++) {
      for (let k = 0; k < per; k++) {
        const z = -D / 2 + edge + 0.3 + icD * (k + 0.5);
        h.ic.push([b.add((s ? 1 : -1) * (W / 2 - side / 2 - 0.1), y0, z, side - 0.3, 0.4, icD - 0.15, COL.ic, { t: 'Infinity Cache 切片', d: `AMD 的第三级缓存（L3），共 ${cfg.icMB} MB。它拦截了大部分本该去显存的访问，让较窄的显存位宽也能获得接近宽位宽的“有效带宽”。`, kv: [['每片', cfg.icMB / cfg.icSlices + ' MB'], ['总容量', cfg.icMB + ' MB']] })]);
      }
    }
  } else {
    for (let s = 0; s < 2; s++) {
      for (let k = 0; k < 3; k++) {
        const z = (k - 1) * (D / 3.2);
        b.add((s ? 1 : -1) * (W / 2 - side / 2 - 0.1), y0, z, side - 0.4, 0.3, D / 3.2 - 0.6, COL.io, { t: 'Infinity Fanout 链路 PHY', d: '连接 MCD 的高密度扇出接口，每条链路约 900 GB/s，六条合计约 5.3 TB/s。' });
      }
    }
  }
  // 中央带：L2 + 命令处理器
  const hub = 5.0;
  b.add(0, y0, 0, hub, 0.5, band - 0.5, COL.sched, { t: '命令处理器 / 几何处理器 / 硬件调度', d: '读取驱动提交的命令，分配几何工作和计算工作组到各个着色器引擎。' });
  const l2W = (W - side * 2 - hub - 2.2) / 2;
  for (let s = 0; s < 2; s++) {
    b.add((s ? 1 : -1) * (hub / 2 + 0.2 + l2W / 2), y0, 0, l2W, 0.35, band - 0.5, COL.l2, { t: `L2 缓存（共 ${cfg.l2MB} MB）`, d: '全芯片共享的二级缓存，在 Infinity Cache 之前。' });
  }
  b.add(-W / 2 + side + 0.45, y0, 0, 0.6, 0.3, band - 0.6, COL.io, { t: '媒体引擎 / 显示 / PCIe', d: '视频编解码（AV1 / HEVC / H.264）、显示输出、PCIe 5.0 主机接口。' });

  let si = 0;
  for (let row = 0; row < 2; row++) {
    const n = row === 0 ? cols : cfg.se - cols;
    for (let c = 0; c < n; c++) {
      const sx = -W / 2 + side + 0.3 + (seW + 0.2) * (c + 0.5);
      const sz = (row ? 1 : -1) * (band / 2 + 0.1 + seD / 2);
      const sIndex = si++;
      const sInfo = { t: `着色器引擎 SE ${sIndex + 1}`, d: `Shader Engine：含图元单元、光栅器、渲染后端（RB）和 ${cfg.wgp} 个 WGP（${cfg.wgp * 2} 个 CU），地位相当于 NVIDIA 的 GPC。`, kv: [['WGP', cfg.wgp], ['CU', cfg.wgp * 2], ['流处理器', cfg.wgp * 128]] };
      const frame = b.add(sx, y0, sz, seW, 0.08, seD, COL.frame, sInfo);
      const fz = row ? sz + seD / 2 - 0.55 : sz - seD / 2 + 0.55;
      b.add(sx - 2.4, y0 + 0.08, fz, 3.6, 0.3, 0.7, COL.tex, { t: '图元单元 + 光栅器', d: '组装三角形、剔除背面、光栅化成像素片段。' });
      b.add(sx + 2.3, y0 + 0.08, fz, 3.6, 0.3, 0.7, 0xf09a8f, { t: '渲染后端 RB', d: '相当于 ROP：深度 / 模板测试、颜色混合，写入帧缓冲。' });
      const se = { frame, x: sx, z: sz, wgps: [] };
      h.ses.push(se);
      for (let w = 0; w < cfg.wgp; w++) {
        const wc = w % 4;
        const wr = Math.floor(w / 4);
        const wx = sx - seW / 2 + 0.15 + 2.2 * (wc + 0.5);
        const wz0 = row ? sz - seD / 2 + 0.25 : sz - seD / 2 + 1.1;
        const wz = wz0 + wr * 2.25 + 1.05;
        const wInfo = { ...INFO.wgp, t: `WGP（SE ${sIndex + 1} · #${w + 1}）` };
        const parts = [b.add(wx, y0 + 0.08, wz, 2.1, 0.05, 2.1, 0x30333a, wInfo)];
        const cuInfo = { ...INFO.cu, t: `CU（SE ${sIndex + 1} · WGP ${w + 1}）`, go: 'amd-wgp', clickText: '点击查看 WGP 内部 →' };
        parts.push(...cuMini(b, wx - 0.5, y0 + 0.13, wz, cuInfo));
        parts.push(...cuMini(b, wx + 0.5, y0 + 0.13, wz, cuInfo));
        const wgp = { parts, se: sIndex, x: wx, z: wz };
        h.wgps.push(wgp);
        se.wgps.push(wgp);
      }
    }
  }
  b.build(g);

  if (labels) {
    h.labels.push(label(`${cfg.name}${cfg.area ? `<small>${cfg.area} mm²</small>` : ''}`, 0, 1.6, -D / 2 - 0.2, { cls: 'big', parent: g }));
    h.labels.push(label(`着色器引擎 × ${cfg.se}`, h.ses[0].x, 1.2, h.ses[0].z, { parent: g }));
    h.labels.push(label(`L2 ${cfg.l2MB} MB`, -hub / 2 - 2.2, 1.0, 0, { parent: g }));
    if (!cfg.chiplet) {
      h.labels.push(label(`Infinity Cache ${cfg.icMB} MB`, W / 2 - side / 2, 1.0, 0, { parent: g }));
      h.labels.push(label(`显存控制器 ${cfg.mc}×32-bit`, 0, 0.9, D / 2 - edge / 2, { parent: g }));
    }
  }
  return h;
}

// ====================== 芯片参数 ======================
export const DIES = {
  GB202: { vendor: 'n', name: 'GB202', gpc: 12, tpc: 8, mc: 16, l2Slices: 16, l2MB: 128, transistors: '922 亿', area: 750, node: 'TSMC 4N' },
  GB203: { vendor: 'n', name: 'GB203', gpc: 7, tpc: 6, mc: 8, l2Slices: 8, l2MB: 64, transistors: '456 亿', area: 378, node: 'TSMC 4N' },
  GB205: { vendor: 'n', name: 'GB205', gpc: 5, tpc: 5, mc: 6, l2Slices: 6, l2MB: 48, transistors: '310 亿', area: 263, node: 'TSMC 4N' },
  GB206: { vendor: 'n', name: 'GB206', gpc: 3, tpc: 6, mc: 4, l2Slices: 4, l2MB: 32, transistors: '219 亿', area: 181, node: 'TSMC 4N' },
  NAVI48: { vendor: 'a', name: 'Navi 48', se: 4, wgp: 8, mc: 8, icSlices: 8, icMB: 64, l2MB: 8, transistors: '539 亿', area: 357, node: 'TSMC N4P' },
  NAVI44: { vendor: 'a', name: 'Navi 44', se: 2, wgp: 8, mc: 4, icSlices: 4, icMB: 32, l2MB: 4, transistors: '297 亿', area: 199, node: 'TSMC N4P' },
};
