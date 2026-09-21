# Document 05 — Angular / Ionic / Bootstrap Implementation Guide

## Stack Mapping

| React (Reference) | Angular Production |
|-------------------|--------------------|
| React 18 + Vite | Angular 15+ |
| Tailwind CSS v4 | Bootstrap 5 + custom SCSS |
| Lucide React icons | Ionicons (`ion-icon`) or `lucide-angular` |
| react-markdown + remark-gfm | `ngx-markdown` |
| Context API (TokenLabContext) | Angular Service + BehaviorSubject |
| CSS custom properties (`--accent`) | SCSS variables + CSS custom properties |
| `createPortal` | `*ngTemplateOutlet` or `ViewContainerRef` |
| SSE streaming | `EventSource` + RxJS `Observable` |

---

## Module Structure

```
src/
├── app/
│   ├── core/
│   │   ├── services/
│   │   │   ├── chat.service.ts          (conversation state, send message)
│   │   │   ├── streaming.service.ts     (SSE streaming)
│   │   │   ├── mini-pathway.service.ts  (pathway state)
│   │   │   └── auth.service.ts
│   │   ├── models/
│   │   │   ├── chat-message.model.ts
│   │   │   ├── yuzee-response.model.ts  (Protocol v1.3 types)
│   │   │   └── mini-pathway.model.ts
│   │   └── pipes/
│   │       └── safe-html.pipe.ts
│   ├── shared/
│   │   ├── components/
│   │   │   ├── guidance-list/           (card list + timeline)
│   │   │   ├── protocol-renderer/       (JSON → UI)
│   │   │   └── loading-skeleton/
│   │   └── directives/
│   │       └── auto-grow.directive.ts   (textarea auto-grow)
│   ├── features/
│   │   ├── chat/
│   │   │   ├── chat-area/
│   │   │   ├── composer/
│   │   │   ├── chat-turn/
│   │   │   └── telemetry-footer/
│   │   ├── mini-pathway/
│   │   │   ├── mini-pathway-panel/
│   │   │   ├── pathway-history-selector/
│   │   │   └── pathway-offer-button/
│   │   ├── sidebar/
│   │   └── navbar/
│   └── app.component.ts
└── styles/
    ├── _tokens.scss      (CSS custom properties + SCSS variables)
    ├── _chat.scss        (chat-experience styles)
    ├── _mini-pathway.scss
    ├── _guidance-list.scss
    └── styles.scss       (global imports)
```

---

## CSS Custom Properties (Bootstrap + SCSS)

Put these in `styles/_tokens.scss` and import globally:

```scss
// _tokens.scss

:root {
  --accent:        #7244c6;
  --accent-hover:  color-mix(in srgb, var(--accent) 83%, black);
  --accent-5:      color-mix(in srgb, var(--accent)  5%, white);
  --accent-8:      color-mix(in srgb, var(--accent)  8%, white);
  --accent-light:  color-mix(in srgb, var(--accent) 12%, white);
  --accent-30:     color-mix(in srgb, var(--accent) 30%, transparent);
  --accent-40:     color-mix(in srgb, var(--accent) 40%, transparent);
  --accent-70:     color-mix(in srgb, var(--accent) 70%, transparent);
  --accent-border: color-mix(in srgb, var(--accent) 35%, white);
  --bubble-bg:     #ede5fc;
  --bubble-text:   color-mix(in srgb, var(--accent) 65%, #000);
}

// SCSS shortcuts for use inside component styles
$accent:        var(--accent);
$accent-hover:  var(--accent-hover);
$accent-8:      var(--accent-8);
$accent-light:  var(--accent-light);
$accent-border: var(--accent-border);
$bubble-bg:     var(--bubble-bg);
$bubble-text:   var(--bubble-text);

// Non-accent semantic tokens
$body-bg:       #F9FAFB;
$chat-bg:       #ffffff;
$sidebar-bg:    #ffffff;
$sidebar-list:  #f7f8fa;

$text-primary:  #2c333d;
$text-heading:  #27364a;
$text-dark:     #0d0d0d;
$text-muted:    #718096;
$text-faint:    #8a929d;

$border-default: #e2e8f0;
$border-sidebar: #e6e9ee;
$border-panel:   #e0e6ef;
$border-card:    #dfe6ef;

// Typography
$font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
            'Helvetica Neue', Arial, sans-serif;
$font-mono: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono',
            'Droid Sans Mono', monospace;

// Learning tone palette (AQF levels)
$tones: (
  'level1':  (#166534, #f0fdf4, #86efac),
  'level2':  (#155e75, #ecfeff, #67e8f9),
  'level3':  (#0e7490, #e0f7fa, #38bdf8),
  'level4':  (#1d4ed8, #eff6ff, #93c5fd),
  'level5':  (#4338ca, #eef2ff, #a5b4fc),
  'level6':  (#6d28d9, #f5f3ff, #c4b5fd),
  'level7':  (#7e22ce, #faf5ff, #d8b4fe),
  'level8':  (#86198f, #fdf4ff, #e879f9),
  'level9':  (#9d174d, #fdf2f8, #f9a8d4),
  'level10': (#991b1b, #fff1f2, #fca5a5),
  'micro':   (#92400e, #fffbeb, #fcd34d),
  'short':   (#3f3f46, #fafafa, #a1a1aa),
  'industry':(#1e3a5f, #f0f4ff, #93b4e0),
  'route':   (#374151, #f9fafb, #9ca3af),
  'unit':    (#0e7490, #e0f7fa, #38bdf8),
  'crosslevel':(#86198f, #fdf4ff, #e879f9),
);

// Generate [data-learning-tone] attributes
@each $name, $vals in $tones {
  [data-learning-tone="#{$name}"] {
    --course-ink:  #{nth($vals, 1)};
    --course-bg:   #{nth($vals, 2)};
    --course-edge: #{nth($vals, 3)};
  }
}
```

