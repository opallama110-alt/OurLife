import React, { memo, useCallback, useEffect, useRef } from 'react';
import { Minus, Plus } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────
// StepperSlider — the SETS / REPS / KG control of the active session.
//
// Operated with sweaty hands between sets, so:
//   • 40px ± buttons with hold-to-repeat (350ms delay, then accelerating
//     from 120ms to 40ms per step) — 20→60 kg no longer takes 16 taps.
//   • Fill + thumb move with transform (scaleX / translateX) driven by one
//     `--p` custom property and an ease-out curve. The old spring on
//     width/left overshot past the track ends and trailed the finger.
//   • While the range is being dragged the transition is switched off
//     (`.is-drag`, toggled on the DOM — no re-render) so the thumb sticks
//     to the finger.
//   • The value re-keys on change for a small tick instead of a hard swap.
// ─────────────────────────────────────────────────────────────────────────

export interface StepperSliderProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

const HOLD_DELAY_MS = 350;
const REPEAT_START_MS = 120;
const REPEAT_MIN_MS = 40;

export const StepperSlider = memo(function StepperSlider({
  label, value, onChange, min = 1, max = 30, step = 1, unit,
}: StepperSliderProps) {
  const pct = max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0;
  const trackRef = useRef<HTMLDivElement>(null);

  // Hold-to-repeat reads the freshest value through refs: several ticks can
  // fire before React re-renders with the new `value`.
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const holdTimer = useRef<number | null>(null);

  const nudge = useCallback((dir: 1 | -1): boolean => {
    const next = Math.min(max, Math.max(min, parseFloat((valueRef.current + dir * step).toFixed(2))));
    if (next === valueRef.current) return false;
    valueRef.current = next;
    onChangeRef.current(next);
    try { navigator.vibrate?.(6); } catch { /* vibration unsupported */ }
    return true;
  }, [min, max, step]);

  const stopHold = useCallback(() => {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);
  useEffect(() => stopHold, [stopHold]);

  const startHold = (dir: 1 | -1) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    stopHold();
    if (!nudge(dir)) return;
    let interval = REPEAT_START_MS;
    const repeat = () => {
      if (!nudge(dir)) { stopHold(); return; }
      interval = Math.max(REPEAT_MIN_MS, interval * 0.85);
      holdTimer.current = window.setTimeout(repeat, interval);
    };
    holdTimer.current = window.setTimeout(repeat, HOLD_DELAY_MS);
  };

  // Pointer presses are handled on pointerdown (for hold-to-repeat); a click
  // with detail 0 comes from the keyboard (Enter / Space) and steps once.
  const onKeyClick = (dir: 1 | -1) => (e: React.MouseEvent<HTMLButtonElement>) => {
    if (e.detail === 0) nudge(dir);
  };

  const setDragging = (on: boolean) => {
    trackRef.current?.classList.toggle('is-drag', on);
  };

  return (
    <div className="ae-step">
      <div className="ae-step-top">
        <span className="ae-step-label">{label}</span>
        <span className="ae-step-val">
          <span key={value} className="ae-step-num tnum">{value}</span>
          {unit && <span className="ae-step-unit">{unit}</span>}
        </span>
      </div>
      <div className="ae-step-row">
        <button className="ae-step-btn" type="button" aria-label={`Kurangi ${label}`}
          disabled={value <= min}
          onPointerDown={startHold(-1)} onPointerUp={stopHold}
          onPointerLeave={stopHold} onPointerCancel={stopHold}
          onClick={onKeyClick(-1)}
          onContextMenu={(e) => e.preventDefault()}>
          <Minus size={16} />
        </button>
        <div ref={trackRef} className="ae-step-track" style={{ ['--p' as string]: pct }}>
          <div className="ae-step-fill" />
          <input type="range" min={min} max={max} step={step} value={value}
            aria-label={label}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            onPointerDown={() => setDragging(true)}
            onPointerUp={() => setDragging(false)}
            onPointerCancel={() => setDragging(false)}
            onBlur={() => setDragging(false)}
            className="ae-step-input" />
          <div className="ae-step-rail" aria-hidden="true"><div className="ae-step-thumb" /></div>
        </div>
        <button className="ae-step-btn" type="button" aria-label={`Tambah ${label}`}
          disabled={value >= max}
          onPointerDown={startHold(1)} onPointerUp={stopHold}
          onPointerLeave={stopHold} onPointerCancel={stopHold}
          onClick={onKeyClick(1)}
          onContextMenu={(e) => e.preventDefault()}>
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
});

export default StepperSlider;
