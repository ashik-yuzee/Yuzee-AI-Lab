# Document 01 — JSON to UI: How AI Responses Are Rendered

## The Protocol v1.3 Response Format

Every AI (Gemini) response is a structured JSON object. When the server streams back a response, the client attempts to parse it. If valid, it renders using `ProtocolV13Renderer`; otherwise it falls back to Markdown.

### Top-Level JSON Shape

```json
{
  "response_context": {
    "oala_model": "oala-career-v1.3",
    "response_type": "career_guidance",
    "response_confidence": 0.95
  },
  "frontend": {
    "bridge_message": "Optional intro sentence shown before the structured content",
    "output_sections": [
      {
        "section_id": "s1",
        "type": "cards",
        "title": "Section heading",
        "items": [ ... ]
      }
    ],
    "interaction": {
      "type": "single_choice",
      "question": "Which option suits you?",
      "options": [ ... ],
      "fields": [ ... ]
    },
    "recommended_actions": [ ... ],
    "service_actions": [ ... ]
  }
}
```

---

## Parsing Flow (Client Side)

```
Server streams JSON text
        │
        ▼
 TokenLabContext.tsx receives stream chunks
        │
        ▼
 Attempt JSON.parse() on accumulated content
        │
  ┌─────┴──────┐
  │ Valid JSON  │  Invalid / partial
  └─────┬──────┘       │
        │              ▼
        │         Show Markdown fallback
        ▼             (react-markdown + remarkGfm)
 Run schema validation
        │
  ┌─────┴──────┐
  │ schemaValid │  semanticValid
  │ = true      │  = true
  └─────┬──────┘
        │
        ▼
 ProtocolV13Renderer renders structured blocks
```

### Key Logic in ChatArea.tsx

```typescript
// Attempt to extract a valid structured response
const parseStructuredResponse = (msg: ChatMessage): YuzeeResponseV13 | null => {
  if (msg.streamStopped || (msg.isStreaming && !msg.structuredResponse)) return null;
  if (msg.error || msg.schemaValid === false || msg.semanticValid === false) return null;
  return acceptedResponse(msg.structuredResponse || msg.content);
};
```

`acceptedResponse()` tries JSON.parse, validates top-level shape, and returns the typed object or null.

---

## Output Block Types

The `frontend.output_sections` array contains blocks of different `type` values. Each is rendered differently:

| type | Rendered As | Visual Style |
|------|-------------|--------------|
| `text` | Markdown prose | Plain text, 16px, line-height 1.7 |
| `heading` | Section heading | Bold, bottom border gradient |
| `cards` | Card list (GuidanceList) | Bordered cards, optional status pills |
| `timeline` | Vertical timeline | Step circles + connecting line |
| `flow` | Sequential steps | Numbered flow diagram |
| `pathway_map` | Course table | Rows with AQF colour codes |
| `scorecard` | Score grid | Auto-fit columns |
| `progress` | Progress indicators | Stacked bars |
| `callout` | Callout box | Inset left border, tinted background |
| `table` | Data table | Responsive, stacks on mobile |

### Block Rendering in ProtocolV13Renderer

Each `output_sections[n]` is rendered in sequence:

```typescript
// For each section in data.frontend.output_sections:
switch (section.type) {
  case 'text':
    return <Markdown>{section.content}</Markdown>
  case 'heading':
    return <h2 data-output-type="heading">{section.title}</h2>
  case 'cards':
    return <GuidanceList items={section.items} />
  case 'timeline':
    return <GuidanceList items={section.items} ordered={true} />
  case 'callout':
    return <div data-output-type="callout" data-output-variant={section.variant}>...</div>
  case 'table':
    return <div className="response-table-scroll"><table>...</table></div>
}
```

---

## GuidanceList Component (Unordered Cards vs Ordered Timeline)

This is the most reused rendering component. It renders `items` as either:

### Unordered Card List (`type: "cards"`)

```html
<ul class="guidance-rows">
  <li class="guidance-row" data-learning-tone="level6">
    <div class="guidance-row-content">
      <div class="guidance-row-header">
        <span class="guidance-row-title">Graduate Certificate in Health Informatics</span>
        <span class="guidance-status">Level 8</span>      <!-- optional pill -->
      </div>
      <p class="guidance-description">Offered by UTS and Monash...</p>
      <span class="guidance-side-label">12 months · ~$15,000</span>
    </div>
  </li>
</ul>
```

**Visual:** White cards, 1px `#e0e6ef` border, 10px border-radius. On hover: border darkens to `#acbdd4`, subtle box-shadow.

### Ordered Timeline (`type: "timeline"`)

```html
<ol class="guidance-rows guidance-rows-ordered">
  <!-- Backbone line runs left side via ::before pseudo -->
  <li class="guidance-row">
    <!-- Step circle number comes from CSS counter ::before -->
    <div class="guidance-row-content">
      <div class="guidance-row-title">Step 1: Complete online triage</div>
      <p class="guidance-description">...</p>
    </div>
  </li>
</ol>
```

**Visual:** Left vertical line (gradient from accent to grey). Each step has a numbered circle (`26×26px`, gradient `#7244c6 → #a78bfa`, white text). The step content sits in a card to the right.

---

## Learning Tone Colour System (`data-learning-tone`)

Course/qualification items are tagged with an AQF (Australian Qualifications Framework) level. This drives the entire colour theme of that card:

