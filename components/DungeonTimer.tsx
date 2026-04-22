import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, X, Clock } from 'lucide-react';

export const DungeonTimer: React.FC = () => {
  const [seconds, setSeconds] = useState(0);
  const [maxS, setMaxS] = useState(60);
  const [active, setActive] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);

  const defaultTimes = [30, 60, 90, 120];

  const beep = useCallback(() => {
    try {
      if (!audioCtx.current) audioCtx.current = new AudioContext();
      const osc = audioCtx.current.createOscillator();
      const gain = audioCtx.current.createGain();
      osc.connect(gain); gain.connect(audioCtx.current.destination);
      osc.frequency.value = 880; gain.gain.value = 0.3;
      osc.start(); osc.stop(audioCtx.current.currentTime + 0.2);
    } catch { }
  }, []);

  useEffect(() => {
    if (active && seconds > 0) {
      intervalRef.current = window.setInterval(() => setSeconds(s => s - 1), 1000);
    } else if (seconds === 0 && active) {
      setActive(false);
      beep();
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [active, seconds, beep]);

  const start = (s: number) => { setMaxS(s); setSeconds(s); setActive(true); };
  const toggleTimer = () => {
    if (seconds === 0 && !active) start(maxS);
    else setActive(!active);
  };
  const stop = () => { setActive(false); setSeconds(0); };

  const pct = maxS > 0 ? ((maxS - seconds) / maxS) * 100 : 0;
  const r = 36; const circ = 2 * Math.PI * r;

  return (
    <div className="fixed bottom-24 right-4 z-[100] flex flex-col items-end gap-2">
      {/* Timer Controls Panel */}
      {isOpen && (
        <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-[0_0_20px_rgba(6,182,212,0.15)] p-4 w-48 mb-1 animate-slide-up">
          <div className="flex items-center justify-between mb-3 text-slate-300">
            <h4 className="text-xs font-bold uppercase tracking-widest text-cyan-500">Dungeon Timer</h4>
            <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-red-400 transition-colors"><X size={14} /></button>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {defaultTimes.map(t => (
              <button key={t} onClick={() => start(t)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-1.5 rounded transition-colors font-mono">{t}s</button>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <button onClick={stop} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded transition-colors"><RotateCcw size={14} /></button>
            <button onClick={toggleTimer} className="flex-1 ml-2 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded flex items-center justify-center transition-colors shadow-lg shadow-cyan-500/20">
              {active ? <Pause size={14} /> : <Play size={14} />}
            </button>
          </div>
        </div>
      )}

      {/* Floating Indicator */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-slate-900 rounded-full border border-slate-700 shadow-xl flex items-center justify-center relative overflow-hidden group hover:border-cyan-500/50 hover:shadow-[0_0_15px_rgba(6,182,212,0.2)] transition-all"
      >
        <svg className="absolute inset-0 w-full h-full -rotate-90 transform" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={r} fill="none" stroke="#1e293b" strokeWidth="4" />
          <circle cx="40" cy="40" r={r} fill="none" stroke="#06b6d4" strokeWidth="4"
            strokeDasharray={circ} strokeDashoffset={circ - (pct / 100) * circ}
            className="transition-all duration-1000 ease-linear shadow-[0_0_10px_#06b6d4]" />
        </svg>
        <div className="relative z-10 flex flex-col items-center justify-center pointer-events-none">
          {active ? (
            <span className="text-cyan-400 font-mono font-bold text-sm tracking-tighter drop-shadow-[0_0_5px_currentColor]">{seconds}</span>
          ) : (
            <Clock size={20} className="text-slate-400 group-hover:text-cyan-400 transition-colors" />
          )}
        </div>
      </button>
    </div>
  );
};
