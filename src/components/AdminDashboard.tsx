import React, { useState, useEffect } from 'react';
import { Users, Search, TrendingUp, DollarSign, Activity, Shield, Loader, Eye, X, Calendar, Dumbbell, CreditCard, Wallet, BarChart3, ArrowUpRight, ArrowDownRight, Filter, Trash2, ShieldAlert, Bell, BellOff, Flame } from 'lucide-react';
import { storageService } from '../services/storageService';
import { useAuth } from '../context/AuthContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, CartesianGrid, AreaChart, Area } from 'recharts';
import { MUSCLE_GROUP_CONFIG } from '../config/constants';
import { GymProfile, WorkoutLog, MuscleGroup } from '../types';
import { calculateStreak } from '../services/gamificationService';
import { calculateAge } from '../utils/dateUtils';
import { ref, get, remove } from 'firebase/database';
import { rtdb } from '../../firebase-config';

export const AdminDashboard: React.FC = () => {
    const { user, loading: authLoading } = useAuth();
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isOwner, setIsOwner] = useState(false);

    if (authLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-slate-500 animate-fade-in">
                <Loader size={48} className="animate-spin mb-4 text-cyan-500" />
                <p>Loading authentication status...</p>
            </div>
        );
    }

    if (!loading && !isOwner) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 animate-fade-in">
                <ShieldAlert size={64} className="text-rose-500 mb-4" />
                <h1 className="text-2xl font-bold text-white mb-2 font-mono">ACCESS DENIED</h1>
                <p className="text-slate-400 text-center max-w-md font-mono mb-6">
                    This area is restricted to authorized personnel only.
                    <br />
                    Current User: <span className="text-cyan-400">{user?.email}</span>
                </p>
                <button
                    onClick={() => window.location.href = '/'}
                    className="px-6 py-3 bg-slate-900 border border-slate-700 text-white rounded-xl hover:bg-slate-800 hover:border-cyan-500/50 transition-all font-mono text-sm flex items-center"
                >
                    <Activity size={16} className="mr-2" /> Return to Training
                </button>
            </div>
        );
    }

    // Detail Modal State
    const [selectedUser, setSelectedUser] = useState<any | null>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    // Transaction Filter State
    const [transactionSearch, setTransactionSearch] = useState('');
    const [transactionFilter, setTransactionFilter] = useState<'All' | 'Income' | 'Expense'>('All');

    const [vizPeriod, setVizPeriod] = useState<'weekly' | 'monthly' | 'yearly'>('weekly');
    const [financePeriod, setFinancePeriod] = useState<'weekly' | 'monthly' | 'yearly'>('weekly');

    // Helper: Calculate Frequency Data
    const getFrequencyData = (logs: WorkoutLog[]) => {
        if (!logs) return [];
        const now = new Date();
        const currentYear = now.getFullYear();

        // Weekly: Mon-Sun of current week
        if (vizPeriod === 'weekly') {
            const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            const getWeekNumber = (d: Date) => {
                d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
                d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
                const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
                return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
            };
            const currentWeek = getWeekNumber(now);

            return days.map((d, i) => {
                const count = logs.filter(l => {
                    const logDate = new Date(l.date);
                    return logDate.getDay() === (i + 1) % 7 && getWeekNumber(logDate) === currentWeek && logDate.getFullYear() === currentYear;
                })?.length;
                return { label: d, count };
            });
        }

        // Monthly: Days 1-31 of current month
        if (vizPeriod === 'monthly') {
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            const currentMonth = now.getMonth();
            return Array.from({ length: daysInMonth }, (_, i) => {
                const dayNum = i + 1;
                const count = logs.filter(l => {
                    const d = new Date(l.date);
                    return d.getDate() === dayNum && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
                })?.length;
                return { label: dayNum.toString(), count };
            });
        }

        // Yearly: Jan-Dec of current year
        if (vizPeriod === 'yearly') {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return months.map((m, i) => {
                const count = logs.filter(l => {
                    const d = new Date(l.date);
                    return d.getMonth() === i && d.getFullYear() === currentYear;
                })?.length;
                return { label: m, count };
            });
        }
        return [];
    };

    // Helper: Finance Trend Data
    const getFinanceData = (transactions: any[]) => {
        if (!transactions) return [];
        const now = new Date();
        const currentYear = now.getFullYear();

        if (financePeriod === 'weekly') {
            const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            const getWeekNumber = (d: Date) => {
                d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
                d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
                const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
                return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
            };
            const currentWeek = getWeekNumber(now);

            return days.map((d, i) => {
                const dayTrans = transactions.filter(t => {
                    const tDate = new Date(t.date);
                    return tDate.getDay() === (i + 1) % 7 && getWeekNumber(tDate) === currentWeek && tDate.getFullYear() === currentYear;
                });
                const income = dayTrans.filter(t => t.type === 'income').reduce((s: number, t: any) => s + t.amount, 0);
                const expense = dayTrans.filter(t => t.type === 'expense').reduce((s: number, t: any) => s + t.amount, 0);
                return { label: d, income, expense };
            });
        }

        if (financePeriod === 'monthly') {
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            const currentMonth = now.getMonth();
            return Array.from({ length: daysInMonth }, (_, i) => {
                const dayNum = i + 1;
                const dayTrans = transactions.filter(t => {
                    const d = new Date(t.date);
                    return d.getDate() === dayNum && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
                });
                const income = dayTrans.filter(t => t.type === 'income').reduce((s: number, t: any) => s + t.amount, 0);
                const expense = dayTrans.filter(t => t.type === 'expense').reduce((s: number, t: any) => s + t.amount, 0);
                return { label: dayNum.toString(), income, expense };
            });
        }

        if (financePeriod === 'yearly') {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return months.map((m, i) => {
                const monthTrans = transactions.filter(t => {
                    const d = new Date(t.date);
                    return d.getMonth() === i && d.getFullYear() === currentYear;
                });
                const income = monthTrans.filter(t => t.type === 'income').reduce((s: number, t: any) => s + t.amount, 0);
                const expense = monthTrans.filter(t => t.type === 'expense').reduce((s: number, t: any) => s + t.amount, 0);
                return { label: m, income, expense };
            });
        }
        return [];
    };

    useEffect(() => {
        // Strict email check for Owner View
        const email = user?.email?.toLowerCase().trim();
        const authorized = email === 'opallama11@gmail.com' || email === 'opallama110@gmail.com';

        setIsOwner(authorized);

        if (!authorized) {
            setLoading(false);
            return;
        }

        setLoading(true);

        // Phase 11d: Dual-source fetch — RTDB has rich nested data (workouts,
        // transactions, gymProfile), Firestore has the canonical user list used
        // by the leaderboard. Merge both so the admin table is never empty.
        const fetchUsers = async () => {
            try {
                const rtdbSnap = await get(ref(rtdb, 'users'));
                const rtdbData: Record<string, any> = rtdbSnap.exists() ? rtdbSnap.val() : {};

                let firestoreUsers: any[] = [];
                try {
                    firestoreUsers = await storageService.getAllUsers();
                } catch (e) {
                    console.warn('[AdminDashboard] getAllUsers fallback failed:', e);
                }

                const merged: Record<string, any> = {};

                // Seed from RTDB (includes nested workouts/transactions/etc.)
                Object.entries(rtdbData).forEach(([uid, val]) => {
                    merged[uid] = { id: uid, ...(val as any) };
                });

                // Layer Firestore top-level fields (xp, level, rank, monthlyXP, …)
                firestoreUsers.forEach(fu => {
                    if (!fu?.id) return;
                    merged[fu.id] = { ...(merged[fu.id] || {}), ...fu, id: fu.id };
                });

                const data = Object.values(merged);

                // Sort by Level/XP (Highest to Lowest)
                data.sort((a: any, b: any) => {
                    const levelA = a.level ?? a.gymProfile?.level ?? 0;
                    const levelB = b.level ?? b.gymProfile?.level ?? 0;
                    const xpA = a.xp ?? a.gymProfile?.totalXP ?? 0;
                    const xpB = b.xp ?? b.gymProfile?.totalXP ?? 0;

                    if (levelB !== levelA) return levelB - levelA;
                    return xpB - xpA;
                });

                setUsers(data);
            } catch (error) {
                console.error("Failed to fetch users", error);
                setUsers([]);
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();

        return () => { };
    }, [user, isOwner]);

    const handleViewUser = async (uid: string) => {
        setLoadingDetails(true);
        setIsDetailOpen(true);
        try {
            const data = await storageService.getUserDetails(uid);
            setSelectedUser(data);
        } catch (error) {
            console.error("Failed to get user details", error);
        } finally {
            setLoadingDetails(false);
        }
    };

    const handleDeleteUser = async (uid: string, userName: string) => {
        if (!isOwner) return;

        if (window.confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) {
            try {
                await remove(ref(rtdb, `users/${uid}`));
                setUsers(prev => prev.filter(u => u.id !== uid));
                // Close detail modal if open and matches deleted user
                if (selectedUser?.id === uid) {
                    closeDetail();
                }
            } catch (error) {
                console.error("Failed to delete user", error);
                alert("Failed to delete user. See console for details.");
            }
        }
    };

    const closeDetail = () => {
        setIsDetailOpen(false);
        setSelectedUser(null);
    };

    if (!user || !isOwner) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-slate-500 animate-fade-in">
                <Shield size={48} className="mb-4 text-rose-500" />
                <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
                <p>This dashboard is restricted to the owner account.</p>
                <div className="mt-4 p-3 bg-slate-900/50 rounded-lg text-xs font-mono">
                    Current User: {user?.email || 'Guest'}
                </div>
            </div>
        );
    }

    const filteredUsers = users.filter(u =>
        u.name.toLowerCase()?.includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase()?.includes(searchTerm.toLowerCase())
    );

    const avgLevel = users?.length > 0 ? Math.round(users.reduce((sum, u) => sum + (u.level || 1), 0) / users?.length) : 0;

    // Helper to calculate balance
    const calculateBalance = (transactions: any[]) => {
        return transactions.reduce((acc, t) => t.type === 'income' ? acc + t.amount : acc - t.amount, 0);
    };

    // Helper to determine recovery
    const getRecoveryStatus = (workoutLogs: any[]) => {
        if (!workoutLogs || workoutLogs?.length === 0) return "Fully Recovered (No recent data)";
        const lastWorkout = workoutLogs[0]; // Assuming sorted desc by date
        const type = lastWorkout.type;
        // Simple logic
        if (type?.includes('Push')) return "Chest, Shoulders, Triceps recovering";
        if (type?.includes('Pull')) return "Back, Biceps recovering";
        if (type?.includes('Legs')) return "Legs, Glutes recovering";
        return "Recovering from " + type;
    };

    const handleSendNudge = async (type: 'gym' | 'finance') => {
        if (!selectedUser?.fcmToken) {
            alert("This user hasn't enabled notifications yet.");
            return;
        }

        const title = type === 'gym' ? "💪 Time to Grind!" : "💰 Save That Money!";
        const body = type === 'gym'
            ? "Don't let your gains wait. Hit the gym today!"
            : "Remember your financial goals. Spend properly!";

        console.log(`[Mock FCM] Sending to ${selectedUser.fcmToken}:`, { title, body });
        alert(`Nudge sent: ${title}`);
    };

    return (
        <div className="space-y-6 animate-slide-up pb-24 px-4 sm:px-0">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center">
                        <Shield size={24} className="mr-2 text-rose-500" />
                        Owner Dashboard
                    </h2>
                    <p className="text-slate-400 text-sm">Leaderboard & user statistics</p>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-bold text-white font-mono">{users?.length}</div>
                    <div className="text-xs text-slate-500 uppercase">Total Users</div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3">
                <div className="jarvis-card p-4 rounded-xl">
                    <div className="flex items-center space-x-2 text-slate-400 mb-2">
                        <Users size={16} className="text-cyan-400" />
                        <span className="text-xs font-mono uppercase">Registered Users</span>
                    </div>
                    <div className="text-lg font-bold text-white font-mono">{users?.length}</div>
                </div>
                <div className="jarvis-card p-4 rounded-xl">
                    <div className="flex items-center space-x-2 text-slate-400 mb-2">
                        <TrendingUp size={16} className="text-emerald-400" />
                        <span className="text-xs font-mono uppercase">Avg Level</span>
                    </div>
                    <div className="text-lg font-bold text-white font-mono">Lv. {avgLevel}</div>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                    type="text"
                    placeholder="Search users by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-cyan-500 transition-all font-mono text-sm"
                />
            </div>

            {/* User List Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
                {/* Table Header */}
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-2 p-3 bg-slate-800/50 text-xs font-mono text-slate-400 uppercase border-b border-slate-700">
                    <div className="col-span-1 text-center">#</div>
                    <div className="col-span-5">User Details</div>
                    <div className="col-span-2 text-center">Age</div>
                    <div className="col-span-2 text-center">Gender</div>
                    <div className="col-span-2 text-center">Action</div>
                </div>

                {loading ? (
                    <div className="p-12 flex flex-col items-center justify-center text-slate-500">
                        <Loader size={24} className="animate-spin mb-2 text-cyan-500" />
                        <span className="text-xs font-mono">Fetching user data...</span>
                    </div>
                ) : filteredUsers?.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-sm font-mono">No users found.</div>
                ) : (
                    <div className="divide-y divide-slate-800/50">
                        {filteredUsers.map((u, index) => {
                            return (
                                <div key={u.id} className="grid grid-cols-12 gap-2 p-3 items-center hover:bg-slate-800/30 transition-colors group">
                                    <div className="col-span-1 text-center font-mono text-slate-600 group-hover:text-slate-400">{index + 1}</div>
                                    <div className="col-span-5 min-w-0">
                                        <div className="font-bold text-white text-sm truncate">{u.name}</div>
                                        <div className="text-[10px] text-slate-500 truncate font-mono">{u.email}</div>
                                    </div>
                                    <div className="col-span-2 text-center">
                                        <div className="text-white font-mono text-sm">{u.userState?.dateOfBirth ? calculateAge(u.userState.dateOfBirth) : (u.age || '-')}</div>
                                    </div>
                                    <div className="col-span-2 text-center">
                                        <div className="text-white font-mono text-sm capitalize">{u.userState?.gender || u.gender || 'Not Set'}</div>
                                    </div>
                                    <div className="col-span-2 text-center flex items-center justify-center space-x-2">
                                        <button
                                            onClick={() => handleViewUser(u.id)}
                                            className="p-2 bg-slate-800 text-cyan-400 rounded-lg hover:bg-cyan-500 hover:text-white transition-colors"
                                            title="View Details"
                                        >
                                            <Eye size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteUser(u.id, u.name)}
                                            className="p-2 bg-slate-800 text-rose-400 rounded-lg hover:bg-rose-500 hover:text-white transition-colors"
                                            title="Delete User"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Detail Modal - Relocated to Bottom for Isolation */}
            {isDetailOpen && (
                <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
                    {/* Modal Box */}
                    <div className="relative w-full max-w-4xl max-h-[85vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-scale-up">
                        {loadingDetails || !selectedUser ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-20">
                                <Loader size={48} className="animate-spin mb-4 text-cyan-500" />
                                <p className="font-mono">Loading User Data...</p>
                            </div>
                        ) : (
                            <>
                                {/* Modal Header - Fixed at Top */}
                                <div className="p-4 md:p-6 flex items-center justify-between bg-slate-800/80 backdrop-blur-md border-b border-slate-700 rounded-t-3xl z-10 shrink-0">
                                    <div className="flex items-center space-x-4">
                                        <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-800 rounded-full flex items-center justify-center font-bold text-lg md:text-xl text-cyan-400 border border-slate-700">
                                            {selectedUser.name?.charAt(0) || 'U'}
                                        </div>
                                        <div>
                                            <h3 className="text-lg md:text-xl font-bold text-white line-clamp-1">{selectedUser.name}</h3>
                                            <p className="text-xs md:text-sm text-slate-400 font-mono line-clamp-1">{selectedUser.email} • {selectedUser.userState?.fitnessGoal || 'No Goal'}</p>
                                        </div>
                                    </div>
                                    <button onClick={closeDetail} className="p-2 bg-slate-700 text-slate-400 rounded-full hover:bg-rose-500 hover:text-white transition-colors shrink-0 ml-4">
                                        <X size={20} />
                                    </button>
                                </div>

                                {/* Scrollable Content */}
                                <div className="p-4 md:p-6 overflow-y-auto custom-scrollbar bg-slate-900">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* LEFT COLUMN: GYM */}
                                        <div className="space-y-6">
                                            {/* Physical Stats Card (Moved from Table) */}
                                            <div className="jarvis-card p-4 rounded-xl">
                                                <div className="text-xs font-mono text-slate-500 uppercase mb-3 flex items-center">
                                                    <Activity size={14} className="mr-2" /> Physical Stats
                                                </div>
                                                <div className="grid grid-cols-3 gap-2 text-center">
                                                    <div className="bg-slate-800/50 p-2 rounded-lg">
                                                        <div className="text-xs text-slate-400">Height</div>
                                                        <div className="font-bold text-white">{selectedUser.userState?.height || '-'} cm</div>
                                                    </div>
                                                    <div className="bg-slate-800/50 p-2 rounded-lg">
                                                        <div className="text-xs text-slate-400">Weight</div>
                                                        <div className="font-bold text-white">{selectedUser.userState?.weight || '-'} kg</div>
                                                    </div>
                                                    <div className="bg-slate-800/50 p-2 rounded-lg">
                                                        <div className="text-xs text-slate-400">BMI</div>
                                                        {(() => {
                                                            const h = (selectedUser.userState?.height || 170) / 100;
                                                            const w = selectedUser.userState?.weight || 60;
                                                            const b = (w / (h * h)).toFixed(1);
                                                            const bn = parseFloat(b);
                                                            let c = 'text-emerald-400';
                                                            if (bn < 18.5 || bn >= 25) c = 'text-amber-400';
                                                            if (bn >= 30) c = 'text-rose-500';
                                                            return <div className={`font-bold ${c}`}>{b}</div>;
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Recent Workouts List */}
                                            <div className="space-y-3">
                                                <div className="flex items-center space-x-2">
                                                    <Activity className="text-cyan-400" size={20} />
                                                    <h4 className="text-sm font-bold text-white">Recent Workouts</h4>
                                                </div>
                                                <div className="space-y-3">
                                                    {selectedUser.workoutLogs?.slice(0, 3).map((log: any, i: number) => (
                                                        <div key={i} className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 flex justify-between items-center hover:bg-slate-800 transition-colors">
                                                            <div>
                                                                <div className="flex items-center space-x-2">
                                                                    <span className="font-bold text-white text-sm">{log.type}</span>
                                                                    {log.xpEarned > 0 && (
                                                                        <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20">
                                                                            +{log.xpEarned}xp
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="text-xs text-slate-500 mt-1 flex items-center space-x-2">
                                                                    <span>{log.date}</span>
                                                                    <span>•</span>
                                                                    <span>{log.exercises?.length || 0} exercises</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {(!selectedUser.workoutLogs || selectedUser.workoutLogs?.length === 0) && (
                                                        <div className="text-center text-slate-600 text-xs py-4 border border-dashed border-slate-800 rounded-xl">
                                                            No recent workouts
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center space-x-2 mb-4">
                                                <Dumbbell className="text-cyan-400" size={24} />
                                                <h4 className="text-lg font-bold text-white">Gym & Recovery</h4>
                                            </div>

                                            {/* Recovery Status Card */}
                                            <div className="jarvis-card p-4 rounded-xl border-l-4 border-l-cyan-500">
                                                <div className="text-xs font-mono text-slate-500 uppercase mb-1">Recovery Status</div>
                                                <div className="text-white font-medium">
                                                    {getRecoveryStatus(selectedUser.workoutLogs)}
                                                </div>
                                                <div className="mt-2 text-xs text-slate-400">
                                                    Last workout: {selectedUser.workoutLogs?.[0]?.date || 'None'} ({selectedUser.workoutLogs?.[0]?.type || 'N/A'})
                                                </div>
                                            </div>

                                            {/* Workout Streak */}
                                            <div className="jarvis-card p-4 rounded-xl flex items-center justify-between overflow-hidden relative" style={{ transform: 'none' }}>
                                                <div className="absolute right-0 top-0 w-24 h-24 bg-orange-500/10 rounded-full blur-2xl" />
                                                <div>
                                                    <h4 className="text-xs font-mono text-slate-400 uppercase mb-1">Workout Streak</h4>
                                                    <div className="text-3xl font-extrabold text-white font-mono flex items-baseline">
                                                        {calculateStreak(selectedUser.workoutLogs)} <span className="text-xs text-slate-500 ml-1 font-medium">Days</span>
                                                    </div>
                                                </div>
                                                <div className="relative">
                                                    {calculateStreak(selectedUser.workoutLogs) > 0 && (
                                                        <div className="absolute inset-0 bg-orange-500/20 blur-md rounded-full scale-150 animate-pulse" />
                                                    )}
                                                    <Flame size={48} strokeWidth={1.5} className={`relative z-10 transition-all duration-1000 ${calculateStreak(selectedUser.workoutLogs) > 0 ? 'text-orange-500 drop-shadow-[0_0_15px_rgba(249,115,22,0.8)] animate-pulse' : 'text-slate-600'}`} />
                                                </div>
                                            </div>

                                            {/* Gym Schedule */}
                                            <div className="jarvis-card p-4 rounded-xl">
                                                <div className="text-xs font-mono text-slate-500 uppercase mb-3 flex items-center">
                                                    <Calendar size={14} className="mr-2" /> Weekly Schedule
                                                </div>
                                                <div className="space-y-2">
                                                    {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                                                        <div key={day} className="flex justify-between text-sm py-1 border-b border-slate-800/50 last:border-0">
                                                            <span className="capitalize text-slate-400 w-24">{day}</span>
                                                            <span className="text-white flex-1 text-right truncate">
                                                                {selectedUser.gymSchedule?.[day] || '-'}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Muscle Stats */}
                                            <div className="jarvis-card p-4 rounded-xl">
                                                <div className="text-xs font-mono text-slate-500 uppercase mb-3">Muscle Distribution</div>
                                                <div className="space-y-2">
                                                    {Object.entries(selectedUser.gymProfile?.muscleXP || {} as Record<string, number>)
                                                        .sort(([, a], [, b]) => (b as number) - (a as number))
                                                        .slice(0, 5) // Top 5
                                                        .map(([muscle, xp]) => {
                                                            const cfg = MUSCLE_GROUP_CONFIG[muscle as MuscleGroup];
                                                            return (
                                                                <div key={muscle} className="flex items-center justify-between text-xs">
                                                                    <span className="flex items-center text-slate-300">
                                                                        <div className="relative w-4 h-4 mr-2 inline-flex items-center justify-center shrink-0">
                                                                          <img src={`/assets/muscles/${muscle}.webp`} alt={muscle} className="w-full h-full object-contain opacity-80" onError={(e) => { e.currentTarget.style.display='none'; e.currentTarget.nextElementSibling?.classList.remove('hidden') }} />
                                                                          <Dumbbell className="hidden w-4 h-4 text-slate-500" />
                                                                        </div>
                                                                        {cfg?.label || muscle}
                                                                    </span>
                                                                    <span className="text-cyan-400 font-mono">{xp as number} XP</span>
                                                                </div>
                                                            )
                                                        })}
                                                </div>
                                            </div>
                                        </div>

                                        {/* RIGHT COLUMN: FINANCE */}
                                        <div className="space-y-6">
                                            <div className="flex items-center space-x-2 mb-4">
                                                <Wallet className="text-emerald-400" size={24} />
                                                <h4 className="text-lg font-bold text-white">Financial Health</h4>
                                            </div>

                                            {/* Balance Card */}
                                            <div className="jarvis-card p-4 rounded-xl border-l-4 border-l-emerald-500">
                                                <div className="text-xs font-mono text-slate-500 uppercase mb-1">Current Balance</div>
                                                <div className="text-2xl font-bold text-white font-mono">
                                                    Rp {calculateBalance(selectedUser.transactions).toLocaleString('id-ID')}
                                                </div>
                                                <div className="mt-1 text-xs text-slate-400">
                                                    Based on tracked transactions
                                                </div>
                                            </div>

                                            {/* Cashflow Chart */}
                                            <div className="jarvis-card p-4 rounded-xl">
                                                <div className="flex items-center justify-between mb-4">
                                                    <h4 className="text-xs font-mono text-slate-400 uppercase">Cashflow Trend</h4>
                                                    <div className="flex bg-slate-800 rounded-lg p-0.5">
                                                        {(['weekly', 'monthly', 'yearly'] as const).map(p => (
                                                            <button key={p} onClick={() => setFinancePeriod(p)}
                                                                className={`px-2 py-1 text-[9px] font-bold uppercase rounded-md transition-all ${financePeriod === p ? 'bg-emerald-500 text-slate-900' : 'text-slate-400'}`}>
                                                                {p}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <ResponsiveContainer width="100%" height={180}>
                                                    <AreaChart data={getFinanceData(selectedUser.transactions)}>
                                                        <defs>
                                                            <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                            </linearGradient>
                                                            <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                                            </linearGradient>
                                                        </defs>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                                        <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} dy={5} interval={financePeriod === 'monthly' ? 4 : 0} />
                                                        <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
                                                        <Area type="monotone" dataKey="income" stroke="#10b981" fillOpacity={1} fill="url(#colorIncome)" strokeWidth={2} />
                                                        <Area type="monotone" dataKey="expense" stroke="#ef4444" fillOpacity={1} fill="url(#colorExpense)" strokeWidth={2} />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            </div>

                                            {/* Transaction History */}
                                            <div className="jarvis-card p-4 rounded-xl">
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="text-xs font-mono text-slate-500 uppercase flex items-center">
                                                        <CreditCard size={14} className="mr-2" /> Transaction History
                                                    </div>
                                                    <div className="flex space-x-2">
                                                        <select
                                                            className="bg-slate-800 text-xs text-slate-300 border border-slate-700 rounded-lg px-2 py-1 outline-none focus:border-cyan-500"
                                                            value={transactionFilter}
                                                            onChange={(e) => setTransactionFilter(e.target.value as any)}
                                                        >
                                                            <option value="All">All</option>
                                                            <option value="Income">Income</option>
                                                            <option value="Expense">Expense</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                {/* Search Bar */}
                                                <div className="relative mb-4">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                                                    <input
                                                        type="text"
                                                        placeholder="Search transactions..."
                                                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                                                        value={transactionSearch}
                                                        onChange={(e) => setTransactionSearch(e.target.value)}
                                                    />
                                                </div>

                                                <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                                                    {selectedUser.transactions
                                                        ?.filter((t: any) => {
                                                            const matchesFilter = transactionFilter === 'All' ||
                                                                (transactionFilter === 'Income' && t.type === 'income') ||
                                                                (transactionFilter === 'Expense' && t.type === 'expense');
                                                            const matchesSearch = t.description?.toLowerCase()?.includes(transactionSearch.toLowerCase()) ||
                                                                t.category?.toLowerCase()?.includes(transactionSearch.toLowerCase());
                                                            return matchesFilter && matchesSearch;
                                                        })
                                                        .slice(0, 10) // Limit to 10 for performance, maybe paginate later
                                                        .map((t: any, i: number) => (
                                                            <div key={i} className="flex items-center justify-between p-2 hover:bg-slate-800/30 rounded-lg transition-colors group">
                                                                <div className="flex items-center space-x-3">
                                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.type === 'income' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                                                        {t.type === 'income' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-sm font-medium text-white">{t.category || 'Other'}</div>
                                                                        <div className="text-[10px] text-slate-500 font-mono">
                                                                            {t.date} <span className="opacity-50 mx-1">•</span> {t.description || t.category}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className={`font-mono text-sm font-bold ${t.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                                    {t.type === 'income' ? '+' : '-'}Rp {t.amount.toLocaleString('id-ID')}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    {(!selectedUser.transactions || selectedUser.transactions?.length === 0) && (
                                                        <div className="text-center text-slate-600 text-xs py-8">No transactions found.</div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Nudge Actions */}
                                            <div className="jarvis-card p-4 rounded-xl border border-dashed border-slate-700">
                                                <div className="flex items-center space-x-2 mb-3">
                                                    <Bell className="text-yellow-400" size={20} />
                                                    <h4 className="text-sm font-bold text-white">Send Nudge</h4>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <button
                                                        onClick={() => handleSendNudge('gym')}
                                                        className="p-3 bg-slate-800 hover:bg-cyan-900/30 border border-slate-700 hover:border-cyan-500 rounded-xl transition-all group flex flex-col items-center justify-center text-center"
                                                    >
                                                        <Dumbbell className="text-cyan-400 mb-2 group-hover:scale-110 transition-transform" size={24} />
                                                        <span className="text-xs font-bold text-white">Gym Motivation</span>
                                                        <span className="text-[10px] text-slate-500 mt-1">"Time to lift! 💪"</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleSendNudge('finance')}
                                                        className="p-3 bg-slate-800 hover:bg-emerald-900/30 border border-slate-700 hover:border-emerald-500 rounded-xl transition-all group flex flex-col items-center justify-center text-center"
                                                    >
                                                        <DollarSign className="text-emerald-400 mb-2 group-hover:scale-110 transition-transform" size={24} />
                                                        <span className="text-xs font-bold text-white">Thrifty Mode</span>
                                                        <span className="text-[10px] text-slate-500 mt-1">"Save money! 💰"</span>
                                                    </button>
                                                </div>
                                                {selectedUser.fcmToken ? (
                                                    <div className="mt-3 text-[10px] text-emerald-400 flex items-center justify-center">
                                                        <Bell size={10} className="mr-1" /> User has enabled notifications
                                                    </div>
                                                ) : (
                                                    <div className="mt-3 text-[10px] text-slate-500 flex items-center justify-center">
                                                        <BellOff size={10} className="mr-1" /> User has not enabled notifications
                                                    </div>
                                                )}
                                            </div>
                                        </div >
                                    </div >
                                </div >
                            </>
                        )}
                    </div >
                </div >
            )}
        </div >
    );
};
