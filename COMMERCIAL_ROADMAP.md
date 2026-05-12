# OurLife — Commercial-Grade Roadmap

> **Status:** Late beta / early commercial. Foundation is technically sound (gamification, achievements, attributes, fatigue, streak protection are real production logic). The gap to commercial-grade is **finishing 24 half-shipped features**, **6 security blockers**, and a **UX consistency pass**. ~71 findings cataloged from deep codebase audit.
>
> **Document purpose:** sister-file to `CLAUDE_NEXT_PHASES.md`. CLAUDE_NEXT_PHASES is technical execution detail for ready-to-build phases; this is the **strategic roadmap** showing the full landscape and recommended order to ship a commercial-quality product.

---

## TL;DR — What's actually left

| Tier | Description | Items | Estimated effort |
|------|-------------|-------|-------|
| 0 | Critical pre-launch blockers (security, data integrity) | 6 | 1–2 weeks |
| 1 | Phase A.7 — real notched nav + small UI fixes | 8 | 1–2 days |
| 2 | "Coming Soon" stubs → actually shipped | 9 | 2–3 weeks |
| 3 | Feature completeness — finishing half-built work | 12 | 3–4 weeks |
| 4 | Commercial polish — consistency, accessibility, perf | 15 | 2–3 weeks |
| 5 | Differentiation features — what makes OurLife stand out | 10 | 4–6 weeks |
| 6 | Major epics — i18n, rank seasonal, testing, social | 5 | 8–12 weeks |
| **Total** | | **65** | **~4–6 months to fully commercial** |

That's the honest range. A leaner "good enough to charge for it" cut at **Tier 0–3 = ~6–8 weeks of focused work**. Tiers 4–6 lift the product from "shipped" to "loved."

---

## Tier 0 — Critical pre-launch blockers

These ship-stoppers compromise security, privacy, or data integrity. Don't take payments or do meaningful marketing until these are fixed.

### 0.1 Move Groq API key to a backend proxy
- **Location:** `services/aiService.ts:107` — `new Groq({ apiKey, dangerouslyAllowBrowser: true })`
- **Risk:** Anyone opens DevTools → reads the API key from the bundle → racks up your Groq bill or exfiltrates user chats.
- **Fix:** Firebase Cloud Function (`functions/src/chatWithSystem.ts`) accepts `{ userMessage, userContext }`, calls Groq server-side with secret key, returns reply. Client calls it via `httpsCallable`. Tool calls (execute_penalty, mark_quest_complete) move to Admin SDK on the server.
- **Effort:** Large (~1 day). Functions setup + secret config + client refactor + auth check.

### 0.2 Audit and lock down Firebase security rules
- **Location:** Firebase Console (no rules in repo). Currently unknown posture.
- **Risk:** Without `auth != null` + `uid == request.auth.uid` checks, any authenticated user can read/write any other user's data. Leaderboard queries also need scoped reads.
- **Fix:** Write `firestore.rules` and `database.rules.json` to repo. Auth gate everything. Per-user document isolation. Public read only on explicit fields (display name, level, XP for leaderboard).
- **Effort:** Medium (~3 hours).

### 0.3 Replace hardcoded admin email with role-based access
- **Location:** `services/storageService.ts:197-198`, `App.tsx:21`, `components/AdminDashboard.tsx:174-175`
- **Risk:** Admin promotion requires a code deploy. Doesn't scale. Adds friction to ops.
- **Fix:** Read `users/{uid}.role` from Firestore. Admin guard component checks role. Settings → Admin tab (visible to admins only) lists all users with role toggle.
- **Effort:** Medium (~3 hours).

### 0.4 Cascade-delete on account deletion
- **Location:** `context/AuthContext.tsx:119-131`
- **Risk:** Avatar images orphaned in Cloud Storage (cost + privacy). Subcollections (workouts, habits, achievements) potentially leaked.
- **Fix:** Delete order: 1) Storage avatar by uid pattern, 2) Firestore subcollections (use `getDocs` + batch delete), 3) RTDB user node, 4) Auth user. Use a Cloud Function for atomic cleanup (better than client-side which can be interrupted).
- **Effort:** Large (~5 hours, including testing).

