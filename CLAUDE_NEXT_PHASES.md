# OurLife — Master Execution Prompt: Phase B through E

> **Purpose:** Hand this document to Claude Code (Opus 4.7, max effort) in VS Code. It contains everything needed to continue the project from where Phase A left off without re-auditing the conversation history. Each section is self-paste-able — load Section 0 first, then the section for the phase you want to execute.

---

## 0. PRE-FLIGHT — load this context BEFORE doing anything

### 0.1 Project identity (the vibe)
- **App:** OurLife — gamified fitness & habit tracker.
- **Aesthetic:** Solo Leveling × Duolingo. Dark UI, neon red + cyan accents, ranked hunter system, attribute stats (STR/VIT/AGI/PER/INT), streaks with fire emoji, glowing rarity badges (iron → mythic), Daily Protocol framing for habits.
- **User base:** Indonesian, but UI is mixed (Bahasa Indonesia for user-facing copy, English for code/system terms).
- **Tone:** "The System" speaks like a calm but firm AI overseer. Penalties are XP deductions, rewards are XP grants. Quests are habit-derived, not generated from nothing.

### 0.2 Tech stack (verified against package.json)
- React 18 + Vite + TypeScript (strict mode).
- Tailwind CSS — **no `tailwind.config.js` extends used**, animations live in `index.css`.
- Firebase: Auth (email/password + Google), Firestore (denormalized profile data + leaderboard queries), Realtime Database (live state via `onSnapshot`).
- AI: `groq-sdk` ^0.7.0, Llama 3.3 70B Versatile, function calling (`execute_penalty`, `mark_quest_complete`).
- Charts: `recharts` ^3.7.0.
- Icons: `lucide-react`.
- PWA: `vite-plugin-pwa` (workbox, service worker auto-generated).

### 0.3 Branch state (as of this prompt)
- Active branch: `feature/dob-system`
- Commits ahead of `main`: 15
- Build: green (~1,711 KB JS, +CSS ~10 KB).
- Bundle is over Vite's 500 KB warning threshold — Phase C addresses this.

### 0.4 Phase A — what's already shipped (do NOT redo)
Mega-prompt features:
1. **DOB system** — `dateOfBirth` ISO string replaces static `age`. Auto-calculation utility in `utils/dateUtils.ts`. Mobile date picker in `components/DateOfBirthPicker.tsx`. Migration in `services/migrationService.ts`.
2. **Settings 3-tab redesign** — `My Profile` / `Goals & Tracking` / `App Settings`. Account section embeds avatar upload + display name. Several "Coming Soon" badges on toggles (Notifications FCM, Theme, Language, Font Size, Export Data, Clear Cache) — these are stubs, not implemented.
3. **Status Window** — was a modal in Phase 3B (with attributes/Power Signature radar/combat stats/rank progress); converted to inline `StatusCard.tsx` in UI Step 1, then placed in 3-col Dashboard grid alongside Last Session + Daily Protocol in UI Step 5a.
4. **Streak Protection** — `streakFreezeTokens` (max 3) earned by completing all daily habits, auto-applied when missed-day would break streak. `services/streakProtectionService.ts`, `components/TokenDisplay.tsx`, `components/TokenUsedModal.tsx`.
5. **Achievement system** — 21 achievements with rarity tiers (iron → mythic), progress tracking, XP/token rewards, unlock notifications. Triggered after workout save / habit toggle / app boot retroactive sweep. `services/achievementService.ts`, `context/AchievementContext.tsx`.

