import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../../hooks/usePresence';

// ─────────────────────────────────────────────────────────────────────────
// SystemBot — central nav button mascot.
// Pure-SVG cyan-eyed unit (no external icons). Animations are CSS-driven
// (idle bob, halo pulse, ring spin, orbit dot, blink, antenna sway).
//
// Mood priority:
//   active=true (chat open) → 'happy'  (closed crescent eyes, big smile)
//   press=true              → 'alert'  (wide bright eyes, "o" mouth)
//   active=false, no press  → 'idle'   (blinking eyes, soft smile)
//   thinking (not used here) → reserved for future loading state
// ─────────────────────────────────────────────────────────────────────────

export type BotMood = 'idle' | 'alert' | 'happy' | 'thinking';

export interface BotFaceProps {
    mood?: BotMood;
    size?: number;
}

export function BotFace({ mood = 'idle', size = 44 }: BotFaceProps) {
    return (
        <svg
            className={`bot-face mood-${mood}`}
            viewBox="0 0 48 48"
            width={size}
            height={size}
            aria-hidden="true"
        >
            <defs>
                <linearGradient id="bot-head-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0F1525" />
                    <stop offset="100%" stopColor="#04060D" />
                </linearGradient>
                <radialGradient id="bot-eye-grad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#A5F3FC" />
                    <stop offset="60%" stopColor="#22D3EE" />
                    <stop offset="100%" stopColor="#0E7490" />
                </radialGradient>
                <filter id="bot-eye-glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="1.2" result="b" />
                    <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
            </defs>

            {/* antenna */}
            <g className="bot-antenna">
                <line x1="24" y1="11" x2="24" y2="6" stroke="#22D3EE" strokeWidth="1.4" strokeLinecap="round" />
                <circle cx="24" cy="4.5" r="1.8" fill="#22D3EE" />
            </g>

            {/* head plate */}
            <rect x="8" y="11" width="32" height="29" rx="9" fill="url(#bot-head-grad)" stroke="#22D3EE" strokeWidth="1.2" />

            {/* visor sheen */}
            <rect x="10" y="13" width="28" height="4" rx="6" fill="#22D3EE" opacity="0.08" />

            {/* side bolts */}
            <circle cx="8.5" cy="26" r="0.9" fill="#22D3EE" opacity="0.55" />
            <circle cx="39.5" cy="26" r="0.9" fill="#22D3EE" opacity="0.55" />

            {/* eyes — per mood. Keyed on mood so every swap remounts the
                group and replays the small "pop" (CSS botMoodPop) instead of
                the eyes changing shape in a single frame. */}
            {mood === 'happy' ? (
                <g key="happy" className="bot-eyes" filter="url(#bot-eye-glow)">
                    <path d="M13 25 Q17 21 21 25" stroke="#67E8F9" strokeWidth="2" fill="none" strokeLinecap="round" />
                    <path d="M27 25 Q31 21 35 25" stroke="#67E8F9" strokeWidth="2" fill="none" strokeLinecap="round" />
                </g>
            ) : mood === 'alert' ? (
                <g key="alert" className="bot-eyes wide" filter="url(#bot-eye-glow)">
                    <circle cx="17" cy="24" r="3.6" fill="url(#bot-eye-grad)" />
                    <circle cx="31" cy="24" r="3.6" fill="url(#bot-eye-grad)" />
                    <circle cx="18" cy="22.6" r="1.2" fill="white" opacity="0.85" />
                    <circle cx="32" cy="22.6" r="1.2" fill="white" opacity="0.85" />
                </g>
            ) : mood === 'thinking' ? (
                <g key="thinking" className="bot-eyes" filter="url(#bot-eye-glow)">
                    <circle cx="17" cy="22.5" r="2.6" fill="url(#bot-eye-grad)" />
                    <circle cx="31" cy="22.5" r="2.6" fill="url(#bot-eye-grad)" />
                    <circle cx="17.6" cy="21.6" r="0.9" fill="white" opacity="0.7" />
                    <circle cx="31.6" cy="21.6" r="0.9" fill="white" opacity="0.7" />
                </g>
            ) : (
                <g key="idle" className="bot-eyes" filter="url(#bot-eye-glow)">
                    <circle cx="17" cy="24" r="2.8" fill="url(#bot-eye-grad)" />
                    <circle cx="31" cy="24" r="2.8" fill="url(#bot-eye-grad)" />
                    <circle cx="17.8" cy="22.8" r="1" fill="white" opacity="0.7" />
                    <circle cx="31.8" cy="22.8" r="1" fill="white" opacity="0.7" />
                </g>
            )}

            {/* mouth — per mood */}
            {mood === 'happy' ? (
                <path d="M17 32 Q24 38 31 32" stroke="#67E8F9" strokeWidth="1.6" fill="none" strokeLinecap="round" />
            ) : mood === 'alert' ? (
                <circle cx="24" cy="34" r="2" stroke="#22D3EE" strokeWidth="1.5" fill="none" />
            ) : mood === 'thinking' ? (
                <g stroke="#22D3EE" strokeWidth="1.5" strokeLinecap="round">
                    <line x1="20" y1="34" x2="20.5" y2="34" />
                    <line x1="24" y1="34" x2="24.5" y2="34" />
                    <line x1="28" y1="34" x2="28.5" y2="34" />
                </g>
            ) : (
                <path d="M19 33 Q24 36 29 33" stroke="#22D3EE" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            )}
        </svg>
    );
}