---

## App Layout Component

`app.component.html`:
```html
<div id="oala-root" class="d-flex flex-column vh-100 overflow-hidden bg-body-secondary">
  <app-navbar></app-navbar>

  <div class="flex-fill d-flex overflow-hidden position-relative" style="min-height: 0">
    <app-sidebar></app-sidebar>

    <main class="flex-fill d-flex flex-column position-relative overflow-hidden" style="min-width: 0; background: #fff">
      <app-chat-area></app-chat-area>
    </main>

    <app-mini-pathway-panel *ngIf="miniPathwayOpen"></app-mini-pathway-panel>
  </div>

  <!-- Modals -->
  <app-settings-modal></app-settings-modal>
  <!-- ... -->
</div>
```

`app.component.scss`:
```scss
#oala-root {
  font-family: $font-sans;
  font-size: 15px;
  line-height: 1.6;
  color: $text-primary;
  -webkit-font-smoothing: antialiased;
}
```

---

## Chat Service (State Management)

```typescript
// chat.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ChatMessage, Conversation } from '../models/chat-message.model';
import { StreamingService } from './streaming.service';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private conversationsSubject = new BehaviorSubject<Conversation[]>([]);
  private currentConvSubject  = new BehaviorSubject<Conversation | null>(null);
  private isStreamingSubject  = new BehaviorSubject<boolean>(false);

  conversations$ = this.conversationsSubject.asObservable();
  currentConversation$ = this.currentConvSubject.asObservable();
  isStreaming$ = this.isStreamingSubject.asObservable();

  get currentConversation(): Conversation | null {
    return this.currentConvSubject.value;
  }

  get isStreaming(): boolean {
    return this.isStreamingSubject.value;
  }

  async sendMessage(text: string, attachments: any[] = []): Promise<void> {
    const conv = this.currentConvSubject.value;
    if (!conv || this.isStreaming) return;

    // Add user message optimistically
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    this.appendMessage(conv.id, userMsg);

    // Add placeholder assistant message
    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      isStreaming: true,
      createdAt: new Date().toISOString(),
    };
    this.appendMessage(conv.id, assistantMsg);

    this.isStreamingSubject.next(true);

    try {
      await this.streamingService.stream(
        `/api/conversations/${conv.id}/messages`,
        { message: text, attachments },
        (chunk) => this.onStreamChunk(conv.id, assistantMsg.id, chunk),
        () => this.onStreamEnd(conv.id, assistantMsg.id),
      );
    } catch (e) {
      this.onStreamError(conv.id, assistantMsg.id, e);
    }
  }

  private onStreamChunk(convId: string, msgId: string, chunk: any): void {
    // Update the streaming message with accumulated content
    this.updateMessage(convId, msgId, { content: chunk.text });
  }

  private onStreamEnd(convId: string, msgId: string): void {
    this.updateMessage(convId, msgId, { isStreaming: false });
    this.isStreamingSubject.next(false);
  }

  private onStreamError(convId: string, msgId: string, error: any): void {
    this.updateMessage(convId, msgId, { isStreaming: false, error: error?.message });
    this.isStreamingSubject.next(false);
  }

  // ... appendMessage, updateMessage, etc.
  constructor(private streamingService: StreamingService) {}
}
```

---

## Chat Area Component

