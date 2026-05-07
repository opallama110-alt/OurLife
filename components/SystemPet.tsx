import React from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// SYSTEM PET — emotion-aware round blob avatar for the System chat surface.
// Pure presentational: no state, no side effects. Drive everything through
// props. Float animation is the same across emotions; emotion swaps the
// face character + gradient color, not the motion.
// ═══════════════════════════════════════════════════════════════════════════

export type PetEmotion =
  | 'idle'
  | 'thinking'
  | 'happy'
  | 'excited'
  | 'tired'
  | 'sad'
  | 'shocked';

interface SystemPetProps {
  emotion: PetEmotion;
  /** sm = 40px (chat header), lg = 64px (empty state). */
  size?: 'sm' | 'lg';
  className?: string;
}

const FACES: Record<PetEmotion, string> = {
  idle:     'o_o',
  thinking: '...',
  happy:    '^_^',
  excited:  '★_★',
  tired:    '-_-',
  sad:      ';_;',
  shocked:  'O_O',
};

// Tailwind gradient pairs per emotion. Surrounding shadow stays red-tinted
// to preserve the chat brand glow regardless of mood.
const GRADIENTS: Record<PetEmotion, string> = {
  idle:     'from-red-500 to-amber-500',
  thinking: 'from-purple-500 to-blue-500',
  happy:    'from-emerald-400 to-cyan-500',
  excited:  'from-amber-400 to-yellow-500',
  tired:    'from-slate-500 to-slate-700',
  sad:      'from-blue-500 to-indigo-700',
  shocked:  'from-red-600 to-orange-600',
};

export const SystemPet: React.FC<SystemPetProps> = ({
  emotion,
  size = 'sm',
  className = '',
}) => {
  const sizeClass = size === 'sm' ? 'w-10 h-10 text-xs' : 'w-16 h-16 text-base';

  return (
    <div
      className={`
        ${sizeClass}
        rounded-full bg-gradient-to-br ${GRADIENTS[emotion]}
        flex items-center justify-center
        shadow-lg shadow-red-500/40
        animate-pet-float
        font-mono font-bold text-white select-none
        transition-all duration-500
        ${className}
      `}
      role="img"
      aria-label={`System pet: ${emotion}`}
    >
      {FACES[emotion]}
    </div>
  );
};
