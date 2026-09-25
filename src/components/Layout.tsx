import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { storageService } from '../services/storageService';
import { useAuth } from '../context/AuthContext';
import { SystemChat } from './SystemChat';
import { BottomNav, BottomNavTab, ConfirmDialog, SystemFrameDefs } from './hud';
import { getLocalDateString } from '../utils/dateUtils';
import { useSoftKeyboardOpen } from '../hooks/useSoftKeyboard';

// ─────────────────────────────────────────────────────────────────────────
// Layout — minimal top bar + content outlet + notched bottom nav + bot.
// Mobile-style shell at all viewports (Q1=B: nav constrained to max-width
// 500px centered, content keeps its existing max-w-5xl). The desktop
// sidebar from the previous version is dropped entirely.
//
// SystemChat open state is hoisted here so the center bot mascot tap can
// toggle the chat without SystemChat owning its own FAB.
// ─────────────────────────────────────────────────────────────────────────

const pathToTab = (pathname: string): BottomNavTab => {
    if (pathname.startsWith('/gym')) return 'gym';
    if (pathname.startsWith('/habits')) return 'habits';
    if (pathname.startsWith('/settings') || pathname.startsWith('/profile')) return 'settings';
    return 'dashboard';
};

const TAB_TO_PATH: Record<BottomNavTab, string> = {
    dashboard: '/',
    gym: '/gym',
    habits: '/habits',
    settings: '/settings',
};

/** Display-only selector: does any habit still need ticking today? */
const hasPendingHabits = (): boolean => {
    const today = getLocalDateString();
    return (storageService.getHabits() || []).some(h => !(h.completedDates?.includes(today)));
};

export const Layout: React.FC = () => {
    const { logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const [habitsPending, setHabitsPending] = useState(hasPendingHabits);
    const [chatOpen, setChatOpen] = useState(false);
    const [logoutOpen, setLogoutOpen] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    const keyboardOpen = useSoftKeyboardOpen();

    const activeTab = useMemo(() => pathToTab(location.pathname), [location.pathname]);

    // .ol-main is the scroll container (not window), so the browser never
    // resets it on navigation — without this, switching tabs lands you
    // halfway down the next screen. Layout effect = reset before paint.
    const mainRef = useRef<HTMLElement>(null);
    useLayoutEffect(() => {
        if (mainRef.current) mainRef.current.scrollTop = 0;
    }, [location.pathname]);

    // Habit pending dot: live, so ticking the last habit on the Habits screen
    // retires the dot right there (with its exit animation) instead of on the
    // next tab switch. The route dependency re-checks "today" after midnight.
    useEffect(() => {
        const sync = () => setHabitsPending(hasPendingHabits());
        sync();
        return storageService.subscribe(sync);
    }, [location.pathname]);

    const handleTabChange = (key: BottomNavTab) => {
        const target = TAB_TO_PATH[key];
        if (location.pathname !== target) navigate(target);
    };

    // Q4: bot tap when chat already open → toggle close.
    const handleBotPress = () => setChatOpen(prev => !prev);

    // The logout button sits where a thumb rests on the top bar, and signing
    // out also wipes the local cache — so it asks first.
    const handleLogoutConfirm = async () => {
        setLoggingOut(true);
        try {
            await logout();
        } finally {
            // On success the auth listener unmounts this shell anyway; if the
            // sign-out failed (AuthContext logs it) the user lands back in the app.
            setLoggingOut(false);
            setLogoutOpen(false);
        }
    };

    return (
        <div className="ol-shell font-sans">
            {/* Invisible SVG <defs> for the .sys-frame corner ornaments.
                Every SystemNotification across the app resolves its corner
                filigree via <use href="#sys-filigree" /> against this. */}
            <SystemFrameDefs />

            {/* Top bar — minimal: logo + wordmark left, red logout right */}
            <header className="ol-top">
                <div className="ol-top-brand">
                    <div className="ol-top-logo">
                        <img src="/ourlife-logo.png" alt="" />
                    </div>
                    <span className="ol-top-name">OurLife</span>
                </div>
                <button
                    type="button"
                    className="ol-top-logout"
                    onClick={() => setLogoutOpen(true)}
                    aria-label="Keluar dari akun"
                    aria-haspopup="dialog"
                >
                    <LogOut size={16} aria-hidden="true" />
                </button>
            </header>

            {/* Main content */}
            <main className="ol-main" ref={mainRef}>
                {/* Keyed on the path so each tab switch replays a short
                    fade-rise (.ol-route) instead of hard-cutting between
                    screens. Pages remount on route change anyway, so the key
                    costs nothing extra. */}
                <div className="ol-main-inner ol-route" key={location.pathname}>
                    <Outlet />
                </div>
            </main>

            {/* Notched bottom nav with center bot mascot. Slides away while
                the soft keyboard is up so it never covers the field being
                edited (interactive-widget=resizes-content lifts fixed
                elements above the keyboard). */}
            <BottomNav
                active={activeTab}
                onChange={handleTabChange}
                onBotPress={handleBotPress}
                botActive={chatOpen}
                habitsBadge={habitsPending}
                hidden={keyboardOpen}
            />

            {/* The System chat sheet — opens via bot tap */}
            <SystemChat open={chatOpen} onClose={() => setChatOpen(false)} />

            <ConfirmDialog
                open={logoutOpen}
                title="Keluar dari akun?"
                message="Kamu perlu masuk lagi untuk melanjutkan progres di perangkat ini."
                confirmLabel="Keluar"
                tone="red"
                busy={loggingOut}
                onConfirm={handleLogoutConfirm}
                onCancel={() => setLogoutOpen(false)}
            />
        </div>
    );
};