`chat-area.component.html`:
```html
<div class="d-flex flex-column h-100 overflow-hidden position-relative bg-white" id="chat-viewport">

  <!-- Cost warning banner -->
  <div *ngIf="costWarning" class="alert alert-warning rounded-0 mb-0 py-2 d-flex justify-content-between align-items-center small">
    <span>⚠ Daily spend alert: {{ costWarning.amount }} USD</span>
    <button class="btn-close btn-sm" (click)="dismissCostWarning()"></button>
  </div>

  <!-- Messages scroll area -->
  <div class="flex-fill overflow-y-auto" style="min-height: 0" #scrollContainer>
    <div class="mx-auto px-3 px-sm-4 py-4 py-sm-5" style="max-width: 896px">

      <!-- Empty state -->
      <ng-container *ngIf="!messages.length; else conversationTurns">
        <div class="py-5 text-center">
          <div class="d-inline-flex align-items-center justify-content-center rounded-4 mb-4"
               style="width: 56px; height: 56px; background: var(--accent-light); color: var(--accent)">
            <ion-icon name="sparkles-outline" style="font-size: 28px"></ion-icon>
          </div>
          <h1 class="h4 fw-bold mb-2" style="color: #0d0d0d">What are you planning next?</h1>
          <p class="text-muted mb-4" style="max-width: 400px; margin-inline: auto">
            Explore Oala career guidance with structured JSON validation and token optimisation.
          </p>
          <div class="row g-2 text-start" style="max-width: 672px; margin-inline: auto">
            <div class="col-12 col-sm-6" *ngFor="let prompt of starterPrompts">
              <button class="btn btn-outline-light w-100 text-start rounded-3 p-3 border"
                      style="border-color: #e5e5e5; background: #fff"
                      (click)="sendMessage(prompt.prompt)">
                <div class="fw-semibold small mb-1" style="color: #0d0d0d">{{ prompt.title }}</div>
                <p class="mb-0 text-muted" style="font-size: 12px">{{ prompt.prompt }}</p>
              </button>
            </div>
          </div>
        </div>
      </ng-container>

      <!-- Conversation turns -->
      <ng-template #conversationTurns>
        <div class="d-flex flex-column gap-5">
          <div *ngFor="let turn of turnGroups" class="turn-group">

            <!-- Timestamp divider -->
            <app-chat-turn-divider [timestamp]="turn.createdAt"></app-chat-turn-divider>

            <!-- User message -->
            <div *ngIf="turn.userMsg" class="mb-4">
              <div class="text-uppercase fw-bold mb-2" style="font-size: 11px; letter-spacing: .06em; color: #6d7782">
                You
              </div>
              <div class="d-inline-block user-bubble">
                {{ turn.userMsg.content }}
              </div>
            </div>

            <!-- Assistant messages -->
            <div *ngFor="let msg of turn.assistantMsgs" class="oala-message">
              <div class="text-uppercase fw-bold mb-2" style="font-size: 11px; letter-spacing: .06em; color: #38596b">
                Oala
              </div>

              <!-- Structured protocol response -->
              <app-protocol-renderer
                *ngIf="getStructured(msg) as structured"
                [data]="structured"
                [readOnly]="isStreaming || !isLastAssistant(msg.id)"
                (interact)="handleInteract($event)">
              </app-protocol-renderer>

              <!-- Markdown fallback -->
              <div *ngIf="!getStructured(msg) && !msg.error && !msg.isStreaming"
                   class="prose-content"
                   markdown [data]="msg.content | readableText">
              </div>

              <!-- Streaming progress -->
              <app-chat-streaming-status
                *ngIf="msg.isStreaming"
                [phase]="msg.streamProgress?.phase"
                (stop)="stopStreaming()">
              </app-chat-streaming-status>

              <!-- Error -->
              <app-error-banner
                *ngIf="msg.error"
                [errorCode]="msg.errorCode"
                [message]="msg.error"
                (retry)="retryLastMessage()">
              </app-error-banner>

              <!-- Telemetry footer -->
              <app-telemetry-footer
                *ngIf="msg.telemetry && !msg.isStreaming"
                [telemetry]="msg.telemetry"
                (openBreakdown)="openTelemetry(msg.telemetry)">
              </app-telemetry-footer>
            </div>
          </div>
        </div>
      </ng-template>

      <div #messagesEnd></div>
    </div>
  </div>

  <!-- Composer -->
  <app-composer></app-composer>

</div>
```

`chat-area.component.scss`:
```scss
.user-bubble {
  font-size: 16px;
  line-height: 1.6;
  white-space: pre-wrap;
  padding: 12px 14px;
  max-width: 100%;
  background: var(--bubble-bg);
  color: var(--bubble-text);
  border-radius: 18px 18px 6px 18px;

  @media (min-width: 576px) {
    font-size: 15px;
    max-width: 85%;
  }
}

.prose-content {
  font-size: 16px;
  line-height: 1.7;
  color: #0d0d0d;

  @media (min-width: 576px) {
    font-size: 15px;
    line-height: 1.65;
  }

  p { margin-bottom: 12px; }
  strong { font-weight: 600; }
  code {
    background: #f4f4f4;
    color: #c7254e;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 13px;
    font-family: $font-mono;
  }
  pre {
    background: #1e1e1e;
    color: #d4d4d4;
    border-radius: 12px;
    padding: 16px;
    overflow-x: auto;
    code { background: none; color: inherit; padding: 0; }
  }
}

// Auto-scroll on new messages — handled in TS with @ViewChild + scrollIntoView
```

---

## Composer Component

