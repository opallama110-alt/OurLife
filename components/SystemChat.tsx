import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, X, Send, Loader2 } from 'lucide-react';
import { aiService } from '../services/aiService';
import { storageService } from '../services/storageService';

type ChatMsg = {
  id: string;
  role: 'user' | 'system';
  text: string;
};

// ═══════════════════════════════════════════════════════════════════════════
// SYSTEM CHAT — FAB + slide-up sheet
// Persistent floating action button anchored bottom-right (above the mobile nav).
// Tapping opens a slide-up sheet with a Solo Leveling-themed chat surface that
// pipes user messages into aiService.chat() and renders the System's reply.
// ═══════════════════════════════════════════════════════════════════════════
export const SystemChat: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState(storageService.getGymProfile());
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
    try {
      const reply = await aiService.chat(text);
      const sysMsg: ChatMsg = { id: `s_${Date.now()}`, role: 'system', text: reply || '...' };
      setMessages(prev => [...prev, sysMsg]);
    } catch (e: any) {
      console.error('[SystemChat] aiService.chat failed:', e);
      setError(e?.message || 'The System is unreachable.');
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

  return (
    <>
      {/* ── Floating Action Button ── */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open System chat"
          className="fixed z-[60] bottom-24 right-4 md:bottom-6 md:right-6 w-14 h-14 rounded-full bg-gradient-to-br from-red-500 via-orange-500 to-amber-500 shadow-[0_0_25px_rgba(239,68,68,0.6)] hover:shadow-[0_0_40px_rgba(239,68,68,0.9)] flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 group"
        >
          <span className="absolute inset-0 rounded-full bg-red-500/30 animate-ping" />
          <span className="absolute inset-1 rounded-full bg-gradient-to-br from-red-500 to-amber-500" />
          <Sparkles size={22} className="relative z-10 text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.8)]" strokeWidth={2.4} />
        </button>
      )}

      {/* ── Slide-up Sheet ── */}
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center md:p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full md:max-w-lg md:rounded-2xl rounded-t-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border-t md:border border-red-500/40 shadow-[0_-10px_60px_rgba(239,68,68,0.3)] md:shadow-[0_0_60px_rgba(239,68,68,0.3)] flex flex-col max-h-[90vh] md:max-h-[80vh] animate-slide-up overflow-hidden">
            {/* Decorative glow */}
            <div className="absolute -top-20 -right-20 w-60 h-60 bg-red-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="relative z-10 flex items-center justify-between p-4 border-b border-slate-800/80">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center shadow-lg shadow-red-500/40">
                  <Sparkles size={18} className="text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-widest text-white font-mono">The System</h2>
                  <p className="text-[10px] text-slate-500 font-mono">
                    Lv.{profile.level} · {(profile.totalXP ?? 0).toLocaleString()} XP
                    {(profile.currentStreak ?? 0) > 0 && (
                      <span className="text-orange-400"> · {profile.currentStreak}🔥</span>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
                aria-label="Close System chat"
              >
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto px-4 py-4 space-y-3 custom-scrollbar">
              {messages.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500/20 to-amber-500/20 border border-red-500/30 flex items-center justify-center mb-4">
                    <Sparkles size={28} className="text-red-400" />
                  </div>
                  <p className="text-sm text-slate-300 font-medium mb-1">The System is listening.</p>
                  <p className="text-xs text-slate-500 max-w-[260px]">
                    Report a missed session, request a quest, or ask for guidance. The System can grant XP and apply penalties directly.
                  </p>
                </div>
              )}

              {messages.map(m => (
                <div
                  key={m.id}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${m.role === 'user'
                      ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white rounded-br-sm shadow-lg shadow-cyan-500/20'
                      : 'bg-slate-800/80 border border-red-500/20 text-slate-100 rounded-bl-sm shadow-lg'
                      }`}
                  >
                    {m.role === 'system' && (
                      <div className="text-[10px] font-mono uppercase tracking-widest text-red-400 mb-1">The System</div>
                    )}
                    {m.text}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-slate-800/80 border border-red-500/20 px-4 py-2.5 rounded-2xl rounded-bl-sm flex items-center space-x-2">
                    <Loader2 size={14} className="text-red-400 animate-spin" />
                    <span className="text-xs text-slate-400 font-mono">The System is deliberating...</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-300">
                  {error}
                </div>
              )}
            </div>

            {/* Input */}
            <div className="relative z-10 p-3 border-t border-slate-800/80 bg-slate-950/50">
              <div className="flex items-end space-x-2">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Speak to the System..."
                  rows={1}
                  className="flex-1 resize-none bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/30 transition-all max-h-32"
                />
                <button
                  onClick={send}
                  disabled={!input.trim() || loading}
                  className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-amber-500 hover:from-red-400 hover:to-amber-400 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shadow-lg shadow-red-500/30 transition-all active:scale-95"
                  aria-label="Send message to System"
                >
                  {loading ? (
                    <Loader2 size={16} className="text-white animate-spin" />
                  ) : (
                    <Send size={16} className="text-white" />
                  )}
                </button>
              </div>
              <p className="text-[10px] text-slate-600 font-mono mt-2 px-1">
                Powered by Llama 3.3 · The System may grant XP or apply penalties
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
