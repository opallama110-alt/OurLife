# OurLife — Claude Code Auto-Load Pointer

> File ini di-auto-load oleh Claude Code setiap sesi. Sengaja dibuat slim biar gak ngabisin context budget. Konteks lengkap (identitas proyek, state, arsitektur, roadmap, konvensi, eksekusi fase, pola kerja) ada di **`PROMPT_CLAUDE_CODE.md`**.

## Aksi yang HARUS Claude lakukan saat sesi baru

1. **Baca `D:\OurLife\PROMPT_CLAUDE_CODE.md`** — itu master prompt + project bible.
2. **Verifikasi file management** — pastikan cuma 3 `.md` di project root: `PROMPT_CLAUDE_CODE.md`, `CLAUDE.md` (file ini), `README.md`. Kalau ada `CLAUDE_NEXT_PHASES.md` atau `COMMERCIAL_ROADMAP.md`, mereka stale dari konsolidasi sebelumnya — surface to user dengan cleanup command dari Section 12.3 di master prompt.
3. **Konfirmasi paham + tanya 2-3 klarifikasi** sebelum tulis kode apa pun.

## Rules cepat (override default behavior)

- **Tech stack:** React 18 + Vite + TypeScript + Tailwind, Firebase (Auth + Firestore + RTDB), Groq AI. **No SvelteKit syntax. No Next.js syntax.**
- **State:** `services/storageService.ts` adalah single source of truth. **No new state libraries** (Redux/Zustand/Recoil) tanpa diskusi.
- **Animasi:** Di `index.css`. camelCase keyframe + kebab-case utility class. **No `tailwind.config.js` extends.** **No `<style jsx>` (Next.js).**
- **CSS 3D:** Element dengan `transform-style: preserve-3d` (mis. flip cards) — **JANGAN** pakai `filter` (drop-shadow) atau `mix-blend-mode` di element itu atau parent-nya (flattens 3D context).
- **Eksekusi:** Satu fitur sampai sempurna. Pause after each commit. Audit before edit. Build green sebelum commit.
- **Bahasa:** Copy untuk user (toast, modal, button) = Bahasa Indonesia. Code, comments, logs = English.
- **Security:** Jangan introduce hardcoded API keys atau `dangerouslyAllowBrowser` baru. Existing `aiService.ts` exposure adalah Tier 0.1 task di roadmap.

## Quick reference

- Proyek: OurLife (gamified fitness + habit tracker)
- Theme: Solo Leveling × Duolingo
- Branch aktif: cek `git branch --show-current`
- Build: `npm run build` (harus green sebelum commit)
- Tier prioritas: 0 (security) → 1 (quick wins) → 2 (coming soon stubs) → 3 (feature complete) → 4 (polish) → 5 (differentiation) → 6 (epics)

**Detail penuh: `PROMPT_CLAUDE_CODE.md`.**