`composer.component.html`:
```html
<div class="composer-wrapper px-3 px-sm-4 pb-4 pb-sm-5 pt-2 pt-sm-3 bg-white"
     style="padding-bottom: calc(1rem + env(safe-area-inset-bottom, 0px))">
  <div class="mx-auto" style="max-width: 896px">

    <!-- Attachment chips -->
    <div *ngIf="attachments.length" class="d-flex flex-wrap gap-2 mb-2">
      <div *ngFor="let att of attachments; let i = index"
           class="attachment-chip">
        <img *ngIf="att.previewUrl" [src]="att.previewUrl" class="rounded" style="width: 20px; height: 20px; object-fit: cover">
        <ion-icon *ngIf="!att.previewUrl" name="attach-outline"></ion-icon>
        <span class="text-truncate" style="max-width: 160px">{{ att.name }}</span>
        <button type="button" class="btn-close btn-close-sm" (click)="removeAttachment(i)"></button>
      </div>
    </div>

    <!-- Pill input -->
    <div class="composer-pill" [class.composer-pill--listening]="listening">
      <!-- Hidden file input -->
      <input #fileInput type="file"
             accept="image/*,application/pdf,text/plain,text/csv,application/json"
             multiple class="d-none" (change)="handleFiles($event)">

      <!-- + button -->
      <button type="button" class="composer-btn" (click)="fileInput.click()" [disabled]="isStreaming">
        <ion-icon name="add-outline"></ion-icon>
      </button>

      <!-- Textarea -->
      <textarea
        #composerInput
        id="composer-input"
        rows="1"
        placeholder="Tell me what you'd like help with…"
        class="composer-textarea"
        [(ngModel)]="text"
        (input)="onInput($event)"
        (keydown)="onKeyDown($event)"
        [disabled]="isStreaming"
        aria-label="Your message">
      </textarea>

      <!-- Mic button -->
      <button type="button" class="composer-btn"
              [class.composer-btn--listening]="listening"
              (click)="toggleMic()" [disabled]="isStreaming">
        <ion-icon [name]="listening ? 'mic-off-outline' : 'mic-outline'"></ion-icon>
      </button>

      <!-- Stop (when streaming) -->
      <button *ngIf="isStreaming; else sendBtn"
              type="button" class="composer-send composer-send--stop"
              (click)="stopStreaming()">
        <ion-icon name="stop"></ion-icon>
      </button>

      <!-- Send -->
      <ng-template #sendBtn>
        <button type="button" class="composer-send"
                [class.composer-send--active]="hasContent"
                [disabled]="!hasContent"
                (click)="handleSend()">
          <ion-icon name="arrow-up-outline"></ion-icon>
        </button>
      </ng-template>
    </div>

  </div>
</div>
```

`composer.component.scss`:
```scss
.composer-wrapper {
  background: #fff;
}

.attachment-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--accent-8);
  border: 1px solid var(--accent-border);
  border-radius: 8px;
  padding: 4px 8px;
  font-size: 12px;
  color: var(--accent);
  font-weight: 500;
  max-width: 200px;
}

.composer-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #fff;
  border: 1px solid #e2e6ed;
  border-radius: 28px;
  padding: 4px 10px;
  box-shadow: 0 0 0 1px rgba(0,0,0,.04), 0 2px 6px rgba(0,0,0,.05);
  transition: border-color .15s;

  @media (min-width: 576px) {
    padding: 10px 12px;
    gap: 6px;
  }

  &--listening { border-color: #fca5a5; }
}

.composer-textarea {
  flex: 1;
  min-width: 0;
  font-size: 16px;
  line-height: 1.55;
  color: #1c1f26;
  background: transparent;
  border: none;
  resize: none;
  overflow: hidden;
  min-height: 28px;
  max-height: 176px; /* 44 * 4 */
  padding: 2px 0;

  &::placeholder { color: #a8b0bb; }
  &:focus { outline: none; }

  @media (min-width: 576px) {
    font-size: 15px;
    line-height: 1.68;
  }
}

.composer-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: #8a929d;
  flex-shrink: 0;
  transition: color .15s, background .15s;

  ion-icon { font-size: 16px; }

  &:hover {
    color: var(--accent);
    background: var(--accent-8);
  }

  &--listening {
    background: #fff1f2;
    color: #ef4444;
    &:hover { background: #ffe4e6; }
  }

  @media (min-width: 576px) {
    width: 32px;
    height: 32px;
  }
}

.composer-send {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: #e2e8f0;
  color: #94a3b8;
  flex-shrink: 0;
  transition: background .15s;

  ion-icon { font-size: 16px; }

  &--active {
    background: var(--accent);
    color: #fff;
    cursor: pointer;
    &:hover { background: var(--accent-hover); }
  }

  &--stop {
    background: #fff1f2;
    color: #e11d48;
    cursor: pointer;
    &:hover { background: #ffe4e6; }
  }

  @media (min-width: 576px) {
    width: 32px;
    height: 32px;
  }
}
```

