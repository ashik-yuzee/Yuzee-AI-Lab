# Document 03 — Mini Pathway Panel

## What It Is

The Mini Pathway panel is a **right-side drawer** that appears when Oala detects that the user's conversation contains career pathway content relevant enough to generate a structured "mini pathway" report.

- It is separate from the main conversation
- It streams a structured Gemini-generated report into the panel
- It stores all generated pathways per conversation (history selector)
- It can expand to full-screen
- It has a drag-to-resize handle

---

## How It Is Triggered

### Step-by-Step Flow

```
1. User sends a message about career planning
2. Oala responds with a Protocol v1.3 structured response (JSON)
3. MiniPathwayExperience runs reviewMiniPathway() (MiniLM semantic similarity)
4. If pathway relevance score >= 0.42 with margin >= 0.06:
   → Inject "Open your mini pathway" button into #mini-pathway-offer portal
5. User clicks the offer button
6. Panel opens: isMiniPathwayOpen = true
7. POST /api/conversations/:id/mini-pathway (with sourceMessageId, hint, location)
8. Server streams structured JSON blocks via SSE
9. Panel renders streaming blocks in real time (MiniPathwayStreaming)
10. On completion: pathway saved, history updated
```

### Decision Logic
- If a saved pathway already exists for this message → show "Open" button directly
- If score < 0.42 or margin < 0.06 → button does not appear
- In low-engagement episodes (few messages) → offer suppressed

---

## Panel Anatomy

```
┌────────────────────────────────────────────┐
│  2px gradient top border (accent → violet → fuchsia)
├──────────────────────────────────────────────
│  RESIZE HANDLE (left edge, col-resize cursor)
├──────────────────────────────────────────────
│  HEADER                              [Expand] [X]
│  [Map icon]  Mini pathway
├──────────────────────────────────────────────
│  HISTORY SELECTOR
│  SAVED PATHWAYS  1
│  ┌─────────────────────────────────────────┐
│  │ Pathway 1 · 18 Sept 2026, 5:02 pm  [▾] │
│  │ [Location: Sydney...] SUPPLE...         │
│  └─────────────────────────────────────────┘
├──────────────────────────────────────────────
│  BODY (overflow-y: auto)
│  ┌─ COURSE COLOURS AND LEVELS (collapsible) ─┐
│  └──────────────────────────────────────────┘
│  ┌─ IN THIS ANSWER (collapsible) ────────────┐
│  └──────────────────────────────────────────┘
│  [Pathway report content — ProtocolV13Renderer]
│  [Caption/disclaimer at bottom]
├── Bottom fade gradient overlay ─────────────┤
└──────────────────────────────────────────────┘
```

---

## Panel Dimensions & Position

```css
.mini-pathway-panel {
  position: relative;
  width: 440px;         /* default width */
  flex-shrink: 0;       /* won't compress when chat area is squeezed */
  background: #fff;
  border-left: 1px solid #e0e6ef;
  display: flex;
  flex-direction: column;
  min-height: 0;
  z-index: 35;
  box-shadow: -4px 0 20px rgba(0,0,0,.08);
}

/* At >= 1600px wide screens */
@media (min-width: 1600px) {
  .mini-pathway-panel { width: 490px; }
}

/* At < 1200px — overlays the chat (absolute positioning) */
@media (max-width: 1199px) {
  .mini-pathway-panel {
    position: absolute;
    right: 0; top: 0; bottom: 0;
    width: min(480px, 100%);
    box-shadow: -6px 0 24px rgba(0,0,0,.1);
  }
}

/* Mobile — full width */
@media (max-width: 600px) {
  /* width is already 100% via min(480px, 100%) */
}
```

---

## Gradient Top Border

```css
.mini-pathway-panel::before {
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  z-index: 1;
  background: linear-gradient(90deg, #7244c6 0%, #a78bfa 55%, #e879f9 100%);
}
```

---

## Bottom Fade

