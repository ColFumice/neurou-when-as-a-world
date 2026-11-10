interface WorldPixelZoomProps {
  active: boolean;
}

export function WorldPixelZoom({ active }: WorldPixelZoomProps) {
  return (
    <div
      className={`console-pixel-zoom ${active ? 'is-active' : ''}`}
      aria-hidden={!active}
    >
      <div className="console-pixel-zoom__grid">
        {Array.from({ length: 64 }, (_, index) => (
          <span key={index} style={{ animationDelay: `${(index % 8) * 40}ms` }} />
        ))}
      </div>
      <p className="console-pixel-zoom__caption">zoom / pixel resolve</p>
    </div>
  );
}