`composer.component.ts` (key logic):
```typescript
@Component({ selector: 'app-composer', ... })
export class ComposerComponent {
  @ViewChild('composerInput') textareaRef!: ElementRef<HTMLTextAreaElement>;

  text = '';
  listening = false;
  attachments: Attachment[] = [];

  get hasContent(): boolean {
    return this.text.trim().length > 0 || this.attachments.length > 0;
  }

  onInput(event: Event): void {
    const el = event.target as HTMLTextAreaElement;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 176)}px`;
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.handleSend();
    }
  }

  handleSend(): void {
    if (!this.hasContent || this.isStreaming) return;
    this.chatService.sendMessage(this.text, this.attachments);
    this.text = '';
    this.attachments = [];
    const el = this.textareaRef.nativeElement;
    el.style.height = 'auto';
  }

  handleFiles(event: Event): void {
    const files = Array.from((event.target as HTMLInputElement).files ?? []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        this.attachments.push({
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          data: result.split(',')[1],
          previewUrl: file.type.startsWith('image/') ? result : undefined,
        });
      };
      reader.readAsDataURL(file);
    });
  }
}
```

---

## Mini Pathway Panel Component

`mini-pathway-panel.component.html`:
```html
<aside id="mini-pathway-panel"
       class="mini-pathway-panel"
       [class.mini-pathway-panel--expanded]="expanded"
       [class.mini-pathway-panel--resizing]="resizing"
       [style.width.px]="expanded ? undefined : panelWidth"
       aria-label="Mini pathway">

  <!-- Resize handle (left edge) -->
  <div *ngIf="!expanded"
       class="mini-pathway-resize-handle"
       (mousedown)="startResize($event)"
       (touchstart)="startResizeTouch($event)">
    <span aria-hidden="true"></span>
  </div>

  <!-- Header -->
  <header>
    <div class="mini-pathway-heading">
      <span class="mini-pathway-heading-icon">
        <ion-icon name="map-outline" style="font-size: 23px"></ion-icon>
      </span>
      <div>
        <h2>Mini pathway</h2>
      </div>
    </div>
    <div class="mini-pathway-header-actions">
      <button type="button" class="mini-pathway-expand"
              (click)="toggleExpand()"
              [attr.aria-expanded]="expanded"
              [title]="expanded ? 'Return to side panel (Esc)' : 'Expand across the screen'">
        <ion-icon [name]="expanded ? 'contract-outline' : 'expand-outline'"></ion-icon>
        <span>{{ expanded ? 'Collapse' : 'Expand' }}</span>
      </button>
      <button type="button" (click)="close()" aria-label="Close mini pathway">
        <ion-icon name="close-outline" style="font-size: 22px"></ion-icon>
      </button>
    </div>
  </header>

  <!-- History selector -->
  <app-pathway-history-selector
    [runs]="historyRuns"
    [selectedId]="selectedRun?.id"
    [loading]="loading"
    (selectRun)="onSelectRun($event)">
  </app-pathway-history-selector>

  <!-- Body -->
  <div id="mini-pathway-body" class="mini-pathway-body">

    <!-- Loading / streaming state -->
    <app-mini-pathway-streaming
      *ngIf="loading"
      [stage]="stage"
      [blocks]="draftBlocks"
      (stop)="onStopGenerate()">
    </app-mini-pathway-streaming>

    <!-- Error state -->
    <div *ngIf="!loading && error" role="alert" class="mini-pathway-notice">
      <p>{{ error }}</p>
      <button *ngIf="hint" type="button" (click)="generate('manual')">Try again</button>
    </div>

    <!-- Completed pathway report -->
    <ng-container *ngIf="!loading && !error && selectedRun?.response">
      <p *ngIf="isStale" class="mini-pathway-caption">
        Saved from an earlier answer. Continue your conversation above.
      </p>

      <div class="mini-pathway-report">
        <app-pathway-colour-guide></app-pathway-colour-guide>
        <app-protocol-renderer
          [data]="selectedRun.response"
          [readOnly]="true"
          [hideRecommendedActions]="true"
          [pathwayLearningCues]="true">
        </app-protocol-renderer>
      </div>

      <p class="mini-pathway-caption">
        Generated by AI from this conversation. No source lookup was performed;
        check course details, time estimates and eligibility before relying on them.
      </p>
    </ng-container>

    <!-- Empty / waiting state -->
    <p *ngIf="!loading && !error && !selectedRun?.response" class="mini-pathway-caption">
      Continue in the chat. You can open a mini pathway when it is relevant.
    </p>

  </div>
