import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import SystemBot from './SystemBot';

// ─────────────────────────────────────────────────────────────────────────
// BottomNav — notched floating bar with center bot mascot slot.
// 4 nav items (Dashboard/Gym/Habits/Settings) + center SystemBot slot.
// Cyan indicator stripe slides under the active tab on change.
//
// Owned at the Layout level; routes via the parent's onChange callback so
// the nav itself doesn't import react-router.
// ─────────────────────────────────────────────────────────────────────────

export type BottomNavTab = 'dashboard' | 'gym' | 'habits' | 'settings';

interface NavItem {
    key: BottomNavTab;
    label: string;
    icon: 'grid' | 'dumbbell' | 'check' | 'gear';
}

const NAV_ITEMS: readonly NavItem[] = [
    { key: 'dashboard', label: 'Dashboard', icon: 'grid' },
    { key: 'gym', label: 'Gym', icon: 'dumbbell' },
    { key: 'habits', label: 'Habits', icon: 'check' },
    { key: 'settings', label: 'Settings', icon: 'gear' },
] as const;

function NavIcon({ name, size = 22 }: { name: NavItem['icon']; size?: number }) {
    if (name === 'grid') return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
            <rect x="13" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
            <rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
            <rect x="13" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
        </svg>
    );
    if (name === 'dumbbell') return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <path d="M3 9v6 M21 9v6 M6 7v10 M18 7v10 M6 12h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
    );
    if (name === 'check') return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <rect x="4" y="4" width="16" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
            <path d="M8 12.5 L11 15.5 L16.5 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
    // gear
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
            <path d="M12 3v2 M12 19v2 M3 12h2 M19 12h2 M5.6 5.6l1.4 1.4 M17 17l1.4 1.4 M5.6 18.4 7 17 M17 7l1.4-1.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
    );
}

interface BNItemProps {
    item: NavItem;
    active: boolean;
    badge?: boolean;
    onClick: () => void;
}

const BNItem: React.FC<BNItemProps> = ({ item, active, badge, onClick }) => (
    <button
        type="button"
        className={`bn-item ${active ? 'is-active' : ''}`}
        data-tab={item.key}
        onClick={onClick}
    >
        <span className="bn-item-icon">
            <NavIcon name={item.icon} />
            {badge && <span className="bn-badge" />}
        </span>
        <span className="bn-item-label">{item.label}</span>
    </button>
);

export interface BottomNavProps {
    active: BottomNavTab;
    onChange: (key: BottomNavTab) => void;
    onBotPress: () => void;
    botActive: boolean;
    habitsBadge?: boolean;
}

export default function BottomNav({
    active,
    onChange,
    onBotPress,
    botActive,
    habitsBadge = false,
}: BottomNavProps) {
    const itemsRef = useRef<HTMLDivElement>(null);
    const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false });

    // useLayoutEffect so the indicator measures synchronously after DOM commit,
    // avoiding a flicker on first render or active-tab change.
    useLayoutEffect(() => {
        const root = itemsRef.current;
        if (!root) return;
        const el = root.querySelector<HTMLElement>(`[data-tab="${active}"]`);
        if (!el) {
            setIndicator(s => ({ ...s, ready: false }));
            return;
        }
        const r = el.getBoundingClientRect();
        const w = root.getBoundingClientRect();
        setIndicator({ left: r.left - w.left, width: r.width, ready: true });
    }, [active]);

    // Re-measure on viewport resize (e.g., orientation change).
    useEffect(() => {
        const onResize = () => {
            const root = itemsRef.current;
            if (!root) return;
            const el = root.querySelector<HTMLElement>(`[data-tab="${active}"]`);
            if (!el) return;
            const r = el.getBoundingClientRect();
            const w = root.getBoundingClientRect();
            setIndicator({ left: r.left - w.left, width: r.width, ready: true });
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [active]);

    return (
        <nav className="bn">
            <div className="bn-bar">
                <div
                    className="bn-indicator"
                    style={{
                        transform: `translateX(${indicator.left}px)`,
                        width: `${indicator.width}px`,
                        opacity: indicator.ready ? 1 : 0,
                    }}
                />
                <div className="bn-items" ref={itemsRef}>
                    {NAV_ITEMS.slice(0, 2).map(it => (
                        <BNItem
                            key={it.key}
                            item={it}
                            active={active === it.key}
                            onClick={() => onChange(it.key)}
                        />
                    ))}
                    <div className="bn-center-slot" aria-hidden="true" />
                    {NAV_ITEMS.slice(2).map(it => (
                        <BNItem
                            key={it.key}
                            item={it}
                            active={active === it.key}
                            badge={it.key === 'habits' && habitsBadge}
                            onClick={() => onChange(it.key)}
                        />
                    ))}
                </div>
            </div>
            <SystemBot active={botActive} onPress={onBotPress} />
        </nav>
    );
}
