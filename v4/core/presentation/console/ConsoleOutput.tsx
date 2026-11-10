import { useEffect, useRef } from 'react';

interface ConsoleOutputProps {
  lines: readonly string[];
}

export function ConsoleOutput({ lines }: ConsoleOutputProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [lines]);

  return (
    <div
      ref={ref}
      className="console-output"
      role="log"
      aria-live="polite"
      aria-label="console 输出"
    >
      {lines.map((line, index) => {
        const isError = /^\s*(error\b|\[error\]|错误|失败)/i.test(line);
        const isAccent = !isError && (
          (/^\s*\[ OK \]/.test(line) && index % 5 === 0)
          || (/^\s*\[\s*\d+%\]/.test(line) && index % 7 === 0)
          || (/^\s*asset=/.test(line) && index % 9 === 0)
        );
        const className = [
          'console-output__line',
          isError ? 'console-output__line--error' : '',
          isAccent ? 'console-output__line--accent' : '',
        ].filter(Boolean).join(' ');
        return (
          <div className={className} key={`${index}-${line}`}>
            {line}
          </div>
        );
      })}
    </div>
  );
}