UI/UX overhaul (Phase A Steps 1–5):
- **Step 1** — `StatusWindowModal.tsx` deleted, `StatusCard.tsx` created (collapsed identity + expanded radar/stats).
- **Step 2** — Recovery list emerald glow de-escalated (`Dashboard.tsx:647/653/661` lost their box-shadow / drop-shadow / gradient on the `nearlyDone` branch). Status chips (✓ Ready / ⏳ Recovering) added below the anatomy viewer.
- **Step 3** — Anatomy SVG drop-shadow filters stripped (`AnatomyViewer.tsx:317-339`). EXHAUSTED state now uses translucent red fill `rgba(239, 68, 68, 0.45)` instead of outline-only with glow. Massive perf win on muscle picker search.
- **Step 4** — `components/SystemPet.tsx` created (round blob, 7 emotions, 2 sizes, single petFloat keyframe). Replaces static Sparkles avatar in SystemChat header + empty state. Emotion driven by profile/loading/AI-response keywords.
- **Step 5a** — StatusCard moved into the Stats Grid (3-col on desktop). Greeting now lands first.
- **Step 5b** — `Settings.tsx:122` reads `displayName` from `storageService.getUserState().name` first (UserState canonical), falls back to Firebase Auth.

### 0.5 Architectural rules (from `D:\OurLife\CLAUDE.md` — these OVERRIDE any default behavior)
1. **No SvelteKit syntax.** This is React/Vite. No `error(500, ...)`, no SvelteKit routing.
2. **Local assets first.** Images and SVG live in `/public/exercises/` or `/public/assets/`. Don't fetch from external APIs unless explicitly asked.
3. **CSS 3D constraints.** When using `transform-style: preserve-3d` (e.g., flip cards), absolutely DO NOT use `filter` (drop-shadow) or `mix-blend-mode` on the animated element or its parents. Anatomy drop-shadows already removed in Step 3, but the rule applies broadly.
4. **State management.** Use `services/storageService.ts` for global state and caching. Use `onSnapshot` for real-time syncing (e.g., Leaderboard).
5. **Clean navigation.** Main router stays minimal. Profile, Tools, Admin nested under `/settings`.

### 0.6 Service layer (where logic lives)
- `services/storageService.ts` — single source of truth. Subscribe pattern (line 38-style) for reactive components.
- `services/gamificationService.ts` — XP, levels, ranks (`RANK_TIERS`), titles, streak calculation, achievement evaluation.
- `services/attributeService.ts` — `calculateAttributes`, `getJobClass`, `getRankProgress`. Phase B Step 6a extends this.
- `services/fatigueService.ts` — `computeFatigue` (per-muscle decay, returns `FatigueReport`).
- `services/streakProtectionService.ts` — token-based streak preservation.
- `services/achievementService.ts` — `checkAndGrant` (the trigger function), `evaluateAchievements`.
- `services/migrationService.ts` — schema migrations on app boot.
- `services/aiService.ts` — Groq client + tool bridge. **Security TODO: API key currently exposed via `dangerouslyAllowBrowser: true`. Move to Firebase Function eventually.**

