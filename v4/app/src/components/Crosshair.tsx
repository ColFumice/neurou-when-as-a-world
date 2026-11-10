import { useEffect, useRef, useState } from 'react';
import './crosshair.css';

/**
 * 全局全屏准星。
 *
 * 性能约束：
 * - pointermove 不触发 React render，只更新 rAF 中的 CSS 变量；
 * - 横/竖线是 100vw / 100vh 的固定元素，用 transform 平移；
 * - 中心缩放只作用于 core / glow / lens，四条线始终贴边。
 */
export function Crosshair() {
  const rootRef = useRef<HTMLDivElement>(null);
  const visibleRef = useRef(true);
  const [pressed, setPressed] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;

    const position = {
      x: Math.round(window.innerWidth / 2),
      y: Math.round(window.innerHeight / 2),
    };
    let frame = 0;

    const paint = () => {
      frame = 0;
      node.style.setProperty('--crosshair-x', `${position.x}px`);
      node.style.setProperty('--crosshair-y', `${position.y}px`);
    };

    const schedule = () => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(paint);
    };

    const show = () => {
      if (visibleRef.current) return;
      visibleRef.current = true;
      setVisible(true);
    };
    const hide = () => {
      visibleRef.current = false;
      setVisible(false);
      setPressed(false);
    };

    const onPointerMove = (event: PointerEvent) => {
      position.x = Math.round(event.clientX);
      position.y = Math.round(event.clientY);
      show();
      schedule();
    };

    const onPointerDown = () => setPressed(true);
    const onPointerUp = () => setPressed(false);
    const onPointerCancel = () => setPressed(false);
    const onPointerOut = (event: PointerEvent) => {
      // relatedTarget 为 null 表示指针离开窗口，而不是在元素之间移动。
      if (event.relatedTarget === null) hide();
    };
    const onResize = () => {
      position.x = Math.min(position.x, window.innerWidth);
      position.y = Math.min(position.y, window.innerHeight);
      schedule();
    };

    paint();
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerCancel, { passive: true });
    window.addEventListener('pointerout', onPointerOut);
    window.addEventListener('resize', onResize);
    window.addEventListener('blur', hide);
    document.addEventListener('mouseleave', hide);

    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      window.removeEventListener('pointerout', onPointerOut);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('blur', hide);
      document.removeEventListener('mouseleave', hide);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`crosshair${pressed ? ' is-pressed' : ''}`}
      data-visible={visible ? 'true' : 'false'}
      aria-hidden="true"
    >
      <span className="crosshair__line crosshair__line--x" />
      <span className="crosshair__line crosshair__line--y" />
      <span className="crosshair__center">
        <span className="crosshair__glow" />
        <span className="crosshair__core" />
      </span>
    </div>
  );
}
