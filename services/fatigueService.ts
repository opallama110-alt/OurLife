import { WorkoutLog, MuscleGroup, getRecoveryHours, MUSCLE_RECOVERY_HOURS } from '../types';

/**
 * Project Chimera Phase 2 — Fatigue & Recovery scoring.
 *
 * Per-muscle fatigue is 100 right after a training stimulus and decays
 * linearly to 0 over the muscle's recovery window (gender-aware). The
 * overall fatigue score is the average of the all-muscle vector — this
 * matches the Daily Protocol intuition that one fully exhausted muscle
 * shouldn't dominate a 14-muscle body, but a body where everything is
 * recovering should read as moderately fatigued.
 */

export interface MuscleFatigue {
    muscle: MuscleGroup;
    fatigue: number;            // 0–100
    hoursSinceStimulus: number; // for tooltip / AI context
    recoveryHours: number;
}

export interface FatigueReport {
    score: number;              // 0–100 overall (avg of perMuscle.fatigue)
    label: 'Fresh' | 'Primed' | 'Warm' | 'Heavy' | 'Cooked';
    color: string;              // tailwind color class
    accent: string;             // hex for SVG gauges
    perMuscle: MuscleFatigue[];

    // ── Phase 6b: surface "how much body is offline" alongside score ──
    // Score answers "how cooked overall?", these answer "how much of the
    // body is recovering right now?" — both belong on the surface.
    // Threshold for "recovering" is fatigue > 5 (small dead zone — anything
    // below 5% reads as fresh enough to ignore for count purposes).
    recoveringCount: number;
    totalMuscles: number;
    recoveringPercent: number;  // 0–100, rounded
}

const ALL_MUSCLES = Object.keys(MUSCLE_RECOVERY_HOURS) as MuscleGroup[];

const labelFor = (score: number): { label: FatigueReport['label']; color: string; accent: string } => {
    if (score < 15) return { label: 'Fresh',  color: 'text-emerald-400', accent: '#10b981' };
    if (score < 35) return { label: 'Primed', color: 'text-cyan-400',    accent: '#06b6d4' };
    if (score < 60) return { label: 'Warm',   color: 'text-amber-400',   accent: '#f59e0b' };
    if (score < 85) return { label: 'Heavy',  color: 'text-orange-400',  accent: '#f97316' };
    return { label: 'Cooked', color: 'text-red-400', accent: '#ef4444' };
};

export const computeFatigue = (
    workouts: WorkoutLog[],
    nowMs: number = Date.now(),
    gender?: 'Male' | 'Female',
): FatigueReport => {
    // Most recent stimulus time per muscle within its own recovery window.
    const lastStimulus: Partial<Record<MuscleGroup, number>> = {};
    for (const w of workouts) {
        const ts = w.timestamp
            ? new Date(w.timestamp).getTime()
            : new Date(w.date + 'T12:00:00').getTime();
        if (isNaN(ts) || ts > nowMs) continue;
        for (const m of (w.muscleGroups || [])) {
            const prev = lastStimulus[m];
            if (prev === undefined || ts > prev) lastStimulus[m] = ts;
        }
    }

    const perMuscle: MuscleFatigue[] = ALL_MUSCLES.map(m => {
        const recoveryHours = getRecoveryHours(m, gender);
        const ts = lastStimulus[m];
        if (ts === undefined) {
            return { muscle: m, fatigue: 0, hoursSinceStimulus: Infinity, recoveryHours };
        }
        const hoursSince = Math.max(0, (nowMs - ts) / (1000 * 60 * 60));
        const fatigue = Math.max(0, Math.min(100, 100 * (1 - hoursSince / recoveryHours)));
        return { muscle: m, fatigue: Math.round(fatigue), hoursSinceStimulus: hoursSince, recoveryHours };
    });

    const score = Math.round(
        perMuscle.reduce((s, m) => s + m.fatigue, 0) / perMuscle.length,
    );
    const meta = labelFor(score);

    // Recovering = strictly above the 5% dead zone. A muscle at exactly 5%
    // does NOT count, by design.
    const recoveringCount = perMuscle.filter(m => m.fatigue > 5).length;
    const totalMuscles = ALL_MUSCLES.length;
    const recoveringPercent = Math.round((recoveringCount / totalMuscles) * 100);

    return {
        score,
        label: meta.label,
        color: meta.color,
        accent: meta.accent,
        perMuscle,
        recoveringCount,
        totalMuscles,
        recoveringPercent,
    };
};
