// ============================================================
// Cocos Creator 3.8.8 引擎类型桩（ambient module 'cc'）
//
// 用途：
//   本工程尚未导入 Cocos Creator 编辑器（node_modules/cc 与
//   temp/tsconfig.cocos.json 不存在）。为了让 presentation 域
//   五个 Cocos 组件（FrameDriver / CameraRig / InputCollector /
//   DebugPanel / ProtagonistView）在 tsc --noEmit 下能通过类型
//   检查，本文件以 ambient module 声明提供最小可用类型桩。
//
// 偏差声明（VERDICT-094 引擎隔离；偏差栏 1）：
//   桩类型不等于真实 Cocos 引擎类型。真实类型由 Cocos Creator
//   3.8.8 编辑器在首次打开本工程时生成 temp/tsconfig.cocos.json
//   + 内置 cc 类型声明；届时编辑器编译资产脚本以编辑器侧
//   配置为准，本桩仅供阶段 1 命令行 tsc / IDE 检查使用。
//   真实引擎导入后，本桩将被覆盖（temp/ 路径优先于 types/）；
//   组件签名不变（VERDICT-094：补齐 @ccclass / extends
//   Component 时方法签名不变）。
//
// 位置约束（E8 不触发）：
//   本文件位于工程根 types/ 目录，不在 src/ 任何逻辑模块下，
//   check-dependencies E8 只扫描 constants/ledger/world/
//   character/trace/chart/director 七个逻辑模块目录。
//
// 类型覆盖（最小够用）：
//   Component / _decorator.ccclass / _decorator.property /
//   Node / input / EventKeyboard / KeyCode / EventMouse /
//   EventTouch / Label / UITransform / Graphics / Camera /
//   CameraProjection / RenderTexture / SpriteFrame / Sprite /
//   MeshRenderer / Material / Vec3 / Vec4 / Color / Enum / sys /
//   primitives / utils.MeshUtils / DirectionalLight / Ambient /
//   screen
// ============================================================

declare module 'cc' {
  /** 组件基类（Cocos 3.8） */
  export class Component {
    /** 挂载节点（由引擎注入，非空） */
    node: Node;
    /** 是否启用（引擎生命周期字段） */
    enabled: boolean;
    /** 加载生命周期（灰盒空实现） */
    onLoad?(): void;
    /** 启用生命周期（灰盒空实现） */
    onEnable?(): void;
    /** 禁用生命周期（灰盒空实现） */
    onDisable?(): void;
    /** 销毁生命周期（灰盒空实现） */
    onDestroy?(): void;
    /** 每帧更新生命周期（灰盒空实现） */
    update?(deltaTime: number): void;
  }

  /** 节点（Cocos 3.8） */
  export class Node {
    name: string;
    /** 节点是否激活（Cocos 3.8 Node.active；false 时节点及其子树不渲染） */
    active: boolean;
    position: Vec3;
    /** 缩放（Cocos 3.8） */
    scale: Vec3;
    /** 旋转欧拉角（度） */
    eulerAngles: Vec3;
    /** 相机 / UI 可见性层（Cocos Layers 位掩码） */
    layer: number;
    children: Node[];
    /** 父节点 */
    parent: Node | null;
    constructor(name?: string);
    /** 添加子节点 */
    addChild(child: Node): void;
    /** 按 name 查找子节点 */
    getChildByName(name: string): Node | null;
    /** 查找组件 */
    getComponent<T extends Component>(c: new () => T): T | null;
    /** 添加组件 */
    addComponent<T extends Component>(c: new () => T): T;
    /** 设置世界 / 本地位置（Cocos 3.8） */
    setPosition(x: number, y: number, z: number): void;
    /** 设置缩放（Cocos 3.8） */
    setScale(x: number, y: number, z: number): void;
    /** 按欧拉角（度）设置旋转（Cocos 3.8） */
    setRotationFromEuler(x: number, y: number, z: number): void;
  }

  /** 三维向量（Cocos 3.8） */
  export class Vec3 {
    x: number;
    y: number;
    z: number;
    constructor(x?: number, y?: number, z?: number);
    /** 设置分量（链式） */
    set(x: number, y: number, z: number): Vec3;
  }

  /** 四维向量（Cocos 3.8；滤镜 vec4 uniform 传参用） */
  export class Vec4 {
    x: number;
    y: number;
    z: number;
    w: number;
    constructor(x?: number, y?: number, z?: number, w?: number);
  }

  /** 颜色（Cocos 3.8） */
  export class Color {
    r: number;
    g: number;
    b: number;
    a: number;
    constructor(r?: number, g?: number, b?: number, a?: number);
  }

