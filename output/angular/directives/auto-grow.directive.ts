import { Directive, ElementRef, HostListener, Input, OnInit } from '@angular/core';

/**
 * AutoGrowDirective — mirrors the React auto-grow textarea logic.
 *
 * Usage:  <textarea appAutoGrow [maxHeightPx]="176"></textarea>
 *
 * The textarea starts at its natural single-line height and expands
 * up to maxHeightPx as content grows. When overflow is reached the
 * textarea becomes scrollable.
 */
@Directive({ selector: '[appAutoGrow]', standalone: true })
export class AutoGrowDirective implements OnInit {
  @Input() maxHeightPx = 176; // ~7 lines at 1.55 line-height

  constructor(private el: ElementRef<HTMLTextAreaElement>) {}

  ngOnInit(): void {
    const ta = this.el.nativeElement;
    ta.style.overflow = 'hidden';
    ta.style.resize = 'none';
    this._resize();
  }

  @HostListener('input') onInput(): void { this._resize(); }

  private _resize(): void {
    const ta = this.el.nativeElement;
    ta.style.height = 'auto';
    const next = Math.min(ta.scrollHeight, this.maxHeightPx);
    ta.style.height = `${next}px`;
    ta.style.overflowY = ta.scrollHeight > this.maxHeightPx ? 'auto' : 'hidden';
  }

  /** Call this externally after programmatically clearing the textarea. */
  reset(): void { this._resize(); }
}
