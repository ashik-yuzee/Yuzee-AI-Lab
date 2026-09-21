# Document 04 — Composer (Input Box)

## Overview

The Composer is a sticky input bar at the bottom of the chat area. It is a pill-shaped container holding:
1. **+ button** — file attachment
2. **Auto-growing textarea** — user input
3. **Mic button** — voice input
4. **Send / Stop button** — circular, accent-colored

---

## Full HTML Structure

```html
<!-- Outer wrapper — padding, max-width centred -->
<div class="px-3 sm:px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-6 pt-2 sm:pt-3 bg-white">
  <div class="max-w-4xl mx-auto">

    <!-- @Oala suggestion popup (shows when user types "@o") -->
    <div id="oala-suggestion" class="mb-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
      <button class="w-full rounded-xl p-3 text-left hover:bg-slate-50">
        <span class="font-semibold text-slate-800">@Oala · Yuzee guidance</span>
        <span class="text-sm text-slate-500">Understand our services...</span>
      </button>
    </div>

    <!-- @Oala status bar (when @Oala mention is active) -->
    <div class="mb-2 flex flex-wrap items-center gap-x-3 px-2 text-xs text-slate-500">
      <!-- If @Oala active: purple pill chip -->
      <span class="inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1.5
                   font-medium text-purple-700">
        @Oala · Yuzee help
        <button aria-label="Remove Oala mention">
          [X icon 14px]
        </button>
      </span>
      <!-- Else: link button -->
      <button class="rounded-lg py-2 hover:text-purple-700">
        Ask <span class="font-semibold text-purple-700">@Oala</span> about Yuzee services
      </button>
    </div>

    <!-- Attachment chips row -->
    <div class="flex flex-wrap gap-2 mb-2 px-1">
      <div class="flex items-center gap-1.5 bg-[--accent-8] border border-[--accent-border]
                  rounded-lg px-2 py-1 text-[12px] text-[--accent] font-medium max-w-[200px]">
        [Paperclip or image preview]
        <span class="truncate">filename.pdf</span>
        <button>[X icon]</button>
      </div>
    </div>

    <!-- ── Main pill input ── -->
    <div class="flex items-center gap-1 sm:gap-1.5 bg-white border rounded-[28px]
                px-2.5 sm:px-3 py-1 sm:py-2.5 transition-all
                border-[#e2e6ed]"
         style="box-shadow: 0 0 0 1px rgba(0,0,0,.04), 0 2px 6px rgba(0,0,0,.05)">

      <!-- Hidden file input -->
      <input type="file" accept="image/*,application/pdf,text/plain,text/csv,application/json"
             multiple class="sr-only" />

      <!-- + Attachment button -->
      <button type="button"
              class="w-11 h-11 sm:w-8 sm:h-8 rounded-full flex items-center justify-center
                     text-[#8a929d] hover:text-[--accent] hover:bg-[--accent-8]
                     transition-colors shrink-0">
        [Plus icon 16px]
      </button>

      <!-- Auto-growing textarea -->
      <textarea
        id="composer-input"
        rows="1"
        placeholder="Tell me what you'd like help with…"
        class="flex-1 min-w-0 text-[16px] sm:text-[15px] text-[#1c1f26]
               placeholder:text-[#a8b0bb] bg-transparent resize-none overflow-hidden
               focus:outline-none leading-[1.55] sm:leading-[1.68]
               min-h-[28px] max-h-44 py-0.5">
      </textarea>

      <!-- Mic button -->
      <button type="button"
              class="w-11 h-11 sm:w-8 sm:h-8 rounded-full flex items-center justify-center
                     [normal: text-[#8a929d] hover:text-[--accent] hover:bg-[--accent-8]]
                     [listening: bg-red-50 text-red-500 hover:bg-red-100]">
        [Mic / MicOff icon]
      </button>

      <!-- Send button (when not streaming) -->
      <button type="button"
              class="w-11 h-11 sm:w-8 sm:h-8 rounded-full flex items-center justify-center
                     [has content: bg-[--accent] text-white]
                     [empty: bg-slate-100 text-slate-300 cursor-not-allowed]">
        [ArrowUp icon 16px]
      </button>

      <!-- Stop button (when streaming) -->
      <button type="button"
              class="w-11 h-11 sm:w-8 sm:h-8 rounded-full flex items-center justify-center
                     bg-rose-50 text-rose-600 hover:bg-rose-100">
        [Square icon 14px, filled]
      </button>
    </div>

  </div>
</div>
```