  /** 装饰器命名空间（Cocos 3.8） */
  export namespace _decorator {
    /**
     * @ccclass 类装饰器：注册组件类型到 Cocos 类型注册表。
     * 灰盒桩：返回接受构造函数并原样返回的装饰器。
     */
    export function ccclass(name?: string): <T extends new (...args: any[]) => any>(target: T) => T;
    /**
     * @property 属性装饰器：声明可序列化字段供编辑器面板配置。
     * 灰盒桩：返回属性装饰器。
     */
    export function property(opts?: any): (target: object, propertyKey: string) => void;
  }

  /** 输入系统命名空间（Cocos 3.8） */
  export namespace input {
    /** 启动输入监听 */
    export function on(type: string, callback: (e: any) => void, target?: any): void;
    /** 停止输入监听 */
    export function off(type: string, callback: (e: any) => void, target?: any): void;
  }

  /** 键盘事件（Cocos 3.8） */
  export class EventKeyboard {
    keyCode: KeyCode;
    /** 裸键名（KeyboardEvent.key 口径；数字键为 '0'~'9'） */
    key: string;
    /** 按下 / 抬起类型判别（IsPressed / Released） */
    type: string;
  }

  /** 键码枚举（Cocos 3.8，仅列出灰盒测试需要键位） */
  export enum KeyCode {
    KEY_W = 'W',
    KEY_A = 'A',
    KEY_S = 'S',
    KEY_D = 'D',
    TAB = 'Tab',
    ARROW_UP = 'ArrowUp',
    ARROW_DOWN = 'ArrowDown',
    ARROW_LEFT = 'ArrowLeft',
    ARROW_RIGHT = 'ArrowRight',
    SPACE = 'Space',
    ESCAPE = 'Escape',
    DIGIT_0 = 'Digit0',
    DIGIT_1 = 'Digit1',
    DIGIT_2 = 'Digit2',
    DIGIT_3 = 'Digit3',
    DIGIT_4 = 'Digit4',
    DIGIT_5 = 'Digit5',
    DIGIT_6 = 'Digit6',
    DIGIT_7 = 'Digit7',
    DIGIT_8 = 'Digit8',
    DIGIT_9 = 'Digit9',
    NUMPAD_0 = 'Numpad0',
    NUMPAD_1 = 'Numpad1',
    NUMPAD_2 = 'Numpad2',
    NUMPAD_3 = 'Numpad3',
    NUMPAD_4 = 'Numpad4',
    NUMPAD_5 = 'Numpad5',
    NUMPAD_6 = 'Numpad6',
    NUMPAD_7 = 'Numpad7',
    NUMPAD_8 = 'Numpad8',
    NUMPAD_9 = 'Numpad9',
    ENTER = 'Enter',
  }

  /** 鼠标事件（Cocos 3.8） */
  export class EventMouse {
    button: number;
    /** 指针屏幕坐标（左下角原点；真实 cc 访问器） */
    getLocationX(): number;
    getLocationY(): number;
    getScrollY(): number;
    type: string;
  }

  /** 触控事件（Cocos 3.8） */
  export class EventTouch {
    touches: Touch[];
    type: string;
  }

  /** 触控点（Cocos 3.8） */
  export class Touch {
    locationX: number;
    locationY: number;
  }

  /** UI 文本组件（Cocos 3.8） */
  export class Label extends Component {
    /** 文本内容 */
    string: string;
    /** 字号 */
    fontSize: number;
    /** 行高 */
    lineHeight: number;
    /** 文本颜色 */
    color: Color;
  }

  /** UI 变换组件（Cocos 3.8） */
  export class UITransform extends Component {
    width: number;
    height: number;
    setContentSize(width: number, height: number): void;
  }

  /**
   * 矢量绘图组件（Cocos 3.8 真名 Graphics，引擎内为
   * GraphicsComponent 的导出别名）。灰盒桩仅声明绘制用到的成员。
   */
  export class Graphics extends Component {
    /** 填充色（含 alpha） */
    fillColor: Color;
    /** 描边色（含 alpha） */
    strokeColor: Color;
    /** 描边线宽 */
    lineWidth: number;
    /** 清空画布 */
    clear(): void;
    /** 矩形路径（左下角 + 宽高） */
    rect(x: number, y: number, width: number, height: number): void;
    /** 圆形路径 */
    circle(x: number, y: number, radius: number): void;
    /** 填充当前路径 */
    fill(): void;
    /** 描边当前路径 */
    stroke(): void;
    /** 移动画笔 */
    moveTo(x: number, y: number): void;
    /** 画直线 */
    lineTo(x: number, y: number): void;
  }

  /** 相机清屏标志（Cocos 3.8 CameraClearFlag） */
  export enum CameraClearFlag {
    /** 天空盒清屏 */
    SKYBOX = 0,
    /** 纯色清屏（清颜色 + 清深度） */
    SOLID_COLOR = 1,
    /** 只清深度（保留已有颜色，让先渲染的相机内容透过来） */
    DEPTH_ONLY = 2,
    /** 不清屏 */
    DONT_CLEAR = 3,
  }

