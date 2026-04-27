import React from 'react';
import { Activity } from 'lucide-react';
import { FatigueReport } from '../services/fatigueService';

interface FatigueGaugeProps {
    report: FatigueReport;
    compact?: boolean;
}

// Semi-circular gauge: -90° (left, fresh) → +90° (right, cooked).
// Uses two arcs: a faint slate track and a colored progress arc whose
// length = score%. The needle anchors at the bottom-center pivot.
export const FatigueGauge: React.FC<FatigueGaugeProps> = ({ report, compact = false }) => {
    const { score, label, color, accent } = report;
    const radius = 56;
    const stroke = 10;
    const cx = 70;
    const cy = 70;

    // Arc spans 180° (π radians). Compute path for fraction of arc.
    const polar = (angleDeg: number) => {
        const rad = (angleDeg - 180) * (Math.PI / 180); // 0..180 maps to left→right semicircle
        return [cx + radius * Math.cos(rad), cy + radius * Math.sin(rad)];
    };
    const [sx, sy] = polar(0);
    const [ex, ey] = polar(180);
    const trackPath = `M ${sx} ${sy} A ${radius} ${radius} 0 0 1 ${ex} ${ey}`;

    const fraction = Math.max(0, Math.min(1, score / 100));
    const [px, py] = polar(180 * fraction);
    const progressPath = `M ${sx} ${sy} A ${radius} ${radius} 0 ${fraction > 0.5 ? 1 : 0} 1 ${px} ${py}`;

    const needleAngle = -90 + 180 * fraction; // pointing up at 0%
    const needleRad = (needleAngle * Math.PI) / 180;
    const nx = cx + (radius - 6) * Math.sin(needleRad);
    const ny = cy - (radius - 6) * Math.cos(needleRad);

    return (
        <div className={`relative bg-slate-950/60 border border-slate-800 rounded-2xl ${compact ? 'p-3' : 'p-4'}`}>
            <div className="flex items-center space-x-2 mb-2">
                <Activity size={14} className={color} />
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">Fatigue</span>
            </div>
            <div className="flex items-center justify-center">
                <svg viewBox="0 0 140 90" className="w-full max-w-[180px] h-auto">
                    {/* Track */}
                    <path d={trackPath} fill="none" stroke="#1e293b" strokeWidth={stroke} strokeLinecap="round" />
                    {/* Progress */}
                    <path
                        d={progressPath}
                        fill="none"
                        stroke={accent}
                        strokeWidth={stroke}
                        strokeLinecap="round"
                        style={{ filter: `drop-shadow(0 0 4px ${accent}88)`, transition: 'all 0.6s ease' }}
                    />
                    {/* Tick marks */}
                    {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
                        const [tx1, ty1] = polar(180 * t);
                        const innerR = radius - stroke - 2;
                        const rad = (180 * t - 180) * (Math.PI / 180);
                        const tx2 = cx + innerR * Math.cos(rad);
                        const ty2 = cy + innerR * Math.sin(rad);
                        return (
                            <line
                                key={i}
                                x1={tx1} y1={ty1} x2={tx2} y2={ty2}
                                stroke="#475569"
                                strokeWidth="1"
                            />
                        );
                    })}
                    {/* Needle */}
                    <line
                        x1={cx} y1={cy} x2={nx} y2={ny}
                        stroke={accent}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        style={{ filter: `drop-shadow(0 0 3px ${accent})`, transition: 'all 0.6s ease' }}
                    />
                    <circle cx={cx} cy={cy} r="4" fill="#0f172a" stroke={accent} strokeWidth="1.5" />
                    {/* Score label */}
                    <text
                        x={cx} y={cy - 18}
                        textAnchor="middle"
                        className="font-mono font-bold"
                        style={{ fill: accent, fontSize: '18px' }}
                    >
                        {score}
                    </text>
                </svg>
            </div>
            <div className="text-center mt-1">
                <span className={`text-xs font-mono font-bold uppercase tracking-widest ${color}`}>{label}</span>
            </div>
            {!compact && (
                <p className="text-[10px] text-slate-500 font-mono text-center mt-1 leading-snug">
                    {score < 15 && 'Fully recovered — push hard today.'}
                    {score >= 15 && score < 35 && 'Light fatigue — quality session ahead.'}
                    {score >= 35 && score < 60 && 'Manageable load — pick complementary muscles.'}
                    {score >= 60 && score < 85 && 'Heavy systemic load — favor lighter volume.'}
                    {score >= 85 && 'Deeply fatigued — consider an active recovery day.'}
                </p>
            )}
        </div>
    );
};
