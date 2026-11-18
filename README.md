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
- Attempts shorter than 15 seconds are saved as practice estimates and excluded from speed charts and level recommendations.
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
- **Specialist-scored comprehension assessment:** a grade-specific rubric for the 12 skills in five domains, with editable score descriptions, enabled skills, and 1–5 weights; defaults to a 0–2 scale and equal weights
- Unassessed skills are excluded from the weighted calculation; the app shows the arithmetic result without pass bands, diagnoses, or automatic placement decisions
- Each saved assessment keeps a snapshot of its rubric version so later specialist changes do not rewrite historical scores

### Doctor tools
- **Add custom passages** with 4–6 skill-tagged questions
- **Student profiles:** WCPM and comprehension charts (right-to-left), per-skill totals, session history, and a level recommendation based on the last 3 sessions at the same level
- **Parent weekly report:** a preview-first, revocable link (WhatsApp / copy) containing only a summary snapshot; expires after 7 days

### Security & admin
- Login screen (username + 4–6 digit PIN); the first account is the admin
- Admin: add or remove users, change roles (admin / doctor-teacher), reset PINs
- PIN lock on doctor pages (auto-unlocks for 10 minutes)
- Per-student **parental consent** for audio recording (saved, shown in the profile, can be withdrawn)
- **Backup & restore:** export and import student and session data as JSON; local login PINs are excluded, so create a new local login after restoring

---

## Project structure

| File | Purpose |
|---|---|
| `index.html` | The whole front-end app (HTML + CSS + JS, no build step) |
| `passages.js` | The 18 built-in passages (`PASSAGES.push(...)`) |
| `api/transcribe.js` | Vercel serverless function that proxies audio to Groq Whisper |
| `api/parent.js` | Creates, reads, and revokes seven-day parent report links |
| `api/cloud.js` | Clinic sync and membership API; filters local PIN records on both read and write |
| `C8qBMDOA.md` | Product blueprint (Arabic) |
| `1_6.md` | Source text of the leveled passages |
| `*design-pack*.pdf`, `*.jpg` | UI designs, logo and the Sanfour mascot |
| `.nojekyll` | Disables Jekyll on GitHub Pages |

## Deployment
- Hosted on **Vercel**, deployed automatically on every push to `main`.
- Environment variable: **`GROQ_API_KEY`** (set in Vercel → Settings → Environment Variables, then redeploy). **Never commit keys.**
- GitHub Pages also serves the front-end, but without AI and with separate data. Use the Vercel link.

## Data storage (current)
Student and session data live in browser **localStorage**, per device and per domain. If clinic sync is enabled, those records are also stored in the clinic's cloud account:

| Key | Contents |
|---|---|
| `sanfour_users` | Local convenience accounts `{u, pin, role}`; never included in clinic sync or backups |
| `sanfour_students` | Students `{id, name, consent}` |
| `sanfour_h` | Session history `{sid, ts, date, title, grade, level, wcpm, acc, comp, skills}` |
| `sanfour_custom` | Doctor-authored passages |
| `sanfour_rubrics` | Per-grade specialist rubric versions and score descriptions |
| `sanfour_assessments` | Specialist-entered skill scores, evidence notes, and the rubric snapshot used |
| `sanfour_pin` | Local doctor-page convenience lock; never included in clinic sync or backups |
| `sanfour_cur`, `sanfour_timed` | Session settings |

## Known limitations
- Clearing browser storage deletes local data (use Backup). Clinic sync stores student and session data until the clinic deletes it.
- Local PINs are stored unencrypted on the device. They are convenience locks, not real security; protect shared devices with their operating-system account lock.
- JSON backups contain student names, consent records, and session results. Store them securely and delete old copies when they are no longer needed.
- Specialist assessments and rubric versions sync with clinic data and are included in backups. Assessment evidence notes may contain child information; keep them brief and appropriate for the current clinic access model.
- The Groq free tier has rate limits.
- WCPM targets are **provisional** and need validation by Arabic reading specialists.
- The AI marks are suggestions; disfluency (stuttering) detection is not reliable yet.

## Roadmap (next for a developer)
1. **Stronger access controls**: clinician access is still gated locally in the app; use clinic identity and server-enforced roles for student records, then add per-doctor scopes and a retention workflow
2. **Improved disfluency detection:** a specialized model for repetitions, prolongations and blocks
3. **Error-type analysis** for Arabic: diacritics, similar letters, hamza/ة, long vowels, sun/moon لام
4. **Specialist validation** of passages, tashkeel, questions and benchmarks
5. **Privacy compliance** with child-data laws in each target country, a data-processing agreement with the speech provider, and a retention policy

## Privacy
- Parental consent is required before recording.
- Audio is sent to the speech provider only when the AI button is used, and is not stored in the app after the session.
- Parent report links contain only a previewed summary, expire after 7 days, and can be revoked by the clinic.
- Parent report links created before the expiring-link update no longer open.
- Clinic sync removes local user PIN records from existing cloud snapshots on the next authorized pull; server-side filtering also prevents older app versions from uploading them again.
