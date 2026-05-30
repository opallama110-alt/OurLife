import React, { useCallback, useEffect, useRef, useState } from 'react';
import { aiService } from '../services/aiService';
import { storageService } from '../services/storageService';
import { BotFace, BotMood, DotPulse } from './hud';

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

const pad2 = (n: number) => String(n).padStart(2, '0');
const formatTime = (d: Date = new Date()) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

const DAY_NAMES = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'];
const formatTodayHeader = (d: Date = new Date()) =>
  `${DAY_NAMES[d.getDay()]} · ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;

const MessageBubble: React.FC<{ msg: ChatMsg; animateIn: boolean }> = ({ msg, animateIn }) => {
  if (msg.from === 'system') {
    return (
      <div className={`sc-msg sc-msg-sys ${animateIn ? 'sc-msg-in' : ''}`}>
        <span className="sc-msg-ava">
          <BotFace mood="idle" size={26} />
        </span>
        <div className="sc-msg-body sc-msg-body-sys">
          <div className="sc-msg-head">
            <span>SYSTEM</span>
            <span className="sc-msg-time">{msg.time}</span>
          </div>
          <div className="sc-msg-text">{msg.text}</div>
        </div>
      </div>
    );
  }
  return (
    <div className={`sc-msg sc-msg-user ${animateIn ? 'sc-msg-in' : ''}`}>
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
  const [lastIdx, setLastIdx] = useState(messages.length - 1);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Mount state machine (rAF → setShow, setTimeout → setMounted false on close).
  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => setShow(true));
      const focusT = window.setTimeout(() => { inputRef.current?.focus(); }, 360);
      return () => { cancelAnimationFrame(id); window.clearTimeout(focusT); };
    }
    setShow(false);
    const t = window.setTimeout(() => setMounted(false), 320);
    return () => window.clearTimeout(t);
  }, [open]);

  // Auto-scroll to bottom on new message / typing change.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, [messages.length, typing]);

  const send = useCallback(async (text: string) => {
    const t = (text || '').trim();
    if (!t || typing) return;
    setDraft('');
    setError(null);
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
      setError((e as Error)?.message || 'The System is unreachable.');
    } finally {
      setTyping(false);
    }
  }, [typing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void send(draft);
  };

  if (!mounted) return null;

  const hasUserMsg = messages.some(m => m.from === 'user');
  const headMood: BotMood = typing ? 'thinking' : 'happy';

  return (
    <div className={`sc-root ${show ? 'is-open' : ''}`}>
      <div className="sc-backdrop" onClick={onClose} />
      <div className="sc-panel">
        {/* Corner brackets — inline brk-c spans (reference uses Brackets helper, our
            CornerBracket component is a wrapper; the .sc-panel .brk-* CSS already
            positions them, we just emit the bare spans). */}
        <span className="brk-c brk-tl" style={{ width: 14, height: 14, top: -1, left: -1 }} aria-hidden="true" />
        <span className="brk-c brk-tr" style={{ width: 14, height: 14, top: -1, right: -1 }} aria-hidden="true" />
        <span className="brk-c brk-bl" style={{ width: 14, height: 14, bottom: -1, left: -1 }} aria-hidden="true" />
        <span className="brk-c brk-br" style={{ width: 14, height: 14, bottom: -1, right: -1 }} aria-hidden="true" />

        <div className="sc-handle" />

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
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2 L12 12 M12 2 L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="sc-list" ref={listRef}>
          <div className="sc-day">
            <span className="sc-day-line" />
            <span>{formatTodayHeader()}</span>
            <span className="sc-day-line" />
          </div>
          {messages.map((m, i) => (
            <MessageBubble key={i} msg={m} animateIn={i === lastIdx} />
          ))}
          {typing && <TypingIndicator />}
          {error && (
            <div className="sc-error">{error}</div>
          )}
        </div>

        {/* Quick replies — only before user has sent anything */}
        {!hasUserMsg && (
          <div className="sc-quick">
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
            placeholder="Speak to the System…"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            disabled={typing}
          />
          <button
            type="submit"
            className="sc-send"
            disabled={!draft.trim() || typing}
            aria-label="Kirim"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 11 L21 3 L13 21 L11 13 Z" />
            </svg>
          </button>
        </form>

        <div className="sc-foot">
          Powered by Llama 3.3 · The System may grant XP or apply penalties
        </div>
      </div>
    </div>
  );
};
