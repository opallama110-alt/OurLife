import React, { useState } from 'react';
import { UserState, ExperienceLevel, IdealDuration, FocusArea, MuscleGroup, Environment } from '../types';
import { storageService } from '../services/storageService';
import { doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase-config';
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
        <div className="ob-step animate-slide-up">
            <div className="ob-step-head">
                <h2 className="ob-step-title">Selamat Datang di OurLife</h2>
                <p className="ob-step-sub">Mari mulai dengan saling mengenal.</p>
            </div>

            <div className="ob-group">
                <div className="ob-field">
                    <label className="ob-label">Panggil kamu apa?</label>
                    <label className="au-field">
                        <span className="au-field-ico"><User size={16} /></span>
                        <input
                            className="au-input"
                            type="text"
                            value={formData.name}
                            onChange={(e) => updateField('name', e.target.value)}
                            placeholder="Nama Kamu"
                        />
                    </label>
                </div>

                <div className="ob-grid-2">
                    <div className="ob-field">
                        <label className="ob-label">Jenis Kelamin</label>
                        <div className="ob-grid-2">
                            {([['Male', 'Pria'], ['Female', 'Wanita']] as const).map(([val, label]) => (
                                <button
                                    key={val}
                                    type="button"
                                    onClick={() => updateField('gender', val)}
                                    className={`ob-choice is-stacked ${formData.gender === val ? 'is-active' : ''}`}
                                >
                                    <span className="ob-choice-label">{label}</span>
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
            <div className="ob-step animate-slide-up">
                <div className="ob-step-head">
                    <h2 className="ob-step-title">Statistik Tubuh</h2>
                    <p className="ob-step-sub">Geser untuk atur tinggi &amp; berat — kami kalibrasi rencanamu langsung.</p>
                </div>

                {/* Live BMI Display — bmi.borderClass/bgClass/colorClass kept (dynamic) */}
                <div className={`rounded-2xl p-5 border ${bmi.borderClass} ${bmi.bgClass} transition-all duration-300`}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] uppercase tracking-widest font-mono ob-t-2">BMI Kamu</span>
                        <span className={`text-xs font-bold font-mono ${bmi.colorClass}`}>{bmi.category}</span>
                    </div>
                    <div className="flex items-baseline space-x-2">
                        <span className={`text-5xl font-bold font-mono ${bmi.colorClass} transition-colors`}>{bmi.value}</span>
                        <span className="ob-t-3 text-xs font-mono">kg/m²</span>
                    </div>
                    {/* BMI scale bar — colored zones kept (semantic) */}
                    <div className="ob-scale mt-3">
                        <div className="absolute inset-y-0 left-0 w-[calc(18.5/40*100%)] bg-cyan-500/40" />
                        <div className="absolute inset-y-0 left-[calc(18.5/40*100%)] w-[calc(6.5/40*100%)] bg-emerald-500/50" />
                        <div className="absolute inset-y-0 left-[calc(25/40*100%)] w-[calc(5/40*100%)] bg-amber-500/50" />
                        <div className="absolute inset-y-0 left-[calc(30/40*100%)] right-0 bg-rose-500/50" />
                        <div
                            className="absolute top-[-4px] w-1 h-[calc(100%+8px)] bg-white rounded-full shadow-lg transition-all duration-200"
                            style={{ left: `calc(${Math.min(100, (bmi.value / 40) * 100)}% - 2px)` }}
                        />
                    </div>
                    <div className="flex justify-between text-[9px] font-mono ob-t-3 mt-1.5">
                        <span>18.5</span><span>25</span><span>30</span><span>40+</span>
                    </div>
                </div>

                {/* Height Slider */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="flex items-center text-sm font-medium ob-t-2">
                            <Ruler size={14} className="mr-2 text-cyan-400" /> Tinggi
                        </label>
                        <span className="text-lg font-bold font-mono ob-t-hi">{h}<span className="text-xs ob-t-3 ml-1">cm</span></span>
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
                    <div className="flex justify-between text-[10px] font-mono ob-t-mute mt-1">
                        <span>{HEIGHT_MIN}</span><span>{HEIGHT_MAX}</span>
                    </div>
                </div>

                {/* Weight Slider */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="flex items-center text-sm font-medium ob-t-2">
                            <Weight size={14} className="mr-2 text-cyan-400" /> Berat
                        </label>
                        <span className="text-lg font-bold font-mono ob-t-hi">{w}<span className="text-xs ob-t-3 ml-1">kg</span></span>
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
                    <div className="flex justify-between text-[10px] font-mono ob-t-mute mt-1">
                        <span>{WEIGHT_MIN}</span><span>{WEIGHT_MAX}</span>
                    </div>
                </div>

                {/* Tailored Recommendation (gender + experience aware) — bmi.borderClass kept */}
                <div className={`rounded-2xl p-4 border ${bmi.borderClass} transition-all duration-300`} style={{ background: 'rgba(7, 12, 24, 0.6)' }}>
                    <div className="flex items-center space-x-2 mb-2">
                        <Sparkles size={14} className={bmi.colorClass} />
                        <span className={`text-[10px] uppercase tracking-widest font-mono font-bold ${bmi.colorClass}`}>Rutinitas Tersesuai</span>
                    </div>
                    <p className="text-xs ob-t-2 leading-relaxed">{bmi.recommendation}</p>
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
            <div className="ob-step animate-slide-up">
                <div className="ob-step-head">
                    <h2 className="ob-step-title">Misimu</h2>
                    <p className="ob-step-sub">Tentukan tujuan utamamu.</p>
                </div>

                <div className="ob-group">
                    <div className="ob-field">
                        <label className="ob-label">Target Kebugaran</label>
                        <div className="ob-col">
                            {(['Lose Weight', 'Build Muscle', 'Keep Fit'] as const).map((goal) => (
                                <button
                                    key={goal}
                                    type="button"
                                    onClick={() => updateField('fitnessGoal', goal)}
                                    className={`ob-choice ${formData.fitnessGoal === goal ? 'is-active' : ''}`}
                                >
                                    <span className="ob-choice-radio" />
                                    <span className="ob-choice-label">{GOAL_LABELS[goal]}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="ob-field">
                        <label className="ob-label">Tingkat Aktivitas</label>
                        <div className="ob-grid-2">
                            {(['Sedentary', 'Light', 'Moderate', 'Active'] as const).map((level) => (
                                <button
                                    key={level}
                                    type="button"
                                    onClick={() => {
                                        updateField('activityLevel', level);
                                        // Phase 10 — auto-populate schedule to match activity level.
                                        // User can still edit this in Step 5.
                                        setSchedule({ ...ACTIVITY_SCHEDULES[level] });
                                    }}
                                    className={`ob-choice is-stacked ${formData.activityLevel === level ? 'is-active' : ''}`}
                                >
                                    <span className="ob-choice-label">{ACT_LABELS[level]}</span>
                                </button>
                            ))}
                        </div>
                        <p className="ob-hint">Jadwal akan otomatis disesuaikan — bisa diubah di langkah terakhir.</p>
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

        return (
            <div className="ob-step animate-slide-up">
                <div className="ob-step-head">
                    <h2 className="ob-step-title">Gaya Latihanmu</h2>
                    <p className="ob-step-sub">Bantu kami menyesuaikan plan dengan ritmemu.</p>
                </div>

                {/* Pengalaman Latihan — semantic tone accents (emerald/amber/purple) kept */}
                <div className="ob-field">
                    <label className="ob-label">Pengalaman Latihan</label>
                    <div className="ob-grid-3">
                        {EXPERIENCE.map(({ value, label, sub, Icon, tone }) => {
                            const active = formData.experienceLevel === value;
                            return (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => updateField('experienceLevel', value)}
                                    className={`ob-choice is-stacked tone-${tone} ${active ? 'is-active' : ''}`}
                                >
                                    <Icon size={22} className="ob-choice-icon" />
                                    <span className="ob-choice-label">{label}</span>
                                    <span className="ob-choice-sub">{sub}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Durasi Ideal */}
                <div className="ob-field">
                    <label className="ob-label">Durasi Ideal</label>
                    <div className="ob-grid-3">
                        {DURATIONS.map(({ value, label, sub, Icon }) => {
                            const active = formData.idealDuration === value;
                            return (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => updateField('idealDuration', value)}
                                    className={`ob-choice is-stacked ${active ? 'is-active' : ''}`}
                                >
                                    <Icon size={22} className="ob-choice-icon" />
                                    <span className="ob-choice-label">{label}</span>
                                    <span className="ob-choice-sub">{sub}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Fokus Area Otot — reactive AnatomyViewer preview (untouched) */}
                <div className="ob-field">
                    <label className="ob-label">Fokus Area Otot</label>

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

                    <div className="ob-grid-2">
                        {FOCUS.map(({ value, label, Icon }) => {
                            const active = formData.focusArea === value;
                            return (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => updateField('focusArea', value)}
                                    className={`ob-choice tone-rose ${active ? 'is-active' : ''}`}
                                >
                                    <Icon size={20} className="ob-choice-icon" />
                                    <span className="ob-choice-label">{label}</span>
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
            <div className="ob-step animate-slide-up">
                <div className="ob-step-head">
                    <h2 className="ob-step-title">Lingkungan &amp; Peralatan</h2>
                    <p className="ob-step-sub">Pilih alat yang kamu punya — kami hanya menampilkan latihan yang bisa kamu lakukan.</p>
                </div>

                {/* Environment */}
                <div className="ob-field">
                    <label className="ob-label">Lingkungan Latihan</label>
                    <div className="ob-grid-2">
                        {ENV_OPTIONS.map(({ value, label, sub, Icon }) => {
                            const active = formData.environment === value;
                            return (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => updateField('environment', value)}
                                    className={`ob-choice is-stacked ${active ? 'is-active' : ''}`}
                                >
                                    <Icon size={24} className="ob-choice-icon" />
                                    <span className="ob-choice-label">{label}</span>
                                    <span className="ob-choice-sub">{sub}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Equipment Multi-select */}
                <div className="ob-field">
                    <div className="flex items-center justify-between">
                        <label className="ob-label">Peralatan Tersedia</label>
                        <span className="text-[10px] font-mono ob-t-3">
                            {selectedEquipment.length} dipilih
                        </span>
                    </div>
                    <div className="ob-grid-2">
                        {EQUIPMENT_OPTIONS.map(item => {
                            const active = selectedEquipment.includes(item);
                            return (
                                <button
                                    key={item}
                                    type="button"
                                    onClick={() => toggleEquipment(item)}
                                    className={`ob-choice is-between ${active ? 'is-active' : ''}`}
                                >
                                    <span className="ob-choice-label">{item}</span>
                                    {active && (
                                        <span className="ob-choice-check">
                                            <Check size={12} strokeWidth={3} />
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    {selectedEquipment.length === 0 && (
                        <p className="ob-warn">
                            ⚠ Pilih minimal satu — tanpa ini semua latihan akan disembunyikan.
                        </p>
                    )}
                </div>
            </div>
        );
    };

    // ════════════ STEP 6 — Jadwal Mingguan ════════════
    const renderStep6 = () => (
        <div className="ob-step animate-slide-up">
            <div className="ob-step-head">
                <h2 className="ob-step-title">Jadwal Mingguan</h2>
                <p className="ob-step-sub">Rencanakan pertarunganmu. Bisa diubah kapan saja.</p>
            </div>

            <div className="ob-group">
                <div className="ob-chips no-scrollbar">
                    {Object.keys(PRESETS).map((preset) => (
                        <button
                            key={preset}
                            type="button"
                            onClick={() => setSchedule(PRESETS[preset as keyof typeof PRESETS])}
                            className="ob-chip"
                        >
                            {preset}
                        </button>
                    ))}
                </div>

                <div className="ob-col">
                    {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
                        <div key={day} className="ob-day-row">
                            <span className="ob-day-label">{DAY_LABELS[day]}</span>
                            <input
                                type="text"
                                value={schedule[day] || ''}
                                onChange={(e) => setSchedule({ ...schedule, [day]: e.target.value })}
                                className="ob-day-input"
                                placeholder="Istirahat"
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    return (
        <div className="ob-screen">
            <div className="au-bg-grid" />
            <div className="au-bg-glow" />
            <div className="ob-card">
                {/* Progress Bar */}
                <div className="ob-progress">
                    <div className="ob-progress-fill" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
                </div>

                <div className="ob-logo">
                    <img src="/ourlife-logo.png" alt="OurLife" />
                </div>

                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
                {step === 3 && renderStep3()}
                {step === 4 && renderStep4()}
                {step === 5 && renderStep5()}
                {step === 6 && renderStep6()}

                <div className="ob-nav">
                    {step > 1 ? (
                        <button type="button" className="ob-back" onClick={() => setStep(prev => prev - 1)}>
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
                                type="button"
                                onClick={handleNext}
                                disabled={disabled}
                                className="au-cta"
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
