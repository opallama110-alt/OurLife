<div align="center">

# OurLife

**Gamified fitness & habit tracker. Solo Leveling × Duolingo.**

*Setiap workout dan habit yang lo kerjain = XP. Naik level. Naik rank. Develop character stats. Build streak. The System watches.*

![Status](https://img.shields.io/badge/status-private%20beta-orange)
![Stack](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![Stack](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)
![Stack](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Stack](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white)
![Stack](https://img.shields.io/badge/Firebase-orange?logo=firebase&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-ready-5A0FC8?logo=pwa&logoColor=white)

</div>

---

## Apa Itu OurLife?

Web app (PWA) untuk fitness tracking + habit building yang ter-gamifikasi. Konsep: gabungan **Hevy/Strong** (gym log) dengan **Duolingo** (habit streak + reward loop) dan **Solo Leveling** (rank progression + character stat aesthetic).

### Fitur Inti

**Gamification engine.** Setiap workout dan habit completion = XP. Level naik berdasarkan total XP. Rank tier: E-Rank → D → C → B → A → S → National Level Hunter. Character stats: STR, VIT, AGI, PER, INT — derived dari workout history, habits, body data.

**Workout tracking.** Per-muscle anatomy viewer dengan recovery status real-time. Muscle picker dengan fatigue-aware suggestions. Exercise library dengan filter berdasarkan equipment yang lo punya. Workout history yang feed back ke attribute system.

**Habit building.** Daily Protocol cards. Streak counter dengan auto-protect via Freeze Token economy (earn token dengan complete semua daily habits, auto-use kalau missed day mau break streak — max 3 token).

**Achievement system.** 21 achievements dengan 7 rarity tiers (iron → mythic). Progress tracking, XP + token rewards, unlock notifications. Trigger after workout / habit toggle / app boot retroactive sweep.

**The System (AI Coach).** Groq Llama 3.3 70B powered. Function calling untuk execute_penalty + mark_quest_complete. Round blob pet avatar dengan 8 emotion states yang reactive ke user state (missed habits → angry, streak broken → sad, late & incomplete → tired, all done → happy, dll). Notched FAB integration di bottom nav.

**Status Window.** Collapsible card showing Level, Rank, Job Class (mis. "Recruit Strategist", "Shadow Berserker"), Top 3 attributes, Fatigue %. Expand untuk Power Signature radar, full attribute grid, Combat Stats, Rank Progress bar.

**Leaderboard.** Global ranking via Firebase Firestore + RTDB real-time sync.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite + TypeScript (strict) + Tailwind CSS |
| State | Custom `services/storageService.ts` pattern + Firebase RTDB |
| Backend-as-a-Service | Firebase (Auth + Firestore + Realtime Database + Storage) |
| AI | Groq SDK + Llama 3.3 70B Versatile (function calling) |
| Charts | Recharts (Power Signature radar) |
| Icons | lucide-react |
| PWA | vite-plugin-pwa (Workbox) |
| Routing | react-router-dom |
| Lang | Bahasa Indonesia (UI) / English (code) |

---

## Run Locally

**Prerequisites:** Node.js 18+ (recommend 20+).

```bash
# 1. Clone
git clone https://github.com/opallama110-alt/OurLife.git
cd OurLife

# 2. Install
npm install

# 3. Setup secrets — bikin .env.local
# Isi minimal:
#   VITE_FIREBASE_API_KEY=...
#   VITE_FIREBASE_AUTH_DOMAIN=...
#   VITE_FIREBASE_PROJECT_ID=...
#   VITE_FIREBASE_STORAGE_BUCKET=...
#   VITE_FIREBASE_MESSAGING_SENDER_ID=...
#   VITE_FIREBASE_APP_ID=...
#   VITE_FIREBASE_DATABASE_URL=...
#   VITE_GROQ_API_KEY=...

# 4. Run dev
npm run dev

# 5. Production build
npm run build
```

`.env.local` is gitignored — never commit secrets.

---

## Status

**Currently in private beta.** Foundation features shipped:

- [x] DOB system + auto-age calculation
- [x] Settings 3-tab redesign (My Profile / Goals & Tracking / App Settings)
- [x] Inline StatusCard with collapsible expand
- [x] Streak Protection (Freeze Token economy)
- [x] 21 Achievements with rarity tiers + unlock notifications
- [x] Power Signature attributes (STR/VIT/AGI/PER/INT) — data-driven
- [x] Fatigue display with recovering count + percent
- [x] System Pet (8 emotion states, habit-aware avatar)
- [x] Real notched bottom nav (CSS mask cutout)

**On the roadmap** (lihat `PROMPT_CLAUDE_CODE.md` Section 8 untuk detail penuh):

- [ ] Tier 0: Security blockers (~~Groq API → Firebase Function~~ deferred per user decision; role-based admin, Firestore rules, cascade-delete account)
- [ ] Tier 2: FCM notifications, 2FA, change email/password, export data
- [ ] Tier 3: Per-set workout logging, PR tracking, body measurements, goals
- [ ] Tier 5: Seasonal rank system, friend system, exercise library upgrade
- [ ] Tier 6: i18n full coverage, test infra, Sentry, wearable integrations

---

## Project Structure

```
OurLife/
├── components/          ← reusable UI (StatusCard, SystemPet, AnatomyViewer, ...)
├── pages/               ← navigation-level (Dashboard, Profile, Gym, Habits, ...)
├── context/             ← AuthContext, AchievementContext
├── services/            ← business logic (storageService, gamification, attribute, ...)
├── utils/               ← dateUtils
├── config/              ← constants, muscleMapping
├── public/              ← static assets (exercise images, logos)
├── types.ts             ← TypeScript interfaces
├── App.tsx              ← router + providers
├── index.css            ← global CSS + keyframes
├── PROMPT_CLAUDE_CODE.md← project bible (architecture, roadmap, conventions)
└── CLAUDE.md            ← Claude Code auto-load pointer
```

---

## Contributing

This is a private project saat ini. Issues & PRs dari collaborators welcome — koordinasi via [@opallama110-alt](https://github.com/opallama110-alt).

For Claude Code sessions: paste `PROMPT_CLAUDE_CODE.md` sebagai pesan pertama. Itu master prompt yang berisi seluruh project context, roadmap, conventions, dan pola kerja.

---

## License

Private / proprietary. All rights reserved © 2026 Naufal Azmi Alghifari.

---

<div align="center">

*"Awaken your potential. The System levels you up."*

</div>
