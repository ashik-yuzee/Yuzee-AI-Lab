# Document 02 — Conversation Layout & Chat Turns

## Overall Chat Area Structure

```
┌──────────────────────────────────────────────────────┐
│  #chat-viewport  (flex column, overflow hidden)      │
│                                                       │
│  ┌─ [Cost Warning Banner] ─────────────────────────┐ │
│  │  bg-amber/red/orange, border-bottom             │ │
│  └──────────────────────────────────────────────────┘ │
│                                                       │
│  ┌─ [API Key Preview Banner] ──────────────────────┐ │
│  │  bg-amber-50, border-b border-amber-200         │ │
│  └──────────────────────────────────────────────────┘ │
│                                                       │
│  ┌─ Messages Scroll Area ──────────────────────────┐ │
│  │  flex-1, min-h-0, overflow-y-auto               │ │
│  │                                                  │ │
│  │  .max-w-4xl.mx-auto.px-4.py-8                   │ │
│  │  ┌─ Empty State OR Turn Groups ──────────────┐  │ │
│  │  └────────────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────┘ │
│                                                       │
│  ┌─ Composer ──────────────────────────────────────┐ │
│  │  px-4, pb-6, pt-3, bg-white                     │ │
│  └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

---

## Empty State (No Messages)

When there are no messages, the chat shows a centred welcome screen with starter prompts.

```html
<div class="py-16 text-center space-y-6">
  <!-- Icon -->
  <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl
              bg-[--accent-light] text-[--accent]">
    [Sparkles icon 28px]
  </div>

  <!-- Headline -->
  <div>
    <h1 class="text-[22px] font-bold text-[#0d0d0d] tracking-tight">
      What are you planning next?
    </h1>
    <p class="text-[15px] text-[#8a929d] max-w-md mx-auto leading-relaxed">
      Test Oala career guidance with Protocol v1.3 JSON validation
      and context token optimisation.
    </p>
  </div>

  <!-- Starter prompts grid -->
  <div class="grid sm:grid-cols-2 gap-2.5 pt-2 text-left max-w-2xl mx-auto">
    <button class="p-4 bg-white border border-[#e5e5e5]
                   hover:border-[--accent-40] rounded-xl group">
      <div class="font-semibold text-[13px] text-[#0d0d0d] mb-1.5
                  group-hover:text-[--accent]">
        Cybersecurity Pathway
      </div>
      <p class="text-[12px] text-[#8a929d] leading-relaxed line-clamp-2">
        Build a realistic pathway from IT support into a junior cybersecurity analyst.
      </p>
    </button>
    <!-- 4 more prompt cards -->
  </div>
</div>
```

**Starter prompts (hardcoded):**
1. Cybersecurity Pathway
2. Degree vs Apprenticeship
3. Skill Gap Analysis
4. Career Switcher Plan
5. 6-Month Study Plan

---

## Turn Groups

Messages are grouped into "turns" — each turn consists of one user message followed by one or more assistant messages.

### Turn Group HTML Structure

```html
<!-- One turn group -->
<div class="min-w-0">
  <!-- Timestamp divider -->
  <div class="chat-turn-divider">
    <!-- "9/18/2026, 5:01:58 PM" -->
  </div>

  <div class="min-w-0 space-y-4 sm:space-y-5">
    <!-- USER MESSAGE -->
    <div id="message-{id}">
      <div class="text-[11px] font-bold uppercase tracking-[0.06em] text-[#6d7782] mb-2.5">
        You
      </div>
      <div class="inline-block text-[16px] leading-[1.6] max-w-full sm:max-w-[85%]
                  whitespace-pre-wrap px-3.5 py-3"
           style="background-color: var(--bubble-bg);
                  color: var(--bubble-text);
                  border-radius: 18px 18px 6px 18px;">
        I have been a registered nurse for 5 years…
      </div>
    </div>

    <!-- ASSISTANT MESSAGE -->
    <div id="message-{id}" class="space-y-3">
      <div class="text-[11px] font-bold uppercase tracking-[0.06em] text-[#38596b] mb-2.5">
        Oala
      </div>
      <!-- Response content (ProtocolV13Renderer or Markdown) -->
      <!-- Error state -->
      <!-- Streaming status -->
      <!-- Skill suggestions -->
      <!-- Mini pathway offer button -->
      <!-- Telemetry footer -->
    </div>
  </div>