### 0.5 Avatar upload sanitation
- **Location:** `components/Settings.tsx:140-147`
- **Risk:** Malicious SVG/WEBP with embedded scripts. MIME-type check is bypassable.
- **Fix:** Cloud Function intercepts upload, runs `sharp` (Node) to re-encode to safe JPEG/PNG, validates dimensions, max file size. Reject anything that doesn't survive the round-trip.
- **Effort:** Medium (~4 hours).

### 0.6 Confirmation dialogs on destructive actions
- **Location:** Habit delete, workout delete, clear cache, account delete
- **Risk:** One-click data loss with no recovery. User trust killed.
- **Fix:** Reusable `<ConfirmDialog>` component with title, body, confirm/cancel buttons. Required for: account delete, workout/log delete, habit delete, clear cache. Add "type DELETE to confirm" for account delete (highest stakes).
- **Effort:** Small (~2 hours).

---

## Tier 1 — Phase A.7 + Foundational Polish

Ready-to-ship now. Builds on Phase A through Phase B already commited. Lights up immediate visual quality.

### 1.1 Phase A.7 — Real notched bottom nav (CSS mask approach)

**Why:** Phase A.6 used a halo trick (page-bg colored ring around FAB to fake a notch). It works visually but is "geser ke bawah dan nimpa" — not a real curved cutout. Reference UX (Material BottomAppBar, fitness apps) has a smooth half-circle dip carved out of the nav silhouette itself.

**Approach:** CSS `mask-image: radial-gradient(...)` carves a circular cutout from the nav background. No SVG path math, no nav restructure. Single property addition.

**Implementation outline:**

```tsx
<nav 
  className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-dark flex justify-around p-1.5"
  style={{
    maskImage: 'radial-gradient(circle 38px at 50% 0%, transparent 37px, black 38px)',
    WebkitMaskImage: 'radial-gradient(circle 38px at 50% 0%, transparent 37px, black 38px)',
  }}
>
  {/* nav items render normally — only the background is masked */}
</nav>
```

**Math:** Cutout radius 38px at top-center. FAB lg = 64px (32px radius). 6px halo of page bg shows around FAB inside cutout. FAB at `bottom-12` (48px) sits with ~35% of its body inside the cutout zone.

**Caveats to verify in execution:**
- `glass-dark` uses `backdrop-filter: blur`. Mask + backdrop-filter can interact weirdly on Safari. Spec a `mask-mode: alpha` if needed.
- Halo color from Phase A.6 (`bg-slate-950 absolute -inset-2`) should be **removed** — real cutout means no halo trick needed.
- If glass-dark mask renders ugly, fallback: replace `glass-dark` on the nav with a wrapper that has the mask and an inner `glass-dark` div without the mask.

**Effort:** Small (~1 hour, with iteration).

### 1.2 Wire `tired` emotion to actual fatigue (Step 4 follow-up)
- **Location:** `components/SystemChat.tsx` resting-emotion effect
- **Current:** `tired` defined in PetEmotion but never set anywhere. Hour-based trigger from Phase A.5 sets `tired` at 18:00 if habits incomplete, but doesn't read fatigue.
- **Fix:** Import `computeFatigue` from `services/fatigueService`. If `fatigue.score >= 70`, set `tired` (overrides the hour-based one).
- **Effort:** Small (~15 minutes).

### 1.3 Bilingual emotion regex for AI responses
- **Location:** `components/SystemChat.tsx:78-85` (emotion derivation in `send()`)
- **Current:** `/penalty|deducted|broken|punish/i` — English only. The System replies in Bahasa Indonesia, so penalty regex never matches → pet stays happy through Indonesian-language penalty.
- **Fix:** Add ID keywords to both regexes:
  - shocked: `penalty|deducted|broken|punish|hukuman|penalti|terputus|pelanggaran`
  - excited: `quest|level up|bonus|achievement|xp granted|reward|tugas|misi|naik level|hadiah|capai|prestasi`
- **Effort:** Small (~10 minutes).

### 1.4 Schedule day-key audit
- **Location:** `services/storageService.ts` `getGymSchedule()` + Phase B Step 6a's PER schedule adherence signal
- **Risk:** If keys are stored as `'senin'` (Indonesian) but the new attributeService reads via `toLocaleDateString('en-US')` → `'monday'`, the signal silently never fires.
- **Fix:** Read a sample schedule from storage. Confirm keys are English-day-name lowercase. If Indonesian, normalize on read OR update attributeService to handle both.
- **Effort:** Small (~15 minutes audit + fix).

