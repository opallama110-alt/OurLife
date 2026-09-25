import React, { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { usePresence } from '../../hooks/usePresence';

// ─────────────────────────────────────────────────────────────────────────
// SysToast — HUD-styled toast (System voice) with a real enter AND exit.
// `useSysToasts()` owns a small FIFO queue so back-to-back events (e.g. the
// last habit of the day also hitting a streak milestone) play one after the
// other instead of overwriting each other.
// ─────────────────────────────────────────────────────────────────────────

export type SysToastTone = 'cyan' | 'orange' | 'green';

export interface SysToastItem {
  id: number;
  tone: SysToastTone;
  icon?: ReactNode;
  title: string;
  sub?: string;
}

const EXIT_MS = 200;
let nextToastId = 1;

export function useSysToasts(durationMs = 2600) {
  const [queue, setQueue] = useState<SysToastItem[]>([]);
  const [visible, setVisible] = useState(true);

  const push = useCallback((item: Omit<SysToastItem, 'id'>) => {
    setQueue(q => [...q, { ...item, id: nextToastId++ }]);
  }, []);

  const headId = queue[0]?.id;
  useEffect(() => {
    if (headId === undefined) return;
    if (visible) {
      const t = window.setTimeout(() => setVisible(false), durationMs);
      return () => window.clearTimeout(t);
    }
    // Let the exit animation finish before showing the next item.
    const t = window.setTimeout(() => {
      setQueue(q => q.slice(1));
      setVisible(true);
    }, EXIT_MS + 40);
    return () => window.clearTimeout(t);
  }, [headId, visible, durationMs]);

  return { current: visible ? queue[0] ?? null : null, push };
}

export const SysToast: React.FC<{ item: SysToastItem | null }> = ({ item }) => {
  // Keep rendering the last item while it plays its exit.
  const lastRef = useRef<SysToastItem | null>(item);
  if (item) lastRef.current = item;
  const shown = item ?? lastRef.current;
  const { mounted, state } = usePresence(!!item, EXIT_MS);
  if (!mounted || !shown) return null;
  return (
    <div
      key={shown.id}
      className={`sys-toast sys-toast--${shown.tone}`}
      data-state={state}
      role="status"
      aria-live="polite"
    >
      {shown.icon && <span className="sys-toast-ico">{shown.icon}</span>}
      <span className="sys-toast-txt">
        <strong>{shown.title}</strong>
        {shown.sub && <span>{shown.sub}</span>}
      </span>
    </div>
  );
};

export default SysToast;
