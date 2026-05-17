import React, { useEffect, useRef, useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { aiService } from '../services/aiService';
import { storageService } from '../services/storageService';
import { SystemPet, PetEmotion } from './SystemPet';
import { SystemNotification } from './hud';

type ChatMsg = {
  id: string;
  role: 'user' | 'system';
  text: string;
};

// ═══════════════════════════════════════════════════════════════════════════
// SYSTEM CHAT — wrapped in the .sys-frame modal chrome from
// SystemNotification. The chat-specific layout (messages list +
// textarea + send button) lives in the .sys-body; the header carries
// the level chip as the .sys-head cta slot, and "Powered by Llama 3.3"
// rides the SystemNotification footer prop.
//
// The previous inline gradient + red border + glow chrome was dropped
// (it duplicated chrome the .sys-frame already provides). Bot avatar
// (SystemPet) stays in the empty-state body — that emotion mapping is
// part of the System's personality.
// ═══════════════════════════════════════════════════════════════════════════
export interface SystemChatProps {
  open: boolean;
  onClose: () => void;
}

export const SystemChat: React.FC<SystemChatProps> = ({ open, onClose }) => {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState(storageService.getGymProfile());
  const [emotion, setEmotion] = useState<PetEmotion>('idle');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Hydrate the most recent System verdict on first open so the user sees continuity.
  useEffect(() => {
    if (!open) return;
    const last = storageService.getLastSystemMessage();
    if (last && messages.length === 0) {
      setMessages([{ id: 'init', role: 'system', text: last }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Live-update XP/streak chip while sheet is open so AI mutations land visibly.
  useEffect(() => {
    const unsub = storageService.subscribe(() => setProfile(storageService.getGymProfile()));
    return unsub;
  }, []);

  // Pet resting mood — habit-aware priority chain. send() owns interaction-
  // driven emotions (thinking/happy/excited/shocked/sad-on-error); when the
  // sheet is open the emotion is sticky from the last interaction. This
  // effect only runs in the closed-sheet, non-loading rest state.
  //
  // Priority (highest first):
  //   angry  — user dropped the ball yesterday (any habit missed)
  //   sad    — workout streak broken (had history, now zero)
  //   tired  — late in the day, today's protocol incomplete
  //   happy  — today's protocol fully cleared
  //   idle   — fresh state (morning / no signal)
  useEffect(() => {
    if (loading) return; // 'thinking' is owned by send() — don't fight it
    if (open) return;    // sticky emotion while sheet is open

    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const habits = storageService.getHabits() || [];
    const hasHabits = habits.length > 0;

    const allTodayDone =
      hasHabits &&
      habits.every(h => (h.completedDates || []).includes(todayStr));

    const missedYesterday =
      hasHabits &&
      habits.some(h => !(h.completedDates || []).includes(yesterdayStr));

    const streak = profile.currentStreak ?? 0;
    const hasHistory = (profile.workoutsCompleted ?? 0) > 0;
    const hour = new Date().getHours();
    const lateAndNotDone =
      hasHabits &&
      hour >= 18 &&
      !allTodayDone;

    if (missedYesterday) {
      setEmotion('angry');
    } else if (streak === 0 && hasHistory) {
      setEmotion('sad');
    } else if (lateAndNotDone) {
      setEmotion('tired');
    } else if (allTodayDone) {
      setEmotion('happy');
    } else {
      setEmotion('idle');
    }
  }, [profile, loading, open]);

  // Auto-scroll to bottom on new message.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: ChatMsg = { id: `u_${Date.now()}`, role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setError(null);
    setEmotion('thinking');
    try {
      const reply = await aiService.chat(text);
      const sysMsg: ChatMsg = { id: `s_${Date.now()}`, role: 'system', text: reply || '...' };
      setMessages(prev => [...prev, sysMsg]);

      // Heuristic emotion mapping from response text. Cheap; can be upgraded
      // later by reading tool-call results directly from aiService.
      const lower = (reply || '').toLowerCase();
      if (/penalty|deducted|broken|punish/i.test(lower)) {
        setEmotion('shocked');
      } else if (/quest|level up|bonus|achievement|xp granted|reward/i.test(lower)) {
        setEmotion('excited');
      } else {
        setEmotion('happy');
      }
    } catch (e: any) {
      console.error('[SystemChat] aiService.chat failed:', e);
      setError(e?.message || 'The System is unreachable.');
      setEmotion('sad');
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  // Compact level chip rendered in .sys-head cta slot.
  const levelChip = (
    <span className="sys-chat-chip">
      <span className="sys-chat-chip-lv">Lv.{profile.level ?? 1}</span>
      <span className="sys-chat-chip-sep">·</span>
      <span>{(profile.totalXP ?? 0).toLocaleString()} XP</span>
      {(profile.currentStreak ?? 0) > 0 && (
        <>
          <span className="sys-chat-chip-sep">·</span>
          <span className="sys-chat-chip-flame">{profile.currentStreak}🔥</span>
        </>
      )}
    </span>
  );

  return (
    <SystemNotification
      open={open}
      mode="modal"
      tone="cyan"
      closable
      onClose={onClose}
      title="THE SYSTEM"
      subtitle="awaiting your transmission"
      cta={levelChip}
      className="sys-frame-chat"
      footer={
        <p className="sys-chat-footnote">
          Powered by Llama 3.3 · The System may grant XP or apply penalties
        </p>
      }
    >
      {/* Messages list */}
      <div ref={scrollRef} className="sys-chat-messages">
        {messages.length === 0 && !loading && (
          <div className="sys-chat-empty">
            <SystemPet emotion={emotion} size="lg" className="mb-4" />
            <p className="sys-chat-empty-title">The System is listening.</p>
            <p className="sys-chat-empty-sub">
              Report a missed session, request a quest, or ask for guidance.
              The System can grant XP and apply penalties directly.
            </p>
          </div>
        )}

        {messages.map(m => (
          <div key={m.id} className={`sys-chat-row ${m.role === 'user' ? 'is-user' : 'is-system'}`}>
            <div className={`sys-chat-bubble ${m.role === 'user' ? 'is-user' : 'is-system'}`}>
              {m.role === 'system' && (
                <div className="sys-chat-bubble-label">The System</div>
              )}
              {m.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="sys-chat-row is-system">
            <div className="sys-chat-bubble is-system sys-chat-bubble-loading">
              <Loader2 size={14} className="animate-spin" />
              <span>The System is deliberating…</span>
            </div>
          </div>
        )}

        {error && (
          <div className="sys-chat-error">{error}</div>
        )}
      </div>

      {/* Input bar */}
      <div className="sys-chat-input">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Speak to the System..."
          rows={1}
          className="sys-chat-textarea"
        />
        <button
          type="button"
          onClick={send}
          disabled={!input.trim() || loading}
          className="sys-chat-send"
          aria-label="Send message to System"
        >
          {loading
            ? <Loader2 size={16} className="animate-spin" />
            : <Send size={16} />}
        </button>
      </div>
    </SystemNotification>
  );
};