</aside>
```

---

## Protocol Renderer Component (Core JSON → UI)

`protocol-renderer.component.html`:
```html
<div class="counselling-output" [class.output-review]="!pathwayLearningCues">

  <!-- Bridge message (intro text) -->
  <p *ngIf="data.frontend?.bridge_message" class="mb-3" style="font-size: 15px; color: #435369">
    {{ data.frontend.bridge_message }}
  </p>

  <!-- Output sections -->
  <ng-container *ngFor="let section of data.frontend?.output_sections">

    <!-- text -->
    <div *ngIf="section.type === 'text'"
         [attr.data-output-type]="'text'"
         markdown [data]="section.content"
         class="prose-content">
    </div>

    <!-- heading -->
    <div *ngIf="section.type === 'heading'"
         [attr.data-output-type]="'heading'">
      <h4>{{ section.title }}</h4>
    </div>

    <!-- cards (unordered list) -->
    <app-guidance-list *ngIf="section.type === 'cards'"
                       [attr.data-output-type]="'cards'"
                       [items]="section.items"
                       [ordered]="false"
                       [pathwayLearningCues]="pathwayLearningCues">
    </app-guidance-list>

    <!-- timeline (ordered) -->
    <app-guidance-list *ngIf="section.type === 'timeline' || section.type === 'flow'"
                       [attr.data-output-type]="section.type"
                       [items]="section.items"
                       [ordered]="true"
                       [pathwayLearningCues]="pathwayLearningCues">
    </app-guidance-list>

    <!-- table -->
    <div *ngIf="section.type === 'table'" class="response-table-scroll" [attr.data-output-type]="'table'">
      <table class="table response-data-table">
        <thead>
          <tr>
            <th *ngFor="let col of section.columns">{{ col.label }}</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let row of section.rows"
              [attr.data-learning-tone]="row.learning_tone">
            <td *ngFor="let col of section.columns; let i = index"
                [attr.data-label]="col.label">
              {{ row.cells[i] }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- callout -->
    <div *ngIf="section.type === 'callout'"
         [attr.data-output-type]="'callout'"
         [attr.data-output-variant]="section.variant">
      <div class="callout-inner">
        <h4 *ngIf="section.title">{{ section.title }}</h4>
        <div markdown [data]="section.content"></div>
      </div>
    </div>

    <!-- scorecard -->
    <app-scorecard *ngIf="section.type === 'scorecard'"
                   [attr.data-output-type]="'scorecard'"
                   [items]="section.items">
    </app-scorecard>

  </ng-container>

  <!-- Interaction (question form) -->
  <app-protocol-interaction
    *ngIf="data.frontend?.interaction && !readOnly"
    [interaction]="data.frontend.interaction"
    [initialFields]="initialFields"
    (submit)="onInteract($event)">
  </app-protocol-interaction>

</div>
```

---

## Guidance List Component (Cards + Timeline)

`guidance-list.component.html`:
```html
<ul class="guidance-rows" [class.guidance-rows-ordered]="ordered">
  <li *ngFor="let item of items"
      class="guidance-row"
      [attr.data-learning-tone]="item.learning_tone">

    <div class="guidance-row-content">
      <div class="d-flex align-items-start justify-content-between gap-2 mb-1">
        <span class="guidance-row-title">{{ item.title }}</span>
        <span *ngIf="item.status_label" class="guidance-status">
          {{ item.status_label }}
        </span>
      </div>

      <p *ngIf="item.description" class="guidance-description mb-1">
        {{ item.description }}
      </p>

      <span *ngIf="item.side_label" class="guidance-side-label">
        {{ item.side_label }}
      </span>

      <!-- Learning cue tags (pathway panel only) -->
      <app-pathway-learning-cues
        *ngIf="pathwayLearningCues && item.learning_type"
        [learningTone]="item.learning_tone"
        [learningType]="item.learning_type"
        [level]="item.level">
      </app-pathway-learning-cues>
    </div>
  </li>
</ul>
```

---

## Sidebar Component

`sidebar.component.html`:
```html
<!-- Mobile backdrop -->
<div *ngIf="sidebarOpen"
     class="position-fixed inset-0 bg-dark bg-opacity-25 d-lg-none"
     style="z-index: 40; backdrop-filter: blur(2px)"
     (click)="closeSidebar()">
</div>

<!-- Sidebar panel -->
<aside id="app-sidebar"
       class="sidebar-panel"
       [class.sidebar-panel--open]="sidebarOpen">

  <div class="sidebar-inner">
    <!-- Header -->
    <div class="p-3 border-bottom" style="border-color: #e6e9ee">
      <div class="d-flex gap-2">
        <button class="btn btn-sm flex-fill fw-semibold text-white"
                style="background: var(--accent); font-size: 12px"
                (click)="newConversation()">
          <ion-icon name="add-outline"></ion-icon> New Conversation
        </button>
        <button class="btn btn-sm btn-light" (click)="closeSidebar()">
          <ion-icon name="close-outline"></ion-icon>
        </button>
      </div>
    </div>

    <!-- Conversations list -->
    <div class="flex-fill overflow-y-auto p-2" style="background: #f7f8fa; min-height: 0">
      <div class="px-2 py-1 text-uppercase fw-semibold"
           style="font-size: 11px; letter-spacing: .1em; color: #8a929d">
        Conversations
      </div>

      <div *ngFor="let conv of conversations"
           class="conv-item"
           [class.conv-item--active]="conv.id === currentConvId"
           (click)="selectConversation(conv.id)">
        <ion-icon name="chatbubble-outline"
                  [style.color]="conv.id === currentConvId ? 'var(--accent)' : '#8a929d'">
        </ion-icon>
        <div class="flex-fill text-truncate">
          <div class="fw-medium text-truncate">{{ conv.title || 'Career Exploration' }}</div>
          <div style="font-size: 10px; color: #94a3b8">
            {{ conv.model }} · {{ conv.thinkingLevel }} · {{ conv.exchangeCount }} exchanges
          </div>
        </div>
        <button class="btn-icon" (click)="deleteConversation($event, conv.id)">
          <ion-icon name="trash-outline"></ion-icon>
        </button>
      </div>
    </div>

    <!-- Session stats footer -->
    <div class="p-3 border-top" style="border-color: #e6e9ee; cursor: pointer"
         (click)="openAnalytics()">
      <div class="d-flex justify-content-between mb-1">
        <span class="text-uppercase fw-semibold" style="font-size: 11px; color: #8a929d">
          Overall Telemetry
        </span>
        <button class="btn btn-sm btn-link p-0 text-muted" style="font-size: 10px"
                (click)="resetStats($event)">
          Reset
        </button>
      </div>
      <div class="d-flex justify-content-between" style="font-size: 11px; font-family: monospace">
        <span>In <strong>{{ stats.inputTokens | tokenCount }}</strong></span>
        <span class="text-success">⚡ <strong>{{ stats.cachedTokens | tokenCount }}</strong> reads</span>
        <span>Out <strong>{{ stats.outputTokens | tokenCount }}</strong></span>
      </div>
      <div *ngIf="stats.totalCost > 0"
           class="d-flex justify-content-between border-top mt-1 pt-1"
           style="font-size: 11px; font-family: monospace; border-color: #e2e8f0 !important">
        <span class="text-muted">Total cost</span>
        <span class="text-success fw-semibold">{{ stats.totalCost | currency:'USD':'symbol':'1.4-4' }}</span>
      </div>
    </div>
  </div>
</aside>
```

`sidebar.component.scss`:
```scss
.sidebar-panel {
  position: fixed;
  top: 0; bottom: 0; left: 0;
  z-index: 50;
  width: 0;
  overflow: hidden;
  transition: width .2s ease-in-out;
  flex-shrink: 0;

  @media (min-width: 992px) {
    position: relative;
  }

  &--open { width: 288px; }
}

.sidebar-inner {
  width: 288px;
  height: 100%;
  background: #fff;
  border-right: 1px solid #e6e9ee;
  display: flex;
  flex-direction: column;
}

.conv-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
  cursor: pointer;
  color: #5b6472;
  transition: background .15s;

  &:hover { background: rgba(255,255,255,.7); }

  &--active {
    background: #fff;
    border: 1px solid #e6e9ee;
    color: #1c1f26;
    font-weight: 500;
  }

  .btn-icon {
    display: none;
    padding: 4px;
    color: #94a3b8;
    background: none;
    border: none;
    border-radius: 6px;
    &:hover { color: #ef4444; background: #fff1f2; }
  }

  &:hover .btn-icon { display: flex; }
}
```

---

## Navbar Component

`navbar.component.html`:
```html
<nav class="navbar bg-white border-bottom px-3 py-0" style="border-color: #e6e9ee; min-height: 48px">
  <!-- Hamburger (toggle sidebar) -->
  <button class="btn btn-sm me-2" (click)="toggleSidebar()">
    <ion-icon name="menu-outline" style="font-size: 20px"></ion-icon>
  </button>

  <!-- Model selector -->
  <div class="me-2">
    <app-model-selector></app-model-selector>
  </div>

  <!-- Optimization mode selector -->
  <div class="me-3">
    <app-mode-selector></app-mode-selector>
  </div>

  <div class="d-flex align-items-center gap-2 ms-auto">
    <!-- Saved pathways button (portal from mini pathway) -->
    <div id="saved-pathways-control"></div>

    <!-- Pathway whiteboard -->
    <button class="btn btn-sm btn-outline-secondary" (click)="openPathway()"
            style="font-size: 12px">
      <ion-icon name="map-outline"></ion-icon> Pathway
    </button>

    <!-- Mini pathway toggle -->
    <button class="btn btn-sm"
            [class.btn-outline-secondary]="!miniPathwayOpen"
            [class.btn-primary]="miniPathwayOpen"
            (click)="toggleMiniPathway()"
            style="font-size: 12px"
            [style.background]="miniPathwayOpen ? 'var(--accent)' : ''"
            [style.border-color]="miniPathwayOpen ? 'var(--accent)' : ''">
      <ion-icon name="map-outline"></ion-icon>
      <span>Mini pathway</span>
    </button>

    <!-- User / Settings -->
    <button class="btn btn-sm btn-light rounded-circle" (click)="openProfile()">
      <ion-icon name="person-outline"></ion-icon>
    </button>
    <button class="btn btn-sm btn-light rounded-circle" (click)="openSettings()">
      <ion-icon name="settings-outline"></ion-icon>
    </button>
  </div>
</nav>
```

---

## Telemetry Footer Component

```html
<!-- telemetry-footer.component.html -->
<div class="d-flex flex-column flex-sm-row flex-sm-wrap align-items-sm-center
            justify-content-sm-between gap-1 pt-2 border-top"
     style="border-color: #f0f0f0; font-size: 11px; color: #94a3b8">

  <div class="d-flex flex-wrap align-items-center gap-1">
    <!-- Model chip -->
    <span class="badge rounded-1 border"
          [ngClass]="modelChipClass(telemetry.model)">
      {{ modelShortName(telemetry.model) }}
    </span>

    <!-- Thinking chip -->
    <span *ngIf="telemetry.appliedThinkingLevel"
          class="badge rounded-1 border"
          style="background: var(--accent-8); color: var(--accent); border-color: var(--accent-border)">
      {{ telemetry.appliedThinkingLevel }}
    </span>

    <!-- Latency -->
    <span *ngIf="latencySeconds" class="font-monospace" style="font-size: 10px">
      {{ latencySeconds }}s
    </span>

    <!-- Token breakdown button -->
    <button class="btn btn-sm border rounded font-monospace"
            style="font-size: 11px; background: #f4f4f4; border-color: #e5e5e5; padding: 2px 8px"
            (click)="openBreakdown.emit(telemetry)">
      <span *ngIf="telemetry.usage.cachedTokens > 0">
        ⚡ <strong>{{ telemetry.usage.cachedTokens | number }}</strong> cached ·
        In <strong>{{ telemetry.usage.uncachedInputTokens | number }}</strong> new ·
      </span>
      <span *ngIf="!telemetry.usage.cachedTokens">
        In <strong>{{ telemetry.usage.inputTokens | number }}</strong> ·
      </span>
      Out <strong>{{ telemetry.usage.outputTokens | number }}</strong> ·
      <strong>{{ telemetry.usage.totalTokens | number }}</strong>
      <span *ngIf="turnCost" class="text-success"> · {{ turnCost }}</span>
    </button>
  </div>

  <!-- Actions: raw JSON, speak, copy -->
  <div class="d-flex align-items-center gap-1">
    <button class="btn btn-sm btn-light p-1" (click)="toggleRawJson()" title="Show raw JSON">
      <ion-icon name="code-slash-outline" style="font-size: 14px"></ion-icon>
    </button>
    <button class="btn btn-sm btn-light p-1" (click)="speak()" [title]="speaking ? 'Stop' : 'Read aloud'">
      <ion-icon [name]="speaking ? 'volume-mute-outline' : 'volume-high-outline'" style="font-size: 14px"></ion-icon>
    </button>
    <button class="btn btn-sm btn-light p-1" (click)="copy()" title="Copy">
      <ion-icon [name]="copied ? 'checkmark-outline' : 'copy-outline'"
                [style.color]="copied ? '#10b981' : ''"
                style="font-size: 14px">
      </ion-icon>
    </button>
  </div>
</div>
```

Model chip classes:
```typescript
modelChipClass(modelId: string): string {
  if (modelId?.includes('lite')) return 'bg-warning-subtle text-warning border-warning-subtle';
  if (modelId?.includes('2.5') || modelId?.includes('2.0')) return 'bg-secondary-subtle text-secondary border-secondary-subtle';
  return 'bg-primary-subtle text-primary border-primary-subtle';
}
```

---

## Streaming Service (SSE)

```typescript
// streaming.service.ts
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class StreamingService {
  private activeSource: EventSource | null = null;

  stream(
    url: string,
    body: object,
    onChunk: (data: any) => void,
    onEnd: () => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // POST to create the stream, then connect via EventSource
      const token = localStorage.getItem('yuzee_auth') ?? '';
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body),
      }).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        // The server returns server-sent events
        const reader = r.body!.getReader();
        const decoder = new TextDecoder();
        const pump = async (): Promise<void> => {
          const { done, value } = await reader.read();
          if (done) { onEnd(); resolve(); return; }
          const text = decoder.decode(value, { stream: true });
          // Parse SSE lines
          for (const line of text.split('\n')) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                onChunk(data);
              } catch { /* partial JSON, skip */ }
            }
          }
          return pump();
        };
        return pump();
      }).catch(reject);
    });
  }

  stop(): void {
    this.activeSource?.close();
    this.activeSource = null;
  }
}
```

---

## Auto-Grow Textarea Directive

```typescript
// auto-grow.directive.ts
import { Directive, HostListener, ElementRef, Input } from '@angular/core';

