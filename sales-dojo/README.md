# Sales Dojo 🥋

Learn sales fast: structured lessons, quizzes, spaced-repetition flashcards,
and an AI-powered roleplay simulator covering:

- **Prospecting & Cold Outreach**
- **Pitching & Negotiation**
- **Objection Handling**
- **Closing & Follow-up**

This is a standalone web app (Vite + React) and is fully independent from the
rest of this repository.

## Features

- **Lessons** — bite-sized, practical lessons for each module with key
  takeaways and tips.
- **Quizzes** — 5-question quiz per module with instant feedback and
  explanations.
- **Flashcards** — Leitner-system spaced repetition across 24 cards covering
  all four modules.
- **AI Roleplay** — practice real conversations against an AI playing a
  prospect (cold call, discovery, objection handling, closing). After each
  session, get structured coaching feedback.
- **Progress tracking** — all progress is stored locally in your browser
  (localStorage). No account or server required.

## AI Roleplay setup

The AI roleplay simulator calls the Anthropic API directly from your browser
using your own API key.

1. Get an API key from [console.anthropic.com](https://console.anthropic.com/settings/keys).
2. Open the app, go to **Settings**, paste your key, and click **Save** (or
   **Test Connection** to verify it works).
3. Your key is stored only in your browser's localStorage — it is sent
   directly to Anthropic and nowhere else.

Everything else (lessons, quizzes, flashcards) works without an API key.

## Running the app

### Option 1: GitHub Codespaces (recommended if you can't install Node locally)

1. Open this repository on GitHub and click **Code → Codespaces → Create
   codespace on this branch**.
2. Once the Codespace loads, open a terminal and run:
   ```bash
   cd sales-dojo
   npm install
   npm run dev
   ```
3. Codespaces will detect the Vite dev server on port `5173` and show a
   "Open in Browser" notification — click it (or open the **Ports** tab and
   open port 5173). That gives you a public preview URL you can use from any
   device, including your phone.

### Option 2: Locally

Requires [Node.js](https://nodejs.org/) 18+.

```bash
cd sales-dojo
npm install
npm run dev
```

Then open the printed local URL (default `http://localhost:5173`).

## Tech stack

- [Vite](https://vitejs.dev/) + [React](https://react.dev/)
- [react-router-dom](https://reactrouter.com/) for routing
- [@anthropic-ai/sdk](https://github.com/anthropics/anthropic-sdk-typescript) for the AI roleplay simulator
- Plain CSS (no UI framework) — see `src/index.css`
