import React from 'react';
import { MuscleGroup } from '../types';

interface AnatomyMapProps {
    highlightedMuscles: MuscleGroup[];
    mode: 'recovery' | 'target'; // recovery=red for recovering, target=red for targeted
    size?: 'sm' | 'md' | 'lg';
}

export const AnatomyMap: React.FC<AnatomyMapProps> = ({ highlightedMuscles, mode, size = 'md' }) => {
    const highlighted = new Set(highlightedMuscles);

    const getFill = (muscle: MuscleGroup) => {
        if (!highlighted.has(muscle)) return '#374151'; // default gray
        return mode === 'recovery' ? '#ef4444' : '#ef4444'; // red for both
    };

    const getOpacity = (muscle: MuscleGroup) => {
        if (!highlighted.has(muscle)) return '0.5';
        return mode === 'recovery' ? '0.85' : '0.9';
    };

    const getStroke = (muscle: MuscleGroup) => {
        if (!highlighted.has(muscle)) return '#4b5563';
        return mode === 'recovery' ? '#f87171' : '#f87171';
    };

    const SW = '1.2';

    // Sizing
    const svgW = size === 'sm' ? 85 : size === 'md' ? 110 : 140;
    const svgH = size === 'sm' ? 200 : size === 'md' ? 260 : 330;

    return (
        <div className="flex justify-center items-end space-x-4">
            {/* FRONT VIEW */}
            <div className="text-center">
                <span className="text-[8px] text-slate-500 font-mono uppercase tracking-widest mb-1 block">Front</span>
                <svg width={svgW} height={svgH} viewBox="0 0 240 520" className="drop-shadow-xl">
                    {/* Head */}
                    <ellipse cx="120" cy="32" rx="22" ry="28" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
                    {/* Neck */}
                    <rect x="108" y="56" width="24" height="16" rx="4" fill="#1e293b" stroke="#475569" strokeWidth="1" />

                    {/* Traps front */}
                    <path d="M 108 68 L 82 76 L 74 86 L 88 86 L 108 74 Z" fill={getFill('traps')} opacity={getOpacity('traps')} stroke={getStroke('traps')} strokeWidth={SW} />
                    <path d="M 132 68 L 158 76 L 166 86 L 152 86 L 132 74 Z" fill={getFill('traps')} opacity={getOpacity('traps')} stroke={getStroke('traps')} strokeWidth={SW} />

                    {/* Deltoids */}
                    <path d="M 74 86 Q 52 88 46 108 Q 44 118 50 128 L 68 118 L 74 96 Z" fill={getFill('shoulders')} opacity={getOpacity('shoulders')} stroke={getStroke('shoulders')} strokeWidth={SW} />
                    <path d="M 166 86 Q 188 88 194 108 Q 196 118 190 128 L 172 118 L 166 96 Z" fill={getFill('shoulders')} opacity={getOpacity('shoulders')} stroke={getStroke('shoulders')} strokeWidth={SW} />

                    {/* Pectorals */}
                    <path d="M 88 86 L 88 108 Q 88 130 100 142 L 120 148 L 120 86 Z" fill={getFill('chest')} opacity={getOpacity('chest')} stroke={getStroke('chest')} strokeWidth={SW} />
                    <path d="M 152 86 L 152 108 Q 152 130 140 142 L 120 148 L 120 86 Z" fill={getFill('chest')} opacity={getOpacity('chest')} stroke={getStroke('chest')} strokeWidth={SW} />

                    {/* Biceps */}
                    <path d="M 50 128 L 42 168 L 48 192 L 62 192 L 68 168 L 68 118 Z" fill={getFill('biceps')} opacity={getOpacity('biceps')} stroke={getStroke('biceps')} strokeWidth={SW} />
                    <path d="M 190 128 L 198 168 L 192 192 L 178 192 L 172 168 L 172 118 Z" fill={getFill('biceps')} opacity={getOpacity('biceps')} stroke={getStroke('biceps')} strokeWidth={SW} />

                    {/* Forearms */}
                    <path d="M 42 196 L 34 248 L 30 268 L 44 268 L 54 248 L 62 196 Z" fill={getFill('forearms')} opacity={getOpacity('forearms')} stroke={getStroke('forearms')} strokeWidth={SW} />
                    <path d="M 198 196 L 206 248 L 210 268 L 196 268 L 186 248 L 178 196 Z" fill={getFill('forearms')} opacity={getOpacity('forearms')} stroke={getStroke('forearms')} strokeWidth={SW} />

                    {/* Abs */}
                    <path d="M 100 150 L 100 200 L 120 204 L 120 150 Z" fill={getFill('abs')} opacity={getOpacity('abs')} stroke={getStroke('abs')} strokeWidth={SW} />
                    <path d="M 140 150 L 140 200 L 120 204 L 120 150 Z" fill={getFill('abs')} opacity={getOpacity('abs')} stroke={getStroke('abs')} strokeWidth={SW} />
                    {/* Ab dividers */}
                    <line x1="100" y1="164" x2="140" y2="164" stroke="#0f172a" strokeWidth="0.8" opacity="0.6" />
                    <line x1="100" y1="178" x2="140" y2="178" stroke="#0f172a" strokeWidth="0.8" opacity="0.6" />
                    <line x1="100" y1="192" x2="140" y2="192" stroke="#0f172a" strokeWidth="0.8" opacity="0.6" />
                    <line x1="120" y1="150" x2="120" y2="204" stroke="#0f172a" strokeWidth="0.8" opacity="0.6" />

                    {/* Obliques */}
                    <path d="M 88 148 L 88 210 L 100 210 L 100 148 Z" fill={getFill('obliques')} opacity={getOpacity('obliques')} stroke={getStroke('obliques')} strokeWidth={SW} />
                    <path d="M 152 148 L 152 210 L 140 210 L 140 148 Z" fill={getFill('obliques')} opacity={getOpacity('obliques')} stroke={getStroke('obliques')} strokeWidth={SW} />

                    {/* Quads */}
                    <path d="M 88 218 Q 76 222 68 240 Q 58 270 56 300 Q 54 320 58 340 L 74 342 Q 78 322 82 302 L 90 260 Q 96 240 100 226 L 100 218 Z" fill={getFill('quads')} opacity={getOpacity('quads')} stroke={getStroke('quads')} strokeWidth={SW} />
                    <path d="M 100 218 Q 104 240 108 260 L 116 302 Q 118 322 120 342 L 120 218 Z" fill={getFill('quads')} opacity={getOpacity('quads')} stroke={getStroke('quads')} strokeWidth={SW} />
                    <path d="M 152 218 Q 164 222 172 240 Q 182 270 184 300 Q 186 320 182 340 L 166 342 Q 162 322 158 302 L 150 260 Q 144 240 140 226 L 140 218 Z" fill={getFill('quads')} opacity={getOpacity('quads')} stroke={getStroke('quads')} strokeWidth={SW} />
                    <path d="M 140 218 Q 136 240 132 260 L 124 302 Q 122 322 120 342 L 120 218 Z" fill={getFill('quads')} opacity={getOpacity('quads')} stroke={getStroke('quads')} strokeWidth={SW} />

                    {/* Knees */}
                    <ellipse cx="80" cy="348" rx="16" ry="8" fill="#1e293b" stroke="#475569" strokeWidth="1" />
                    <ellipse cx="160" cy="348" rx="16" ry="8" fill="#1e293b" stroke="#475569" strokeWidth="1" />

                    {/* Calves front */}
                    <path d="M 64 356 Q 60 384 62 410 Q 64 430 68 448 L 80 450 Q 82 432 84 410 Q 86 384 86 364 L 84 356 Z" fill={getFill('calves')} opacity={getOpacity('calves')} stroke={getStroke('calves')} strokeWidth={SW} />
                    <path d="M 176 356 Q 180 384 178 410 Q 176 430 172 448 L 160 450 Q 158 432 156 410 Q 154 384 154 364 L 156 356 Z" fill={getFill('calves')} opacity={getOpacity('calves')} stroke={getStroke('calves')} strokeWidth={SW} />

                    {/* Hands & Feet */}
                    <ellipse cx="37" cy="278" rx="8" ry="12" fill="#1e293b" stroke="#475569" strokeWidth="1" />
                    <ellipse cx="203" cy="278" rx="8" ry="12" fill="#1e293b" stroke="#475569" strokeWidth="1" />
                    <ellipse cx="75" cy="460" rx="12" ry="5" fill="#1e293b" stroke="#475569" strokeWidth="1" />
                    <ellipse cx="165" cy="460" rx="12" ry="5" fill="#1e293b" stroke="#475569" strokeWidth="1" />
                </svg>
            </div>

            {/* BACK VIEW */}
            <div className="text-center">
                <span className="text-[8px] text-slate-500 font-mono uppercase tracking-widest mb-1 block">Back</span>
                <svg width={svgW} height={svgH} viewBox="0 0 240 520" className="drop-shadow-xl">
                    {/* Head */}
                    <ellipse cx="120" cy="32" rx="22" ry="28" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
                    {/* Neck */}
                    <rect x="108" y="56" width="24" height="16" rx="4" fill="#1e293b" stroke="#475569" strokeWidth="1" />

                    {/* Traps (back - diamond) */}
                    <path d="M 108 60 Q 90 62 76 76 L 68 86 L 82 96 L 96 108 L 120 130 L 120 68 L 108 64 Z" fill={getFill('traps')} opacity={getOpacity('traps')} stroke={getStroke('traps')} strokeWidth={SW} />
                    <path d="M 132 60 Q 150 62 164 76 L 172 86 L 158 96 L 144 108 L 120 130 L 120 68 L 132 64 Z" fill={getFill('traps')} opacity={getOpacity('traps')} stroke={getStroke('traps')} strokeWidth={SW} />

                    {/* Rear Delts */}
                    <path d="M 68 86 Q 46 92 42 116 L 50 128 L 66 118 L 68 96 Z" fill={getFill('shoulders')} opacity={getOpacity('shoulders')} stroke={getStroke('shoulders')} strokeWidth={SW} />
                    <path d="M 172 86 Q 194 92 198 116 L 190 128 L 174 118 L 172 96 Z" fill={getFill('shoulders')} opacity={getOpacity('shoulders')} stroke={getStroke('shoulders')} strokeWidth={SW} />

                    {/* Lats */}
                    <path d="M 82 96 L 68 118 L 74 170 L 88 210 L 100 210 L 100 130 L 96 108 Z" fill={getFill('lats')} opacity={getOpacity('lats')} stroke={getStroke('lats')} strokeWidth={SW} />
                    <path d="M 158 96 L 172 118 L 166 170 L 152 210 L 140 210 L 140 130 L 144 108 Z" fill={getFill('lats')} opacity={getOpacity('lats')} stroke={getStroke('lats')} strokeWidth={SW} />

                    {/* Triceps */}
                    <path d="M 50 128 L 44 168 L 48 192 L 62 192 L 66 168 L 66 118 Z" fill={getFill('triceps')} opacity={getOpacity('triceps')} stroke={getStroke('triceps')} strokeWidth={SW} />
                    <path d="M 190 128 L 196 168 L 192 192 L 178 192 L 174 168 L 174 118 Z" fill={getFill('triceps')} opacity={getOpacity('triceps')} stroke={getStroke('triceps')} strokeWidth={SW} />

                    {/* Forearms back */}
                    <path d="M 44 196 L 36 248 L 32 268 L 46 268 L 56 248 L 62 196 Z" fill={getFill('forearms')} opacity={getOpacity('forearms')} stroke={getStroke('forearms')} strokeWidth={SW} />
                    <path d="M 196 196 L 204 248 L 208 268 L 194 268 L 184 248 L 178 196 Z" fill={getFill('forearms')} opacity={getOpacity('forearms')} stroke={getStroke('forearms')} strokeWidth={SW} />

                    {/* Lower Back / Erector Spinae */}
                    <path d="M 100 132 L 100 220 L 120 228 L 120 132 Z" fill={getFill('lower_back')} opacity={getOpacity('lower_back')} stroke={getStroke('lower_back')} strokeWidth={SW} />
                    <path d="M 140 132 L 140 220 L 120 228 L 120 132 Z" fill={getFill('lower_back')} opacity={getOpacity('lower_back')} stroke={getStroke('lower_back')} strokeWidth={SW} />

                    {/* Glutes */}
                    <path d="M 88 214 Q 68 220 64 248 Q 62 264 72 276 L 100 278 L 100 228 L 88 218 Z" fill={getFill('glutes')} opacity={getOpacity('glutes')} stroke={getStroke('glutes')} strokeWidth={SW} />
                    <path d="M 152 214 Q 172 220 176 248 Q 178 264 168 276 L 140 278 L 140 228 L 152 218 Z" fill={getFill('glutes')} opacity={getOpacity('glutes')} stroke={getStroke('glutes')} strokeWidth={SW} />

                    {/* Hamstrings */}
                    <path d="M 72 280 Q 64 310 62 340 L 78 344 L 86 310 Q 92 290 98 280 Z" fill={getFill('hamstrings')} opacity={getOpacity('hamstrings')} stroke={getStroke('hamstrings')} strokeWidth={SW} />
                    <path d="M 100 280 Q 106 310 112 340 L 120 344 L 120 280 Z" fill={getFill('hamstrings')} opacity={getOpacity('hamstrings')} stroke={getStroke('hamstrings')} strokeWidth={SW} />
                    <path d="M 168 280 Q 176 310 178 340 L 162 344 L 154 310 Q 148 290 142 280 Z" fill={getFill('hamstrings')} opacity={getOpacity('hamstrings')} stroke={getStroke('hamstrings')} strokeWidth={SW} />
                    <path d="M 140 280 Q 134 310 128 340 L 120 344 L 120 280 Z" fill={getFill('hamstrings')} opacity={getOpacity('hamstrings')} stroke={getStroke('hamstrings')} strokeWidth={SW} />

                    {/* Calves back */}
                    <path d="M 62 352 Q 58 380 60 410 Q 62 430 66 446 L 80 448 Q 82 426 84 406 Q 86 380 86 362 Z" fill={getFill('calves')} opacity={getOpacity('calves')} stroke={getStroke('calves')} strokeWidth={SW} />
                    <path d="M 178 352 Q 182 380 180 410 Q 178 430 174 446 L 160 448 Q 158 426 156 406 Q 154 380 154 362 Z" fill={getFill('calves')} opacity={getOpacity('calves')} stroke={getStroke('calves')} strokeWidth={SW} />

                    {/* Hands & Feet */}
                    <ellipse cx="39" cy="278" rx="8" ry="12" fill="#1e293b" stroke="#475569" strokeWidth="1" />
                    <ellipse cx="201" cy="278" rx="8" ry="12" fill="#1e293b" stroke="#475569" strokeWidth="1" />
                    <ellipse cx="75" cy="458" rx="12" ry="5" fill="#1e293b" stroke="#475569" strokeWidth="1" />
                    <ellipse cx="165" cy="458" rx="12" ry="5" fill="#1e293b" stroke="#475569" strokeWidth="1" />
                </svg>
            </div>
        </div>
    );
};