### 1.5 Resend verification email button
- **Location:** `components/VerifyEmailGate.tsx`
- **Current:** Gate works but no resend if email is missed/expired.
- **Fix:** Button calls `sendEmailVerification()`. Rate-limit to 1 per 60 seconds. Show "Email sent — check inbox" toast.
- **Effort:** Small (~30 minutes).

### 1.6 Settings disabled-button cleanup
- **Location:** `components/Settings.tsx`
- **Current:** Multiple buttons with `disabled={true}` and "COMING SOON" badges.
- **Quick fix:** Group all "Coming Soon" items under a single explicit subsection so users see "feature in development" cohesively, not scattered. Or remove the disabled buttons entirely and replace with a small "What's coming" section linking to a roadmap page.
- **Effort:** Small (~30 minutes).

### 1.7 Login form: show password toggle
- **Location:** `components/Login.tsx`
- **Common UX:** Eye icon next to password field that toggles `type="password"` ↔ `type="text"`.
- **Effort:** Small (~15 minutes).

### 1.8 Error toast standardization
- **Location:** Various components
- **Current:** Some errors as toast, some inline, some silent. Inconsistent recovery UX.
- **Fix:** One toast component (`react-hot-toast` or custom). Use across Login, Settings, GymTracker, HabitTracker. Errors include action: "Retry" or "Dismiss".
- **Effort:** Medium (~3 hours).

---

## Tier 2 — "Coming Soon" → Actually Shipped

The Settings panel currently has nine disabled stubs. Each erodes credibility. Either ship them or remove them.

