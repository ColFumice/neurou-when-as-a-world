/**
 * X · demo 项目根；只由 App 传入 GameScreen，不写进 chartLoader。
 *
 * R5b.2：允许 e2e 通过 Vite 环境变量指向独立 fixture；
 * 生产/正常 dev 不设置该变量，保持原路径。
 */
const ENV_ROOT = import.meta.env?.VITE_NEUROU_PROJECT_ROOT;

export const DEMO_PROJECT_ROOT =
  typeof ENV_ROOT === 'string' && ENV_ROOT.trim().length > 0
    ? ENV_ROOT.trim()
    : 'D:\\Project\\A_New_Begin\\Neurou_official\\v4\\.stereo-demo\\project';
