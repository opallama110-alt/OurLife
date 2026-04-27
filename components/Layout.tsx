import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import { LayoutDashboard, Dumbbell, CheckSquare, Download, LogOut, User as UserIcon, Settings as SettingsIcon } from 'lucide-react';
import { storageService } from '../services/storageService';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useAuth } from '../context/AuthContext';
import { SystemChat } from './SystemChat';

export const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const [habitsPending, setHabitsPending] = useState(false);
  const { isInstallable, install } = usePWAInstall();
  const [userName, setUserName] = useState(user?.displayName || 'User');

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const habits = storageService.getHabits();
    const today = new Date().toISOString().split('T')[0];
    const incomplete = (habits || []).some(h => !(h.completedDates?.includes(today)));
    setHabitsPending(incomplete);
  }, [location.pathname]);

  // Primary navigation — intentionally minimal (Hevy/Strong style).
  // Profile, Tools, and Admin have been consolidated into Settings tabs.
  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/gym', icon: Dumbbell, label: 'Gym' },
    { path: '/habits', icon: CheckSquare, label: 'Habits', hasBadge: habitsPending },
  ];

  const settingsItem = { path: '/settings', icon: SettingsIcon, label: 'Settings' };

  const isSettingsActive = location.pathname === '/settings' || location.pathname.startsWith('/settings/');

  useEffect(() => {
    const localUser = storageService.getUserState();
    if (localUser && localUser.name) setUserName(localUser.name);

    const unsub = storageService.subscribe(() => {
      const updated = storageService.getUserState();
      if (updated && updated.name) setUserName(updated.name);
    });
    return () => unsub();
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <div className="min-h-screen bg-jarvis-bg text-slate-200 flex flex-col md:flex-row font-sans">
      {/* Mobile Header */}
      <header className="md:hidden glass-dark sticky top-0 z-50 p-4 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full border border-slate-600" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center border border-slate-600">
              <UserIcon size={16} className="text-slate-400" />
            </div>
          )}
          <div>
            <h1 className="text-base font-bold font-mono gradient-text-cyan tracking-tight">OurLife</h1>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {isInstallable && (
            <button
              onClick={install}
              className="bg-cyan-500/10 text-cyan-400 p-1.5 rounded-lg border border-cyan-500/30 animate-pulse-glow"
              aria-label="Install App"
            >
              <Download size={16} />
            </button>
          )}
          <button
            onClick={logout}
            className="ml-2 p-1.5 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20"
            aria-label="Sign Out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900/80 backdrop-blur-xl border-r border-slate-800/80 p-6 fixed h-full z-40">
        {/* Logo / User Section */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-3">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Profile" className="w-10 h-10 rounded-full shadow-lg shadow-cyan-500/20 object-cover border-2 border-slate-700" />
            ) : (
              <img src="/ourlife-logo.png" alt="OurLife" className="w-10 h-10 rounded-xl shadow-lg shadow-cyan-500/20 object-cover" />
            )}
            <div className="overflow-hidden">
              <h1 className="text-lg font-bold font-mono gradient-text-cyan tracking-tight truncate">OurLife</h1>
              <p className="text-[10px] text-slate-500 font-mono truncate">{user?.email}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2 truncate">{getGreeting()}, {user?.displayName || userName}</p>
        </div>

        {/* Primary Navigation */}
        <nav className="flex-1 space-y-1.5">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`relative w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${location.pathname === item.path
                ? 'bg-gradient-to-r from-cyan-500/15 to-blue-500/10 text-jarvis-accent shadow-lg shadow-cyan-500/5'
                : 'hover:bg-slate-800/60 text-slate-400 hover:text-white'
                }`}
            >
              {location.pathname === item.path && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-jarvis-accent rounded-r-full" />
              )}
              <item.icon size={20} />
              <span className="font-medium text-sm">{item.label}</span>
              {item.hasBadge && <div className="nav-badge" />}
            </button>
          ))}
        </nav>

        {/* Footer — Install / Settings (absolute bottom) / Sign Out */}
        <div className="mt-auto space-y-2 pt-4 border-t border-slate-800/60">
          {isInstallable && (
            <button
              onClick={install}
              className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white transition-all duration-200 group"
            >
              <Download size={18} className="group-hover:text-cyan-400 transition-colors" />
              <span className="font-medium text-sm">Install App</span>
            </button>
          )}

          <button
            onClick={() => navigate(settingsItem.path)}
            className={`relative w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${isSettingsActive
              ? 'bg-gradient-to-r from-cyan-500/10 to-blue-500/10 text-cyan-400 border border-cyan-500/20'
              : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
          >
            {isSettingsActive && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-jarvis-accent rounded-r-full" />
            )}
            <settingsItem.icon size={20} />
            <span className="font-medium text-sm">{settingsItem.label}</span>
          </button>

          <button
            onClick={logout}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 transition-all duration-200"
          >
            <LogOut size={18} />
            <span className="font-medium text-sm">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 pb-24 md:pb-8 overflow-y-auto">
        <div className="max-w-5xl xl:max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* ═══ Phase 25: The System — global FAB + chat sheet ═══ */}
      <SystemChat />

      {/* Mobile Bottom Nav — Dashboard, Gym, Habits, then Settings at far right */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass-dark flex justify-around p-1.5 z-50">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`relative flex flex-col items-center p-2 rounded-xl transition-all duration-200 ${location.pathname === item.path
              ? 'text-jarvis-accent bg-cyan-500/10'
              : 'text-slate-500'
              }`}
          >
            <item.icon size={20} />
            <span className="text-[10px] mt-1 font-medium">{item.label}</span>
            {item.hasBadge && <div className="nav-badge" />}
          </button>
        ))}
        <button
          onClick={() => navigate(settingsItem.path)}
          className={`relative flex flex-col items-center p-2 rounded-xl transition-all duration-200 ${isSettingsActive
            ? 'text-jarvis-accent bg-cyan-500/10'
            : 'text-slate-500'
            }`}
        >
          <settingsItem.icon size={20} />
          <span className="text-[10px] mt-1 font-medium">{settingsItem.label}</span>
        </button>
      </nav>
    </div>
  );
};
