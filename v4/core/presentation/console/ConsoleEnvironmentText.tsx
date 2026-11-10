import { useEffect, useState } from 'react';
import { ConsoleCommandList } from './ConsoleCommandList';

interface ConsoleEnvironmentTextProps {
  text: string;
}

export function ConsoleEnvironmentText({ text }: ConsoleEnvironmentTextProps) {
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    setVisible(0);
    const timer = window.setInterval(() => {
      setVisible((current) => {
        if (current >= text.length) {
          window.clearInterval(timer);
          return current;
        }
        return current + 1;
      });
    }, 30);
    return () => window.clearInterval(timer);
  }, [text]);

  return (
    <div className="console-environment" aria-label="console 环境文本">
      <p className="console-environment__text">
        {text.slice(0, visible)}
        {visible < text.length ? <span className="console-caret">▌</span> : null}
      </p>
      <div className="console-command-list" aria-label="命令表">
        {ConsoleCommandList.map((item) => (
          <span className="console-command-list__item" key={item.name}>
            <b>{item.name}</b>
            <span>{item.summary}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
