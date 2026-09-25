import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Plus, Trash2, X } from 'lucide-react';
import { usePresence } from '../../hooks/usePresence';

// ═══════════════════════════════════════════════════════════════
// NewHabitModal — slide-up panel for creating habits.
// Ported from prototype components/NewHabitModal.jsx. Emits a
// payload via onCreate; the parent decides how to persist (we
// flatten frequency + customDays into the existing Habit shape).
//
// Motion: usePresence keeps the sheet mounted for a real exit. Enter
// uses --ease-out-expo (no overshoot, so the sheet never lifts off the
// bottom edge and exposes a gap); the backdrop fades opacity only over a
// fixed blur. Portaled to <body> so no transformed page ancestor can
// capture the fixed overlay. The handle/header can be dragged down to
// dismiss (DOM-driven, no per-frame React state).
// ═══════════════════════════════════════════════════════════════

const HABIT_CATEGORIES = [
  { key: 'fitness',  label: 'Fitness',   color: '#22D3EE' },
  { key: 'study',    label: 'Belajar',   color: '#A78BFA' },
  { key: 'mind',     label: 'Mindful',   color: '#34D399' },
  { key: 'health',   label: 'Kesehatan', color: '#EF4444' },
  { key: 'work',     label: 'Pekerjaan', color: '#FB923C' },
] as const;

const FREQ_OPTIONS = [
  { key: 'daily', label: 'Harian' },
  { key: 'work',  label: 'Hari Kerja' },
  { key: 'cust',  label: 'Kustom' },
] as const;

const DAY_LABELS = ['SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB', 'MIN'];

/** Must match the CSS exit duration (--dur-2). */
const EXIT_MS = 200;
/** Drag distance / flick speed (px per ms) that dismisses the sheet. */
const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 0.6;

export type NewHabitSubTask = {
  /** Stable id used in Habit.completedSubTasks[date]. */
  id: string;
  label: string;
  target?: number;
};

export type NewHabitPayload = {
  title: string;
  description: string;
  category: typeof HABIT_CATEGORIES[number]['key'];
  frequency: typeof FREQ_OPTIONS[number]['key'];
  days: number[];          // 0-6 (Mon..Sun)
  xpReward: number;
  /** Empty array = single-toggle habit (legacy behavior). */
  subTasks: NewHabitSubTask[];
};

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (data: NewHabitPayload) => void;
}

