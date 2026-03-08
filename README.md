# Axon Insurance — AI Agent System

A graph-based AI insurance cross-sell prototype powered by Claude (Anthropic).

## Architecture
- **5-gate pipeline**: SSN fraud detection → Accident history → Life boost → Risk scoring → Cross-sell routing
- **6 specialist agents**: Orchestrator, Intent, Car Insurance, Risk Profiler, Life Insurance, Credit Card
- **CAG layer**: Cache-Augmented Generation — all enrichment data assembled once per session

## Stack
- React + Vite (frontend)
- Vercel Edge Functions (API proxy)
- Anthropic Claude claude-sonnet-4-20250514

## Setup

### Local development
```bash
npm install
# Create .env.local with:
# ANTHROPIC_API_KEY=your_key_here
npm run dev
```

### Deploy to Vercel
1. Connect this repo in Vercel dashboard
2. Add `ANTHROPIC_API_KEY` environment variable
3. Deploy — done
