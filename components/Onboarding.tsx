import React, { useState } from 'react';
import { UserState, ExperienceLevel, IdealDuration, FocusArea, MuscleGroup, Environment } from '../types';
import { storageService } from '../services/storageService';
import { doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase-config';
import {
    ArrowRight, User, Ruler, Weight, Sparkles,
    Sprout, Flame, Crown,
    Timer, Hourglass, Clock,
    Dumbbell, Footprints, Activity, Layers,
    Home, Building2, Check,
} from 'lucide-react';
import { GymSchedule } from '../types';
import { calcBMI, bmiSliderStyle } from '../utils/bmi';
import AnatomyViewer from './Anatomy/AnatomyViewer';
import { DateOfBirthPicker } from './DateOfBirthPicker';
import { getTrainedMuscleIds } from '../constants/muscleMapping';

const EQUIPMENT_OPTIONS = [
    'Barbell', 'Dumbbell', 'Cable', 'Machine',
    'Kettlebell', 'Bands', 'Smith Machine', 'Bodyweight',
] as const;

// ── Phase 10: Activity → schedule auto-fill ────────────────────────────
const ACTIVITY_SCHEDULES: Record<NonNullable<UserState['activityLevel']>, GymSchedule> = {
    Sedentary: {
        monday: 'Istirahat', tuesday: 'Jalan Santai', wednesday: 'Istirahat',
        thursday: 'Peregangan', friday: 'Istirahat', saturday: 'Jalan Santai', sunday: 'Istirahat',
    },
    Light: {
        monday: 'Full Body', tuesday: 'Istirahat', wednesday: 'Istirahat',
        thursday: 'Full Body', friday: 'Istirahat', saturday: 'Kardio Ringan', sunday: 'Istirahat',
    },
    Moderate: {
        monday: 'Upper', tuesday: 'Lower', wednesday: 'Istirahat',
        thursday: 'Upper', friday: 'Lower', saturday: 'Recovery Aktif', sunday: 'Istirahat',
    },
    Active: {
        monday: 'Push', tuesday: 'Pull', wednesday: 'Legs',
        thursday: 'Istirahat', friday: 'Push', saturday: 'Pull', sunday: 'Legs',
    },
};

// ── Phase 10: Focus area → muscle groups (for AnatomyViewer preview) ───
const FOCUS_TO_MUSCLES: Record<FocusArea, MuscleGroup[]> = {
    'Dada & Lengan':   ['chest', 'shoulders', 'biceps', 'triceps', 'forearms'],
    'Kaki & Bokong':   ['quads', 'hamstrings', 'glutes', 'calves'],
    'Core':            ['abs', 'obliques', 'lower_back'],
    'Seluruh Tubuh':   ['chest', 'shoulders', 'biceps', 'triceps', 'forearms',
                        'lats', 'traps', 'lower_back', 'abs', 'obliques',
                        'quads', 'hamstrings', 'glutes', 'calves'],
};

interface OnboardingProps {
    onComplete: () => void;
}

const TOTAL_STEPS = 6;

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState<Partial<UserState>>({
        name: '',
        gender: 'Male',
        dateOfBirth: '',
        height: 170,
        weight: 60,
        fitnessGoal: 'Build Muscle',
        activityLevel: 'Moderate',
        experienceLevel: 'Pemula',
        idealDuration: '45 Menit',
        focusArea: 'Seluruh Tubuh',
        environment: 'Gym',
        userEquipment: ['Dumbbell', 'Bodyweight'],
    });
    const [schedule, setSchedule] = useState<GymSchedule>({
        monday: 'Push',
        tuesday: 'Pull',
        wednesday: 'Legs',
        thursday: 'Rest',
        friday: 'Upper',
        saturday: 'Lower',
        sunday: 'Rest'
    });

    const PRESETS = {
        'PPL': {
            monday: 'Push', tuesday: 'Pull', wednesday: 'Legs',
            thursday: 'Rest', friday: 'Push', saturday: 'Pull', sunday: 'Legs'
        },
        'Bro Split': {
            monday: 'Chest', tuesday: 'Back', wednesday: 'Legs',
            thursday: 'Shoulders', friday: 'Arms', saturday: 'Abs/Cardio', sunday: 'Rest'
        },
        'Upper/Lower': {
            monday: 'Upper', tuesday: 'Lower', wednesday: 'Rest',
            thursday: 'Upper', friday: 'Lower', saturday: 'Active Recovery', sunday: 'Rest'
        },
        'Full Body': {
            monday: 'Full Body', tuesday: 'Rest', wednesday: 'Full Body',
            thursday: 'Rest', friday: 'Full Body', saturday: 'Active Recovery', sunday: 'Rest'
        }
    };

    const DAY_LABELS: Record<string, string> = {
        monday: 'Senin', tuesday: 'Selasa', wednesday: 'Rabu', thursday: 'Kamis',
        friday: 'Jumat', saturday: 'Sabtu', sunday: 'Minggu',
    };

    const handleNext = () => {
        if (step < TOTAL_STEPS) {
            setStep(prev => prev + 1);
        } else {
            handleFinish();
        }
    };

    const handleFinish = async () => {
        const currentState = storageService.getUserState();
        const newState: UserState = {
            ...currentState,
            ...formData as UserState,
            isOnboarded: true
        };
        storageService.saveUserState(newState);
        storageService.saveGymSchedule(schedule);

        // Mirror equipment + environment into Firestore `users/{uid}.preferences`
        // so GymTracker (which reads from that collection) sees them immediately.
        const fbUser = auth.currentUser;
        if (fbUser && (newState.environment || newState.userEquipment)) {
            try {
                await setDoc(doc(db, 'users', fbUser.uid), {
                    preferences: {
                        environment: newState.environment || 'Gym',
                        equipment: newState.userEquipment || [],
                    },
                }, { merge: true });
            } catch (e) {
                console.warn('[Onboarding] Failed to mirror preferences to Firestore:', e);
            }
        }

        onComplete();
    };

    const toggleEquipment = (item: string) => {
        const current = formData.userEquipment || [];
        const next = current.includes(item)
            ? current.filter(e => e !== item)
            : [...current, item];
        updateField('userEquipment', next);
    };

    const updateField = (field: keyof UserState, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // ════════════ STEP 1 — Identitas ════════════
    const renderStep1 = () => (
        <div className="space-y-6 animate-slide-up">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-2">Selamat Datang di OurLife</h2>
                <p className="text-slate-400">Mari mulai dengan saling mengenal.</p>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Panggil kamu apa?</label>
                    <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => updateField('name', e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-cyan-500 transition-colors"
                            placeholder="Nama Kamu"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Jenis Kelamin</label>
                        <div className="grid grid-cols-2 gap-2">
                            {([['Male', 'Pria'], ['Female', 'Wanita']] as const).map(([val, label]) => (
                                <button
                                    key={val}
                                    onClick={() => updateField('gender', val)}
                                    className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${formData.gender === val
                                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750'
                                        }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <DateOfBirthPicker
                        value={formData.dateOfBirth || ''}
                        onChange={(date) => updateField('dateOfBirth', date)}
                        label="Tanggal Lahir"
                        required
                    />
                </div>
            </div>
        </div>
    );

    // ════════════ STEP 2 — Statistik Tubuh ════════════
    const renderStep2 = () => {
        const HEIGHT_MIN = 120, HEIGHT_MAX = 220;
        const WEIGHT_MIN = 30, WEIGHT_MAX = 180;
        const h = formData.height || 170;
        const w = formData.weight || 60;
        const bmi = calcBMI(h, w, formData.gender, formData.experienceLevel);

        return (
            <div className="space-y-6 animate-slide-up">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-white mb-2">Statistik Tubuh</h2>
                    <p className="text-slate-400 text-sm">Geser untuk atur tinggi & berat — kami kalibrasi rencanamu langsung.</p>
                </div>

                {/* Live BMI Display */}
                <div className={`rounded-2xl p-5 border ${bmi.borderClass} ${bmi.bgClass} transition-all duration-300`}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] uppercase tracking-widest font-mono text-slate-400">BMI Kamu</span>
                        <span className={`text-xs font-bold font-mono ${bmi.colorClass}`}>{bmi.category}</span>
                    </div>
                    <div className="flex items-baseline space-x-2">
                        <span className={`text-5xl font-bold font-mono ${bmi.colorClass} transition-colors`}>{bmi.value}</span>
                        <span className="text-slate-500 text-xs font-mono">kg/m²</span>
                    </div>
                    {/* BMI scale bar */}
                    <div className="mt-3 relative h-2 rounded-full overflow-hidden bg-slate-900/80 border border-slate-800">
                        <div className="absolute inset-y-0 left-0 w-[calc(18.5/40*100%)] bg-cyan-500/40" />
                        <div className="absolute inset-y-0 left-[calc(18.5/40*100%)] w-[calc(6.5/40*100%)] bg-emerald-500/50" />
                        <div className="absolute inset-y-0 left-[calc(25/40*100%)] w-[calc(5/40*100%)] bg-amber-500/50" />
                        <div className="absolute inset-y-0 left-[calc(30/40*100%)] right-0 bg-rose-500/50" />
                        <div
                            className="absolute top-[-4px] w-1 h-[calc(100%+8px)] bg-white rounded-full shadow-lg transition-all duration-200"
                            style={{ left: `calc(${Math.min(100, (bmi.value / 40) * 100)}% - 2px)` }}
                        />
                    </div>
                    <div className="flex justify-between text-[9px] font-mono text-slate-500 mt-1.5">
                        <span>18.5</span><span>25</span><span>30</span><span>40+</span>
                    </div>
                </div>

                {/* Height Slider */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="flex items-center text-sm font-medium text-slate-300">
                            <Ruler size={14} className="mr-2 text-cyan-400" /> Tinggi
                        </label>
                        <span className="text-lg font-bold font-mono text-white">{h}<span className="text-xs text-slate-500 ml-1">cm</span></span>
                    </div>
                    <input
                        type="range"
                        min={HEIGHT_MIN}
                        max={HEIGHT_MAX}
                        value={h}
                        onChange={(e) => updateField('height', parseInt(e.target.value))}
                        className="range-slider"
                        style={bmiSliderStyle(h, HEIGHT_MIN, HEIGHT_MAX)}
                    />
                    <div className="flex justify-between text-[10px] font-mono text-slate-600 mt-1">
                        <span>{HEIGHT_MIN}</span><span>{HEIGHT_MAX}</span>
                    </div>
                </div>

                {/* Weight Slider */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="flex items-center text-sm font-medium text-slate-300">
                            <Weight size={14} className="mr-2 text-cyan-400" /> Berat
                        </label>
                        <span className="text-lg font-bold font-mono text-white">{w}<span className="text-xs text-slate-500 ml-1">kg</span></span>
                    </div>
                    <input
                        type="range"
                        min={WEIGHT_MIN}
                        max={WEIGHT_MAX}
                        value={w}
                        onChange={(e) => updateField('weight', parseInt(e.target.value))}
                        className={`range-slider ${bmi.sliderVariant}`}
                        style={bmiSliderStyle(w, WEIGHT_MIN, WEIGHT_MAX)}
                    />
                    <div className="flex justify-between text-[10px] font-mono text-slate-600 mt-1">
                        <span>{WEIGHT_MIN}</span><span>{WEIGHT_MAX}</span>
                    </div>
                </div>

                {/* Tailored Recommendation (gender + experience aware) */}
                <div className={`rounded-2xl p-4 border ${bmi.borderClass} bg-slate-900/60 transition-all duration-300`}>
                    <div className="flex items-center space-x-2 mb-2">
                        <Sparkles size={14} className={bmi.colorClass} />
                        <span className={`text-[10px] uppercase tracking-widest font-mono font-bold ${bmi.colorClass}`}>Rutinitas Tersesuai</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{bmi.recommendation}</p>
                </div>
            </div>
        );
    };

    // ════════════ STEP 3 — Misi & Aktivitas ════════════
    const renderStep3 = () => {
        const GOAL_LABELS: Record<string, string> = {
            'Lose Weight': 'Turunkan Berat',
            'Build Muscle': 'Bangun Otot',
            'Keep Fit': 'Jaga Bugar',
        };
        const ACT_LABELS: Record<string, string> = {
            Sedentary: 'Sedenter',
            Light: 'Ringan',
            Moderate: 'Sedang',
            Active: 'Aktif',
        };

        return (
            <div className="space-y-6 animate-slide-up">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-white mb-2">Misimu</h2>
                    <p className="text-slate-400">Tentukan tujuan utamamu.</p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Target Kebugaran</label>
                        <div className="grid grid-cols-1 gap-2">
                            {(['Lose Weight', 'Build Muscle', 'Keep Fit'] as const).map((goal) => (
                                <button
                                    key={goal}
                                    onClick={() => updateField('fitnessGoal', goal)}
                                    className={`flex items-center p-3 rounded-xl border transition-all ${formData.fitnessGoal === goal
                                        ? 'bg-cyan-500/20 border-cyan-500 text-white'
                                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750'
                                        }`}
                                >
                                    <div className={`w-4 h-4 rounded-full border mr-3 flex items-center justify-center ${formData.fitnessGoal === goal ? 'border-cyan-500' : 'border-slate-500'
                                        }`}>
                                        {formData.fitnessGoal === goal && <div className="w-2 h-2 rounded-full bg-cyan-500" />}
                                    </div>
                                    {GOAL_LABELS[goal]}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Tingkat Aktivitas</label>
                        <div className="grid grid-cols-2 gap-2">
                            {(['Sedentary', 'Light', 'Moderate', 'Active'] as const).map((level) => (
                                <button
                                    key={level}
                                    onClick={() => {
                                        updateField('activityLevel', level);
                                        // Phase 10 — auto-populate schedule to match activity level.
                                        // User can still edit this in Step 5.
                                        setSchedule({ ...ACTIVITY_SCHEDULES[level] });
                                    }}
                                    className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all ${formData.activityLevel === level
                                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750'
                                        }`}
                                >
                                    {ACT_LABELS[level]}
                                </button>
                            ))}
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono mt-2">Jadwal akan otomatis disesuaikan — bisa diubah di langkah terakhir.</p>
                    </div>
                </div>
            </div>
        );
    };

    // ════════════ STEP 4 — Pengalaman, Durasi, Fokus ════════════
    const renderStep4 = () => {
        const EXPERIENCE: { value: ExperienceLevel; label: string; sub: string; Icon: React.ComponentType<{ size?: number; className?: string }>; tone: string }[] = [
            { value: 'Pemula',   label: 'Pemula',   sub: '< 6 bulan',   Icon: Sprout, tone: 'emerald' },
            { value: 'Menengah', label: 'Menengah', sub: '6 bln – 2 thn', Icon: Flame,    tone: 'amber'  },
            { value: 'Lanjut',   label: 'Lanjut',   sub: '> 2 tahun',   Icon: Crown,    tone: 'purple' },
        ];

        const DURATIONS: { value: IdealDuration; label: string; sub: string; Icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
            { value: '30 Menit', label: '30 Menit', sub: 'Cepat & padat',  Icon: Timer },
            { value: '45 Menit', label: '45 Menit', sub: 'Standar emas',   Icon: Hourglass },
            { value: '>1 Jam',   label: '>1 Jam',   sub: 'Sesi mendalam',  Icon: Clock },
        ];

        const FOCUS: { value: FocusArea; label: string; Icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
            { value: 'Dada & Lengan',   label: 'Dada & Lengan',   Icon: Dumbbell },
            { value: 'Kaki & Bokong',   label: 'Kaki & Bokong',   Icon: Footprints },
            { value: 'Core',            label: 'Core',            Icon: Activity },
            { value: 'Seluruh Tubuh',   label: 'Seluruh Tubuh',   Icon: Layers },
        ];

        const toneClasses = (tone: string, active: boolean) => {
            const map: Record<string, { active: string; idle: string; iconActive: string }> = {
                emerald: {
                    active: 'bg-emerald-500/15 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.25)]',
                    idle:   'bg-slate-800 border-slate-700 hover:bg-slate-750',
                    iconActive: 'text-emerald-400',
                },
                amber: {
                    active: 'bg-amber-500/15 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.25)]',
                    idle:   'bg-slate-800 border-slate-700 hover:bg-slate-750',
                    iconActive: 'text-amber-400',
                },
                purple: {
                    active: 'bg-purple-500/15 border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.25)]',
                    idle:   'bg-slate-800 border-slate-700 hover:bg-slate-750',
                    iconActive: 'text-purple-400',
                },
            };
            const t = map[tone];
            return { wrap: active ? t.active : t.idle, icon: active ? t.iconActive : 'text-slate-500' };
        };

        return (
            <div className="space-y-6 animate-slide-up">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-white mb-2">Gaya Latihanmu</h2>
                    <p className="text-slate-400 text-sm">Bantu kami menyesuaikan plan dengan ritmemu.</p>
                </div>

                {/* Pengalaman Latihan */}
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Pengalaman Latihan</label>
                    <div className="grid grid-cols-3 gap-2">
                        {EXPERIENCE.map(({ value, label, sub, Icon, tone }) => {
                            const active = formData.experienceLevel === value;
                            const tc = toneClasses(tone, active);
                            return (
                                <button
                                    key={value}
                                    onClick={() => updateField('experienceLevel', value)}
                                    className={`p-3 rounded-xl border transition-all flex flex-col items-center justify-center text-center ${tc.wrap}`}
                                >
                                    <Icon size={22} className={`${tc.icon} mb-1.5`} />
                                    <span className={`text-xs font-bold ${active ? 'text-white' : 'text-slate-300'}`}>{label}</span>
                                    <span className="text-[10px] text-slate-500 font-mono mt-0.5">{sub}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Durasi Ideal */}
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Durasi Ideal</label>
                    <div className="grid grid-cols-3 gap-2">
                        {DURATIONS.map(({ value, label, sub, Icon }) => {
                            const active = formData.idealDuration === value;
                            return (
                                <button
                                    key={value}
                                    onClick={() => updateField('idealDuration', value)}
                                    className={`p-3 rounded-xl border transition-all flex flex-col items-center justify-center text-center ${active
                                        ? 'bg-cyan-500/15 border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.25)]'
                                        : 'bg-slate-800 border-slate-700 hover:bg-slate-750'
                                        }`}
                                >
                                    <Icon size={22} className={`${active ? 'text-cyan-400' : 'text-slate-500'} mb-1.5`} />
                                    <span className={`text-xs font-bold ${active ? 'text-white' : 'text-slate-300'}`}>{label}</span>
                                    <span className="text-[10px] text-slate-500 font-mono mt-0.5">{sub}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Fokus Area Otot — with reactive AnatomyViewer preview */}
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Fokus Area Otot</label>

                    {/* Phase 10 — Interactive anatomy preview. Selected focus area
                        lights up the corresponding muscles in neon red in real time. */}
                    <div className="relative mx-auto mb-3 w-full max-w-[200px] h-[200px] sm:h-[240px] sm:max-w-[240px]">
                        <AnatomyViewer
                            trainedMuscles={getTrainedMuscleIds(
                                FOCUS_TO_MUSCLES[(formData.focusArea as FocusArea) || 'Seluruh Tubuh']
                            )}
                            defaultView="front"
                            showToggle={false}
                            minimal
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        {FOCUS.map(({ value, label, Icon }) => {
                            const active = formData.focusArea === value;
                            return (
                                <button
                                    key={value}
                                    onClick={() => updateField('focusArea', value)}
                                    className={`p-3 rounded-xl border transition-all flex items-center space-x-3 ${active
                                        ? 'bg-rose-500/15 border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.25)]'
                                        : 'bg-slate-800 border-slate-700 hover:bg-slate-750'
                                        }`}
                                >
                                    <Icon size={20} className={active ? 'text-rose-400' : 'text-slate-500'} />
                                    <span className={`text-xs font-bold text-left ${active ? 'text-white' : 'text-slate-300'}`}>{label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    // ════════════ STEP 5 — Lingkungan & Peralatan ════════════
    const renderStep5 = () => {
        const ENV_OPTIONS: { value: Environment; label: string; sub: string; Icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
            { value: 'Home', label: 'Rumah', sub: 'Latihan di rumah', Icon: Home },
            { value: 'Gym',  label: 'Gym',   sub: 'Akses gym lengkap', Icon: Building2 },
        ];

        const selectedEquipment = formData.userEquipment || [];

        return (
            <div className="space-y-6 animate-slide-up">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-white mb-2">Lingkungan & Peralatan</h2>
                    <p className="text-slate-400 text-sm">Pilih alat yang kamu punya — kami hanya menampilkan latihan yang bisa kamu lakukan.</p>
                </div>

                {/* Environment */}
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Lingkungan Latihan</label>
                    <div className="grid grid-cols-2 gap-2">
                        {ENV_OPTIONS.map(({ value, label, sub, Icon }) => {
                            const active = formData.environment === value;
                            return (
                                <button
                                    key={value}
                                    onClick={() => updateField('environment', value)}
                                    className={`p-4 rounded-xl border transition-all flex flex-col items-center justify-center text-center ${active
                                        ? 'bg-cyan-500/15 border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.25)]'
                                        : 'bg-slate-800 border-slate-700 hover:bg-slate-750'
                                        }`}
                                >
                                    <Icon size={24} className={`${active ? 'text-cyan-400' : 'text-slate-500'} mb-1.5`} />
                                    <span className={`text-sm font-bold ${active ? 'text-white' : 'text-slate-300'}`}>{label}</span>
                                    <span className="text-[10px] text-slate-500 font-mono mt-0.5">{sub}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Equipment Multi-select */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-slate-300">Peralatan Tersedia</label>
                        <span className="text-[10px] font-mono text-slate-500">
                            {selectedEquipment.length} dipilih
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {EQUIPMENT_OPTIONS.map(item => {
                            const active = selectedEquipment.includes(item);
                            return (
                                <button
                                    key={item}
                                    onClick={() => toggleEquipment(item)}
                                    className={`p-3 rounded-xl border transition-all flex items-center justify-between text-left ${active
                                        ? 'bg-cyan-500/15 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                                        : 'bg-slate-800 border-slate-700 hover:bg-slate-750'
                                        }`}
                                >
                                    <span className={`text-xs font-bold ${active ? 'text-white' : 'text-slate-300'}`}>{item}</span>
                                    {active && (
                                        <div className="w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center shrink-0">
                                            <Check size={12} strokeWidth={3} className="text-slate-900" />
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    {selectedEquipment.length === 0 && (
                        <p className="text-[10px] text-amber-400 font-mono mt-2">
                            ⚠ Pilih minimal satu — tanpa ini semua latihan akan disembunyikan.
                        </p>
                    )}
                </div>
            </div>
        );
    };

    // ════════════ STEP 6 — Jadwal Mingguan ════════════
    const renderStep6 = () => (
        <div className="space-y-6 animate-slide-up">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-2">Jadwal Mingguan</h2>
                <p className="text-slate-400">Rencanakan pertarunganmu. Bisa diubah kapan saja.</p>
            </div>

            <div className="space-y-4">
                <div className="flex space-x-2 overflow-x-auto pb-2 no-scrollbar">
                    {Object.keys(PRESETS).map((preset) => (
                        <button
                            key={preset}
                            onClick={() => setSchedule(PRESETS[preset as keyof typeof PRESETS])}
                            className="whitespace-nowrap px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-xs text-slate-400 hover:text-white hover:border-cyan-500 transition-colors"
                        >
                            {preset}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-1 gap-2">
                    {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
                        <div key={day} className="flex items-center space-x-3 bg-slate-800/50 p-2 rounded-xl border border-slate-800">
                            <span className="w-24 text-xs font-bold text-slate-500 uppercase tracking-wider">{DAY_LABELS[day]}</span>
                            <input
                                type="text"
                                value={schedule[day] || ''}
                                onChange={(e) => setSchedule({ ...schedule, [day]: e.target.value })}
                                className="flex-1 bg-transparent text-sm text-white focus:outline-none placeholder-slate-600"
                                placeholder="Istirahat"
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-slate-950 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
                {/* Progress Bar */}
                <div className="absolute top-0 left-0 w-full h-1 bg-slate-800">
                    <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500 ease-out"
                        style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
                    />
                </div>

                <div className="mb-8 flex justify-center">
                    <img src="/ourlife-logo.png" alt="OurLife" className="w-16 h-16 rounded-2xl shadow-lg shadow-cyan-500/20 object-cover" />
                </div>

                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
                {step === 3 && renderStep3()}
                {step === 4 && renderStep4()}
                {step === 5 && renderStep5()}
                {step === 6 && renderStep6()}

                <div className="mt-8 pt-6 border-t border-slate-800 flex justify-between items-center">
                    {step > 1 ? (
                        <button
                            onClick={() => setStep(prev => prev - 1)}
                            className="text-slate-400 hover:text-white text-sm font-medium px-4 py-2"
                        >
                            Kembali
                        </button>
                    ) : (
                        <div />
                    )}

                    {(() => {
                        const equipmentInvalid = step === 5 && (formData.userEquipment || []).length === 0;
                        const nameInvalid = !formData.name;
                        const disabled = nameInvalid || equipmentInvalid;
                        return (
                            <button
                                onClick={handleNext}
                                disabled={disabled}
                                className={`flex items-center space-x-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-6 py-2.5 rounded-xl font-bold transition-all hover:shadow-lg hover:shadow-cyan-500/20 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <span>{step === TOTAL_STEPS ? 'Mulai Sekarang' : 'Lanjut'}</span>
                                <ArrowRight size={18} />
                            </button>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
};
