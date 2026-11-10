import { Filter, GlProgram, defaultFilterVert } from 'pixi.js';

const FRAGMENT = `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uK;

void main() {
  vec2 n = vTextureCoord * 2.0 - 1.0;
  float r2 = dot(n, n);
  vec2 src = 0.5 + n * (1.0 + uK * r2) * 0.5;
  finalColor = texture(uTexture, clamp(src, vec2(0.001), vec2(0.999)));
}
`;

/** P · projecttree：PixiJS 8 径向桶形鱼眼。 */
export class FisheyeEffect {
  readonly filter: Filter;
  private strength: number;

  constructor(strength = 0.18) {
    this.strength = strength;
    this.filter = new Filter({
      glProgram: new GlProgram({
        vertex: defaultFilterVert,
        fragment: FRAGMENT,
      }),
      resources: {
        fisheyeUniforms: {
          uK: { value: strength, type: 'f32' },
        },
      },
    });
  }

  setStrength(strength: number): void {
    this.strength = strength;
    const resources = this.filter.resources as {
      fisheyeUniforms?: { uniforms?: { uK?: number } };
    };
    if (resources.fisheyeUniforms?.uniforms) {
      resources.fisheyeUniforms.uniforms.uK = strength;
    }
  }

  getStrength(): number {
    return this.strength;
  }
}