export const NewHabitModal: React.FC<Props> = ({ open, onClose, onCreate }) => {
  const { mounted, state } = usePresence(open, EXIT_MS);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState<typeof HABIT_CATEGORIES[number]['key']>('fitness');
  const [freq, setFreq] = useState<typeof FREQ_OPTIONS[number]['key']>('daily');
  const [customDays, setCustomDays] = useState<Set<number>>(() => new Set([0, 2, 4]));
  // Sub-tasks: locally tracked as a list with stable id; pushed to onCreate
  // as NewHabitSubTask[]. Empty list = single-toggle habit.
  const [subTasks, setSubTasks] = useState<NewHabitSubTask[]>([]);
  const titleRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  /** Set on submit: the form is cleared only once the sheet has slid away. */
  const resetOnCloseRef = useRef(false);
  /** The enter slide has finished — dragging is only allowed after it. */
  const enteredRef = useRef(false);
  const dragRef = useRef<{ id: number; y0: number; t0: number; dy: number } | null>(null);

  const reset = () => {
    setTitle(''); setDesc(''); setCat('fitness'); setFreq('daily');
    setCustomDays(new Set([0, 2, 4]));
    setSubTasks([]);
  };

  const focusTitle = () => {
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) {
      titleRef.current?.focus({ preventScroll: true });
    }
  };

  // Open: Esc closes; focus returns to the trigger on close.
  useEffect(() => {
    if (!open) return;
    // Re-opened within the exit window after a submit: start from a clean form.
    if (resetOnCloseRef.current) { resetOnCloseRef.current = false; reset(); }
    const restoreTo = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    // Focus normally lands on the enter animation's end (so the keyboard
    // doesn't open mid-slide); this is only a fallback if that never fires.
    const t = window.setTimeout(focusTitle, 520);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
      restoreTo?.focus?.({ preventScroll: true });
    };
  }, [open]);

  // Clear a submitted form after the exit, not before: clearing on submit made
  // the title and sub-task rows visibly blank out while the sheet slid away.
  useEffect(() => {
    if (mounted) return;
    enteredRef.current = false;
    dragRef.current = null;
    if (resetOnCloseRef.current) { resetOnCloseRef.current = false; reset(); }
  }, [mounted]);

  if (!mounted || typeof document === 'undefined') return null;

  // XP reward scales with the difficulty of the frequency commitment
  const xpReward = freq === 'daily' ? 5 : freq === 'work' ? 4 : 3;

  const toggleDay = (i: number) => {
    setCustomDays(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const addSubTask = () => {
    setSubTasks(prev => [
      ...prev,
      { id: `st_${Date.now()}_${prev.length}`, label: '', target: undefined },
    ]);
  };
  const updateSubTask = (id: string, patch: Partial<NewHabitSubTask>) => {
    setSubTasks(prev => prev.map(st => (st.id === id ? { ...st, ...patch } : st)));
  };
  const removeSubTask = (id: string) => {
    setSubTasks(prev => prev.filter(st => st.id !== id));
  };

  const submit = () => {
    if (!title.trim()) return;
    let days: number[];
    if (freq === 'daily') days = [0, 1, 2, 3, 4, 5, 6];
    else if (freq === 'work') days = [0, 1, 2, 3, 4];
    else {
      days = [];
      customDays.forEach((d) => days.push(d));
      days.sort((a, b) => a - b);
    }
    // Strip empty-label sub-tasks before persisting — gives the user room
    // to add a row then abandon it without polluting the habit definition.
    const cleanSubTasks = subTasks
      .map(st => ({ ...st, label: st.label.trim() }))
      .filter(st => st.label.length > 0);
    onCreate({
      title: title.trim(),
      description: desc.trim(),
      category: cat,
      frequency: freq,
      days,
      xpReward,
      subTasks: cleanSubTasks,
    });
    resetOnCloseRef.current = true;
    onClose();
  };

  // ── Drag-to-dismiss (handle + header) ──
  const onDragStart = (e: React.PointerEvent<HTMLElement>) => {
    const panel = panelRef.current;
    if (!panel || state !== 'enter' || !enteredRef.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, input, textarea')) return;
    dragRef.current = { id: e.pointerId, y0: e.clientY, t0: performance.now(), dy: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
    panel.style.transition = 'none';
  };
  const onDragMove = (e: React.PointerEvent<HTMLElement>) => {
    const d = dragRef.current;
    const panel = panelRef.current;
    if (!d || !panel || e.pointerId !== d.id) return;
    d.dy = Math.max(0, e.clientY - d.y0);
    panel.style.transform = d.dy > 0 ? `translateY(${d.dy}px)` : '';
  };
  const onDragEnd = (e: React.PointerEvent<HTMLElement>) => {
    const d = dragRef.current;
    const panel = panelRef.current;
    if (!d || e.pointerId !== d.id) return;
    dragRef.current = null;
    if (!panel) return;
    const velocity = d.dy / Math.max(1, performance.now() - d.t0);
    if (e.type === 'pointerup' && (d.dy > DISMISS_DISTANCE || (d.dy > 24 && velocity > DISMISS_VELOCITY))) {
      // Leave the inline offset in place: the exit keyframe animates from it.
      onCloseRef.current();
      return;
    }
    // Not far enough — spring back to rest.
    panel.style.transition = 'transform var(--dur-3) var(--ease-out-expo)';
    panel.style.transform = '';
    window.setTimeout(() => { if (!dragRef.current) panel.style.transition = ''; }, 300);
  };
  const dragHandlers = {
    onPointerDown: onDragStart,
    onPointerMove: onDragMove,
    onPointerUp: onDragEnd,
    onPointerCancel: onDragEnd,
  };

  const ready = title.trim().length > 0;

  return createPortal(
    <div className="nh-root" data-state={state}>
      <div className="nh-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className="nh-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onAnimationEnd={(e) => {
          if (e.target !== e.currentTarget || state !== 'enter') return;
          enteredRef.current = true;
          focusTitle();
        }}
      >
        <div className="nh-handle" aria-hidden="true" {...dragHandlers} />
        <div className="nh-head" {...dragHandlers}>
          <div className="nh-head-info">
            <div className="hud-label-sm fz-cyan">PROTOKOL BARU</div>
            <h2 className="nh-title" id={titleId}>Tambah Habit</h2>
          </div>
          <button className="nh-close" onClick={onClose} aria-label="Tutup" type="button">
            <X size={14} />
          </button>
        </div>

        <label className="nh-field">
          <span className="nh-field-lbl">Judul Habit</span>
          <input ref={titleRef} type="text" className="nh-input"
            placeholder="cth: Lari pagi 5km"
            maxLength={60}
            autoComplete="off"
            enterKeyHint="next"
            value={title}
            onChange={(e) => setTitle(e.target.value)} />
        </label>

        <label className="nh-field">
          <span className="nh-field-lbl">
            Deskripsi <span className="nh-field-opt">(opsional)</span>
          </span>
          <textarea className="nh-input nh-textarea"
            placeholder="Detail tambahan, niat, atau pemicu kebiasaan…"
            rows={2}
            value={desc}
            onChange={(e) => setDesc(e.target.value)} />
        </label>

        <div className="nh-field">
          <span className="nh-field-lbl">Kategori</span>
          <div className="nh-cat-grid">
            {HABIT_CATEGORIES.map((c) => (
              <button key={c.key} type="button"
                className={`nh-cat ${cat === c.key ? 'is-on' : ''}`}
                style={{ ['--cat-color' as string]: c.color }}
                aria-pressed={cat === c.key}
                onClick={() => setCat(c.key)}>
                <span className="nh-cat-dot" />
                <span>{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="nh-field">
          <span className="nh-field-lbl">Frekuensi Target</span>
          <div className="nh-freq-grid">
            {FREQ_OPTIONS.map((f) => (
              <button key={f.key} type="button"
                className={`nh-freq ${freq === f.key ? 'is-on' : ''}`}
                aria-pressed={freq === f.key}
                onClick={() => setFreq(f.key)}>
                {f.label}
              </button>
            ))}
          </div>
          {freq === 'cust' && (
            <div className="nh-days">
              {DAY_LABELS.map((d, i) => (
                <button key={i} type="button"
                  className={`nh-day-pick ${customDays.has(i) ? 'is-on' : ''}`}
                  aria-pressed={customDays.has(i)}
                  onClick={() => toggleDay(i)}>
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sub-tasks editor — optional. Empty list = single-toggle habit.
            When populated, the habit card shows a per-row checklist and
            auto-completes the parent only after every sub-task is checked. */}
        <div className="nh-field">
          <div className="nh-subtasks-head">
            <span className="nh-field-lbl">
              Sub-task <span className="nh-field-opt">(opsional)</span>
            </span>
            <button type="button" className="nh-subtasks-add" onClick={addSubTask}>
              <Plus size={12} /> Tambah sub-task
            </button>
          </div>
          {subTasks.length === 0 ? (
            <p className="nh-subtasks-hint">
              Habit dengan beberapa bagian (mis. push-up + sit-up + lari)
              bisa di-centang per bagian. Kosongkan untuk single-toggle.
            </p>
          ) : (
            <div className="nh-subtasks-list">
              {subTasks.map(st => (
                <div key={st.id} className="nh-subtask-row">
                  <input
                    type="text"
                    className="nh-input nh-subtask-label"
                    placeholder="cth: Push Up"
                    maxLength={40}
                    autoComplete="off"
                    value={st.label}
                    onChange={(e) => updateSubTask(st.id, { label: e.target.value })}
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    className="nh-input nh-subtask-target"
                    placeholder="100"
                    min={1}
                    value={st.target ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      updateSubTask(st.id, { target: v === '' ? undefined : Number(v) });
                    }}
                  />
                  <button
                    type="button"
                    className="nh-subtask-del"
                    onClick={() => removeSubTask(st.id)}
                    aria-label="Hapus sub-task"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="nh-xp-preview">
          <div className="nh-xp-preview-left">
            <span className="hud-label-sm">REWARD XP</span>
            <span className="nh-xp-preview-help">per checkmark</span>
          </div>
          {/* Keyed so the value pops when the frequency changes it. */}
          <div className="nh-xp-preview-val" key={xpReward}>+{xpReward} XP</div>
        </div>

        <div className="nh-actions">
          <button type="button" className="nh-cancel" onClick={onClose}>Batal</button>
          <button type="button" className={`nh-save ${ready ? '' : 'is-disabled'}`}
            disabled={!ready} onClick={submit}>
            <Check size={14} />
            <span>Simpan Habit</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