---

## Pill Input Styling

```css
/* The pill container */
.composer-pill {
  display: flex;
  align-items: center;
  gap: 6px; /* 8px on sm+ */
  background: #fff;
  border: 1px solid #e2e6ed;
  border-radius: 28px;
  padding: 4px 10px 4px 10px;  /* py-1 px-2.5 on mobile */
  /* sm: py-2.5 px-3 */
  box-shadow: 0 0 0 1px rgba(0,0,0,.04), 0 2px 6px rgba(0,0,0,.05);
  transition: border-color .15s, box-shadow .15s;
}

/* When mic is listening */
.composer-pill--listening {
  border-color: #fca5a5;  /* red-300 */
}
```

---

## Textarea Auto-Grow

The textarea starts at `rows=1` and grows with content:

```typescript
const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
  setText(e.target.value);
  e.target.style.height = "auto";
  e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`;
};
```

**Min height:** 28px (single line)
**Max height:** 180px (max-h-44 = 176px, ~7–8 lines)
**Line height:** 1.55 on mobile, 1.68 on desktop
**Font size:** 16px on mobile (prevents iOS zoom), 15px on sm+

---

## Send Button States

| State | Style |
|-------|-------|
| Empty input | `bg-slate-100 text-slate-300 cursor-not-allowed` |
| Has content | `bg-[--accent] text-white` + hover: `bg-[--accent-hover]` |
| Streaming | Replaced by Stop button |

The send button is `w-11 h-11` (44px) on mobile (iOS minimum touch target), `w-8 h-8` (32px) on desktop.

---

## Bottom Padding (iOS Safe Area)

The composer uses `env(safe-area-inset-bottom)` for iPhone home bar:

```css
padding-bottom: calc(1rem + env(safe-area-inset-bottom));
/* sm+: 24px (pb-6) */
```

---

## Voice Input

Uses `SpeechRecognition` (Chrome/Edge only):

```typescript
const rec = new SpeechRecognition();
rec.lang = "en-US";
rec.interimResults = true;
rec.continuous = false;
```

While listening: Mic icon changes to MicOff, button turns red.

---

## File Attachments

Accepted types: `image/*, application/pdf, text/plain, text/csv, application/json`

Each attachment becomes a chip:
```html
<div class="bg-[--accent-8] border border-[--accent-border] rounded-lg px-2 py-1
            text-[12px] text-[--accent] font-medium max-w-[200px]">
  <!-- Image preview (5×5 rounded) or Paperclip icon -->
  <span class="truncate">filename.pdf</span>
  <button>[X icon]</button>
</div>
```

---

## @Oala Mention System

When the user types text starting with `@` followed by `o`, `oa`, `oa`, etc., a suggestion popup appears above the input. Pressing Enter/Tab selects the mention, which changes the routing context to "Yuzee services" mode.

**Active @Oala chip:**
- Background: `bg-purple-50` (`#faf5ff`)
- Text: `text-purple-700` (`#7e22ce`)
- Rounded full (pill shape)

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` | Send message |
| `Shift+Enter` | New line in textarea |
| `Enter` (when @Oala suggestion visible) | Select @Oala |
| `Tab` (when @Oala suggestion visible) | Select @Oala |
| `Escape` (when @Oala suggestion visible) | Dismiss suggestion |

---

## Draft Persistence

Drafts are saved to `sessionStorage` with key `yuzee-message-draft:{conversationId}`. Cleared on send or conversation switch.

---

## Angular/Ionic Implementation Notes

- Use `<ion-textarea>` for the textarea (auto-grow via `autoGrow="true"`)
- Use `(ionInput)` event to sync value
- For the pill border: Bootstrap's border utility + `border-radius: 28px`
- The send button should be an `<ion-button fill="clear">` with a round shape
- File picker: use `<input type="file" hidden #fileInput>` triggered by the + button
- Voice: use `SpeechRecognition` from the Web Speech API (same API works in WebView on Android)
- Safe area bottom: use `--ion-safe-area-bottom` CSS variable from Ionic