### 0.7 Animation + style conventions
- Animations: `index.css`, **camelCase** keyframe + **kebab-case** utility class. Existing examples: `fadeIn`/`animate-fade-in`, `slideUp`/`animate-slide-up`, `petFloat`/`animate-pet-float`, `pulseGlow`/`animate-pulse-glow`, `breathe`/`animate-breathe`.
- Cards: use `jarvis-card` class for consistency. Variants: `jarvis-card-glow`, `gradient-border`.
- Stagger pattern: `delay-100`, `delay-200`, `delay-300`, `delay-400` (Tailwind animation-delay utilities — verify they're defined or use inline style).
- Dark theme tokens: `bg-slate-950` page, `bg-slate-900` cards, `border-slate-800` borders, `text-slate-400` body, `text-cyan-400` accent, `text-red-400` urgency.
- Glow rule: glow only where it communicates state. Never decorative. Step 2 + Step 3 both stripped decorative glows.

### 0.8 Execution discipline (non-negotiable)
- **One step = one commit.** Atomic commits with descriptive multi-paragraph messages.
- **Pause after every step.** Report what landed, then wait for user confirmation before next step.
- **Audit before edit.** Read the affected file/section before making changes. Don't trust line numbers from this document blindly — they're current as of this prompt's writing but the file evolves.
- **Build verify before commit.** Run `npm run build`, confirm green, then commit. Bundle delta must be reported.
- **Don't batch.** If a step has sub-parts (e.g. Step 5a + Step 5b), pause between sub-parts and report.
- **Push back if a request reverts prior work.** Phase A took deliberate decisions; if a new ask would undo one, surface the conflict before executing.
- **Don't touch files outside the step's scope.** Even tempting fixes belong in their own step.

---

## 1. PHASE B — Data-driven Power Signature + Fatigue display polish

**Estimated time:** 2–3 hours total. Two atomic steps with a pause between them.

### 1.1 Why this matters
Current state of `calculateAttributes` (verified in `services/attributeService.ts`): pure workout-history derivation. Stats grow only from gym sessions — height, weight, gender, and habit data are ignored. User feedback: stats should "match the user" (suka lari → AGI, suka angkat beban → STR, weight/height influence baseline).

Current state of `FatigueReport` (verified in `services/fatigueService.ts`): score is the average of per-muscle fatigue (each decays linearly from 100 to 0 over its recovery window). Mathematically correct, but reads as a single number with no transparency about which muscles are pulling the average. User feedback: want explicit "X muscles recovering, Y% of body".

### 1.2 Step 6a — Power Signature derivation extension

**Scope:** `services/attributeService.ts` only. New helper utilities allowed if needed; no caller changes (StatusCard / Profile already consume `calculateAttributes`).

**Approach:** add additional signal terms to existing formulas. Don't replace — augment. Cap remains 100. Existing keyword bags + workout-count base stay as the floor; new signals push values higher.

**Required signal additions per stat:**

- **STR** — already keyword + set volume. Add:
  - **Bodyweight-relative load proxy.** If workout logs include weight per set (verify the `WorkoutLog`/exercise type before assuming), reward heavy lifts relative to user's bodyweight. Pseudocode: `maxCompoundLoad / userWeight` — bigger ratio = more STR. If load isn't logged per set, skip this term gracefully (don't crash).
  - **Heavy-program bonus.** If >50% of recent (last 14 days) workouts contain a STR keyword exercise, +small flat boost. Rewards specialization.

- **VIT** — already workouts + streak. Add:
  - **Healthy BMI baseline.** Compute BMI from `userState.weight` (kg) and `userState.height` (cm). If BMI is in the healthy range (18.5–24.9), grant a small VIT baseline (e.g., +5–8). Outside range, no penalty (don't shame the user) — the baseline just doesn't apply.
  - **Habit consistency contribution.** Read `storageService.getHabits()`; if habit completion rate over the last 7 days is ≥80%, +small boost. VIT is "showing up" — habits count too.

- **AGI** — already AGI keywords + workout floor. Add:
  - **Cardio frequency signal.** If user has cardio-tagged workouts (run/jog/cycle/swim) more than 1×/week average over last 4 weeks, +boost. The existing AGI_KEYWORDS bag is mostly explosive moves (burpees/plyo) — add a parallel CARDIO_KEYWORDS bag for endurance cardio.
  - **Lower BMI factor (mild, optional).** If BMI < 24, slight AGI baseline. Don't penalize higher BMI — same "no shame" rule as VIT.

- **PER** — already streak-heavy. Add:
  - **Daily-protocol completion rate.** Habit completion rate (last 7 days) × 30. PER is awareness/discipline — completing your declared daily protocol is the cleanest signal of that.
  - **On-time workout adherence.** If user has a `gymSchedule` and trains the scheduled muscle group on the right day, +small boost per match. Rewards alignment between intention (schedule) and action.

- **INT** — already variety + diversity. Add:
  - **Program rotation signal.** Compute the variance in muscle group selection across the last 8 workouts. Higher variance (touching different muscle groups) = more INT. Lower variance (e.g., 8× chest day) = no extra INT.
  - **Push/pull/legs balance.** Tag exercises into push/pull/legs (a small static map). Compute the spread across last 14 days. Balanced (close to 33/33/33) = +boost. Heavily skewed = no extra.

**Edge cases to handle:**
- Brand-new account (no workouts, no habits, no weight/height). All new signals should return 0 gracefully. The existing floor stays.
- Missing weight/height in `userState`. BMI calc returns 0 → baseline doesn't apply. No crash.
- Very old workouts (older than the time windows above). Use `Date` comparison; ignore stale data per the windowed signals.

**Tests / verification:**
- Run `npm run build` — must stay green.
- Manually trace `calculateAttributes` for: (a) brand-new user (expect ~0 across), (b) Naufal's profile (expect VIT/INT to nudge up due to streaks/diversity), (c) hypothetical "runner" profile (lots of cardio entries) → AGI should dominate.
- Don't write unit tests unless the user asks — project doesn't have a test infra yet.

**Commit message template:**
```
feat(attributes): extend Power Signature with profile + habit + variety signals

Phase B Step 6a. Derivation now reads beyond raw gym history — incorporates
bodyweight, BMI, habit consistency, schedule adherence, and program rotation
so stats reflect the user's actual training shape, not just session count.

Signal additions per stat:
  STR — bodyweight-relative load proxy + heavy-program specialization bonus
  VIT — healthy-BMI baseline + 7-day habit completion boost
  AGI — cardio-frequency signal + mild low-BMI factor
  PER — habit completion rate + on-schedule workout adherence
  INT — muscle-group variance + push/pull/legs balance

All new signals are additive (existing floors preserved) and graceful on
missing data (brand-new account stays at 0). Caps remain 100.

services/attributeService.ts only — no caller changes (StatusCard / Profile
consume the same calculateAttributes signature).

Pause for review before Step 6b (fatigue display polish).
```

**Pause after commit. Don't start Step 6b.**

---

### 1.3 Step 6b — Fatigue display polish

**Scope:** `services/fatigueService.ts` (extend `FatigueReport`) + `components/StatusCard.tsx` (display).

**Goal:** keep the existing average-score model (it's correct), but expose two additional fields the UI can render:
- `recoveringCount` — number of muscles where fatigue > 0.
- `totalMuscles` — total tracked muscles (already known: `ALL_MUSCLES.length`).
- `recoveringPercent` — `recoveringCount / totalMuscles * 100`.

**Why both score and percent:** they answer different questions. Score answers "how cooked is the body overall?" Percent answers "how much of the body is offline right now?" Both belong on the surface.

**Concrete changes:**

1. **`fatigueService.ts`:** extend `FatigueReport`:
   ```typescript
   export interface FatigueReport {
     score: number;
     label: 'Fresh' | 'Primed' | 'Warm' | 'Heavy' | 'Cooked';
     color: string;
     accent: string;
     perMuscle: MuscleFatigue[];
     // NEW:
     recoveringCount: number;
     totalMuscles: number;
     recoveringPercent: number;
   }
   ```
   Compute the new fields after the existing `perMuscle` is built. Threshold for "recovering" = `fatigue > 5` (small dead zone — anything below 5% reads as fresh enough).

2. **`StatusCard.tsx` (collapsed view, fatigue row):** currently shows just `{fatigue.score}` + status dot. Augment with a sub-line:
   ```
   FATIGUE                        23 🟡
   3 of 14 muscles recovering · 21%
   ```
   Use small font (`text-[10px] font-mono text-slate-500`) for the sub-line. Don't render the sub-line if `recoveringCount === 0` (cleaner empty state).

3. **`StatusCard.tsx` (expanded view, optional small enhancement):** add a "recovering muscles" mini-list showing the top 3 most-fatigued muscles by name + percent. Use existing `perMuscle` array, sort descending by fatigue, slice top 3. Skip entirely if all muscles fresh.

**What NOT to touch:**
- The average-score formula. It's correct.
- Per-muscle decay logic. Phase 3B and prior work refined this.
- Dashboard's recovery card / chips (Step 2 territory, separate concern).

**Commit message template:**
```
feat(fatigue): expose recovering count + percent on FatigueReport, surface in StatusCard

Phase B Step 6b. The average-score model is mathematically correct but opaque —
"23" tells the user nothing about which muscles are pulling the average or how
many of their body is offline. Adding count + percent surfaces that.

services/fatigueService.ts:
  +recoveringCount, +totalMuscles, +recoveringPercent on FatigueReport.
  Threshold: fatigue > 5 counts as "recovering" (small dead zone for noise).

components/StatusCard.tsx:
  Collapsed fatigue row gains a sub-line: "X of Y muscles recovering · Z%".
  Hidden when recoveringCount === 0 (clean fresh state).
  Expanded view adds a top-3 recovering-muscles mini-list (skipped if all fresh).

Score model untouched. Per-muscle decay untouched. Dashboard recovery card
untouched (Step 2 territory).

Phase B complete after this commit.
```

**Pause after commit.** Phase B is done.

---

## 2. PHASE C — Bundle code-splitting

**Estimated time:** ~1 hour. Single step.

### 2.1 Why
Bundle currently 1,711 KB JS, 451 KB gzip. Vite warns at 500 KB (uncompressed). On 4G mobile (~3 Mbps real-world), initial load is ~5–6 seconds before app interactive. Can drop 400–500 KB from initial bundle by lazy-loading routes that aren't on the critical path.

### 2.2 Step 7 — Lazy-load heavy routes and dependencies

**Scope:** `App.tsx` (or wherever `react-router-dom` routes are declared) + any direct heavy imports.

**Identify candidates first** (audit before edit):
1. `pages/AdminDashboard.tsx` — admin-only, ~99% of users never load it.
2. `pages/CalculatorSuite.tsx` — used occasionally, not on first paint.
3. `recharts` import in `StatusCard.tsx` (for Power Signature radar) — heavy library, only used in expanded view.
4. Any other heavy chart/animation library that's imported eagerly.

**Approach:**
1. **Lazy routes via `React.lazy` + `Suspense`:**
   ```typescript
   import { lazy, Suspense } from 'react';
   const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
   const CalculatorSuite = lazy(() => import('./pages/CalculatorSuite'));
   
   <Suspense fallback={<RouteLoadingSpinner />}>
     <Routes>
       <Route path="/admin" element={<AdminDashboard />} />
       <Route path="/calculator" element={<CalculatorSuite />} />
     </Routes>
   </Suspense>
   ```
   Use a minimal loading spinner — match the dark theme, no chrome.

2. **Recharts lazy-load (more nuanced):** the radar chart only renders when StatusCard is expanded. Two options:
   - **Option A** — extract the radar JSX to a separate component, lazy-import that component when `expanded === true`. Cleanest for tree-shaking.
   - **Option B** — leave eager import but split recharts to a manual chunk via `vite.config.ts` `rollupOptions.output.manualChunks`. Less surgical but doesn't change React structure.
   Recommend Option A — the user only pays the recharts cost when they actually expand the card.

3. **Verify the win:** before/after `npm run build`. Report exact KB delta. Target: initial JS bundle drops below 1300 KB. Stretch: below 1000 KB.

**Edge cases:**
- Suspense boundary must wrap lazy children — TypeScript will complain if missing.
- Service worker (PWA) needs to handle the new chunk filenames; `vite-plugin-pwa` should auto-handle this on rebuild.
- Mobile users mid-route on slow connection see the fallback for a moment — that's expected, just make the fallback non-jarring.

**Don't:**
- Lazy-load the Dashboard or any first-paint route. That defeats the purpose (user lands on Dashboard).
- Lazy-load `lucide-react` — too granular, tree-shaking already handles icon imports.
- Lazy-load `firebase` — auth check is critical path.

**Commit message template:**
```
perf(bundle): lazy-load AdminDashboard, CalculatorSuite, and Power Signature radar

Phase C Step 7. Initial JS bundle was 1,711 KB (well past Vite's 500 KB warning).
Splitting non-critical-path routes and the recharts radar drops first-paint
payload substantially.

Changes:
  App.tsx: AdminDashboard and CalculatorSuite become React.lazy routes inside
  a Suspense boundary with a minimal dark-theme spinner fallback.

  components/StatusCard.tsx: extracted PowerSignatureRadar to its own file,
  now React.lazy'd inside the expanded view. Recharts is no longer paid for
  on initial load — only when the user expands their Status Card.

Bundle delta: [Opus to fill in actual numbers]
  Initial JS: 1,711 KB → [X] KB ([Y] KB saved)
  Lazy chunks: AdminDashboard ([A] KB), CalculatorSuite ([B] KB), radar ([C] KB)

Service worker rebuilds clean (PWA precache excludes lazy chunks).

Phase C complete.
```

**Pause after commit.**

---

## 3. PHASE D — i18n system (BLOCKED on user decisions)

**This phase requires design decisions before code. DO NOT start implementation. Surface the questions to the user, get answers, THEN draft an execution plan.**

### 3.1 Decisions needed
1. **Target locales.** Start with EN + ID? Open architecture for future locales (CN, JP, etc.)?
2. **Default locale.** Indonesian-first user base — default to ID? Or EN as a "neutral" fallback?
3. **Toggle UX.** Live language switcher in Settings (works any time)? Or onboarding pick-once with "change requires reload"?
4. **String coverage.** All UI strings extracted from day one, or progressive (start with high-traffic surfaces: Dashboard, Settings, Profile, then expand)?
5. **AI persona language.** The System currently replies in Bahasa Indonesia. Should it follow the UI locale, or stay ID always for the cultural framing?
6. **Date / number formatting.** Match the locale (uses `Intl.DateTimeFormat` automatically) or stay ISO/Latin numerals?

### 3.2 Likely architecture (when unblocked)
- Library: `react-i18next` (industry standard, good React integration, lazy translation loading).
- File structure: `locales/en.json`, `locales/id.json`. Namespace by surface (`dashboard`, `settings`, `profile`, etc.) for code-split friendliness.
- Hook usage: `const { t } = useTranslation('dashboard'); t('greeting.morning')` etc.
- Persistence: locale preference in `userState.locale`, written through Settings save flow.
- AI persona: server-side prompt could include `{userLocale}` substitution if the user wants it to follow.

### 3.3 Realistic effort
- Infrastructure setup: 2–3 hours.
- String extraction: ~6–8 hours for full coverage (~200–400 strings across the app).
- Translation review (if going beyond machine translate): adds 4–6 hours per locale.
- Total: 1.5–2 days for EN + ID full coverage.

**Surface the questions to user. Don't write code until answered.**

---

## 4. PHASE E — Seasonal Rank system (BLOCKED on design conversation)

**This is the largest feature in the wishlist. It needs a dedicated design session before any code. DO NOT start implementation. Help the user reason through the decisions.**

### 4.1 Why it needs design first
ML / HoK / PUBG / Free Fire ranked systems are PvP — rank moves with wins/losses against other players. OurLife has no PvP. Rank input must come from somewhere else, and choosing where determines the entire feature's character.

### 4.2 Decisions needed
1. **What raises rank?** Options:
   - Workouts per week (consistency-driven).
   - Streak length (commitment-driven).
   - Weekly XP earned (output-driven).
   - Composite score (workouts + habits + sleep tracking + ...).
   - PRs on compound lifts (strength-driven, but excludes non-lifters).
   - Achievement points unlocked this season.
   Each shapes player behavior differently. The choice IS the feature.

2. **Tier structure.** ML uses Warrior → Elite → Master → Grandmaster → Epic → Legend → Mythic with division I–V at each tier. That's ~30 sub-ranks. For a fitness app, that may be too granular. Alternatives:
   - 5 tiers, 3 divisions each (15 sub-ranks).
   - 7 tiers, no divisions.
   - Match the existing E/D/C/B/A/S hunter-rank tiers but with seasonal overlay.

3. **Season length.** ML 3 months. HoK 2 months. For fitness:
   - 1 month → tight feedback loop, but possibly stressful.
   - 2 months → middle ground.
   - 3 months → lower pressure, more meaningful.

4. **Reset behavior.** Season end:
   - Hard reset (everyone starts at lowest tier).
   - Soft reset (drop 2 tiers).
   - Decay (rank slowly drops if inactive).

5. **Season rewards.** End-of-season payouts:
   - Cosmetic badges (collectible, persists across seasons).
   - One-off XP grants.
   - Streak Freeze Tokens.
   - Title unlocks ("Season 3 Master").

6. **Coexistence with hunter rank.** Current `RANK_TIERS` (E-Rank → S-Rank) is a *lifetime* rank tied to level. Seasonal rank would be different. Two parallel rank surfaces?
   - Option A: lifetime hunter rank stays (level-based), seasonal rank is a separate badge.
   - Option B: hunter rank becomes seasonal, lifetime stat shifts to "max rank ever achieved".
   - Option A is safer (doesn't break existing UI / leaderboard). Option B is cleaner but invasive.

7. **Visibility / leaderboard.** Seasonal rank globally visible (vs current friends-only leaderboard)? Region-locked?

### 4.3 Realistic effort once design is settled
- Data layer (rank points, season state, history): 4–6 hours.
- Core logic (rank calc, promotion/demotion, season reset job): 6–8 hours.
- UI (rank badge, progress, season timer, end-of-season ceremony): 8–10 hours.
- Migration / backfill for existing users: 2–4 hours.
- Total: 3–4 days minimum once design is locked.

**Lead the user through the decisions. Don't shortcut to implementation.**

---

## 5. EXECUTION RULES — quick reference

(Repeating Section 0.8 for paste convenience.)

1. One step = one commit, atomic and descriptive.
2. Pause after every step. Report what landed. Wait for user confirmation.
3. Audit before edit. Read the file/section first.
4. Build verify before commit. Report bundle delta.
5. Don't batch sub-steps.
6. Push back on requests that revert prior work — surface the conflict.
7. Don't touch files outside the step's scope.
8. Use Bahasa Indonesia for user-facing copy, English for code/comments.
9. Match existing style: dark theme tokens, jarvis-card class, kebab-case animation utilities.
10. No `<style jsx>` (Next.js syntax). No SvelteKit. No `tailwind.config.js` extends — animations in `index.css`.

---

## 6. QUALITY BAR

What "good" looks like, beyond the rules above:

- **Zero TypeScript errors.** Project is strict mode.
- **Mobile responsive verified.** Test breakpoints in the build, especially `sm`/`md`/`lg`.
- **Reduced motion respected** for animations users can opt out of (where it makes sense — `petFloat` is fine, but a full-screen confetti should respect `prefers-reduced-motion`).
- **No console errors** on a fresh app load. The service worker logs at info level are OK; errors are not.
- **No new `dangerouslyAllowBrowser`** or other security regressions. The Groq SDK call is already flagged for relocation to a Firebase Function — don't add similar exposures.
- **Comments earn their place.** Don't comment what code does. Comment why a non-obvious decision was made (Phase A's existing `attributeService.ts` comments are a good model).
- **User-visible language** (chat, modals, toast) stays Bahasa Indonesia. Code, types, function names, docblocks stay English.

---

## 7. HOW TO USE THIS DOCUMENT

For each phase you're ready to execute:

1. Read Section 0 (pre-flight) into the chat. Then read the phase section (1, 2, 3, or 4).
2. For Phase B and C: execute step-by-step, pausing as instructed.
3. For Phase D and E: do NOT execute. Surface the decision questions to the user and help them reason through the answers. Only after answers come back do you draft the execution plan.
4. After every step, report:
   - Commit hash + message
   - Build status + bundle delta
   - Files changed
   - Any deviations from spec (with reasoning)
   - What to verify visually
5. Wait for user confirmation before next step.

**Do not skip the pre-flight section.** It's not optional context — it's how the rest stays self-contained.
