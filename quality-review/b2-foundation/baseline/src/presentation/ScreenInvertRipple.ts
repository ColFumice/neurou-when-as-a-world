// INV-11: visual state only; capture and invert a soft circular region.
import { _decorator, Component, Node, Camera, Sprite, SpriteFrame, RenderTexture,
  Material, EffectAsset, Vec4, UITransform, screen, resources, isValid } from 'cc';
import { easeExpand } from './DeepTraceRevealSequence';
const { ccclass } = _decorator;
const START_RADIUS_VIEW_RATIO = 2 / 15;
const SOFT_EDGE_BASE_PX = 8;
const SOFT_EDGE_RADIUS_SCALE = 0.02;
const SOFT_EDGE_RADIUS_CAP_PX = 600;

@ccclass('ScreenInvertRipple')
export class ScreenInvertRipple extends Component {
  private uiRoot: Node | null = null;
  private sourceCamera: Camera | null = null;
  private rtCamera: Camera | null = null;
  private renderTexture: RenderTexture | null = null;
  private overlayNode: Node | null = null;
  private material: Material | null = null;
  private frame: SpriteFrame | null = null;
  private active = false;
  private widthPx = 0;
  private heightPx = 0;
  private startRadiusPx = 0;
  private endRadiusPx = 0;
  private centerX = 0;
  private centerY = 0;

  onLoad(): void {
    resources.load('effects/invert-ripple', EffectAsset, (error, effect) => {
      if (!isValid(this, true)) { return; }
      if (error || !effect) {
        console.error('[ScreenInvertRipple] Effect 加载失败', error); return;
      }
      this.material = new Material();
      this.material.initialize({ effectAsset: effect, defines: { SAMPLE_FROM_RT: true } });
    });
  }
  bindUiRoot(root: Node): void { this.uiRoot = root; }
  bindSourceCamera(camera: Camera): void { this.sourceCamera = camera; }
  begin(): boolean {
    if (this.active) { return true; }
    if (!this.uiRoot || !this.sourceCamera || !this.material) { return false; }
    this.widthPx = Math.max(2, screen.windowSize.width);
    this.heightPx = Math.max(2, screen.windowSize.height);
    const projected = this.sourceCamera.worldToScreen(this.node.worldPosition);
    this.centerX = projected.x / this.widthPx;
    this.centerY = projected.y / this.heightPx;
    this.ensurePipeline();
    this.active = true;
    this.rtCamera!.enabled = true;
    this.overlayNode!.active = true;
    this.overlayNode!.setSiblingIndex(this.uiRoot.children.length - 1);
    this.updateProgress(0, 0);
    return true;
  }
  updateProgress(progress: number, flash: number): void {
    if (!this.active || !this.material || !this.sourceCamera || !this.rtCamera) { return; }
    if (screen.windowSize.width !== this.widthPx || screen.windowSize.height !== this.heightPx) {
      this.widthPx = Math.max(2, screen.windowSize.width);
      this.heightPx = Math.max(2, screen.windowSize.height);
      this.ensurePipeline();
    }
    this.rtCamera.projection = this.sourceCamera.projection;
    this.rtCamera.fov = this.sourceCamera.fov;
    this.rtCamera.fovAxis = this.sourceCamera.fovAxis;
    this.rtCamera.orthoHeight = this.sourceCamera.orthoHeight;
    this.rtCamera.clearColor = this.sourceCamera.clearColor;
    const p = Math.max(0, Math.min(1, progress));
    const radiusPx = this.startRadiusPx + (this.endRadiusPx - this.startRadiusPx) * easeExpand(p);
    const softPx = SOFT_EDGE_BASE_PX + Math.min(radiusPx, SOFT_EDGE_RADIUS_CAP_PX) * SOFT_EDGE_RADIUS_SCALE;
    this.material.setProperty('u_centerRadius', new Vec4(
      this.centerX * this.widthPx, this.centerY * this.heightPx, radiusPx, softPx));
    this.material.setProperty('u_params', new Vec4(
      easeExpand(1 - p), Math.max(0, Math.min(1, flash)), this.widthPx, this.heightPx));
  }
  end(): void {
    this.active = false;
    if (this.rtCamera && isValid(this.rtCamera, true)) { this.rtCamera.enabled = false; }
    if (this.overlayNode && isValid(this.overlayNode, true)) { this.overlayNode.active = false; }
  }
  onDisable(): void { this.end(); }
  onDestroy(): void {
    this.end();
    if (this.rtCamera && isValid(this.rtCamera.node, true)) { this.rtCamera.node.destroy(); }
    if (this.overlayNode && isValid(this.overlayNode, true)) { this.overlayNode.destroy(); }
    this.frame?.destroy();
    this.material?.destroy();
    this.renderTexture?.destroy();
  }
  private ensurePipeline(): void {
    if (!this.renderTexture) { this.renderTexture = new RenderTexture(); }
    this.renderTexture.reset({ width: Math.round(this.widthPx), height: Math.round(this.heightPx) });
    if (!this.rtCamera) {
      const cameraNode = new Node('DeepTraceInvertRtCamera');
      this.sourceCamera!.node.addChild(cameraNode);
      this.rtCamera = cameraNode.addComponent(Camera);
      this.rtCamera.enabled = false;
      this.rtCamera.near = this.sourceCamera!.near;
      this.rtCamera.far = this.sourceCamera!.far;
      this.rtCamera.clearFlags = this.sourceCamera!.clearFlags;
      this.rtCamera.visibility = this.sourceCamera!.visibility;
      this.rtCamera.priority = this.sourceCamera!.priority - 1;
      this.rtCamera.targetTexture = this.renderTexture;
    }
    if (!this.overlayNode) {
      const node = new Node('ScreenInvertRippleOverlay');
      node.layer = this.uiRoot!.layer;
      this.uiRoot!.addChild(node);
      node.addComponent(UITransform);
      const sprite = node.addComponent(Sprite);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      sprite.type = Sprite.Type.SIMPLE;
      sprite.customMaterial = this.material;
      this.overlayNode = node;
    }
    const rootTransform = this.uiRoot!.getComponent(UITransform)!;
    this.overlayNode.getComponent(UITransform)!.setContentSize(rootTransform.width, rootTransform.height);
    const sprite = this.overlayNode.getComponent(Sprite)!;
    sprite.spriteFrame = null;
    this.frame?.destroy();
    this.frame = new SpriteFrame();
    this.frame.texture = this.renderTexture;
    sprite.spriteFrame = this.frame;
    this.startRadiusPx = START_RADIUS_VIEW_RATIO * this.heightPx;
    this.endRadiusPx = Math.max(this.startRadiusPx + 1, Math.hypot(
      Math.max(this.centerX, 1 - this.centerX) * this.widthPx,
      Math.max(this.centerY, 1 - this.centerY) * this.heightPx));
  }
}
