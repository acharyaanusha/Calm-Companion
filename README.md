# Calm Companion

A conversational app for when you're stressed, anxious, or spiraling. Talk through what you're feeling with an AI that listens first and guides you back to steady ground.

## What it does

- **Conversation partner** — Claude listens without rushing to fix things. It asks grounding questions: *What are you feeling? What led to this? Does this truly end your chances?*
- **Breathing guide** — An interactive orb walks you through box breathing (4-4-6-2) to stop hyperventilating
- **Calming design** — Deep blues and slow aurora animations backed by research on cortisol reduction and parasympathetic response
- **Voice input** — Tap the mic to speak instead of type

## Stack

- React + TypeScript (Vite)
- Express backend with streaming via Server-Sent Events
- Anthropic SDK (`claude-opus-4-6`)

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Add your Anthropic API key to `.env`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```

3. Run both the API server and frontend together:
   ```bash
   npm run dev
   ```

   Opens at `http://localhost:5173`. The API runs on port 3001.
