import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { storageService } from '../services/storageService';
import { useAuth } from '../context/AuthContext';
import { SystemChat } from './SystemChat';
import { BottomNav, BottomNavTab, SystemFrameDefs } from './hud';

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

export const Layout: React.FC = () => {
    const { logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const [habitsPending, setHabitsPending] = useState(false);
    const [chatOpen, setChatOpen] = useState(false);

    const activeTab = useMemo(() => pathToTab(location.pathname), [location.pathname]);

    // Recompute habit pending dot on route change.
    useEffect(() => {
        const habits = storageService.getHabits();
        const today = new Date().toISOString().split('T')[0];
        const incomplete = (habits || []).some(h => !(h.completedDates?.includes(today)));
        setHabitsPending(incomplete);
    }, [location.pathname]);

    const handleTabChange = (key: BottomNavTab) => {
        const target = TAB_TO_PATH[key];
        if (location.pathname !== target) navigate(target);
    };

    // Q4: bot tap when chat already open → toggle close.
    const handleBotPress = () => setChatOpen(prev => !prev);

    return (
        <div className="ol-shell font-sans">
            {/* Invisible SVG <defs> for the .sys-frame corner ornaments.
                Every SystemNotification across the app resolves its corner
                filigree via <use href="#sys-filigree" /> against this. */}
            <SystemFrameDefs />

            {/* Top bar — minimal: logo + wordmark left, red logout right */}
            <header className="ol-top">
                <div className="ol-top-brand">
                    <div className="ol-top-logo" aria-hidden="true">
                        <svg viewBox="0 0 28 28" width="20" height="20" fill="none">
                            <defs>
                                <linearGradient id="ol-brand-grad" x1="0" y1="0" x2="28" y2="28">
                                    <stop offset="0%" stopColor="#67E8F9" />
                                    <stop offset="100%" stopColor="#3B82F6" />
                                </linearGradient>
                            </defs>
                            <path
                                d="M4 18 C 4 12, 10 6, 14 14 C 18 22, 24 16, 24 10"
                                stroke="url(#ol-brand-grad)"
                                strokeWidth="2.6"
                                strokeLinecap="round"
                                fill="none"
                            />
                            <path
                                d="M21.5 7 L24 10 L21 12"
                                stroke="url(#ol-brand-grad)"
                                strokeWidth="2.6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                fill="none"
                            />
                        </svg>
                    </div>
                    <span className="ol-top-name">OurLife</span>
                </div>
                <button
                    type="button"
                    className="ol-top-logout"
                    onClick={logout}
                    aria-label="Sign out"
                >
                    <LogOut size={16} />
                </button>
            </header>

            {/* Main content */}
            <main className="ol-main">
                <div className="ol-main-inner">
                    <Outlet />
                </div>
            </main>

            {/* Notched bottom nav with center bot mascot */}
            <BottomNav
                active={activeTab}
                onChange={handleTabChange}
                onBotPress={handleBotPress}
                botActive={chatOpen}
                habitsBadge={habitsPending}
            />

            {/* The System chat sheet — opens via bot tap */}
            <SystemChat open={chatOpen} onClose={() => setChatOpen(false)} />
        </div>
    );
};