// Mini version for exercise cards - front only, very small
export const MiniAnatomyMap: React.FC<{ muscles: MuscleGroup[] }> = ({ muscles }) => {
    const highlighted = new Set(muscles);
    const f = (m: MuscleGroup) => highlighted.has(m) ? '#ef4444' : '#374151';
    const o = (m: MuscleGroup) => highlighted.has(m) ? '0.9' : '0.3';
    const s = (m: MuscleGroup) => highlighted.has(m) ? '#f87171' : '#4b5563';

    return (
        <div className="flex space-x-1">
            <svg width="28" height="65" viewBox="0 0 240 520">
                <ellipse cx="120" cy="32" rx="22" ry="28" fill="#1e293b" stroke="#475569" strokeWidth="2" />
                <rect x="108" y="56" width="24" height="16" rx="4" fill="#1e293b" />
                <path d="M 108 68 L 82 76 L 74 86 L 88 86 L 108 74 Z" fill={f('traps')} opacity={o('traps')} stroke={s('traps')} strokeWidth="2" />
                <path d="M 132 68 L 158 76 L 166 86 L 152 86 L 132 74 Z" fill={f('traps')} opacity={o('traps')} stroke={s('traps')} strokeWidth="2" />
                <path d="M 74 86 Q 52 88 46 108 Q 44 118 50 128 L 68 118 L 74 96 Z" fill={f('shoulders')} opacity={o('shoulders')} stroke={s('shoulders')} strokeWidth="2" />
                <path d="M 166 86 Q 188 88 194 108 Q 196 118 190 128 L 172 118 L 166 96 Z" fill={f('shoulders')} opacity={o('shoulders')} stroke={s('shoulders')} strokeWidth="2" />
                <path d="M 88 86 L 88 130 L 120 148 L 120 86 Z" fill={f('chest')} opacity={o('chest')} stroke={s('chest')} strokeWidth="2" />
                <path d="M 152 86 L 152 130 L 120 148 L 120 86 Z" fill={f('chest')} opacity={o('chest')} stroke={s('chest')} strokeWidth="2" />
                <path d="M 50 128 L 42 168 L 62 192 L 68 118 Z" fill={f('biceps')} opacity={o('biceps')} stroke={s('biceps')} strokeWidth="2" />
                <path d="M 190 128 L 198 168 L 178 192 L 172 118 Z" fill={f('biceps')} opacity={o('biceps')} stroke={s('biceps')} strokeWidth="2" />
                <path d="M 42 196 L 34 264 L 54 248 L 62 196 Z" fill={f('forearms')} opacity={o('forearms')} stroke={s('forearms')} strokeWidth="2" />
                <path d="M 198 196 L 206 264 L 186 248 L 178 196 Z" fill={f('forearms')} opacity={o('forearms')} stroke={s('forearms')} strokeWidth="2" />
                <path d="M 100 150 L 100 204 L 120 208 L 120 150 Z" fill={f('abs')} opacity={o('abs')} stroke={s('abs')} strokeWidth="2" />
                <path d="M 140 150 L 140 204 L 120 208 L 120 150 Z" fill={f('abs')} opacity={o('abs')} stroke={s('abs')} strokeWidth="2" />
                <path d="M 88 148 L 88 210 L 100 210 L 100 148 Z" fill={f('obliques')} opacity={o('obliques')} stroke={s('obliques')} strokeWidth="2" />
                <path d="M 152 148 L 152 210 L 140 210 L 140 148 Z" fill={f('obliques')} opacity={o('obliques')} stroke={s('obliques')} strokeWidth="2" />
                <path d="M 88 218 Q 60 260 58 340 L 120 342 L 100 218 Z" fill={f('quads')} opacity={o('quads')} stroke={s('quads')} strokeWidth="2" />
                <path d="M 152 218 Q 180 260 182 340 L 120 342 L 140 218 Z" fill={f('quads')} opacity={o('quads')} stroke={s('quads')} strokeWidth="2" />
                <path d="M 64 356 Q 60 410 68 448 L 84 356 Z" fill={f('calves')} opacity={o('calves')} stroke={s('calves')} strokeWidth="2" />
                <path d="M 176 356 Q 180 410 172 448 L 156 356 Z" fill={f('calves')} opacity={o('calves')} stroke={s('calves')} strokeWidth="2" />
            </svg>
            <svg width="28" height="65" viewBox="0 0 240 520">
                <ellipse cx="120" cy="32" rx="22" ry="28" fill="#1e293b" stroke="#475569" strokeWidth="2" />
                <rect x="108" y="56" width="24" height="16" rx="4" fill="#1e293b" />
                <path d="M 108 60 Q 76 76 68 86 L 120 130 L 120 68 Z" fill={f('traps')} opacity={o('traps')} stroke={s('traps')} strokeWidth="2" />
                <path d="M 132 60 Q 164 76 172 86 L 120 130 L 120 68 Z" fill={f('traps')} opacity={o('traps')} stroke={s('traps')} strokeWidth="2" />
                <path d="M 68 86 Q 46 92 42 116 L 66 118 L 68 96 Z" fill={f('shoulders')} opacity={o('shoulders')} stroke={s('shoulders')} strokeWidth="2" />
                <path d="M 172 86 Q 194 92 198 116 L 174 118 L 172 96 Z" fill={f('shoulders')} opacity={o('shoulders')} stroke={s('shoulders')} strokeWidth="2" />
                <path d="M 82 96 L 68 118 L 88 210 L 100 130 Z" fill={f('lats')} opacity={o('lats')} stroke={s('lats')} strokeWidth="2" />
                <path d="M 158 96 L 172 118 L 152 210 L 140 130 Z" fill={f('lats')} opacity={o('lats')} stroke={s('lats')} strokeWidth="2" />
                <path d="M 50 128 L 44 192 L 62 192 L 66 118 Z" fill={f('triceps')} opacity={o('triceps')} stroke={s('triceps')} strokeWidth="2" />
                <path d="M 190 128 L 196 192 L 178 192 L 174 118 Z" fill={f('triceps')} opacity={o('triceps')} stroke={s('triceps')} strokeWidth="2" />
                <path d="M 100 132 L 100 228 L 120 232 L 120 132 Z" fill={f('lower_back')} opacity={o('lower_back')} stroke={s('lower_back')} strokeWidth="2" />
                <path d="M 140 132 L 140 228 L 120 232 L 120 132 Z" fill={f('lower_back')} opacity={o('lower_back')} stroke={s('lower_back')} strokeWidth="2" />
                <path d="M 88 214 Q 62 248 72 276 L 100 278 L 100 228 Z" fill={f('glutes')} opacity={o('glutes')} stroke={s('glutes')} strokeWidth="2" />
                <path d="M 152 214 Q 178 248 168 276 L 140 278 L 140 228 Z" fill={f('glutes')} opacity={o('glutes')} stroke={s('glutes')} strokeWidth="2" />
                <path d="M 72 280 Q 64 340 78 344 L 120 344 L 120 280 Z" fill={f('hamstrings')} opacity={o('hamstrings')} stroke={s('hamstrings')} strokeWidth="2" />
                <path d="M 168 280 Q 176 340 162 344 L 120 344 L 120 280 Z" fill={f('hamstrings')} opacity={o('hamstrings')} stroke={s('hamstrings')} strokeWidth="2" />
                <path d="M 62 352 Q 58 410 66 446 L 86 362 Z" fill={f('calves')} opacity={o('calves')} stroke={s('calves')} strokeWidth="2" />
                <path d="M 178 352 Q 182 410 174 446 L 154 362 Z" fill={f('calves')} opacity={o('calves')} stroke={s('calves')} strokeWidth="2" />
            </svg>
        </div>
    );
};
