# Start here - Yuzee project handover

This is the current local source snapshot from 16 September 2026, including changes not yet in the GitHub baseline. The authoritative handover is `HANDOVER/AI_HANDOVER.md`; the PDF is `HANDOVER/Yuzee-Project-Handover.pdf`.

## Give these to your AI

1. Read `HANDOVER/AI_HANDOVER.md` for implementation, limits and acceptance criteria.
2. Inspect `HANDOVER/SNAPSHOT.json`, `HANDOVER/VALIDATION.json` and `HANDOVER/PACKAGE-CHECKS.json`.
3. Review the current examples at `output/html/Yuzee-Tool-Review-Validation.html` and all 103 tool changes at `output/html/Yuzee-103-Tool-Logic-Review.html`.
4. Run setup and tests before editing. Older reports are historical; current v4 flexible counselling guidance supersedes earlier fixed-section rules.

## Run locally

From this directory: `npm ci`, then copy `.env.example` to `.env` and enter your own Gemini key and admin/auth values. Leave DATABASE_URL blank unless you intend to use PostgreSQL. Run `npm run dev`; open http://localhost:3000/.

No API key, chat history, dependencies or build output is included. Node 26.0.0/npm 11.12.1 were used for the fresh source checks. See the AI handover for the tokenizer cache prerequisite and optional separate concept. Keep the sibling `outputs` folder if regenerating the current before/after gallery.

## What is connected

The main Quiz chat uses improved counselling instructions. MiniLM selects one optional skill for explicit current @Oala messages when ready/confident; it does not monitor every Quiz answer. Gemini generates the final answer. Explore more has a separate evidence-research workflow. Automatic conversation-wide skill recommendation and general 103-tool execution remain future work.