  /** 相机投影类型（Cocos 3.8 CameraProjection） */
  export enum CameraProjection {
    ORTHO = 0,
    PERSPECTIVE = 1,
  }

  /** 相机组件（Cocos 3.8） */
  export class Camera extends Component {
    /** 正交/透视切换（true=正交） */
    orthoHeight: number;
    /** 透视视野（度） */
    fov: number;
    /** 透视远平面 */
    far: number;
    /** 透视近平面 */
    near: number;
    /** 是否正交 */
    ortho: boolean;
    /** 投影类型（正交 / 透视；真实成员名 projection） */
    projection: CameraProjection;
    /** 清屏标志（Cocos 3.8） */
    clearFlags: CameraClearFlag;
    /** 清屏颜色（Cocos 3.8 Skybox cleared color） */
    clearColor: Color;
    /** 渲染优先级（数值小先渲染；3D 相机一般设为负值以早于 UI 相机） */
    priority: number;
    /** 可见层掩码（Cocos Layers 位掩码；默认全可见） */
    visibility: number;
    /** 渲染目标纹理（设置后相机渲到 RT 而非屏幕；灰盒仅 RenderTexture） */
    targetTexture: RenderTexture | null;
  }

  /** 渲染纹理（Cocos 3.8 RenderTexture；反色滤镜 RT 相机用） */
  export class RenderTexture {
    /** 重设 RT 尺寸 / 名称（真实签名 IRenderTextureCreateInfo 的子集） */
    reset(info: { name?: string; width: number; height: number }): void;
  }

  /** 精灵帧（Cocos 3.8 SpriteFrame；可承载 RenderTexture 作纹理） */
  export class SpriteFrame {
    /** 纹理（真实为 TextureBase；灰盒仅 RenderTexture 用例） */
    texture: RenderTexture | null;
  }

  /** 平行光组件（Cocos 3.8，PBR 主光源） */
  export class DirectionalLight extends Component {
    /** 光颜色 */
    color: Color;
    /** 亮度（Cocos 使用 UTF 单位，常用 1~3） */
    illuminance: number;
  }

  /** 环境光组件（Cocos 3.8 场景环境光） */
  export class Ambient extends Component {
    /** 环境光天空色 */
    skyColor: Color;
    /** 环境光天空亮度 */
    skyIllum: number;
    /** 环境光地面色 */
    groundAlbedo: Color;
  }

  /** 2D 精灵组件（Cocos 3.8） */
  export class Sprite extends Component {
    color: Color;
    /** 精灵帧 */
    spriteFrame: SpriteFrame | null;
    /** 尺寸模式（CUSTOM = 用节点 UITransform 尺寸） */
    sizeMode: Sprite.SizeMode;
    /** 精灵类型（SIMPLE = 普通平铺） */
    type: Sprite.Type;
    /** 自定义材质（覆盖内建材质） */
    customMaterial: Material | null;
  }

  export namespace Sprite {
    /** 尺寸模式枚举（灰盒仅用 CUSTOM） */
    export enum SizeMode {
      CUSTOM = 0,
    }
    /** 精灵类型枚举（灰盒仅用 SIMPLE） */
    export enum Type {
      SIMPLE = 0,
    }
  }

  /** 网格渲染器组件（Cocos 3.8，灰盒用立方体占位） */
  export class MeshRenderer extends Component {
    /** 网格资源 */
    mesh: any;
    /** 材质 */
    material: Material | null;
  }

  /** 材质（Cocos 3.8，灰盒桩） */
  export class Material {
    /** 按 effect 名初始化材质 */
    initialize(info: { effectName: string }): void;
    /** 设置 uniform 属性（如 mainColor） */
    setProperty(name: string, value: any): void;
    /** 渲染通道（初始化失败 / Effect 缺失时为空数组） */
    readonly passes: unknown[];
  }

  /** 屏幕信息（Cocos 3.8 screen；灰盒仅用 windowSize） */
  export const screen: {
    /** 当前窗口尺寸（物理像素） */
    readonly windowSize: { width: number; height: number };
  };

  /** 基础图元集合（Cocos 3.8，灰盒桩） */
  export namespace primitives {
    /** 立方体几何信息（灰盒桩，返回 any） */
    export function box(options?: {
      width?: number;
      height?: number;
      length?: number;
    }): any;
  }

  /** 工具集合（Cocos 3.8，灰盒桩） */
  export namespace utils {
    /** 网格工具 */
    export namespace MeshUtils {
      /** 由几何信息创建网格资源 */
      export function createMesh(geometry: any): any;
    }
  }

  /** 枚举辅助（Cocos 3.8，灰盒桩） */
  export function Enum<T>(obj: T): T;
}
