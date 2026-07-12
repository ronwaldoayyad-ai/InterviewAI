# InterviewAI 🎙️

AI-native mobile app for interview preparation, built with React Native (Expo). Practice mock interviews tailored to your goals, job descriptions, or resume, and get granular AI feedback — strengths, improvements, pacing, and STAR-method scoring.

Built from the InterviewAI PRD/TDD using the **"Cognitive Clarity"** design system (Inter typography, `#3f51b5` primary, 8/16/24px spacing).

## Features

- **Auth & onboarding** — Google / Apple / LinkedIn (mock OAuth) + email, multi-step password recovery, 4-step onboarding capturing roles, industries, and experience.
- **Personalized interview engine** — paste a job description, attach a resume (PDF/DOCX), drop a LinkedIn URL, or use general practice; the engine generates a behavioral or technical question set (mocked locally, < 5s).
- **Hardware check** — pre-session network latency ping, microphone permission + live waveform, front-camera preview.
- **Live session** — question cards, real audio recording (expo-audio), REC timer, animated waveform, haptic feedback.
- **Performance review** — session summary (Communication / Technical depth / Clarity), per-answer playback, AI transcript, strengths, improvements, pacing, and STAR breakdown.
- **Dashboard & progress** — animated Interview Readiness ring, AI Coach tips, industry trends, session history.

## Running it

```bash
npm install
npx expo start
```

Then scan the QR code with **Expo Go** (iOS/Android), or press `w` for the web preview.

> Camera and microphone need a real device — the web preview skips the native media pipeline.

## Architecture

```
src/
  theme.js            # Cognitive Clarity design tokens
  data/mockAI.js      # Mock LLM/STT engine — swap for real backend calls
  state/AppContext.js # Auth, onboarding, sessions, readiness score
  components/         # PrimaryButton, ProgressRing, Waveform, ScoreBar, …
  navigation/         # Welcome stack → Onboarding → Main tabs (+ session stack)
  screens/            # 13 screens: auth, onboarding, dashboard, practice,
                      # hardware check, session, summary, review, progress, profile
```

The AI layer (`src/data/mockAI.js`) is intentionally isolated: `generateQuestions`, `analyzeAnswer`, and `summarizeSession` mirror the backend contract from the TDD (LLM question generation, Whisper STT, LLM critique) so they can be swapped for real API calls without touching the UI.

## Stack

Expo SDK 57 · React Native 0.86 · React Navigation 7 · expo-audio · expo-camera · react-native-svg · @expo-google-fonts/inter
