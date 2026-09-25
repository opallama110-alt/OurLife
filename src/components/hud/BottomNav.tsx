import React, { useEffect, useLayoutEffect, useRef } from 'react';
import SystemBot from './SystemBot';
import { usePresence } from '../../hooks/usePresence';

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

/** Must match the `.bn-badge[data-state="exit"]` animation in index.css. */
const BADGE_EXIT_MS = 180;

function NavIcon({ name, size = 22 }: { name: NavItem['icon']; size?: number }) {
    if (name === 'grid') return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
            <rect x="13" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
            <rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
            <rect x="13" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
        </svg>
    );
    if (name === 'dumbbell') return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 9v6 M21 9v6 M6 7v10 M18 7v10 M6 12h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
    );
    if (name === 'check') return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="4" y="4" width="16" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
            <path d="M8 12.5 L11 15.5 L16.5 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
    // gear
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

const BNItem: React.FC<BNItemProps> = ({ item, active, badge = false, onClick }) => {
    // Keeps the dot mounted for its shrink-out when the last habit is ticked.
    const badgePresence = usePresence(badge, BADGE_EXIT_MS);
    return (
        <button
            type="button"
            className={`bn-item ${active ? 'is-active' : ''}`}
            data-tab={item.key}
            onClick={onClick}
            aria-current={active ? 'page' : undefined}
            aria-label={badge ? `${item.label}, ada habit yang belum selesai` : undefined}
        >
            <span className="bn-item-icon">
                <NavIcon name={item.icon} />
                {badgePresence.mounted && (
                    <span className="bn-badge" data-state={badgePresence.state} aria-hidden="true" />
                )}
            </span>
            <span className="bn-item-label">{item.label}</span>
        </button>
    );
};

/**
 * Writes the indicator geometry straight to the DOM — no React state, so a
 * tab change costs no second render. offsetLeft/offsetWidth ignore
 * transforms, so an item mid-press (scale .92) can't skew the measurement.
 * With `animate` false the stripe jumps (first placement, resize) instead of
 * sliding in from the left edge.
 */
function placeIndicator(
    root: HTMLElement | null,
    indicator: HTMLElement | null,
    active: BottomNavTab,
    animate: boolean,
): void {
    if (!root || !indicator) return;
    const el = root.querySelector<HTMLElement>(`[data-tab="${active}"]`);
    if (!el) {
        indicator.style.opacity = '0';
        return;
    }
    if (!animate) indicator.style.transition = 'none';
    indicator.style.width = `${el.offsetWidth}px`;
    indicator.style.transform = `translate3d(${el.offsetLeft}px, 0, 0)`;
    indicator.style.opacity = '1';
    if (!animate) {
        // Commit the jump before handing transitions back to the stylesheet.
        void indicator.offsetWidth;
        indicator.style.transition = '';
    }
}

export interface BottomNavProps {
    active: BottomNavTab;
    onChange: (key: BottomNavTab) => void;
    onBotPress: () => void;
    botActive: boolean;
    habitsBadge?: boolean;
    /** Slide the nav out of the way (e.g. while the soft keyboard is up). */
    hidden?: boolean;
}

export default function BottomNav({
    active,
    onChange,
    onBotPress,
    botActive,
    habitsBadge = false,
    hidden = false,
}: BottomNavProps) {
    const itemsRef = useRef<HTMLDivElement>(null);
    const indicatorRef = useRef<HTMLDivElement>(null);
    const placedRef = useRef(false);
    const activeRef = useRef(active);

    // Layout effect: positioned before paint, so the stripe never shows at a
    // stale spot for a frame after the route changes.
    useLayoutEffect(() => {
        activeRef.current = active;
        placeIndicator(itemsRef.current, indicatorRef.current, active, placedRef.current);
        placedRef.current = true;
    }, [active]);

    // Re-measure whenever the bar itself changes size (rotation, window
    // resize, scrollbar gutter) — a jump, not a slide.
    useEffect(() => {
        const root = itemsRef.current;
        if (!root) return;
        const reflow = () => placeIndicator(root, indicatorRef.current, activeRef.current, false);
        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', reflow);
            return () => window.removeEventListener('resize', reflow);
        }
        const ro = new ResizeObserver(reflow);
        ro.observe(root);
        return () => ro.disconnect();
    }, []);

    return (
        <nav
            className={`bn ${hidden ? 'is-hidden' : ''}`}
            aria-label="Navigasi utama"
            inert={hidden}
        >
            <div className="bn-shadow" aria-hidden="true" />
            <div className="bn-bar">
                <div className="bn-indicator" ref={indicatorRef} aria-hidden="true" />
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