### 2.1 Notifications: real FCM topics
- **Stub:** Toggles for Workout Reminders, Streak Alerts, Achievement Unlocked, Daily Motivation, Habit Check-in
- **Ship state:** 
  1. Client requests FCM permission and gets device token
  2. Token saved to `users/{uid}/fcmTokens` (Firestore array)
  3. Toggles persist to `users/{uid}/notificationPreferences`
  4. Cloud Function listens to relevant events (workout streak break, habit incomplete, achievement unlock) and sends FCM messages to subscribed tokens
  5. Local notification permission UX (don't ask immediately on app load — wait until user toggles ON)
- **Effort:** Extra Large (~2-3 days). FCM setup + Cloud Functions + token management + edge cases (permission denied, token rotation).

### 2.2 Theme toggle (real light mode)
- **Stub:** "Dark (system locked)" 
- **Ship state:** Light theme variant. CSS variable strategy: define color tokens (`--bg-primary`, `--text-primary`, etc.) and swap on `data-theme` attribute on `<html>`. Most colors already use Tailwind's slate scale — light mode swaps to white/zinc with adjusted accent intensities.
- **Reality check:** Solo Leveling aesthetic is intrinsically dark. Light mode might dilute the brand. Consider auto/dark/light only, no "Solo Leveling Light" variant. Or keep dark-locked and remove the stub entirely.
- **Effort:** Large (~6-8 hours). Or Small (~30 min) if you remove the stub.

### 2.3 Language i18n
- **Stub:** "Bahasa Indonesia"
- **Ship state:** `react-i18next`, translation files (`locales/en.json`, `locales/id.json`), language selector in Settings, persisted to `userState.locale`. Surface-by-surface migration starting with high-traffic (Dashboard, Settings, Profile).
- **Reality check:** User base is Indonesian, app is mostly Indonesian. Going EN+ID gives optionality but minimal differentiator value. Defer until user requests come in.
- **Effort:** Extra Large (~1.5-2 days for infra + 6-8 hours for full string migration). See `CLAUDE_NEXT_PHASES.md` Section 3 for the full design conversation.

### 2.4 Font Size selector
- **Stub:** "Medium"
- **Ship state:** Three options (Small/Medium/Large). Set `font-size` on `<html>` (e.g., 14px / 16px / 18px). Tailwind's `rem`-based sizing scales correctly. Persist to `userState.fontSize`.
- **Effort:** Small (~1 hour). Honest commercial-tier feature.

### 2.5 Export Data (CSV / JSON)
- **Stub:** "JSON / CSV"
- **Ship state:** 
  - JSON: serialize entire localCache + Firestore data, prompt download with filename `ourlife-export-{date}.json`
  - CSV: per-collection exports (workouts.csv, habits.csv, achievements.csv) zipped
- **Effort:** Medium (~3 hours).

### 2.6 Clear Cache
- **Stub:** "Free up local storage"
- **Ship state:** `localStorage.clear()` after confirmation modal. Show estimated freed space (`navigator.storage.estimate()`). Re-fetch from Firebase on next load.
- **Effort:** Small (~1 hour).

### 2.7 Two-Factor Authentication
- **Stub:** "Off [Enable]"
- **Ship state:** Firebase Auth supports TOTP MFA natively. Enable in Firebase Console → Authentication → Multi-factor authentication. Client wraps Firebase MFA flow: enroll, verify code, store backup codes.
- **Effort:** Medium (~4 hours).

### 2.8 Change Email / Change Password
- **Stub:** Both disabled
- **Ship state:** 
  - Change Password: modal asks for current password (re-auth), then `updatePassword()`. Show success toast.
  - Change Email: re-auth, then `updateEmail()`, then send new verification email. User must verify new email or revert.
- **Effort:** Medium (~3 hours).

### 2.9 Daily Check-in / Weekly Digest
- **Stub:** "Daily Check-in Reminder: 9:00 AM"
- **Ship state:** Combine with notification system (2.1). Cloud Scheduler triggers Cloud Function at user's preferred time. Function checks user's habits, sends push notification with summary or reminder.
- **Effort:** Extra Large (~2 days). Tied to FCM rollout.

---

## Tier 3 — Feature Completeness

Existing structures with incomplete or shallow implementations. Finish what's started before adding new features.

### 3.1 Onboarding validation + autosave
- **Location:** `components/Onboarding.tsx`
- **Current:** No required-field validation per step. Browser refresh loses progress.
- **Fix:** Each step's "Next" button disabled until required fields complete. Save partial state to `localStorage` after each step. Resume from last step on app reload.
- **Effort:** Medium (~2-3 hours).

### 3.2 Leaderboard: profile click + filters
- **Location:** `components/Leaderboard.tsx`
- **Current:** Read-only top 20 by XP. Names not clickable.
- **Fix:** Click name → modal with user's profile card (avatar, level, rank, achievements). Filter tabs: All Time / This Month / Weekly. Sort options: XP / Streak / Workouts. Add "Find me" button that scrolls to user's row.
- **Effort:** Medium (~4 hours).

### 3.3 Admin Dashboard: pagination + search + sort
- **Location:** `components/AdminDashboard.tsx`
- **Current:** Fetches all users at once. No search.
- **Fix:** 20-per-page pagination with Firestore cursor. Search by name/email (debounced). Sort by XP/level/streak/lastActive. User detail drawer with full data + action buttons (grant XP, reset streak, ban).
- **Effort:** Medium (~4-5 hours).

### 3.4 Workout Templates / Saved Routines
- **Location:** `pages/GymTracker.tsx`
- **Current:** Build workout fresh every session. "Repeat Last" exists but no template library.
- **Fix:** "Save as Template" button after workout completion. Templates listed in Dashboard "Quick Start" or new "Templates" tab in Gym page. Clone, customize, launch.
- **Effort:** Medium (~4 hours).

### 3.5 Workout Log: per-set granularity
- **Location:** `types.ts:46-56` (WorkoutLog interface)
- **Current:** One weight/reps entry per exercise.
- **Fix:** Sets array per exercise: `[{ reps, weight, rpe?, restSeconds?, tempo? }]`. UI: each set is a row, "+ Add Set" button. Tracks progressive overload properly.
- **Effort:** Medium (~5 hours). UI refactor + type changes + migration.

### 3.6 PR (Personal Record) Tracking
- **Location:** No PR detection in `services/gamificationService.ts`
- **Current:** Big lifts go uncelebrated.
- **Fix:** On workout save, scan for new max weight per exercise. Compare to history. If new PR, fire achievement + toast. Profile page: "PR Board" showing top weights per major lift.
- **Effort:** Medium (~3 hours).

### 3.7 Body Measurement Tracking
- **Location:** Not implemented
- **Current:** Only weight/height in UserState. No history.
- **Fix:** New "Body" tab in Profile. Weight + measurements (chest, waist, arm, thigh) with date stamps. Charts showing trend over time. Optional: progress photos timeline (privacy-locked, on-device only or encrypted Firestore).
- **Effort:** Medium-Large (~6 hours).

### 3.8 Goals with Deadlines
- **Location:** Not implemented
- **Current:** "Fitness Goal" in onboarding (Build Muscle / Lose Weight) is just a label.
- **Fix:** New `Goal` type: `{ id, title, type, targetValue, currentValue, deadline, status }`. Goal types: weight target, max lift, streak length, habit duration. Goal dashboard widget. Achievement unlock if hit before deadline.
- **Effort:** Large (~8 hours).

### 3.9 Rest Timer auto-trigger
- **Location:** `pages/GymTracker.tsx:56-119`
- **Current:** RestTimer component exists but requires manual trigger.
- **Fix:** Auto-prompt "Rest 90s?" after marking a set complete. Sound + vibration when done. Quick presets (30/60/90/120s) + custom.
- **Effort:** Small (~2 hours).

### 3.10 Streak Milestone celebrations
- **Location:** `services/gamificationService.ts`
- **Current:** Streak hits 30 days with no acknowledgment.
- **Fix:** Threshold notifications at 7, 14, 30, 60, 90, 100, 365 days. Each milestone unlocks an achievement + toast + +bonus tokens. Profile shows "milestone history."
- **Effort:** Small (~2 hours).

### 3.11 SystemChat history persistence
- **Location:** `components/SystemChat.tsx`
- **Current:** Messages ephemeral (cleared on browser close, except `lastSystemMessage`).
- **Fix:** Save messages to `users/{uid}/systemChat` Firestore subcollection. Load last 50 on chat open. Older accessible via "Show older messages."
- **Effort:** Medium (~3 hours).

### 3.12 Achievement gallery filters
- **Location:** `pages/Profile.tsx` (achievement section)
- **Current:** Long flat list.
- **Fix:** Category tabs (Workout / Habit / Streak / XP / Rank / Special). Status filter (All / Unlocked / In Progress / Locked). Sort: Recent / Progress / Rarity.
- **Effort:** Small-Medium (~2 hours).

---

## Tier 4 — Commercial Polish

Consistency, accessibility, performance. The difference between "works" and "feels premium."

### 4.1 Bundle code-splitting (Phase C)
- **Location:** `App.tsx` + heavy imports
- **Current:** 1.7 MB initial JS.
- **Fix:** Lazy-load AdminDashboard, CalculatorSuite, recharts radar (in StatusCard expanded). Target: <1.2 MB initial. Suspense fallbacks should match dark theme.
- **Effort:** Small-Medium (~2 hours).

### 4.2 Skeleton loaders
- **Location:** Dashboard, GymTracker, HabitTracker, Leaderboard
- **Current:** Mix of spinners and blank states.
- **Fix:** Skeleton components matching card shapes. Pulsing animation. Use during data fetch.
- **Effort:** Medium (~3 hours).

### 4.3 Empty states with CTAs
- **Location:** All list pages
- **Current:** "No data" text.
- **Fix:** Illustrated/iconified empty states with helpful copy and "Add your first X" button. Especially HabitTracker (no habits), Leaderboard (no friends), GymTracker history (no workouts).
- **Effort:** Medium (~4 hours).

### 4.4 Pull-to-refresh on mobile lists
- **Location:** GymTracker history, HabitTracker, Leaderboard
- **Current:** Browser refresh only.
- **Fix:** `react-pull-to-refresh` or custom touch handler. Visual: spinner appears at top, releases when threshold met.
- **Effort:** Medium (~3 hours).

### 4.5 Color consistency pass
- **Location:** Throughout codebase
- **Current:** Mix of `cyan-500`, `blue-500`, `jarvis-accent` for similar concepts.
- **Fix:** Define tokens in Tailwind config: `primary`, `accent`, `urgency`, `success`, `info`. Replace ad-hoc colors with semantic tokens. Document in CLAUDE.md.
- **Effort:** Medium (~4 hours).

### 4.6 Border-radius consistency
- **Location:** Throughout
- **Current:** Mix of `rounded-lg`/`rounded-xl`/`rounded-2xl`.
- **Fix:** Convention: buttons `rounded-lg`, cards `rounded-xl`, modals `rounded-2xl`, pills `rounded-full`. Apply consistently.
- **Effort:** Small-Medium (~2 hours).

### 4.7 Animation timing consistency
- **Location:** Throughout
- **Current:** `animate-slide-up`, `animate-fade-in`, etc. with varying durations.
- **Fix:** Tokens for animation durations: `duration-fast` (150ms), `duration-base` (200ms), `duration-slow` (400ms). Apply consistently per pattern (modals fast, page transitions base, celebrations slow).
- **Effort:** Small (~2 hours).

### 4.8 Search bars where lists are long
- **Location:** GymTracker exercises, Leaderboard, Admin users
- **Fix:** Debounced search input above each long list. Highlights matched text.
- **Effort:** Medium (~3 hours total across surfaces).

### 4.9 Date range picker on charts
- **Location:** Profile history, Admin charts
- **Fix:** Library like `react-day-picker`. Presets (7d, 30d, 90d, custom). Apply to all time-series.
- **Effort:** Medium (~3 hours).

### 4.10 Undo for accidental deletions
- **Location:** Habit/workout/log delete
- **Fix:** Soft-delete (mark `deletedAt`, hide from UI for 30 days). Toast with "Undo" button (5s). Cron Cloud Function purges after 30d.
- **Effort:** Medium (~4 hours).

### 4.11 Accessibility audit
- **Location:** Throughout
- **Fix:** Alt text on all images. ARIA labels on interactive elements. Keyboard navigation testable. Focus order logical. Color not sole indicator. Test with NVDA/VoiceOver.
- **Effort:** Large (~1 day).

### 4.12 Mobile responsive sweep
- **Location:** AdminDashboard, CalculatorSuite, Profile (some surfaces)
- **Fix:** Test on 320px width minimum. Stacked layouts where needed. Horizontal scroll for tables. Hamburger nav for desktop sidebar items not in mobile bottom nav.
- **Effort:** Medium (~5 hours).

### 4.13 Lazy-load images
- **Location:** Avatars, exercise images
- **Fix:** Add `loading="lazy"` to all `<img>`. Consider Intersection Observer for below-fold images.
- **Effort:** Small (~1 hour).

### 4.14 Re-render audit (`useMemo` / `useCallback`)
- **Location:** GymTracker, Dashboard, AdminDashboard
- **Fix:** Profile with React DevTools. Memo expensive components (Anatomy Viewer, Radar chart, Leaderboard). Wrap callbacks. Split contexts by update frequency if needed.
- **Effort:** Medium (~4 hours).

### 4.15 Strip console.log of PII before production
- **Location:** Throughout
- **Risk:** Production users open DevTools, see other-user data in logs.
- **Fix:** Replace `console.log` with a logger that's no-op in prod. Or use `vite-plugin-remove-console`.
- **Effort:** Small (~1 hour).

---

## Tier 5 — Differentiation Features

What separates a generic fitness tracker from one users love and recommend.

### 5.1 Seasonal Rank System (HoK / ML / PUBG style)
- **Status:** BLOCKED — design conversation needed.
- **Open questions** (see `CLAUDE_NEXT_PHASES.md` Section 4):
  1. What raises rank? (workouts/streak/composite/PR)
  2. Tier structure (5/7/9 tiers, divisions or no)
  3. Season length (1/2/3 months)
  4. Reset behavior (hard/soft/decay)
  5. Rewards (cosmetic/XP/tokens/titles)
  6. Coexistence with hunter rank (parallel/replace)
  7. Visibility (global/region/friend-only)
- **Effort once designed:** 3–4 days.

### 5.2 Friend system + challenges
- **Current:** None. Leaderboard is global read-only.
- **Ship state:** Friend requests. Friend list in Profile. Side-by-side stat compare. Shared challenges ("7-day streak together"). Notification when friend hits milestone.
- **Effort:** Extra Large (~1 week).

### 5.3 Exercise library quality bump
- **Current:** Names, basic stats.
- **Ship state:** Each exercise has: video link (YouTube), step-by-step instructions, common mistakes, primary/secondary muscle map, difficulty rating, equipment needed, "suitable for" labels.
- **Effort:** Medium for UI (~6 hours), Large for content curation (~3-5 days).

### 5.4 Progress photos timeline
- **Current:** Not implemented.
- **Ship state:** Camera/upload. Date-stamped private gallery. Before/after comparison view. Optional public share (with consent + watermark). Privacy-first design.
- **Effort:** Large (~1 day).

### 5.5 Sleep / Recovery tracking lite
- **Current:** Not implemented.
- **Ship state:** Manual sleep input (hours + quality 1-5). Affects fatigue calculation. AI coach gives recovery advice. Sleep streak tracking.
- **Effort:** Medium (~5 hours).

### 5.6 Mindfulness corner
- **Current:** Not implemented.
- **Ship state:** Daily reflection prompt (1 question). Gratitude journal (1 line/day). 5-10 min meditation timer with sounds. New PER signal source (consistent reflection = perception bonus).
- **Effort:** Medium (~6 hours).

### 5.7 Plate calculator
- **Current:** Not implemented (CalculatorSuite has BMI/macro maybe).
- **Ship state:** Input target weight + bar weight, output plates per side. Common in serious lifting apps.
- **Effort:** Small (~2 hours).

### 5.8 Nutrition lite
- **Current:** Removed earlier per user feedback.
- **Ship state:** Just protein + water tracking. Daily target (e.g., 2g/kg bodyweight protein, 3L water). Reminder integration. NOT a full meal log.
- **Effort:** Medium (~5 hours).

### 5.9 Notification message center
- **Current:** No history.
- **Ship state:** Bell icon with unread count. Dropdown shows last 20. Full archive page. Mark all read.
- **Effort:** Medium (~4 hours).

### 5.10 Sharing: workout to social
- **Current:** Not implemented.
- **Ship state:** Generate beautiful summary card (workout stats + Solo Leveling theme). Share to Instagram Stories, WhatsApp, etc. Tracks viral attribution.
- **Effort:** Medium (~5 hours).

---

## Tier 6 — Major Epics

Multi-day or multi-week initiatives. Plan deliberately, don't sprinkle into other work.

### 6.1 i18n system (full)
- See `CLAUDE_NEXT_PHASES.md` Section 3 for design questions.
- **Effort:** ~2 days infra + ~1 day per locale full coverage.

### 6.2 Test coverage from zero
- **Current:** No test infrastructure (no jest/vitest/playwright config).
- **Ship state:** 
  - Vitest for unit tests (services priority: storage, gamification, achievements, attribute, fatigue)
  - React Testing Library for component tests (Login, Settings save flow, GymTracker workout save, HabitTracker toggle)
  - Playwright for E2E (signup → onboarding → first workout flow)
  - Target: 70% coverage on services, 50% on components, 5 critical E2E paths.
- **Effort:** Extra Extra Large (~2 weeks to establish + ongoing). Treat as cultural change, not one-off.

### 6.3 Offline mode (write queue)
- **Current:** Read-from-cache works. Writes hit Firebase synchronously, fail offline.
- **Ship state:** Outbox pattern. Writes queue locally. Sync worker drains queue when online. Conflict resolution (last-write-wins or merge logic per resource).
- **Effort:** Extra Large (~1 week).

### 6.4 Performance monitoring + error tracking
- **Current:** No Sentry, no analytics.
- **Ship state:** Sentry for errors + perf. Error boundary catches rendering crashes. Privacy: anonymize PII before send. Optional: PostHog or GA4 for product analytics.
- **Effort:** Medium (~1 day).

### 6.5 Wearable integrations (Apple Watch / Garmin / Fitbit)
- **Current:** Not implemented.
- **Ship state:** OAuth flows for each provider. Pull workouts, sleep, heart rate. Map to OurLife data model. Reconcile duplicate logging.
- **Effort:** Extra Extra Large per provider (~1 week each, conservatively).

---

## Suggested Execution Order

### Sprint 1 (Week 1-2): Critical + Phase A.7
- Tier 0.1 — Move Groq to backend (1 day)
- Tier 0.2 — Firebase rules audit (3 hours)
- Tier 0.3 — Role-based admin (3 hours)
- Tier 0.6 — Confirmation dialogs (2 hours)
- Tier 1.1 — Phase A.7 notched nav (1 hour)
- Tier 1.2-1.5 — Quick wins from audit (~2 hours total)
- Tier 0.4 — Account deletion cascade (5 hours)
- Tier 0.5 — Avatar sanitation (4 hours)

**Goal:** Branch is safe to merge to main. Critical security closed.

### Sprint 2 (Week 3-4): Coming Soon → Shipped
- Tier 2.4 — Font Size (1 hour)
- Tier 2.5 — Export Data (3 hours)
- Tier 2.6 — Clear Cache (1 hour)
- Tier 2.7 — 2FA (4 hours)
- Tier 2.8 — Change Email/Password (3 hours)
- Tier 2.1 — FCM notifications setup (2-3 days, the big one)

**Goal:** No more "Coming Soon" disabled buttons.

### Sprint 3 (Week 5-6): Feature Completeness
- Tier 3.1 — Onboarding validation
- Tier 3.2 — Leaderboard improvements
- Tier 3.3 — Admin Dashboard pagination
- Tier 3.4 — Workout templates
- Tier 3.6 — PR tracking
- Tier 3.9 — Rest timer auto-trigger
- Tier 3.10 — Streak milestones

**Goal:** All half-built features finished.

### Sprint 4 (Week 7-8): Commercial Polish
- Tier 4.1 — Bundle code-split (Phase C)
- Tier 4.2 — Skeleton loaders
- Tier 4.3 — Empty states with CTAs
- Tier 4.5 — Color tokens
- Tier 4.7 — Animation tokens
- Tier 4.11 — Accessibility audit
- Tier 4.14 — Re-render perf

**Goal:** "Feels like a commercial app."

### Sprint 5+ (Week 9+): Differentiation
- Tier 5.1 — Seasonal Rank (3-4 days)
- Tier 5.2 — Friend system (1 week)
- Tier 5.3 — Exercise library quality
- Tier 5.4 — Progress photos
- Tier 5.5 — Sleep/recovery
- Tier 5.6 — Mindfulness

**Goal:** Differentiation. The features users tell their friends about.

### Continuous (every sprint)
- Tier 6.4 — Sentry integration (do early)
- Tier 6.2 — Tests as you go (don't wait for "test sprint")
- Tier 4.13 — Lazy load images (cheap wins)

---

## Decision Points That Block Future Work

These need user decisions before code can start:

1. **Seasonal rank system design (Tier 5.1)** — 7 questions. ~2 hours of brainstorming with mockups.
2. **i18n strategy (Tier 6.1)** — 6 questions. ~30 minutes of decisions.
3. **Light theme: keep or kill stub** — 5 minutes. Decide once.
4. **Friend system social model** — friend graph DB design. ~1 hour discussion.
5. **Wearable strategy** — which provider first, or generic Health Connect API? ~30 minutes.

Schedule a brainstorm session for the rank system early — it's the highest-value differentiation feature and others (achievements, leaderboard, social) plug into it.

---

## What You Get When This Is Done

A product that:
- **Doesn't leak API keys, can't be exploited via avatar uploads, has audited Firebase rules.** Stress-test-ready.
- **Has zero "Coming Soon" stubs.** Settings panel feels finished.
- **Per-set workout logging with PR detection, body measurement charts, progress photos.** Real fitness app DNA.
- **Friend system, shared challenges, share-to-social.** Viral loops. Retention compounds.
- **Seasonal rank system with progression that's separate from lifetime hunter rank.** The feature that makes users come back daily.
- **Real notifications, real reminders, real digest emails.** Re-engagement infrastructure.
- **Skeleton loaders, empty states with CTAs, pull-to-refresh.** Feels premium.
- **Tests covering core services and critical user flows.** Refactoring stops being scary.
- **Sentry tracking errors, analytics tracking behavior.** Data-driven product decisions.
- **Bahasa Indonesia + English with locale-aware date/number formatting.** International-ready.

That's the product. ~4-6 months of focused work to fully realize, but the leaner cut (Tiers 0-3) ships in 6-8 weeks and is already ahead of most "fitness app on App Store" baselines.

---

## How to use this document

- **Reference for prioritization decisions.** When unsure what to do next, scan the tiers and pick something at the active sprint level.
- **Source of execution prompts.** Each Tier item has enough detail that a fresh Claude Code session prompt can be drafted from it. Match style with `CLAUDE_NEXT_PHASES.md`.
- **Living doc.** Update as items ship. Add new findings as they surface. The 71-finding count is from one audit pass — real number grows over time.
- **Stakeholder communication.** If you ever need to explain "why this isn't done yet" to a co-founder, investor, or yourself, this is the answer.

Cross-reference: `CLAUDE.md` (project rules), `CLAUDE_NEXT_PHASES.md` (Phase B-E execution detail). This roadmap supersedes both for strategic prioritization.
