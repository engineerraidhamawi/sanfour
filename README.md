# سنفور (Sanfour): Arabic Reading-Fluency Platform

An Arabic, right-to-left web/mobile app for children aged 6–12 (Grades 1–6) who have reading difficulties. The child reads a passage aloud, and the app measures **words correct per minute (WCPM)**, accuracy, Arabic-specific reading errors, possible stuttering signs and **comprehension**, then reports the results to the doctor/teacher and to parents.

> Screening and progress tracking only. Not a medical or clinical diagnosis.

## What's in this repo

| File | What it is |
|---|---|
| `C8qBMDOA.md` | **Product blueprint (Arabic)**: the main spec. Word-counting rules, error types, stuttering markers, benchmarks, level logic, reports, doctor passage authoring, comprehension analysis, privacy. |
| `1_6.md` | 18 original Arabic passages (Grades 1–6 × Levels 1–3) with tashkeel, word counts and questions |
| `Ew1G1UI8.md` | Sample Grade 5 passage with 5 comprehension questions |
| `001_sanfour-design-pack…pdf` | **All final screen designs in one PDF** |
| `*_Sanfour_*.jpg` | Individual designs: logo, style board, student, doctor and parent screens |

## Users
- **Student:** reads passages, answers questions and sees encouraging results from Roo, the mascot.
- **Doctor/teacher:** adds her own passages with 4–6 tagged questions, assigns them and views reports.
- **Parent:** sees a weekly summary and gives consent for recording.

## Core features to build
1. Arabic RTL interface (mirrored layout, Eastern Arabic numerals), following the design PDF.
2. Grade/level structure: 6 grades × 3 levels, with automatic level up/down.
3. Read-aloud recording, with a 60-second timer and microphone capture.
4. **Speech analysis pipeline:**
   - Arabic speech-to-text with **word-level timestamps**
   - Alignment of the transcript against the passage text
   - WCPM, accuracy, and errors (substitution, omission, insertion, diacritics, similar letters)
   - Disfluency detection: repetitions, prolongations, blocks, pauses longer than 2 seconds
5. Comprehension questions (multiple choice, true/false, ordering, short spoken answers), scored by skill.
6. Doctor passage editor with auto-tashkeel, word count and AI-suggested questions.
7. Reports and dashboards for the doctor and parents.

## Brand
Colors: `#FFC93C` `#1FA6A0` `#FF7A59` `#2D3A4A` `#FFF8EC`. Use a rounded Arabic font (Tajawal or Cairo). The mascot is **Roo**, a kangaroo with teal glasses.

## Requirements
- Parental consent before any recording. Encrypt recordings and delete them after 90 days.
- Comply with children's data-protection laws in each target country.
- WCPM targets are **provisional** and must be validated by Arabic reading specialists.

## Status
Design and content stage. Next step: a working prototype (MVP).
