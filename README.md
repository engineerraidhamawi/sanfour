# سنفور (Sanfour): Arabic Reading-Fluency Platform

An Arabic, right-to-left web app that helps doctors, reading specialists and teachers assess and track reading fluency and comprehension for children aged 6–12 (Grades 1–6).

**🔗 Live app:** https://sanfour-ten.vercel.app

> Screening and progress tracking only. Not a medical or clinical diagnosis.

---

## Features

### Reading session
- 6 grades × 3 levels (دعم / ضمن الصف / تحدٍّ), with 18 built-in Arabic passages, each with 3 comprehension questions
- Untimed mode (default; the clock counts up) or a classic 1-minute timed mode
- Microphone recording of the reading (only with parental consent)
- Doctor scoring: tap the last word read and each misread word
- **WCPM** = (words read − errors) ÷ seconds × 60, plus accuracy %
- Encouraging, honest result headlines, and a warning for readings under 15 seconds

### 🤖 AI transcription assistant
- After a reading, the recording is sent to `/api/transcribe` (a Vercel serverless function) → **Groq Whisper `whisper-large-v3`** (Arabic, word-level timestamps)
- The transcript is aligned to the passage (Arabic-normalized edit-distance alignment) and **pre-marks**:
  - suspected substitutions and omissions (errors)
  - long pauses (more than 2 s before a word)
  - possible repetitions (inserted words)
- **The AI suggests and the doctor confirms.** Every mark can be edited before scoring.
- Known limits: the AI can "auto-correct" misreadings and often misses repetitions and prolongations.

### Comprehension
- Questions after each passage (multiple choice / true-false), tagged by skill: حرفي، استنتاجي، مفردات، ترتيب الأحداث، الفكرة الرئيسة، نقدي
- A per-skill breakdown, plus a fluency × comprehension interpretation

### Doctor tools
- **Add custom passages** with 4–6 skill-tagged questions
- **Student profiles:** WCPM and comprehension charts (right-to-left), per-skill totals, session history, and a level recommendation based on the last 3 sessions at the same level
- **Parent weekly report:** a shareable link (WhatsApp / copy) containing only a summary snapshot, viewable without login

### Security & admin
- Login screen (username + 4–6 digit PIN); the first account is the admin
- Admin: add or remove users, change roles (admin / doctor-teacher), reset PINs
- PIN lock on doctor pages (auto-unlocks for 10 minutes)
- Per-student **parental consent** for audio recording (saved, shown in the profile, can be withdrawn)
- **Backup & restore:** export and import all data as JSON

---

## Project structure

| File | Purpose |
|---|---|
| `index.html` | The whole front-end app (HTML + CSS + JS, no build step) |
| `passages.js` | The 18 built-in passages (`PASSAGES.push(...)`) |
| `api/transcribe.js` | Vercel serverless function that proxies audio to Groq Whisper |
| `C8qBMDOA.md` | Product blueprint (Arabic) |
| `1_6.md` | Source text of the leveled passages |
| `*design-pack*.pdf`, `*.jpg` | UI designs, logo and the Roo mascot |
| `.nojekyll` | Disables Jekyll on GitHub Pages |

## Deployment
- Hosted on **Vercel**, deployed automatically on every push to `main`.
- Environment variable: **`GROQ_API_KEY`** (set in Vercel → Settings → Environment Variables, then redeploy). **Never commit keys.**
- GitHub Pages also serves the front-end, but without AI and with separate data. Use the Vercel link.

## Data storage (current)
All data lives in the browser's **localStorage**, per device and per domain:

| Key | Contents |
|---|---|
| `sanfour_users` | Users `{u, pin, role}` |
| `sanfour_students` | Students `{id, name, consent}` |
| `sanfour_h` | Session history `{sid, ts, date, title, grade, level, wcpm, acc, comp, skills}` |
| `sanfour_custom` | Doctor-authored passages |
| `sanfour_pin`, `sanfour_cur`, `sanfour_timed` | Session settings |

## Known limitations
- No server database: data doesn't sync across devices, and clearing the browser deletes it (use Backup).
- PINs are stored unencrypted on the device. This is a convenience lock, not real security.
- The Groq free tier has rate limits.
- WCPM targets are **provisional** and need validation by Arabic reading specialists.
- The AI marks are suggestions; disfluency (stuttering) detection is not reliable yet.

## Roadmap (next for a developer)
1. **Real backend + auth** (e.g. Supabase/Firebase): synced data, per-doctor students, hashed credentials, encryption
2. **Improved disfluency detection:** a specialized model for repetitions, prolongations and blocks
3. **Error-type analysis** for Arabic: diacritics, similar letters, hamza/ة, long vowels, sun/moon لام
4. **Specialist validation** of passages, tashkeel, questions and benchmarks
5. **Privacy compliance** with child-data laws in each target country, a data-processing agreement with the speech provider, and a retention policy

## Privacy
- Parental consent is required before recording.
- Audio is sent to the speech provider only when the AI button is used, and is not stored in the app after the session.
- The parent report link contains only a summary snapshot.
