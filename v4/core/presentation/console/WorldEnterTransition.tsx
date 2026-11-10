interface WorldEnterTransitionProps {
  active: boolean;
  flash?: boolean;
  worldName: string;
  prologue?: string;
}

export function WorldEnterTransition({
  active,
  flash = false,
  worldName,
  prologue = '',
}: WorldEnterTransitionProps) {
  return (
    <div
      className={[
        'console-enter-transition',
        active ? 'is-active' : '',
        flash ? 'is-flashing' : '',
      ].join(' ')}
      aria-hidden={!active}
    >
      <div className="console-enter-transition__black" />
      <div className="console-enter-transition__flash" />
      <div className="console-enter-transition__label">
        <span>ENTER</span>
        <strong>{worldName}</strong>
        {prologue ? (
          <p className="console-enter-transition__prologue">{prologue}</p>
        ) : null}
      </div>
    </div>
  );
}
