import {
  Component, EventEmitter, Input, OnDestroy, OnInit,
  Output, ViewChild, ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AutoGrowDirective } from '../../directives/auto-grow.directive';

export interface ComposerSendEvent {
  text: string;
  attachments: File[];
  oalaMention: boolean;
}

@Component({
  selector: 'app-composer',
  standalone: true,
  imports: [CommonModule, FormsModule, AutoGrowDirective],
  templateUrl: './composer.component.html',
  styleUrls: ['./composer.component.scss'],
})
export class ComposerComponent implements OnInit, OnDestroy {
  @Input() isStreaming = false;
  @Input() conversationId = '';
  @Output() messageSent = new EventEmitter<ComposerSendEvent>();
  @Output() stopStreaming = new EventEmitter<void>();

  @ViewChild('textareaEl') textareaEl!: ElementRef<HTMLTextAreaElement>;
  @ViewChild(AutoGrowDirective) autoGrow!: AutoGrowDirective;

  text = '';
  attachments: File[] = [];
  previewUrls: string[] = [];
  oalaMentionActive = false;
  showOalaSuggestion = false;
  isListening = false;

  private recognition: SpeechRecognition | null = null;
  private readonly DRAFT_KEY_PREFIX = 'oala-draft:';

  ngOnInit(): void {
    // Restore session draft
    const draft = sessionStorage.getItem(this.DRAFT_KEY_PREFIX + this.conversationId);
    if (draft) this.text = draft;

    // Init speech recognition
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (SR) {
      this.recognition = new SR() as SpeechRecognition;
      this.recognition.lang = 'en-US';
      this.recognition.interimResults = true;
      this.recognition.continuous = false;
      this.recognition.onresult = (e: SpeechRecognitionEvent) => {
        const transcript = Array.from(e.results)
          .map(r => r[0].transcript)
          .join('');
        this.text = transcript;
      };
      this.recognition.onend = () => { this.isListening = false; };
    }
  }

  ngOnDestroy(): void {
    this.recognition?.abort();
    this.previewUrls.forEach(url => URL.revokeObjectURL(url));
  }

  onInput(): void {
    // Save draft
    sessionStorage.setItem(this.DRAFT_KEY_PREFIX + this.conversationId, this.text);

    // @Oala mention detection
    const last = this.text.split(/\s/).pop() ?? '';
    this.showOalaSuggestion = !this.oalaMentionActive && /^@o/i.test(last);
  }

  onKeydown(e: KeyboardEvent): void {
    if (this.showOalaSuggestion && (e.key === 'Enter' || e.key === 'Tab')) {
      e.preventDefault();
      this.selectOalaMention();
      return;
    }
    if (this.showOalaSuggestion && e.key === 'Escape') {
      this.showOalaSuggestion = false;
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.send();
    }
  }

  send(): void {
    const trimmed = this.text.trim();
    if (!trimmed || this.isStreaming) return;

    this.messageSent.emit({
      text: trimmed,
      attachments: [...this.attachments],
      oalaMention: this.oalaMentionActive,
    });

    // Reset
    this.text = '';
    this.attachments = [];
    this.previewUrls.forEach(url => URL.revokeObjectURL(url));
    this.previewUrls = [];
    this.oalaMentionActive = false;
    this.showOalaSuggestion = false;
    sessionStorage.removeItem(this.DRAFT_KEY_PREFIX + this.conversationId);

    setTimeout(() => this.autoGrow?.reset(), 0);
  }

  stop(): void {
    this.stopStreaming.emit();
  }

  selectOalaMention(): void {
    this.oalaMentionActive = true;
    this.showOalaSuggestion = false;
    // Strip any partial @o... from text
    this.text = this.text.replace(/@o\w*/i, '').trimStart();
  }

  removeOalaMention(): void {
    this.oalaMentionActive = false;
  }

  toggleVoice(): void {
    if (!this.recognition) return;
    if (this.isListening) {
      this.recognition.stop();
    } else {
      this.isListening = true;
      this.recognition.start();
    }
  }

  onFileSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    for (const file of files) {
      this.attachments.push(file);
      if (file.type.startsWith('image/')) {
        this.previewUrls.push(URL.createObjectURL(file));
      } else {
        this.previewUrls.push('');
      }
    }
    input.value = '';
  }

  removeAttachment(i: number): void {
    if (this.previewUrls[i]) URL.revokeObjectURL(this.previewUrls[i]);
    this.attachments.splice(i, 1);
    this.previewUrls.splice(i, 1);
  }

  isImageFile(file: File): boolean {
    return file.type.startsWith('image/');
  }
}
