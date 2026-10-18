import { useCallback, useSyncExternalStore } from 'react';

// Per-device choice between the rotating 3D body and the flat 2D anatomy art.
// A display preference, so localStorage (not the synced profile) is enough.
export type BodyRenderPref = '3d' | '2d';

const KEY = 'ol_body_render';
const listeners = new Set<() => void>();
/** Fallback when storage is blocked (private mode), so the switch still works this session. */
let memoryPref: BodyRenderPref | null = null;

function readPref(): BodyRenderPref {
  if (memoryPref) return memoryPref;
  try { return localStorage.getItem(KEY) === '2d' ? '2d' : '3d'; } catch { return '3d'; }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Keeps other open tabs in step when the toggle is flipped in one of them.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    memoryPref = null;
    onChange();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

/** Shared by the Dashboard and Gym body stages so both follow one choice. */
export function useBodyRenderPref(): [BodyRenderPref, (pref: BodyRenderPref) => void] {
  const pref = useSyncExternalStore(subscribe, readPref, () => '3d' as const);
  const setPref = useCallback((next: BodyRenderPref) => {
    try {
      localStorage.setItem(KEY, next);
      memoryPref = null;
    } catch {
      memoryPref = next;
    }
    listeners.forEach(l => l());
  }, []);
  return [pref, setPref];
}

export interface BodyRenderToggleProps {
  value: BodyRenderPref;
  onChange: (pref: BodyRenderPref) => void;
  className?: string;
}

/** 3D | 2D segmented switch — same control as the FRONT/BACK toggle, cyan, top-left. */
export function BodyRenderToggle({ value, onChange, className = '' }: BodyRenderToggleProps) {
  return (
    <div
      className={`d-body-toggle d-render-toggle ${className}`.trim()}
      data-view={value}
      role="group"
      aria-label="Mode tampilan tubuh"
    >
      <button
        type="button"
        className={`d-body-toggle-opt ${value === '3d' ? 'is-on' : ''}`}
        aria-pressed={value === '3d'}
        onClick={() => onChange('3d')}
      >3D</button>
      <button
        type="button"
        className={`d-body-toggle-opt ${value === '2d' ? 'is-on' : ''}`}
        aria-pressed={value === '2d'}
        onClick={() => onChange('2d')}
      >2D</button>
    </div>
  );
}
