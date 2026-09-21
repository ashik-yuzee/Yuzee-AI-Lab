# Oala AI Token Lab — Frontend UI Documentation

**For: Irshad (Angular / Ionic / Bootstrap Production Implementation)**
**Source: React + Vite reference implementation**

---

## Overview

Oala AI Token Lab is a chat-style AI guidance interface built around a **Protocol v1.3** structured JSON response format. Every AI response is delivered as JSON, parsed client-side, and rendered into interactive UI components.

The reference implementation uses:
- **React 18 + Vite** (frontend)
- **Tailwind CSS v4** (utility classes)
- **Custom CSS** (chat-experience.css, mini-pathway.css, guidance-list.css)
- **Lucide React** (icons)

Your production implementation should use:
- **Angular 15+ with Ionic / Capacitor**
- **Bootstrap 5** (utility and component layer)
- **Angular Material / Ionic components** for native feel
- **Lucide Angular or Ionic Icons** (ionicons)

---

## High-Level Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  NAVBAR (fixed top)                                              │
│  [≡] [Model Selector ▾] [Mode ▾] [Pathway] [Mini Pathway]       │
│      [Renderer] [Lab] [Profile] [Settings]                       │
├────────────┬─────────────────────────────────┬───────────────────┤
│            │                                 │                   │
│  SIDEBAR   │   MAIN CHAT AREA                │   RIGHT PANEL     │
│  (w-72)    │   - Conversation scroll         │   (Mini Pathway   │
│  slide-in  │   - ProtocolV13Renderer         │    or Token       │
│  drawer    │   - Composer (sticky bottom)    │    Inspector)     │
│            │                                 │   w-440px         │
└────────────┴─────────────────────────────────┴───────────────────┘
```

### Key Layout Rules
- Root is `height: 100dvh`, `overflow: hidden` — no page scroll
- **Sidebar** is a fixed/relative drawer (`w-72 = 288px`), slides in/out
- **Main chat area** has an inner scroll container (`overflow-y: auto`)
- **Right panel** (Mini Pathway) is `width: 440px`, `flex-shrink: 0`, sits alongside main chat
- At `< 1200px`, right panel becomes `position: absolute`, slides over the chat
- At `< 600px` (mobile), right panel is `width: 100%`
- The **Composer** is sticky at the bottom of the main area (inside the flex column, not position fixed)

---

## Screen States

| State | Description |
|-------|-------------|
| Loading | Centered logo pulse + skeleton bars |
| Login | Centered card with username/password |
| Empty chat | Centered empty state with starter prompts grid |
| Active conversation | Turns list + Composer |
| Streaming | ChatStreamingStatus indicator visible |
| Mini pathway open | Right panel slides in alongside chat |

---

## Component Map

```
App
├── Navbar
├── Sidebar
├── Main
│   ├── ChatArea
│   │   ├── [Cost Warning Banner]
│   │   ├── [API Key Banner]
│   │   ├── Messages scroll container
│   │   │   ├── Empty state / Starter prompts
│   │   │   └── TurnGroups[]
│   │   │       ├── ChatTurnDivider (timestamp)
│   │   │       ├── User message bubble
│   │   │       └── Assistant messages[]
│   │   │           ├── ProtocolV13Renderer (if JSON valid)
│   │   │           ├── Markdown fallback
│   │   │           ├── ChatStreamingStatus
│   │   │           ├── SkillSuggestions
│   │   │           └── Telemetry footer
│   │   └── Composer (input box)
│   ├── TokenInspector (right panel)
│   └── MiniPathwayExperience (right panel)
└── Modals (Settings, Profile, CareerContext, etc.)
```

---

## Color System

All colors are driven by a single `--accent` CSS custom property (default: `#7244c6` purple).

```css
:root {
  --accent:        #7244c6;   /* Primary brand purple */
  --accent-hover:  color-mix(in srgb, var(--accent) 83%, black);
  --accent-5:      color-mix(in srgb, var(--accent)  5%, white);
  --accent-8:      color-mix(in srgb, var(--accent)  8%, white);  /* Very light tint */
  --accent-light:  color-mix(in srgb, var(--accent) 12%, white);
  --accent-30:     color-mix(in srgb, var(--accent) 30%, transparent);
  --accent-40:     color-mix(in srgb, var(--accent) 40%, transparent);
  --accent-70:     color-mix(in srgb, var(--accent) 70%, transparent);
  --accent-border: color-mix(in srgb, var(--accent) 35%, white);
  --bubble-bg:     #ede5fc;   /* User message background */
  --bubble-text:   color-mix(in srgb, var(--accent) 65%, #000);
}
```

### Semantic Colors (non-accent)

| Purpose | Value |
|---------|-------|
| Body background | `#F9FAFB` |
| Chat area background | `#FFFFFF` |
| Sidebar background | `#FFFFFF` / list area `#F7F8FA` |
| Body text | `#2c333d` |
| Heading text | `#0d0d0d` / `#27364a` |
| Muted text | `#718096` / `#8a929d` |
| Border default | `#e2e8f0` / `#e6e9ee` |
| Border light | `#dfe6ef` |
| Conversation divider | `#f0f0f0` |
| Success/cached | `#10b981` (emerald-600) |
| Error/warning | Amber `#f59e0b`, Red `#ef4444` |

### Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Body | System sans-serif | 15px | 400 |
| User message | System sans | 16px / 15px | 400 |
| AI response (prose) | System sans | 16px / 15px | 400 |
| Section label ("You", "Oala") | System sans | 11px | 700 |
| Telemetry footer | Mono | 10px–11px | 400 |
| Button text | System sans | 12px–14px | 500–600 |

Font stack:
```
-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif
```

---

## Next Documents

- [01 — JSON to UI Rendering](./01-json-to-ui.md)
- [02 — Conversation Layout & Chat Turns](./02-conversation-layout.md)
- [03 — Mini Pathway Panel](./03-mini-pathway-panel.md)
- [04 — Composer (Input Box)](./04-composer.md)
- [05 — Angular Implementation Guide](./05-angular-guide.md)