</div>
```

---

## User Message Bubble

**Key specs:**
- Display: `inline-block` (not full width — wraps to content)
- Max width: `100%` on mobile, `85%` on sm+ screens
- Background: `var(--bubble-bg)` = `#ede5fc` (light lavender)
- Text colour: `var(--bubble-text)` = `color-mix(in srgb, var(--accent) 65%, #000)` ≈ `#4a2e8a`
- Border radius: `18px 18px 6px 18px` (chat bubble, flat bottom-right)
- Font size: 16px mobile, 15px desktop
- Line height: 1.6
- Padding: `14px 14px` (px-3.5 py-3)

**Label above bubble ("You"):**
- Font: 11px, bold, uppercase, letter-spacing 0.06em
- Colour: `#6d7782`
- Margin bottom: 10px

---

## Assistant Message (Oala) Container

**Label ("Oala"):**
- Font: 11px, bold, uppercase, letter-spacing 0.06em
- Colour: `#38596b` (darker, slightly different from "You")

**Content width:** Full width of the container (max-w-4xl = 896px, centred)

**Space between messages:** `space-y-4` (16px) on mobile, `space-y-5` (20px) on sm+
**Space between turns:** `space-y-8` (32px) on mobile, `space-y-12` (48px) on sm+

---

## ChatTurnDivider

A subtle timestamp divider between conversation turns:

```html
<div class="flex items-center gap-3 py-2 mb-3">
  <div class="flex-1 h-px bg-[#f0f0f0]"></div>
  <span class="text-[10px] text-slate-400 font-mono whitespace-nowrap">
    9/18/2026, 5:01:58 PM
  </span>
  <div class="flex-1 h-px bg-[#f0f0f0]"></div>
</div>
```

---

## Streaming Status Indicator

While the AI is generating, shows a progress indicator:

```html
<div class="main-chat-progress">
  <!-- Icon circle: 31×31px, border-radius 50%, breathing animation -->
  <div class="main-chat-progress-icon">
    [Sparkles or Activity icon]
  </div>

  <div class="main-chat-progress-copy">
    <strong>Preparing your answer</strong>
    <p>Phase-specific message (routing, generating, validating...)</p>
  </div>

  <button>Stop</button>
</div>
```

**CSS:**
```css
.main-chat-progress {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0 16px;
  min-height: 76px;
  max-width: 740px;
}
.main-chat-progress-icon {
  display: grid;
  place-items: center;
  width: 31px; height: 31px;
  border-radius: 50%;
  background: var(--accent-8);
  color: var(--accent);
  animation: chat-breathe 2.8s ease-in-out infinite;
}
@keyframes chat-breathe { 50% { opacity: 0.5; } }
```

---

## Error States

Displayed after a failed assistant message. Styled as banners:

```html
<div class="flex items-start gap-2.5 p-3 border rounded-lg text-sm bg-amber-50 border-amber-200 text-amber-900">
  [Icon]
  <div>
    <p class="font-semibold text-[13px]">Rate limit reached</p>
    <p class="text-xs opacity-80">Wait a moment and try again.</p>
  </div>
  <button class="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold">
    [RotateCcw icon] Retry
  </button>
</div>
```

**Error type colours:**
| Error | Background | Border | Text |
|-------|-----------|--------|------|
| RATE_LIMIT | amber-50 | amber-200 | amber-900 |
| QUOTA_EXHAUSTED | red-50 | red-200 | red-900 |
| AUTH_ERROR | red-50 | red-200 | red-900 |
| PROVIDER_ERROR | slate-50 | slate-200 | slate-800 |
| FUNCTION_TIMEOUT | amber-50 | amber-200 | amber-900 |

---

## Compaction Banner

When context has been compacted (memory archived), shows:

```html
<div class="flex items-center gap-1.5 p-2 bg-emerald-50 border border-emerald-200
            text-emerald-900 rounded-lg text-xs font-medium cursor-pointer
            hover:bg-emerald-100/70">
  [TrendingDown icon] Context compacted — older turns archived to preserve memory
</div>
```

---

## Skill Suggestions

After a completed response, optional follow-up skill suggestions appear:

```html
<!-- SkillSuggestions component — shows after last assistant message -->
<div class="skill-suggestions">
  <!-- Chips with suggested next actions -->
</div>
```

---

## Mini Pathway Offer Button

The "Open your mini pathway" button is rendered into a DOM portal (`<div id="mini-pathway-offer">`) injected after the last structured assistant message. The offer button appears inline in the conversation:

