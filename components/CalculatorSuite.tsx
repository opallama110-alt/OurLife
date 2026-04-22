import React, { useState, useEffect } from 'react';
import { Calculator, Zap, Activity, Scale, Heart, Utensils, ChevronRight, Dumbbell, Timer } from 'lucide-react';

type ToolType = 'strength' | 'nutrition' | 'plates' | 'timer' | null;

export const CalculatorSuite: React.FC = () => {
    const [activeTool, setActiveTool] = useState<ToolType>(null);

    // --- STATE FOR CALCULATORS ---

    // 1RM
    const [weight, setWeight] = useState<number>(0);
    const [reps, setReps] = useState<number>(0);
    const oneRepMax = weight > 0 && reps > 0 ? Math.round(weight * (1 + reps / 30)) : 0;

    // TDEE & Macros
    const [age, setAge] = useState<number>(20);
    const [gender, setGender] = useState<'male' | 'female'>('male');
    const [height, setHeight] = useState<number>(170);
    const [bodyWeight, setBodyWeight] = useState<number>(65);
    const [activity, setActivity] = useState<number>(1.375);
    const [goal, setGoal] = useState<'cut' | 'maintain' | 'bulk'>('maintain');



    // --- CALCULATIONS ---

    // BMR (Mifflin-St Jeor)
    const bmr = Math.round((10 * bodyWeight) + (6.25 * height) - (5 * age) + (gender === 'male' ? 5 : -161));
    const tdee = Math.round(bmr * activity);

    // Macros
    const targetCalories = goal === 'cut' ? tdee - 500 : goal === 'bulk' ? tdee + 300 : tdee;
    const protein = Math.round(bodyWeight * 2); // 2g per kg
    const fats = Math.round(bodyWeight * 0.9); // 0.9g per kg
    const carbs = Math.round((targetCalories - (protein * 4) - (fats * 9)) / 4);


    // --- STATE FOR PLATES ---
    const [targetWeight, setTargetWeight] = useState<number>(60);
    const barWeight = 20;

    const calculatePlates = (weight: number) => {
        let remaining = (weight - barWeight) / 2;
        if (remaining <= 0) return [];
        
        const availablePlates = [25, 20, 15, 10, 5, 2.5, 1.25];
        const result: {weight: number, count: number, color: string}[] = [];
        const plateColors: Record<number, string> = {
            25: 'bg-red-500', 20: 'bg-blue-500', 15: 'bg-yellow-500 text-slate-900',
            10: 'bg-green-500', 5: 'bg-slate-200 text-slate-900',
            2.5: 'bg-slate-600', 1.25: 'bg-slate-700'
        };

        for (const p of availablePlates) {
            if (remaining >= p) {
                const count = Math.floor(remaining / p);
                result.push({ weight: p, count, color: plateColors[p] });
                remaining -= p * count;
            }
        }
        return result;
    };

    const platesNeeded = calculatePlates(targetWeight);

    // --- STATE FOR TIMER ---
    const [timeLeft, setTimeLeft] = useState(0);
    const [timerActive, setTimerActive] = useState(false);
    const [totalTime, setTotalTime] = useState(60);

    useEffect(() => {
        let interval: any = null;
        if (timerActive && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft(time => time - 1);
            }, 1000);
        } else if (timeLeft === 0 && timerActive) {
            setTimerActive(false);
        }
        return () => clearInterval(interval);
    }, [timerActive, timeLeft]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const startTimer = (seconds: number) => {
        setTotalTime(seconds);
        setTimeLeft(seconds);
        setTimerActive(true);
    };

    const reset = () => setActiveTool(null);

    const ToolCard: React.FC<{
        id: ToolType;
        title: string;
        desc: string;
        icon: React.ElementType;
        color: string;
    }> = ({ id, title, desc, icon: Icon, color }) => (
        <div
            onClick={() => setActiveTool(id)}
            className="bg-jarvis-card p-6 rounded-xl border border-slate-700 hover:border-jarvis-accent hover:shadow-lg hover:shadow-cyan-500/10 transition-all cursor-pointer group"
        >
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${color} bg-opacity-20`}>
                <Icon className={color.replace('bg-', 'text-')} size={24} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-jarvis-accent transition-colors">{title}</h3>
            <p className="text-sm text-slate-400">{desc}</p>
            <div className="mt-4 flex items-center text-xs font-mono text-slate-500 uppercase tracking-widest group-hover:text-white transition-colors">
                Access Tool <ChevronRight size={14} className="ml-1" />
            </div>
        </div>
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-end justify-between">
                <div>
                    <h2 className="text-3xl font-bold text-white mb-2">Operations Tools</h2>
                    <p className="text-slate-400">Biometric Analysis & Planning</p>
                </div>
                {activeTool && (
                    <button onClick={reset} className="text-sm text-slate-400 hover:text-white underline">
                        Back to Menu
                    </button>
                )}
            </div>

            {!activeTool && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <ToolCard
                        id="strength"
                        title="Strength Architect"
                        desc="1RM Estimator & Strength Standards for compound lifts."
                        icon={Zap}
                        color="bg-amber-500 text-amber-500"
                    />
                    <ToolCard
                        id="nutrition"
                        title="Nutrition Protocol"
                        desc="TDEE, BMR, and personalized Macro targets."
                        icon={Utensils}
                        color="bg-emerald-500 text-emerald-500"
                    />
                    <ToolCard
                        id="plates"
                        title="Barbell Plate Calculator"
                        desc="Quickly calculate plates for your barbell lifts."
                        icon={Dumbbell}
                        color="bg-blue-500 text-blue-500"
                    />
                    <ToolCard
                        id="timer"
                        title="Rest Timer"
                        desc="Customizable countdown for sets."
                        icon={Timer}
                        color="bg-violet-500 text-violet-500"
                    />
                </div>
            )}

            {/* --- STRENGTH VIEW --- */}
            {activeTool === 'strength' && (
                <div className="bg-jarvis-card p-6 rounded-xl border border-slate-700 max-w-2xl mx-auto">
                    <h3 className="text-xl font-bold text-white mb-6 flex items-center">
                        <Zap className="mr-3 text-amber-500" /> 1RM Estimator (Epley Formula)
                    </h3>

                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div>
                            <label className="block text-xs font-mono text-slate-400 mb-2">LIFTED WEIGHT (KG)</label>
                            <input
                                type="number"
                                value={weight || ''}
                                onChange={e => setWeight(parseFloat(e.target.value))}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-amber-500 outline-none appearance-none"
                                placeholder="e.g. 60"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-mono text-slate-400 mb-2">REPS PERFORMED</label>
                            <input
                                type="number"
                                value={reps || ''}
                                onChange={e => setReps(parseFloat(e.target.value))}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-amber-500 outline-none appearance-none"
                                placeholder="e.g. 8"
                            />
                        </div>
                    </div>

                    <div className="bg-slate-900/50 p-6 rounded-xl text-center border border-slate-800">
                        <p className="text-slate-500 text-sm font-mono mb-2">ESTIMATED 1 REP MAX</p>
                        <div className="text-5xl font-black text-white tracking-tighter">
                            {oneRepMax} <span className="text-2xl text-slate-500 font-normal">kg</span>
                        </div>
                    </div>

                    <div className="mt-8 grid grid-cols-4 gap-2 text-center text-xs">
                        <div className="p-2 bg-slate-800 rounded">
                            <div className="text-slate-400 mb-1">95% (2RM)</div>
                            <div className="font-bold text-white">{Math.round(oneRepMax * 0.95)} kg</div>
                        </div>
                        <div className="p-2 bg-slate-800 rounded">
                            <div className="text-slate-400 mb-1">90% (4RM)</div>
                            <div className="font-bold text-white">{Math.round(oneRepMax * 0.90)} kg</div>
                        </div>
                        <div className="p-2 bg-slate-800 rounded">
                            <div className="text-slate-400 mb-1">85% (6RM)</div>
                            <div className="font-bold text-white">{Math.round(oneRepMax * 0.85)} kg</div>
                        </div>
                        <div className="p-2 bg-slate-800 rounded">
                            <div className="text-slate-400 mb-1">75% (10RM)</div>
                            <div className="font-bold text-white">{Math.round(oneRepMax * 0.75)} kg</div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- NUTRITION VIEW --- */}
            {activeTool === 'nutrition' && (
                <div className="bg-jarvis-card p-6 rounded-xl border border-slate-700 max-w-4xl mx-auto">
                    <h3 className="text-xl font-bold text-white mb-6 flex items-center">
                        <Utensils className="mr-3 text-emerald-500" /> TDEE & Macro Architect
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-mono text-slate-400 mb-2">WEIGHT (KG)</label>
                                    <input type="number" value={bodyWeight} onChange={e => setBodyWeight(parseFloat(e.target.value))} className="input-std" />
                                </div>
                                <div>
                                    <label className="block text-xs font-mono text-slate-400 mb-2">HEIGHT (CM)</label>
                                    <input type="number" value={height} onChange={e => setHeight(parseFloat(e.target.value))} className="input-std" />
                                </div>
                                <div>
                                    <label className="block text-xs font-mono text-slate-400 mb-2">AGE</label>
                                    <input type="number" value={age} onChange={e => setAge(parseFloat(e.target.value))} className="input-std" />
                                </div>
                                <div>
                                    <label className="block text-xs font-mono text-slate-400 mb-2">GENDER</label>
                                    <select value={gender} onChange={e => setGender(e.target.value as any)} className="input-std">
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-mono text-slate-400 mb-2">ACTIVITY LEVEL</label>
                                <select value={activity} onChange={e => setActivity(parseFloat(e.target.value))} className="input-std">
                                    <option value={1.2}>Sedentary (Office job, little exercise)</option>
                                    <option value={1.375}>Light Active (1-3 days/week)</option>
                                    <option value={1.55}>Mod. Active (3-5 days/week)</option>
                                    <option value={1.725}>Very Active (6-7 days/week)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-mono text-slate-400 mb-2">GOAL</label>
                                <div className="flex bg-slate-900 rounded-lg p-1">
                                    {['cut', 'maintain', 'bulk'].map(g => (
                                        <button
                                            key={g}
                                            onClick={() => setGoal(g as any)}
                                            className={`flex-1 py-2 rounded text-xs font-bold uppercase transition-all ${goal === g ? 'bg-emerald-500 text-slate-900' : 'text-slate-500 hover:text-white'}`}
                                        >
                                            {g}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <p className="text-slate-400 text-xs font-mono">DAILY TARGET</p>
                                    <p className="text-3xl font-bold text-white">{targetCalories} <span className="text-sm text-emerald-500">kcal</span></p>
                                </div>
                                <div className="text-right">
                                    <p className="text-slate-400 text-xs font-mono">BMR</p>
                                    <p className="text-xl font-bold text-slate-300">{bmr}</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <MacroBar label="Protein" amount={protein} cal={protein * 4} color="bg-cyan-500" total={targetCalories} />
                                <MacroBar label="Fats" amount={fats} cal={fats * 9} color="bg-amber-500" total={targetCalories} />
                                <MacroBar label="Carbs" amount={carbs} cal={carbs * 4} color="bg-rose-500" total={targetCalories} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- PLATES VIEW --- */}
            {activeTool === 'plates' && (
                <div className="bg-jarvis-card p-6 rounded-xl border border-slate-700 max-w-2xl mx-auto">
                    <h3 className="text-xl font-bold text-white mb-6 flex items-center">
                        <Dumbbell className="mr-3 text-blue-500" /> Barbell Plate Calculator
                    </h3>
                    
                    <div className="mb-8">
                        <label className="block text-xs font-mono text-slate-400 mb-2">TARGET WEIGHT (KG) - Includes 20kg Bar</label>
                        <input
                            type="number"
                            value={targetWeight || ''}
                            onChange={e => setTargetWeight(parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-4 text-white text-2xl font-bold focus:border-blue-500 outline-none appearance-none"
                            placeholder="e.g. 100"
                        />
                    </div>
                    
                    <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
                        <p className="text-slate-500 text-xs font-mono mb-6 text-center">PLATES TO LOAD PER SIDE</p>
                        
                        {targetWeight <= 20 ? (
                            <div className="text-center py-4 text-slate-400">Empty Barbell (20kg)</div>
                        ) : (
                            <div className="space-y-4">
                                {platesNeeded.map(p => (
                                    <div key={p.weight} className="flex justify-between items-center bg-slate-800 p-3 rounded-lg border border-slate-700">
                                        <div className="flex items-center space-x-4">
                                            <div className={`w-12 h-16 rounded-md border-2 border-black/20 flex flex-col justify-center items-center shadow-lg font-bold ${p.color}`}>
                                                {p.weight}
                                            </div>
                                            <span className="text-slate-300 font-mono text-xs">{p.weight}kg Plate</span>
                                        </div>
                                        <div className="text-2xl font-bold text-white flex items-center">
                                            <span className="text-slate-500 text-sm mr-2">x</span>{p.count}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        <div className="mt-6 flex justify-center">
                           <div className="w-full h-4 bg-slate-400 rounded-sm relative flex items-center justify-center">
                              <div className="w-1/2 h-full bg-slate-400 border-x-4 border-slate-500"></div>
                              <div className="absolute left-1/2 -ml-2 w-4 h-6 bg-slate-300 rounded-sm"></div>
                           </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- TIMER VIEW --- */}
            {activeTool === 'timer' && (
                <div className="bg-jarvis-card p-6 rounded-xl border border-slate-700 max-w-sm mx-auto text-center">
                    <h3 className="text-xl font-bold text-white mb-6 flex justify-center items-center">
                        <Timer className="mr-3 text-violet-500" /> Rest Timer
                    </h3>
                    
                    <div className="relative w-48 h-48 mx-auto mb-8 flex justify-center items-center">
                        <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                            <circle cx="96" cy="96" r="88" className="stroke-slate-800" strokeWidth="8" fill="none" />
                            <circle 
                                cx="96" cy="96" r="88" 
                                className="stroke-violet-500 transition-all duration-1000 ease-linear" 
                                strokeWidth="8" fill="none" 
                                strokeDasharray={2 * Math.PI * 88}
                                strokeDashoffset={timerActive || timeLeft > 0 ? (2 * Math.PI * 88) * (1 - (timeLeft / totalTime)) : 0}
                            />
                        </svg>
                        <div className="relative z-10 flex flex-col items-center">
                            <span className="text-5xl font-black font-mono text-white tracking-tighter shadow-violet-500/50 drop-shadow-lg">
                                {formatTime(timeLeft)}
                            </span>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 mb-6">
                        <button onClick={() => startTimer(60)} className="py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 font-mono text-sm hover:border-violet-500 hover:text-white transition-all">60s</button>
                        <button onClick={() => startTimer(90)} className="py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 font-mono text-sm hover:border-violet-500 hover:text-white transition-all">90s</button>
                        <button onClick={() => startTimer(120)} className="py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 font-mono text-sm hover:border-violet-500 hover:text-white transition-all">120s</button>
                    </div>
                    
                    <div className="flex space-x-3">
                        {timerActive ? (
                            <button onClick={() => setTimerActive(false)} className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-colors">Pause</button>
                        ) : (
                            <button onClick={() => { if(timeLeft > 0) setTimerActive(true); else startTimer(60); }} className="flex-1 py-3 rounded-xl bg-violet-500 text-white font-bold hover:bg-violet-400 transition-colors shadow-lg shadow-violet-500/20">
                                {timeLeft > 0 ? "Resume" : "Start 60s"}
                            </button>
                        )}
                        <button onClick={() => { setTimerActive(false); setTimeLeft(0); }} className="px-5 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 hover:text-white transition-colors font-bold">
                            Reset
                        </button>
                    </div>
                </div>
            )}

            <style>{`
        .input-std {
            width: 100%;
            background-color: #0f172a;
            border: 1px solid #334155;
            border-radius: 0.5rem;
            padding: 0.75rem;
            color: white;
            outline: none;
            appearance: none;
            -webkit-appearance: none;
        }
        .input-std:focus {
            border-color: #06b6d4;
        }
      `}</style>
        </div>
    );
};

const MacroBar: React.FC<{ label: string, amount: number, cal: number, color: string, total: number }> = ({ label, amount, cal, color, total }) => {
    const percent = Math.min((cal / total) * 100, 100);
    return (
        <div>
            <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-300 font-bold">{label}</span>
                <span className="text-slate-400">{amount}g <span className="text-xs opacity-50">({Math.round(percent)}%)</span></span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }}></div>
            </div>
        </div>
    );
}

const ZoneRow: React.FC<{ zone: string, title: string, range: string, bpm: string, color: string }> = ({ zone, title, range, bpm, color }) => (
    <div className="flex items-center p-3 rounded-lg bg-slate-900 border border-slate-800">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-slate-900 mr-4 ${color}`}>
            {zone}
        </div>
        <div className="flex-1">
            <p className="font-bold text-white">{title}</p>
            <p className="text-xs text-slate-500">{range}</p>
        </div>
        <div className="text-right font-mono font-bold text-slate-300">
            {bpm}
        </div>
    </div>
);