```css
.mini-pathway-panel::after {
  content: "";
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 48px;
  background: linear-gradient(to top, #fff 30%, rgba(255,255,255,0) 100%);
  pointer-events: none;
  z-index: 6;
}
/* Hidden when expanded to full screen */
.mini-pathway-panel--expanded::after { display: none; }
```

---

## Header

```html
<header class="mini-pathway-panel > header">
  <!-- Left: icon + title -->
  <div class="mini-pathway-heading">
    <span class="mini-pathway-heading-icon">
      [Map icon 23px]
    </span>
    <div>
      <h2>Mini pathway</h2>
    </div>
  </div>

  <!-- Right: action buttons -->
  <div class="mini-pathway-header-actions">
    <!-- Expand / collapse button -->
    <button class="mini-pathway-expand">
      [Maximize2 / Minimize2 icon] Expand/Collapse
    </button>
    <!-- Close button -->
    <button aria-label="Close mini pathway">
      [X icon 22px]
    </button>
  </div>
</header>
```

**Header CSS:**
```css
.mini-pathway-panel > header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 15px 20px;
  border-bottom: 1px solid #e0e6ef;
  background: #fff;
  flex-shrink: 0;
}
.mini-pathway-heading-icon {
  display: grid;
  place-items: center;
  width: 36px; height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--accent-8) 0%, #ede5fc 100%);
  color: var(--accent);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 7%, transparent),
              0 1px 4px rgba(0,0,0,.08);
}
.mini-pathway-panel h2 {
  font-size: 15px;
  font-weight: 600;
  color: #27364a;
  letter-spacing: -.01em;
}
```

---

## History Selector

The panel shows a dropdown with all saved pathways for this conversation:

```html
<div class="mini-pathway-history">
  <div class="mini-pathway-history-label">
    [Clock icon] SAVED PATHWAYS <b>1</b>
  </div>

  <!-- Trigger button (dropdown toggle) -->
  <button class="mini-pathway-history-trigger [--open modifier when open]">
    <span class="mini-pathway-history-trigger-text">
      <strong>Pathway 1 · 18 Sept 2026, 5:02 pm</strong>
      <small>[Location: Sydney…] SUPPLE…</small>
    </span>
    <span class="mini-pathway-history-chevron">
      [ChevronDown icon, rotates 180° when open]
    </span>
  </button>

  <!-- Dropdown list (animated in) -->
  <ul class="mini-pathway-history-list">
    <li>
      <button class="mini-pathway-history-option--selected">
        <span class="mini-pathway-history-option-title">Pathway 1</span>
        <span class="mini-pathway-history-option-ctx">18 Sept 2026, 5:02 pm</span>
      </button>
    </li>
  </ul>
</div>
```

**Key CSS:**
```css
.mini-pathway-history-label {
  font-size: 10.5px;
  font-weight: 600;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: .07em;
}
.mini-pathway-history-label b {
  background: linear-gradient(135deg, var(--accent) 0%, #a78bfa 100%);
  color: #fff;
  border-radius: 999px;
  padding: 0 5px;
  line-height: 16px;
  font-size: 10px;
}
.mini-pathway-history-trigger {
  padding: 10px 14px;
  border: 1px solid #dfe6ef;
  border-radius: 10px;
  background: #fff;
}
.mini-pathway-history-trigger--open {
  border-color: var(--accent);
  background: var(--accent-8);
  box-shadow: 0 0 0 1px var(--accent-border);
}
.mini-pathway-history-list {
  position: absolute;
  left: 12px; right: 12px;
  top: calc(100% - 4px);
  z-index: 10;
  background: #fff;
  border: 1px solid #e0e6ef;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0,0,0,.1), 0 2px 6px rgba(0,0,0,.06);
  animation: pathway-dropdown-in .12s ease-out both;
}
@keyframes pathway-dropdown-in {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

---

## Streaming State

While generating, the body shows:

```html
<div class="mini-pathway-stream-status">
  <span role="status">
    [animated dots or icon] Preparing your mini pathway...
  </span>
  <button>Stop</button>
</div>
<p class="mini-pathway-stream-caption">This may take a moment…</p>

