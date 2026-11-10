interface WorldLoadProgressBarProps {
  active: boolean;
}

export function WorldLoadProgressBar({ active }: WorldLoadProgressBarProps) {
  return (
    <div
      className={`console-loading-progress ${active ? 'is-active' : ''}`}
      aria-hidden={!active}
    >
      <div className="console-loading-progress__lines">
        <span>loading world package...</span>
        <span>checking entry points...</span>
        <span>mounting parallax layers...</span>
      </div>
      <div className="console-loading-progress__bar">
        <span />
      </div>
      <div className="console-loading-progress__percent">[##########] 100%</div>
    </div>
  );
}
