# OurLife Project Guidelines

## Core Identity & Vibe
- **Project**: OurLife (Fitness & Habit Tracking App).
- **Theme**: Dark mode, modern, sleek. Inspired by industry standards like "Hevy" and "Strong".
- **Gamification**: Heavy "Solo Leveling" x "Duolingo" aesthetics. Uses Ranks, Lifetime XP, Monthly League XP, Streaks (🔥), and glowing rarity badges (Iron, Silver, Gold, Epic).
- **Colors**: Deep slates (`bg-slate-900`), neon reds (`text-red-500`, `shadow-red-500/20`), and cyan/blue accents for specific UI elements.

## Tech Stack
- **Frontend**: React (Vite), TypeScript, Tailwind CSS.
- **Backend/BaaS**: Firebase (Auth, Firestore, Realtime Database/RTDB).
- **Icons & Charts**: `lucide-react`, `recharts`.
- **Animations**: CSS transitions/keyframes, `anime.js` (if complex).

## Strict Coding Rules
1. **No SvelteKit Syntax**: Do NOT use `error(500, ...)` or SvelteKit-specific routing. This is a strict React/Vite project.
2. **Local Assets First**: Assume images and SVG assets are hosted locally in `/public/exercises/` or `/public/assets/`. Do not fetch from external APIs like `v2.exercisedb.io` unless explicitly asked.
3. **CSS 3D Constraints**: When using `transform-style: preserve-3d` (e.g., for flip cards), absolutely DO NOT use `filter` (like `drop-shadow`) or `mix-blend-mode` on the animated element or its parents, as it flattens the 3D context in CSS and breaks `backface-visibility: hidden`.
4. **State Management**: Rely on `services/storageService.ts` for global state and caching. Use `onSnapshot` for real-time Leaderboard syncing instead of one-off fetches.
5. **Clean Navigation**: Keep the main router and navigation bars minimal. Features like Profile, Tools, and Admin should be nested under `/settings`.

## Execution Workflow
- When given a large epic or refactor, break it down into sequential phases.
- **ALWAYS pause after completing one phase and ask for user confirmation before proceeding to the next.** Do not attempt to refactor the entire app in one massive generation.
- Keep terminal output concise. Do not explain standard React concepts unless asked.