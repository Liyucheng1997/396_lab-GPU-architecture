# 显卡架构 3D

用 Three.js 交互式拆解 NVIDIA Blackwell 与 AMD RDNA 显卡架构：从整张显卡到芯片、SM / WGP 内部，再到晶圆良率和型号分档。

## 运行

需要 Node.js 18 及以上。

```bash
npm install
npm start
```

然后打开 http://localhost:5173 。`npm install` 只会安装 Three.js（0.169.0）；`server.js` 是零依赖的静态服务器。

## 章节

| # | 章节 | 内容 |
| --- | --- | --- |
| 01 | 一张显卡的构成 | PCB、GPU、显存、供电、均热板、热管、鳍片、风扇的爆炸图 |
| 02 | CPU 与 GPU 的根本区别 | 8 个大核 vs 1024 个小核“渲染比赛”，并行 / 串行两种任务 |
| 03 | 一帧画面是怎么画出来的 | 渲染管线 6 个阶段 + 光线追踪 BVH 支线 |
| 04 | 线程与存储的层级 | 线程 → warp → 线程块 → 网格；寄存器 → L1 → L2 →（Infinity Cache）→ 显存 |
| 05 | GB202 整颗芯片 | 12 GPC / 96 TPC / 192 SM，L2、显存控制器、I/O |
| 06 | SM 内部 | 4 个分区、warp 调度、CUDA / Tensor / RT Core 执行动画 |
| 07 | Navi 48 整颗芯片 | 4 SE / 32 WGP / 64 CU，Infinity Cache |
| 08 | WGP 内部 | 2 个 CU、SIMD32、标量单元、wave32 / wave64 / 双发射动画 |
| 09 | Navi 31 Chiplet | GCD + 6 MCD 封装，7900 XTX / XT / GRE 切换与拆解 |
| 10 | 晶圆与良率 | 300 mm 晶圆随机缺陷，完整 / 屏蔽 / 报废分类，良率与成本 |
| 11 | 同一颗芯片，不同显卡 | RTX 50 与 RX 9000 各型号的屏蔽单元、位宽、显存、算力对比 |
| 12 | NVIDIA 与 AMD 架构对照 | SM 与 WGP 同尺度并排，术语与设计取舍对照 |

操作：拖动旋转、滚轮缩放、右键平移，悬停查看部件说明，部分部件可点击进入下一层；键盘左右方向键翻章。

## 代码结构

- `js/main.js`：渲染器、相机、章节切换、悬停拾取、讲解面板
- `js/kit.js`：配色、批量方块（InstancedMesh）、标签、补间动画
- `js/chips.js`：SM / WGP 精细模型，按参数生成整颗 NVIDIA / AMD 芯片，芯片规格表
- `js/chapters/*.js`：每章一个文件，导出 `{ id, group, title, build(ctx) }`

## 说明

芯片布局是按真实层级结构组织的示意模型，不是显微照片的精确复刻；规格取自公开的参考设计数据，非公版显卡的频率和功耗会有差异。