export interface SystemBotProps {
    active: boolean;
    onPress: () => void;
}

// Ring/orbit speed while the chat is open (ring 8s→3s, orbit 6s→2s).
const RING_ACTIVE_RATE = 8 / 3;
const ORBIT_ACTIVE_RATE = 3;

export default function SystemBot({ active, onPress }: SystemBotProps) {
    const [press, setPress] = useState(false);
    const [ping, setPing] = useState(0);
    const btnRef = useRef<HTMLButtonElement>(null);

    const mood: BotMood = active ? 'happy' : press ? 'alert' : 'idle';

    // Speed the ring + orbit up while the chat is open through the Web
    // Animations API: changing `animation-duration` in CSS recomputes the
    // progress (elapsed / duration), which made both jump to a new angle the
    // instant the bot was tapped. A playback-rate change keeps the angle.
    useEffect(() => {
        const btn = btnRef.current;
        if (!btn || typeof btn.getAnimations !== 'function') return;
        for (const a of btn.getAnimations({ subtree: true })) {
            const name = (a as CSSAnimation).animationName;
            if (name === 'ring-spin') a.updatePlaybackRate(active ? RING_ACTIVE_RATE : 1);
            else if (name === 'orbit-spin') a.updatePlaybackRate(active ? ORBIT_ACTIVE_RATE : 1);
        }
    }, [active]);

    const handleClick = () => {
        // Launch ping ties the tap to the sheet it opens (not on close).
        if (!active && !prefersReducedMotion()) setPing(p => p + 1);
        onPress();
    };

    return (
        <button
            ref={btnRef}
            type="button"
            className={`sys-bot ${active ? 'is-active' : ''} ${press ? 'is-press' : ''}`}
            onPointerDown={() => setPress(true)}
            onPointerUp={() => setPress(false)}
            onPointerLeave={() => setPress(false)}
            onPointerCancel={() => setPress(false)}
            onClick={handleClick}
            aria-label={active ? 'Tutup The System' : 'Buka The System'}
            aria-expanded={active}
        >
            <span className="sys-bot-halo" aria-hidden="true" />
            <span className="sys-bot-ring" aria-hidden="true" />
            {ping > 0 && <span key={ping} className="sys-bot-ping" aria-hidden="true" />}
            <span className="sys-bot-disc">
                <span className="sys-bot-shine" aria-hidden="true" />
                <BotFace mood={mood} size={42} />
            </span>
            <span className="sys-bot-orbit" aria-hidden="true">
                <span className="sys-bot-orbit-dot" />
            </span>
        </button>
    );
}
