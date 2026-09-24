import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { aiService } from '../services/aiService';
import { storageService } from '../services/storageService';
import { BotFace, BotMood, DotPulse } from './hud';
import { usePresence, prefersReducedMotion } from '../hooks/usePresence';

// ═══════════════════════════════════════════════════════════════════════════
// SYSTEM CHAT — wholesale ported from
// .design-reference/ourlife/project/components/SystemChat.jsx.
// CLI/terminal aesthetic: "[ SYSTEM ]" bracketed title, ONLINE status line,
// JUMAT · 15 MEI 2026 date divider, SYSTEM-labelled bubbles with mono
// timestamps, quick-reply chips, "> " input prompt, orange send button.
//
// AI integration uses the existing aiService.chat (Groq Llama 3.3) — the
// prototype's window.claude.complete shim is replaced. Habit-aware emotion
// priority chain from the prior implementation is dropped in favor of the
// prototype's simpler typing↔happy↔idle BotFace mood swap, because the
// prototype is the canonical design now. Re-introducing angry/sad/tired
// moods to BotFace is a separate task (Tier 1 polish).
//
// Mobile behaviour: the input stays focused while the System replies
// (readOnly, not disabled — disabling blurs it and drops the keyboard), the
// sheet reopens scrolled to the latest message, and the grabber/header can
// be dragged down to dismiss (DOM-driven, no per-frame React state).
// ═══════════════════════════════════════════════════════════════════════════
export interface SystemChatProps {
  open: boolean;
  onClose: () => void;
}

type ChatMsg = {
  from: 'system' | 'user';
  text: string;
  time: string;
};

/** How a bubble enters: 'in' = rise, 'swap' = replaces the typing row. */
type BubbleAnim = 'in' | 'swap' | null;

const QUICK_REPLIES = [
  'Plan terbaik untuk hari ini?',
  'Cek status fatigue.',
  'Apa habit yang harus aku selesaikan?',
];

const SEED_MESSAGES: ChatMsg[] = [
  {
    from: 'system',
    text: 'Halo, Hunter. Aku [SYSTEM] — antarmuka taktismu. Aku bisa baca status, jadwal, fatigue, dan habit harian.',
    time: '',
  },
];

// Sheet close transition (CSS .sc-root:not(.is-open) .sc-panel) + margin.
const CLOSE_MS = 240;
// Drag-to-dismiss thresholds.
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 0.6; // px/ms

const pad2 = (n: number) => String(n).padStart(2, '0');
const formatTime = (d: Date = new Date()) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

