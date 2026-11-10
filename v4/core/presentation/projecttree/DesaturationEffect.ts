/** P · projecttree：右键撤回时的降饱和过渡。 */

export class DesaturationEffect {
  static filter(active: boolean, amount = 0.92): string {
    return `saturate(${active ? Math.max(0, 1 - amount) : 1})`;
  }

  static transition(active: boolean): string {
    return active
      ? 'filter 70ms ease-out'
      : 'filter 420ms ease-in';
  }
}
