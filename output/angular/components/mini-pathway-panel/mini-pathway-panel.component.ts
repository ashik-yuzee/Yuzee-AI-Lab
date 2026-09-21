import {
  Component, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { StructuredResponse } from '../../services/chat.service';
import { ProtocolRendererComponent } from '../protocol-renderer/protocol-renderer.component';

export interface SavedPathway {
  id: string;
  title: string;
  context: string;
  report: StructuredResponse;
  colourLegend?: Array<{ tone: string; label: string }>;
  generatedAt: Date;
}

@Component({
  selector: 'app-mini-pathway-panel',
  standalone: true,
  imports: [CommonModule, ProtocolRendererComponent],
  templateUrl: './mini-pathway-panel.component.html',
  styleUrls: ['./mini-pathway-panel.component.scss'],
})
export class MiniPathwayPanelComponent implements OnInit, OnDestroy {
  @Input() savedPathways: SavedPathway[] = [];
  @Input() isOpen = false;
  @Output() panelClose = new EventEmitter<void>();
  @Output() pathwayGenerated = new EventEmitter<SavedPathway>();

  activePathway: SavedPathway | null = null;
  isExpanded = false;
  isGenerating = false;
  isResizing = false;
  dropdownOpen = false;
  streamContent = '';
  streamStatus = '';
  panelWidth = 440;

  private resizeStartX = 0;
  private resizeStartWidth = 440;
  private abortCtrl: AbortController | null = null;

  ngOnInit(): void {
    if (this.savedPathways.length > 0) {
      this.activePathway = this.savedPathways[0];
    }
  }

  ngOnDestroy(): void { this.abortCtrl?.abort(); }

  close(): void { this.panelClose.emit(); }

  toggleExpand(): void { this.isExpanded = !this.isExpanded; }

  toggleDropdown(): void { this.dropdownOpen = !this.dropdownOpen; }

  selectPathway(pw: SavedPathway): void {
    this.activePathway = pw;
    this.dropdownOpen = false;
  }

  stopGeneration(): void {
    this.abortCtrl?.abort();
    this.isGenerating = false;
  }

  /**
   * Trigger pathway generation for a given user query.
   * Called externally by a parent (e.g. ChatArea) when the MiniLM score ≥ 0.42.
   */
  async generate(query: string, model = 'gemini-2.0-flash'): Promise<void> {
    this.abortCtrl = new AbortController();
    this.isGenerating = true;
    this.streamContent = '';
    this.streamStatus = 'Generating pathway…';

    try {
      const res = await fetch('/api/mini-pathway', {
        method: 'POST',
        signal: this.abortCtrl.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, model }),
      });

      if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));

      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buffer = '';
      let raw = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += dec.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') continue;
          try {
            const ev = JSON.parse(data);
            if (ev.type === 'status') this.streamStatus = ev.message ?? '';
            else if (ev.type === 'chunk') { raw += ev.text ?? ''; this.streamContent += ev.text ?? ''; }
            else if (ev.type === 'done') {
              const report = tryParseProtocol(raw);
              if (report) {
                const pw: SavedPathway = {
                  id: crypto.randomUUID(),
                  title: ev.title ?? query.slice(0, 55),
                  context: query.slice(0, 80),
                  report,
                  generatedAt: new Date(),
                };
                this.savedPathways = [pw, ...this.savedPathways];
                this.activePathway = pw;
                this.pathwayGenerated.emit(pw);
              }
            }
          } catch { /* skip */ }
        }
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') console.error('Pathway generation failed', e);
    } finally {
      this.isGenerating = false;
      this.streamContent = '';
      this.streamStatus = '';
    }
  }

  // ── Resize ───────────────────────────────────────────────
  startResize(e: MouseEvent): void {
    this.isResizing = true;
    this.resizeStartX = e.clientX;
    this.resizeStartWidth = this.panelWidth;
    e.preventDefault();
  }

  startResizeTouch(e: TouchEvent): void {
    this.isResizing = true;
    this.resizeStartX = e.touches[0].clientX;
    this.resizeStartWidth = this.panelWidth;
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(e: MouseEvent): void {
    if (!this.isResizing) return;
    const delta = this.resizeStartX - e.clientX;
    this.panelWidth = Math.min(700, Math.max(320, this.resizeStartWidth + delta));
  }

  @HostListener('document:mouseup')
  onMouseUp(): void { this.isResizing = false; }

  @HostListener('document:touchmove', ['$event'])
  onTouchMove(e: TouchEvent): void {
    if (!this.isResizing) return;
    const delta = this.resizeStartX - e.touches[0].clientX;
    this.panelWidth = Math.min(700, Math.max(320, this.resizeStartWidth + delta));
  }

  @HostListener('document:touchend')
  onTouchEnd(): void { this.isResizing = false; }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent): void {
    if (this.dropdownOpen && !(e.target as HTMLElement).closest('.mini-pathway-history')) {
      this.dropdownOpen = false;
    }
  }
}

function tryParseProtocol(raw: string): StructuredResponse | null {
  const inner = raw.trim()
    .replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  try {
    const p = JSON.parse(inner);
    return p?.version && p?.output_sections ? p : null;
  } catch { return null; }
}