const DAY_NAMES = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'];
const formatTodayHeader = (d: Date = new Date()) =>
  `${DAY_NAMES[d.getDay()]} · ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;

const scrollListToEnd = (el: HTMLElement | null, onlyIfNear = false) => {
  const list = el?.closest('.sc-list') as HTMLElement | null;
  if (!list) return;
  if (onlyIfNear && list.scrollHeight - list.scrollTop - list.clientHeight > 96) return;
  list.scrollTop = list.scrollHeight;
};

// Terminal-style reveal for a fresh System reply. Writes textContent from a
// rAF loop — no per-character React state — and keeps the list pinned to
// the bottom while the text grows (unless the user scrolled up to read).
const TypeOut: React.FC<{ text: string }> = ({ text }) => {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      el.textContent = text;
      el.classList.remove('caret');
      return;
    }
    // Long answers speed up so every reply finishes in ~1.5s.
    const perFrame = Math.max(2, Math.ceil(text.length / 90));
    let i = 0;
    let raf = 0;
    const tick = () => {
      i = Math.min(text.length, i + perFrame);
      el.textContent = text.slice(0, i);
      scrollListToEnd(el, true);
      if (i < text.length) raf = window.requestAnimationFrame(tick);
      else el.classList.remove('caret');
    };
    raf = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(raf);
      // Never leave a half-written reply behind if the sheet closes mid-way.
      el.textContent = text;
    };
  }, [text]);
  return <span ref={ref} className="caret" />;
};

const MessageBubble: React.FC<{ msg: ChatMsg; anim: BubbleAnim }> = ({ msg, anim }) => {
  const animClass = anim === 'in' ? 'sc-msg-in' : anim === 'swap' ? 'sc-msg-swap' : '';
  if (msg.from === 'system') {
    return (
      <div className={`sc-msg sc-msg-sys ${animClass}`}>
        <span className="sc-msg-ava">
          <BotFace mood="idle" size={26} />
        </span>
        <div className="sc-msg-body sc-msg-body-sys">
          <div className="sc-msg-head">
            <span>SYSTEM</span>
            <span className="sc-msg-time">{msg.time}</span>
          </div>
          <div className="sc-msg-text">
            {anim === 'swap' ? <TypeOut text={msg.text} /> : msg.text}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className={`sc-msg sc-msg-user ${animClass}`}>
      <div className="sc-msg-body sc-msg-body-user">
        <div className="sc-msg-text">{msg.text}</div>
        <div className="sc-msg-time-user">{msg.time}</div>
      </div>
    </div>
  );
};

const TypingIndicator: React.FC = () => (
  <div className="sc-msg sc-msg-sys sc-msg-in">
    <span className="sc-msg-ava">
      <BotFace mood="thinking" size={26} />
    </span>
    <div className="sc-msg-body sc-msg-body-sys sc-typing">
      <div className="sc-msg-head">
        <span>SYSTEM</span>
        <span className="sc-msg-time">sedang berpikir…</span>
      </div>
      <div className="sc-typing-dots">
        <span /><span /><span />
      </div>
    </div>
  </div>
);

export const SystemChat: React.FC<SystemChatProps> = ({ open, onClose }) => {
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>(() => {
    const last = storageService.getLastSystemMessage();
    if (last) {
      return [{ from: 'system', text: last, time: '' }];
    }
    return SEED_MESSAGES;
  });
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Index of the newest bubble that should animate in; -1 = none. Reset on
  // every open so reopening the sheet doesn't replay the whole history.
  const [lastIdx, setLastIdx] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const lastUserText = useRef('');
  const drag = useRef<{ y: number; t: number; dy: number; id: number } | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Mount state machine (rAF → setShow, setTimeout → setMounted false on close).
  useEffect(() => {
    if (open) {
      // A drag-dismiss leaves inline styles on the panel; reopening inside
      // the close window (before unmount) must not inherit the thrown-away
      // translateY(100%).
      for (const el of [panelRef.current, backdropRef.current]) {
        if (el) { el.style.transition = ''; el.style.transform = ''; el.style.opacity = ''; }
      }
      setMounted(true);
      setLastIdx(-1);
      const id = requestAnimationFrame(() => setShow(true));
      // Only auto-focus with a mouse/trackpad: on phones the keyboard would
      // pop mid-slide and cover the quick replies the user came to tap.
      const finePointer = window.matchMedia?.('(pointer: fine)').matches;
      const focusT = finePointer
        ? window.setTimeout(() => { inputRef.current?.focus({ preventScroll: true }); }, 380)
        : 0;
      return () => { cancelAnimationFrame(id); window.clearTimeout(focusT); };
    }
    setShow(false);
    const t = window.setTimeout(() => setMounted(false), prefersReducedMotion() ? 0 : CLOSE_MS);
    return () => window.clearTimeout(t);
  }, [open]);

  // Esc closes the sheet (desktop / hardware keyboards).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // The sheet DOM is recreated on every open, so jump (not smooth-scroll)
  // to the latest message before the first paint.
  useLayoutEffect(() => {
    if (!mounted) return;
    const list = listRef.current;
    if (!list) return;
    list.style.scrollBehavior = 'auto';
    list.scrollTop = list.scrollHeight;
    list.style.scrollBehavior = '';
  }, [mounted]);

  // Auto-scroll to bottom on new message / typing change.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, [messages.length, typing, error]);

  const send = useCallback(async (text: string) => {
    const t = (text || '').trim();
    if (!t || typing) return;
    lastUserText.current = t;
    setError(null);
    setDraft('');
    setMessages(m => {
      const next: ChatMsg[] = [...m, { from: 'user', text: t, time: formatTime() }];
      setLastIdx(next.length - 1);
      return next;
    });
    setTyping(true);

    try {
      const reply = await aiService.chat(t);
      // small intentional delay so the thinking state is visible
      await new Promise(r => window.setTimeout(r, 380));
      setMessages(m => {
        const next: ChatMsg[] = [...m, {
          from: 'system',
          text: reply || 'Sinyal melemah. Coba ulangi pertanyaanmu, Hunter.',
          time: formatTime(),
        }];
        setLastIdx(next.length - 1);
        return next;
      });
    } catch (e) {
      console.error('[SystemChat] aiService.chat failed:', e);
      // aiService already classifies errors into Indonesian copy.
      setError((e as Error)?.message || 'Sinyal System terputus.');
    } finally {
      setTyping(false);
    }
  }, [typing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void send(draft);
  };

  // ── Drag-to-dismiss (grabber + header) ──
  const onDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    const panel = panelRef.current;
    if (!panel) return;
    drag.current = { y: e.clientY, t: performance.now(), dy: 0, id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
    panel.style.transition = 'none';
    if (backdropRef.current) backdropRef.current.style.transition = 'none';
  };
  const onDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const panel = panelRef.current;
    if (!d || !panel || e.pointerId !== d.id) return;
    // Resist dragging upward; follow the finger downward 1:1.
    const raw = e.clientY - d.y;
    d.dy = raw > 0 ? raw : raw / 6;
    panel.style.transform = `translateX(-50%) translateY(${d.dy}px)`;
    if (backdropRef.current) {
      const p = Math.max(0, Math.min(1, d.dy / Math.max(1, panel.offsetHeight)));
      backdropRef.current.style.opacity = String(1 - p);
    }
  };
  const onDragEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const panel = panelRef.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    if (!panel) return;
    const velocity = d.dy / Math.max(1, performance.now() - d.t);
    if (d.dy > DISMISS_DISTANCE || (d.dy > 24 && velocity > DISMISS_VELOCITY)) {
      // Continue the throw from where the finger left it.
      panel.style.transition = 'transform 220ms var(--ease-in)';
      panel.style.transform = 'translateX(-50%) translateY(100%)';
      if (backdropRef.current) {
        backdropRef.current.style.transition = 'opacity 220ms var(--ease-in)';
        backdropRef.current.style.opacity = '0';
      }
      onClose();
    } else {
      // Spring back via the stylesheet transition.
      panel.style.transition = '';
      panel.style.transform = '';
      if (backdropRef.current) {
        backdropRef.current.style.transition = '';
        backdropRef.current.style.opacity = '';
      }
    }
  };

  const hasUserMsg = messages.some(m => m.from === 'user');
  // Quick replies fade out after the first message instead of vanishing
  // (the sheet itself is unmounted while closed, so no `mounted` gate).
  const quick = usePresence(!hasUserMsg, 200);

  if (!mounted) return null;

  const headMood: BotMood = typing ? 'thinking' : 'happy';
  const dragHandlers = {
    onPointerDown: onDragStart,
    onPointerMove: onDragMove,
    onPointerUp: onDragEnd,
    onPointerCancel: onDragEnd,
  };

  return (
    <div className={`sc-root ${show ? 'is-open' : ''}`}>
      <div className="sc-backdrop" ref={backdropRef} onClick={onClose} />
      <div
        className="sc-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="The System"
      >
        {/* Corner brackets — inline brk-c spans (reference uses Brackets helper, our
            CornerBracket component is a wrapper; the .sc-panel .brk-* CSS already
            positions them, we just emit the bare spans). */}
        <span className="brk-c brk-tl" style={{ width: 14, height: 14, top: -1, left: -1 }} aria-hidden="true" />
        <span className="brk-c brk-tr" style={{ width: 14, height: 14, top: -1, right: -1 }} aria-hidden="true" />
        <span className="brk-c brk-bl" style={{ width: 14, height: 14, bottom: -1, left: -1 }} aria-hidden="true" />
        <span className="brk-c brk-br" style={{ width: 14, height: 14, bottom: -1, right: -1 }} aria-hidden="true" />

        <div className="sc-grab" {...dragHandlers}>
          <div className="sc-handle" aria-hidden="true" />

          {/* Header */}
          <div className="sc-head">
            <div className="sc-head-ava">
              <span className="sc-head-ava-halo" />
              <BotFace mood={headMood} size={36} />
            </div>
            <div className="sc-head-info">
              <div className="sc-head-title">
                <span className="sc-bracket">[</span> SYSTEM <span className="sc-bracket">]</span>
              </div>
              <div className="sc-head-status">
                <DotPulse tone="green" />
                <span>ONLINE · v1.0 · LLAMA-3.3</span>
              </div>
            </div>
            <button type="button" className="sc-close" onClick={onClose} aria-label="Tutup">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2 2 L12 12 M12 2 L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="sc-list" ref={listRef}>
          <div className="sc-day">
            <span className="sc-day-line" />
            <span>{formatTodayHeader()}</span>
            <span className="sc-day-line" />
          </div>
          {messages.map((m, i) => (
            <MessageBubble
              key={i}
              msg={m}
              anim={i !== lastIdx ? null : m.from === 'system' ? 'swap' : 'in'}
            />
          ))}
          {typing && <TypingIndicator />}
          {error && (
            <div className="sc-error" role="alert">
              <span>{error}</span>
              {lastUserText.current && (
                // Puts the message back in the field instead of auto-resending:
                // aiService may already have applied a tool call (penalty /
                // quest complete) before the failure, and a blind one-tap
                // resend could apply it twice. The user re-sends knowingly.
                <button
                  type="button"
                  className="sc-error-retry"
                  onClick={() => {
                    setError(null);
                    setDraft(lastUserText.current);
                    inputRef.current?.focus({ preventScroll: true });
                  }}
                  disabled={typing}
                >
                  Ulangi pesan
                </button>
              )}
            </div>
          )}
        </div>

        {/* Quick replies — only before user has sent anything */}
        {quick.mounted && (
          <div className="sc-quick" data-state={quick.state}>
            {QUICK_REPLIES.map(q => (
              <button
                key={q}
                type="button"
                className="sc-quick-btn"
                onClick={() => send(q)}
                disabled={typing}
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <form className="sc-input" onSubmit={handleSubmit}>
          <span className="sc-prompt">&gt;</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Bicara dengan System…"
            enterKeyHint="send"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            readOnly={typing}
            aria-busy={typing}
            aria-label="Pesan untuk System"
          />
          <button
            type="submit"
            className="sc-send"
            disabled={!draft.trim() || typing}
            aria-label="Kirim"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M3 11 L21 3 L13 21 L11 13 Z" />
            </svg>
          </button>
        </form>

        <div className="sc-foot">
          Ditenagai Llama 3.3 · System bisa memberi XP atau penalti
        </div>
      </div>
    </div>
  );
};
