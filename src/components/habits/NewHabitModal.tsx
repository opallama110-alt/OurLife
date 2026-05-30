import React, { useEffect, useRef, useState } from 'react';
import { Check, Plus, Trash2, X } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// NewHabitModal — slide-up panel for creating habits.
// Ported from prototype components/NewHabitModal.jsx. Emits a
// payload via onCreate; the parent decides how to persist (we
// flatten frequency + customDays into the existing Habit shape).
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
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState<typeof HABIT_CATEGORIES[number]['key']>('fitness');
  const [freq, setFreq] = useState<typeof FREQ_OPTIONS[number]['key']>('daily');
  const [customDays, setCustomDays] = useState<Set<number>>(() => new Set([0, 2, 4]));
  // Sub-tasks: locally tracked as a list with stable id; pushed to onCreate
  // as NewHabitSubTask[]. Empty list = single-toggle habit.
  const [subTasks, setSubTasks] = useState<NewHabitSubTask[]>([]);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const a = requestAnimationFrame(() => setShow(true));
      const t = window.setTimeout(() => { titleRef.current?.focus(); }, 350);
      return () => { cancelAnimationFrame(a); window.clearTimeout(t); };
    }
    setShow(false);
    const t = window.setTimeout(() => setMounted(false), 320);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!mounted) return null;

  // XP reward scales with the difficulty of the frequency commitment
  const xpReward = freq === 'daily' ? 5 : freq === 'work' ? 4 : 3;

  const toggleDay = (i: number) => {
    setCustomDays(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const reset = () => {
    setTitle(''); setDesc(''); setCat('fitness'); setFreq('daily');
    setCustomDays(new Set([0, 2, 4]));
    setSubTasks([]);
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
    reset();
    onClose();
  };

  const ready = title.trim().length > 0;

  return (
    <div className={`nh-root ${show ? 'is-open' : ''}`} role="dialog" aria-modal="true">
      <div className="nh-backdrop" onClick={onClose} />
      <div className="nh-panel">
        <div className="nh-handle" />
        <div className="nh-head">
          <div className="nh-head-info">
            <div className="hud-label-sm fz-cyan">PROTOKOL BARU</div>
            <h2 className="nh-title">Tambah Habit</h2>
          </div>
          <button className="nh-close" onClick={onClose} aria-label="Tutup" type="button">
            <X size={14} />
          </button>
        </div>

        <label className="nh-field">
          <span className="nh-field-lbl">Judul Habit</span>
          <input ref={titleRef} type="text" className="nh-input"
            placeholder="cth: Lari pagi 5km"
            value={title}
            onChange={(e) => setTitle(e.target.value)} />
        </label>

        <label className="nh-field">
          <span className="nh-field-lbl">
            Deskripsi <span style={{ color: 'var(--t-3)' }}>(opsional)</span>
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
              Sub-task <span style={{ color: 'var(--t-3)' }}>(opsional)</span>
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
                    value={st.label}
                    onChange={(e) => updateSubTask(st.id, { label: e.target.value })}
                  />
                  <input
                    type="number"
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
          <div className="nh-xp-preview-val">+{xpReward} XP</div>
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
    </div>
  );
};
