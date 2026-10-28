// 章节顺序
import board from './board.js';
import cpuGpu from './cpu-gpu.js';
import pipeline from './pipeline.js';
import hierarchy from './hierarchy.js';
import nvDie from './nv-die.js';
import nvSm from './nv-sm.js';
import amdDie from './amd-die.js';
import amdWgp from './amd-wgp.js';
import chiplet from './amd-chiplet.js';
import wafer from './wafer.js';
import sku from './sku.js';
import compare from './compare.js';

export const chapters = [board, cpuGpu, pipeline, hierarchy, nvDie, nvSm, amdDie, amdWgp, chiplet, wafer, sku, compare];