@Directive({ selector: 'textarea[appAutoGrow]' })
export class AutoGrowDirective {
  @Input() maxHeight = 176;

  constructor(private el: ElementRef<HTMLTextAreaElement>) {}

  @HostListener('input')
  onInput(): void {
    const el = this.el.nativeElement;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, this.maxHeight)}px`;
  }
}
```

---

## Key Bootstrap Overrides

Add to `styles.scss`:

```scss
// Scrollbar — thin and subtle
* {
  scrollbar-width: thin;
  scrollbar-color: rgba(0,0,0,.18) transparent;
}
*::-webkit-scrollbar { width: 6px; height: 6px; }
*::-webkit-scrollbar-track { background: transparent; }
*::-webkit-scrollbar-thumb {
  background-color: rgba(0,0,0,.16);
  border-radius: 9999px;
}

// Remove Bootstrap's blue focus ring — use accent
*:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

// Override Bootstrap's primary colour
.btn-primary {
  background-color: var(--accent);
  border-color: var(--accent);
  &:hover { background-color: var(--accent-hover); border-color: var(--accent-hover); }
}

// Selection highlight
::selection {
  background-color: color-mix(in srgb, var(--accent) 20%, white);
  color: color-mix(in srgb, var(--accent) 80%, black);
}
```

---

## Accent Colour Persistence

On app init, load the saved accent colour from localStorage:

```typescript
// app.component.ts
ngOnInit(): void {
  const DEFAULT_ACCENT = '#7244c6';
  const saved = localStorage.getItem('oala-accent') ?? DEFAULT_ACCENT;
  document.documentElement.style.setProperty('--accent', saved);
  // All --accent-* variants derive from this via color-mix() in CSS
}
```

---

## Responsive Breakpoints Summary

| Bootstrap Breakpoint | Width | Behaviour |
|---------------------|-------|-----------|
| xs (default) | < 576px | Single column, 16px text, tall touch targets |
| sm | ≥ 576px | Two-column starter grid, 15px text, smaller buttons |
| lg | ≥ 992px | Sidebar becomes inline (not overlay) |
| — | ≥ 1200px | Mini pathway panel sits alongside chat |
| — | ≥ 1600px | Mini pathway panel expands to 490px |