<!-- Skeleton lines while waiting -->
<div class="mini-pathway-skeleton">
  <span class="mini-pathway-skeleton-line mini-pathway-skeleton-title"></span>
  <span class="mini-pathway-skeleton-line mini-pathway-skeleton-short"></span>
  <span class="mini-pathway-skeleton-line"></span>
</div>

<!-- Draft blocks animate in as they arrive -->
<div class="mini-pathway-stream-section">
  <!-- One block of content -->
</div>
```

**Skeleton CSS:**
```css
.mini-pathway-skeleton-line {
  display: block;
  height: 12px;
  border-radius: 5px;
  background: linear-gradient(90deg, #f1f5f9 25%, #e8edf4 50%, #f1f5f9 75%);
  background-size: 400% 100%;
  animation: pathway-shimmer 1.7s ease-in-out infinite;
}
@keyframes pathway-shimmer {
  from { background-position: 150% 0; }
  to   { background-position: -100% 0; }
}
```

---

## Report Content (ProtocolV13Renderer inside panel)

The pathway report uses the same `ProtocolV13Renderer` but wrapped in:

```html
<div class="mini-pathway-report">
  <!-- Colour guide (collapsible) -->
  <details class="pathway-colour-guide">
    <summary>COURSE COLOURS AND LEVELS ...</summary>
    <!-- AQF level key chips -->
  </details>

  <!-- "In this answer" section jump nav (collapsible) -->
  <details class="in-this-answer-details">
    <summary>IN THIS ANSWER  Jump to a section</summary>
    <nav aria-label="In this answer">
      <ul>
        <li>
          <!-- Numbered circle: gradient -->
          <a href="#section-1">Section title</a>
        </li>
      </ul>
    </nav>
  </details>

  <!-- Protocol renderer output blocks -->
  [ProtocolV13Renderer with pathwayLearningCues=true]
</div>
```

**Report prose overrides in mini-pathway.css:**
```css
/* Section eyebrows — muted small caps */
.mini-pathway-report h4 {
  font-size: 10.5px !important;
  font-weight: 700 !important;
  letter-spacing: .1em !important;
  text-transform: uppercase !important;
  color: #8fa3b8 !important;
}

/* Heading sections get gradient underline */
.mini-pathway-report [data-output-type="heading"] {
  border-bottom: 2px solid transparent;
  border-image: linear-gradient(90deg, var(--accent) 0%, #e0e6ef 65%) 1;
}

/* Callout info boxes get accent inset shadow */
.mini-pathway-report [data-output-type="callout"][data-output-variant="info"] > div {
  background: linear-gradient(135deg, #ede5fc 0%, #f4eeff 55%, #f8f0ff 100%) !important;
  border: 1px solid var(--accent-border) !important;
  box-shadow: inset 3px 0 0 var(--accent) !important;
  color: #3b2464 !important;
}
```

---

## Learning Cue Tags (PathwayLearningCues)

When `pathwayLearningCues=true`, course items show expandable pill tags:

```html
<div class="pathway-learning-cues">
  <details class="pathway-learning-cue" data-learning-tone="level6">
    <summary>
      <span class="pathway-type-dot"></span>  <!-- coloured dot -->
      Graduate Certificate
      <span class="pathway-level">Level 8</span>
      <!-- chevron (rotates on open) -->
    </summary>
    <div class="pathway-type-explanation">
      <p>AQF Level 8 graduate certificates are...</p>
      <p><strong>Duration:</strong> typically 6–12 months</p>
    </div>
  </details>
</div>
```

Tags are colour-coded by the `data-learning-tone` system (see Document 01).

---

## Expanded Mode

When the user clicks "Expand":
```css
.mini-pathway-panel--expanded {
  position: absolute;
  inset: 0;             /* covers entire workspace area */
  width: 100%;
  max-width: none;
  border-left: 0;
  z-index: 40;
}
.mini-pathway-panel--expanded .mini-pathway-body {
  width: 100%;
  max-width: 1100px;
  margin-inline: auto;
  flex: 1;
  padding: 28px 40px;
}
```

---

## Resize Handle

```html
<div class="mini-pathway-resize-handle"
     role="separator"
     aria-valuenow="440"
     aria-valuemin="280"
     aria-valuemax="720"
     tabindex="0">
  <span aria-hidden="true" />  <!-- visual grip dot -->
</div>
```

```css
.mini-pathway-resize-handle {
  position: absolute;
  left: -12px; top: 0; bottom: 0;
  width: 24px;
  cursor: col-resize;
  z-index: 2;
}
.mini-pathway-resize-handle span {
  position: absolute;
  top: 50%; left: 9px;
  transform: translateY(-50%);
  width: 5px; height: 36px;
  border-radius: 3px;
  background: #d1d9e6;
}
/* Turns accent-coloured on hover/drag */
.mini-pathway-resize-handle:hover span,
.mini-pathway-panel--resizing .mini-pathway-resize-handle span {
  background: var(--accent);
}
/* Prevent text selection during drag */
body:has(.mini-pathway-panel--resizing),
body:has(.mini-pathway-panel--resizing) * {
  cursor: col-resize !important;
  user-select: none !important;
}
```

---

## Saved Pathways Control (Navbar Portal)

A small button is injected into the Navbar showing saved pathway count:

```html
<button class="mini-pathway-saved-control">
  [Map icon 17px]
  <span>Saved pathways</span>
  <b>1</b>  <!-- count badge -->
</button>
```

```css
.mini-pathway-saved-control {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border: 1px solid #dce3ec;
  border-radius: 8px;
  font-size: 12px;
  background: #fff;
}
.mini-pathway-saved-control b {
  background: var(--accent);
  color: #fff;
  border-radius: 999px;
  padding: 0 5px;
  line-height: 17px;
  font-weight: 600;
}
/* Hide the text label on narrow screens, keep badge */
@media (max-width: 900px) {
  .mini-pathway-saved-control span { display: none; }
}
```

---

## Caption / Disclaimer

At the bottom of a completed pathway:

```html
<p class="mini-pathway-caption">
  Generated by Gemini from this conversation. No source lookup was performed;
  check course details, time estimates and eligibility before relying on them.
</p>
```

```css
.mini-pathway-caption {
  font-size: 13px;
  line-height: 1.65;
  color: #718096;
  border-left: 2px solid #e0e6ef;
  padding: 0 0 16px 12px;
  margin-left: 1px;
}
/* Last caption becomes a top-ruled footer */
.mini-pathway-caption:last-child {
  border-left-color: transparent;
  padding-left: 0;
  margin-left: 0;
  border-top: 1px solid #edf0f4;
  margin-top: 20px;
  padding-top: 14px;
}
```

---

## Container Query: Compact Mode

The panel uses container queries to self-adjust at narrow widths:

```css
.mini-pathway-panel { container-type: inline-size; }

@container (max-width: 400px) {
  .mini-pathway-panel > header { padding: 13px 14px; }
  .mini-pathway-heading { gap: 8px; }
  .mini-pathway-heading-icon { width: 30px; height: 30px; border-radius: 8px; }
  .mini-pathway-expand span { display: none; }   /* hide "Expand" label */
  .mini-pathway-body { padding: 16px 14px 32px; }
}
```

---

## Scrollbar Style (inside panel)

Scrollbars inside the panel are hidden until hover, 3px thin:

```css
.mini-pathway-panel * { scrollbar-width: none; }
.mini-pathway-panel *::-webkit-scrollbar { width: 3px; height: 3px; }
.mini-pathway-panel *::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 9999px;
}
.mini-pathway-panel *:hover::-webkit-scrollbar-thumb {
  background: rgba(114, 68, 198, .18);
}
```

---

## Responsive Summary

| Screen Width | Behaviour |
|-------------|-----------|
| ≥ 1600px | Panel width 490px |
| 1200px–1599px | Panel width 440px, sits alongside chat |
| < 1200px | Panel absolute, slides over chat |
| < 600px | Panel full width, compact padding |
| Panel < 400px | Compact header, labels hidden |
