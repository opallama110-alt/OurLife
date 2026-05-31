# OurLife — Claude Code Auto-Load Pointer

> File ini di-auto-load oleh Claude Code setiap sesi. Sengaja dibuat slim biar gak ngabisin context budget. Konteks lengkap (identitas proyek, state, arsitektur, roadmap, konvensi, eksekusi fase, pola kerja) ada di **`PROMPT_CLAUDE_CODE.md`**. Snapshot keputusan & state terakhir ada di **`HANDOFF.md`**.

## Aksi yang HARUS Claude lakukan saat sesi baru

1. **Baca `D:\OurLife\HANDOFF.md`** dulu — itu paling baru, berisi keputusan + state snapshot dari sesi sebelumnya yang mungkin belum sepenuhnya tercermin di master prompt.
2. **Baca `D:\OurLife\PROMPT_CLAUDE_CODE.md`** — master prompt + project bible (full architecture, roadmap, conventions).
3. **Verifikasi file management** — pastikan cuma 4 `.md` di project root: `PROMPT_CLAUDE_CODE.md`, `CLAUDE.md` (file ini), `HANDOFF.md`, `README.md`. Semua source frontend ada di bawah `src/` (Fase 2 refactor); `firebase-config.js`, `index.html`, config build, dan `functions/` tetap di root. Kalau ada `CLAUDE_NEXT_PHASES.md` atau `COMMERCIAL_ROADMAP.md`, mereka stale dari konsolidasi sebelumnya — surface to user dengan cleanup command dari §12.3 master prompt.
4. **Konfirmasi paham + tanya 2-3 klarifikasi** sebelum tulis kode apa pun.

## Rules cepat (override default behavior)

- **Tech stack:** React 18 + Vite + TypeScript + Tailwind, Firebase (Auth + Firestore + RTDB), Groq AI. **No SvelteKit syntax. No Next.js syntax.**
- **State:** `src/services/storageService.ts` adalah single source of truth. **No new state libraries** (Redux/Zustand/Recoil) tanpa diskusi.
- **Animasi:** Di `src/index.css`. camelCase keyframe + kebab-case utility class. **No `tailwind.config.js` extends.** **No `<style jsx>` (Next.js).**
- **CSS 3D:** Element dengan `transform-style: preserve-3d` (mis. flip cards) — **JANGAN** pakai `filter` (drop-shadow) atau `mix-blend-mode` di element itu atau parent-nya (flattens 3D context).
- **Eksekusi:** Satu fitur sampai sempurna. Pause after each commit. Audit before edit. Build green sebelum commit.
- **Bahasa:** Copy untuk user (toast, modal, button) = Bahasa Indonesia. Code, comments, logs = English.
- **Security policy:** `src/services/aiService.ts` uses **direct Groq SDK call** dengan `dangerouslyAllowBrowser: true` (`VITE_GROQ_API_KEY` bundled to client). Trade-off accepted by user untuk personal-use PWA + Groq free tier. **Tier 0.1 server-side migration DEFERRED to Tier 6** (future multi-user scenario). **JANGAN refactor balik ke Cloud Function tanpa explicit user OK.** Untuk SECRET LAIN (Firebase admin keys, third-party paid APIs, dll) — jangan introduce hardcoded keys.

## Quick reference

- Proyek: OurLife (gamified fitness + habit tracker)
- Theme: Solo Leveling × Duolingo
- Branch aktif: cek `git branch --show-current`
- Build: `npm run build` (harus green sebelum commit)
- Tier prioritas (post-Groq-deferral): 0 (security minus Groq item) → 1 (quick wins) → 2 (coming soon stubs) → 3 (feature complete) → 4 (polish) → 5 (differentiation) → 6 (epics including Groq migration when multi-user)

**Detail penuh: `PROMPT_CLAUDE_CODE.md`. State snapshot terakhir: `HANDOFF.md`.**