| `data-learning-tone` | Ink Colour | Background | Edge/Border |
|---------------------|------------|------------|-------------|
| `level1` | `#166534` (green) | `#f0fdf4` | `#86efac` |
| `level2` | `#155e75` (cyan-dark) | `#ecfeff` | `#67e8f9` |
| `level3` / `unit` | `#0e7490` | `#e0f7fa` | `#38bdf8` |
| `level4` | `#1d4ed8` (blue) | `#eff6ff` | `#93c5fd` |
| `level5` | `#4338ca` (indigo) | `#eef2ff` | `#a5b4fc` |
| `level6` | `#6d28d9` (violet) | `#f5f3ff` | `#c4b5fd` |
| `level7` | `#7e22ce` (purple) | `#faf5ff` | `#d8b4fe` |
| `level8` / `crosslevel` | `#86198f` (fuchsia) | `#fdf4ff` | `#e879f9` |
| `level9` | `#9d174d` (pink) | `#fdf2f8` | `#f9a8d4` |
| `level10` | `#991b1b` (red) | `#fff1f2` | `#fca5a5` |
| `micro` | `#92400e` (amber) | `#fffbeb` | `#fcd34d` |
| `short` | `#3f3f46` (zinc) | `#fafafa` | `#a1a1aa` |
| `industry` | `#1e3a5f` (navy) | `#f0f4ff` | `#93b4e0` |
| `route` | `#374151` (grey) | `#f9fafb` | `#9ca3af` |

Applied via CSS variables on the element:
```css
[data-learning-tone="level6"] {
  --course-ink:  #6d28d9;
  --course-bg:   #f5f3ff;
  --course-edge: #c4b5fd;
}
```

---

## Interactive Components

### Inline Question Form (ProtocolInteraction)

When the JSON includes `frontend.interaction`, the renderer shows a question card after the content:

```json
{
  "type": "short_text",
  "question": "Are you looking to transition into an entry-level role?",
  "hint": "A short answer is fine. You can also say \"I'm not sure\".",
  "field_id": "transition_intent"
}
```

Rendered as:
```html
<form class="main-chat-question">
  <div class="main-chat-question-kicker">
    <!-- Icon + "Your next step" label -->
  </div>
  <p class="main-chat-question-title">Are you looking to transition...</p>
  <p class="main-chat-question-hint">A short answer is fine...</p>
  <div class="main-chat-question-footer">
    <span>You can change direction at any time.</span>
    <button type="submit">Continue →</button>
  </div>
</form>
```

**Visual:** White card, 1px `#e0e6ef` border, `border-radius: 15px`, `background: #fafbfe`.

### Multiple-Choice Form

```json
{
  "type": "single_choice",
  "question": "Which area interests you most?",
  "options": [
    { "id": "opt1", "label": "System implementation", "description": "..." },
    { "id": "opt2", "label": "Clinical informatics", "description": "..." }
  ]
}
```

```html
<fieldset class="main-chat-choices">
  <div class="main-chat-choice">
    <input type="radio" name="q" value="opt1">
    <span class="main-chat-choice-copy">
      <strong>System implementation</strong>
      <span>Work on EHR rollouts...</span>
    </span>
  </div>
</fieldset>
```

Selected state: `border-color: var(--accent)`, `background: var(--accent-8)`, `box-shadow: 0 0 0 1px var(--accent-border)`.

---

## Fallback: Markdown Rendering

When the response is not valid Protocol v1.3 JSON, it falls back to `react-markdown`:

```html
<div class="prose prose-slate max-w-none text-[16px] leading-[1.7]
            prose-p:text-[#0d0d0d] prose-p:my-3
            prose-code:bg-[#f4f4f4] prose-code:text-[#c7254e]
            prose-pre:bg-[#1e1e1e] prose-pre:text-[#d4d4d4]">
  <!-- Rendered markdown HTML here -->
</div>
```

**In Angular/Bootstrap:** Use `[innerHTML]` with a markdown pipe (ngx-markdown), styled with equivalent prose classes.

---

## Streaming State

While the AI is generating a response, `msg.isStreaming = true`. The renderer shows:

```html
<div class="main-chat-progress">
  <div class="main-chat-progress-icon">
    <!-- Animated icon, breathing pulse -->
  </div>
  <div class="main-chat-progress-copy">
    <strong>Preparing your answer</strong>
    <p>Analysing your background and goals…</p>
  </div>
  <button>Stop</button>
</div>
```

**Animation:** `@keyframes chat-breathe { 50% { opacity: 0.5 } }` at 2.8s infinite.

---

## Telemetry Footer

After each completed assistant message, a compact telemetry footer shows token usage:

```html
<div class="border-t border-[#f0f0f0] flex items-center gap-2 text-[11px] text-slate-400">
  <!-- Model chip -->
  <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border bg-violet-50 text-violet-700">
    [CPU icon] 3.7 Flash
  </span>
  <!-- Thinking level chip (if used) -->
  <span class="bg-[--accent-8] text-[--accent] border-[--accent-border]">
    medium
  </span>
  <!-- Latency -->
  <span class="font-mono">12.4s</span>
  <!-- Clickable token breakdown button -->
  <button class="font-mono bg-[#f4f4f4] border rounded">
    ⚡ 40,485 cached · In 3,847 new · Out 2,004 · Think 844 · 6,695 · ~$0.00254
  </button>
  <!-- Action icons: raw JSON toggle, read aloud, copy -->
</div>
```

**Model chip colours:**
- Flash Lite: `bg-amber-50 border-amber-200 text-amber-800`
- Standard/2.x: `bg-slate-100 border-slate-200 text-slate-600`
- Default (other): `bg-violet-50 border-violet-200 text-violet-700`

**Cache indicator:** ⚡ emoji + green `text-emerald-600` for cost.
