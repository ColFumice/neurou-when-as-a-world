import {
  _decorator, Component, Node, Camera, Canvas, Color, Mesh, Material,
  MeshRenderer, primitives, utils, UITransform, isValid,
} from 'cc';
import { Bootstrap } from './Bootstrap';
import type { RuntimeGraph } from './Bootstrap';
import { FrameDriver } from './src/presentation/FrameDriver';
import { InputCollector } from './src/presentation/InputCollector';
import { CameraRig } from './src/presentation/CameraRig';
import { ProtagonistView } from './src/presentation/ProtagonistView';
import { applyFolderTheme } from './src/presentation/FolderTheme';
import type { WorldFolderEntry } from './src/presentation/FolderCatalog';

const { ccclass } = _decorator;
const WORLD_LAYER = 1 << 30;

/** A fresh local sandbox: existing movement/vertical rules, no traces, chart or narrative writes. */
@ccclass('MinimalWorldBuilder')
export class MinimalWorldBuilder extends Component {
  private entry: WorldFolderEntry | null = null;
  private graph: RuntimeGraph | null = null;
  private worldRoot: Node | null = null;
  private cameraRig: CameraRig | null = null;
  private camera: Camera | null = null;
  private info: HTMLElement | null = null;
  private readonly visualAssets: Array<Mesh | Material> = [];

  bindEntry(entry: WorldFolderEntry): void { this.entry = entry; }

  start(): void {
    this.graph = this.node.addComponent(Bootstrap).ensureRuntime();
    const worldRoot = new Node('MinimalWorld3D');
    (this.node.parent?.parent ?? this.node).addChild(worldRoot);
    worldRoot.layer = WORLD_LAYER;
    this.worldRoot = worldRoot;
    const uiCamera = this.node.parent?.getComponent(Canvas)?.cameraComponent ??
      this.node.getComponent(Canvas)?.cameraComponent;
    if (uiCamera) { uiCamera.clearFlags = Camera.ClearFlag.DEPTH_ONLY; }

    const rig = new Node('CameraRig');
    rig.layer = WORLD_LAYER; worldRoot.addChild(rig);
    this.cameraRig = rig.addComponent(CameraRig);
    this.cameraRig.bindProtagonist(this.graph.protagonist);
    const cameraNode = new Node('MinimalWorldCamera');
    cameraNode.layer = WORLD_LAYER; rig.addChild(cameraNode);
    cameraNode.setPosition(0, 7, 15); cameraNode.setRotationFromEuler(-24, 0, 0);
    const camera = cameraNode.addComponent(Camera);
    camera.near = 0.1; camera.far = 200; camera.fov = 45;
    camera.priority = -1; camera.visibility = WORLD_LAYER;
    camera.clearColor = new Color(135, 175, 220, 255);
    camera.clearFlags = Camera.ClearFlag.SOLID_COLOR;
    this.camera = camera;

    this.addBox('Ground', 60, 0.2, 60, 0, -0.9, 0, new Color(83, 94, 105));
    this.addBox('SpawnPoint', 2.6, 0.05, 2.6, 0, -0.775, 0, new Color(170, 185, 170));
    this.addBox('LateralGuide', 60, 0.025, 0.04, 0, -0.785, -2, new Color(123, 139, 150));
    this.addBox('DepthGuide', 0.04, 0.025, 60, -2, -0.785, 0, new Color(123, 139, 150));
    const protagonistNode = this.addBox('Protagonist', 1, 1, 1, 0, 0, 0, new Color(220, 70, 70));
    const protagonistView = protagonistNode.addComponent(ProtagonistView);
    protagonistView.bindSource(this.graph.protagonist);

    const input = this.node.addComponent(InputCollector);
    input.bindCameraRig(this.cameraRig);
    input.bindChartStateProvider(() => this.graph!.session.getChartPlaybackState());
    input.bindChartContextProvider(() => false);
    input.bindWorldMotionProvider(() => this.graph!.session.isWorldMotionGated());
    const frames = this.node.addComponent(FrameDriver);
    frames.bindWiring(input, this.graph.session);
    frames.addRefreshable(protagonistView);
    frames.addRefreshable(this.cameraRig);
    frames.addRefreshable(this);

    this.info = document.createElement('aside');
    this.info.id = 'minimal-world-info';
    this.info.style.cssText = 'position:fixed;top:24px;left:24px;max-width:calc(100% - 48px);padding:16px 22px;background:var(--folder-panel);color:var(--folder-ink);font:16px/1.6 var(--folder-font);border:1px solid var(--folder-border);border-radius:4px;z-index:100;overflow-wrap:anywhere';
    applyFolderTheme(this.info);
    const title = document.createElement('strong'); title.textContent = this.entry?.title ?? '新世界';
    const hint = document.createElement('div'); hint.textContent = '出生点 · WASD 移动 · 空格跳跃 · 滚轮调整视距';
    this.info.append(title, hint); document.body.appendChild(this.info);
  }

  onFrameRefresh(): void {
    if (this.camera && this.cameraRig) { this.camera.fov = this.cameraRig.getViewDistance() * 4.5; }
    const transform = this.node.getComponent(UITransform);
    const parent = this.node.parent?.getComponent(UITransform);
    if (transform && parent) { transform.setContentSize(parent.width, parent.height); }
  }

  onDisable(): void {
    if (this.worldRoot && isValid(this.worldRoot, true)) { this.worldRoot.active = false; }
    this.info?.remove();
  }

  onDestroy(): void {
    this.info?.remove(); this.info = null;
    if (this.worldRoot && isValid(this.worldRoot, true)) { this.worldRoot.destroy(); }
    this.worldRoot = null;
    for (const asset of this.visualAssets) { if (isValid(asset, true)) { asset.destroy(); } }
    this.visualAssets.length = 0;
  }

  private addBox(
    name: string, width: number, height: number, length: number,
    x: number, y: number, z: number, color: Color,
  ): Node {
    const node = new Node(name); node.layer = WORLD_LAYER; this.worldRoot!.addChild(node);
    node.setPosition(x, y, z);
    const renderer = node.addComponent(MeshRenderer);
    const mesh = utils.createMesh(primitives.box({ width, height, length }));
    const material = new Material();
    material.initialize({ effectName: 'builtin-unlit' });
    material.setProperty('mainColor', color);
    renderer.mesh = mesh; renderer.setMaterial(material, 0);
    this.visualAssets.push(mesh, material);
    return node;
  }
}