```html
<button class="mini-pathway-offer">
  [Map icon 21px]
  <span>
    <strong>Open your mini pathway</strong>
    <small>See possible routes, trade-offs and a practical next step.</small>
  </span>
  [ArrowRight icon 19px]
</button>
```

**CSS:**
```css
.mini-pathway-offer {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  margin: 16px 0;
  padding: 14px 16px;
  border: 1px solid #dfe6ef;
  border-radius: 12px;
  background: #fff;
  color: #27364a;
  cursor: pointer;
  transition: border-color .15s, background .15s, box-shadow .15s;
}
.mini-pathway-offer:hover {
  border-color: #acbdd4;
  background: #f4f7fb;
  box-shadow: 0 2px 8px rgba(0,0,0,.07);
}
.mini-pathway-offer:active { transform: translateY(1px); }
.mini-pathway-offer strong { font-size: 14px; font-weight: 600; color: #27364a; }
.mini-pathway-offer small  { font-size: 13px; color: #718096; line-height: 1.5; }
/* Arrow icon slides right on hover */
.mini-pathway-offer > svg:last-child { transition: transform .18s ease-out; }
.mini-pathway-offer:hover > svg:last-child { transform: translateX(4px); }
```

---

## Responsive Behaviour

| Breakpoint | Behaviour |
|-----------|-----------|
| `< 640px` (mobile) | Messages: 16px text, py-5 padding, space-y-4 |
| `>= 640px` (sm) | Messages: 15px text, py-8 padding, space-y-5, sm:max-w-[85%] bubble |
| All sizes | max-w-4xl (896px) centred with px-4 / px-5 |

### User Bubble on Mobile
- Border radius stays `18px 18px 6px 18px`
- Font size: 16px (matches the textarea for iOS zoom prevention)
- Max width: 100% (no `sm:max-w-[85%]` clamp — takes full width on phone)

### Conversation Turn Spacing
- Mobile: `space-y-8` (32px between turns)
- Desktop sm+: `space-y-12` (48px between turns)

---

## Scroll Behaviour

- Chat messages: `overflow-y: auto` with smooth-scroll on new messages
- Auto-scrolls to bottom: `messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })` triggered whenever message count changes or streaming starts/stops
- Scrollbar: thin (6px width), transparent track, `rgba(0,0,0,.16)` thumb

---

## Sidebar

The sidebar slides in from the left:

```html
<aside id="app-sidebar"
       class="fixed lg:relative top-0 bottom-0 left-0 z-50 shrink-0
              transition-all duration-200 ease-in-out
              [isSidebarOpen ? 'w-72' : 'w-0'] overflow-hidden">

  <div class="w-72 bg-white border-r border-[#e6e9ee] flex flex-col h-full">
    <!-- Header: New Conversation + Close + Load Demo -->
    <!-- Conversations list -->
    <!-- Session stats footer -->
  </div>
</aside>
```

**Width:** `w-72 = 288px`
**Transition:** `transition-all duration-200 ease-in-out` (slides in/out)
**Mobile backdrop:** `fixed inset-0 bg-slate-900/30 backdrop-blur-xs` over rest of app when open on `< 1024px`

### Conversation Item
```html
<div class="group relative flex items-center justify-between
            px-3 py-2 rounded-lg text-xs cursor-pointer transition-all
            [selected: bg-white border border-[#e6e9ee] font-medium]
            [unselected: text-[#5b6472] hover:bg-white/70]">
  [MessageSquare icon 14px, accent-colored if selected]
  <span class="truncate font-medium">Evaluating A Career In Cybersecurity</span>
  <span class="text-[10px] text-slate-500">3.7-flash · adaptive · 2 exchanges</span>
  <!-- Rename + Delete buttons (visible on hover via group-hover) -->
</div>
```

### Session Stats Footer
```html
<div class="p-3 border-t bg-white hover:bg-[#f7f8fa] cursor-pointer">
  <span class="text-[11px] uppercase tracking-widest text-[#8a929d]">Overall Telemetry</span>
  <div class="text-[11px] font-mono text-slate-700 flex justify-between">
    <span>In <strong>741.1k</strong></span>
    <span class="text-emerald-700">⚡ <strong>1022.2k</strong> reads</span>
    <span>Out <strong>71.7k</strong></span>
  </div>
  <!-- Total cost row -->
</div>
```
