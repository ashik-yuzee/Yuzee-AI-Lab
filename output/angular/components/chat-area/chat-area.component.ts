import {
  Component, ElementRef, Input, OnDestroy, OnInit, ViewChild, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

import { ChatService, ChatState, TurnGroup } from '../../services/chat.service';
import { StreamingService } from '../../services/streaming.service';
import { ComposerComponent, ComposerSendEvent } from '../composer/composer.component';
import { ProtocolRendererComponent } from '../protocol-renderer/protocol-renderer.component';

@Component({
  selector: 'app-chat-area',
  standalone: true,
  imports: [CommonModule, ComposerComponent, ProtocolRendererComponent],
  templateUrl: './chat-area.component.html',
  styleUrls: ['./chat-area.component.scss'],
})
export class ChatAreaComponent implements OnInit, OnDestroy {
  @ViewChild('scrollEl') scrollEl!: ElementRef<HTMLDivElement>;

  groups: TurnGroup[] = [];
  conversationId = '';
  isStreaming = false;
  streamingText = '';
  streamingStatus = '';
  error: string | null = null;

  starterPrompts = [
    { icon: 'school-outline',   text: 'What qualifications do I need to become a nurse?' },
    { icon: 'map-outline',      text: 'Show me pathway options from Certificate III to Diploma' },
    { icon: 'briefcase-outline',text: 'Which courses are industry-recognised in engineering?' },
    { icon: 'globe-outline',    text: 'Can I study online and still get credit at TAFE?' },
  ];

  private sub!: Subscription;
  private lastGroupId = '';

  constructor(
    private chat: ChatService,
    private streaming: StreamingService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.sub = this.chat.state.subscribe((s: ChatState) => {
      const conv = s.conversations.find(c => c.id === s.activeConversationId);
      this.groups = conv?.groups ?? [];
      this.conversationId = s.activeConversationId ?? '';
      this.isStreaming = s.isStreaming;
      this.streamingText = s.streamingText;
      this.streamingStatus = s.streamingStatus;
      this.error = s.error;
      this.cdr.markForCheck();
      this._scrollToBottom();
    });
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }

  async onMessageSent(e: ComposerSendEvent): Promise<void> {
    if (!this.conversationId) this.chat.newConversation();
    const groupId = this.chat.addUserMessage(e.text, e.attachments);
    this.lastGroupId = groupId;
    await this.streaming.send(e.text, this.conversationId, groupId, {
      mode: e.oalaMention ? 'oala' : undefined,
    });
  }

  stop(): void { this.streaming.stop(); }

  retry(): void {
    this.chat.patch({ error: null });
    // Re-send last user message — find it from state
    const group = this.groups[this.groups.length - 1];
    if (group?.userMessage) {
      this.streaming.send(group.userMessage.content, this.conversationId, group.id);
    }
  }

  useStarter(text: string): void {
    if (!this.conversationId) this.chat.newConversation();
    const groupId = this.chat.addUserMessage(text);
    this.streaming.send(text, this.conversationId, groupId);
  }

  onInteractionSubmit(event: { groupId: string; answer: any }): void {
    const answerText = typeof event.answer === 'string'
      ? event.answer
      : JSON.stringify(event.answer);
    const groupId = this.chat.addUserMessage(answerText);
    this.streaming.send(answerText, this.conversationId, groupId);
  }

  modelChipClass(model: string): Record<string, boolean> {
    const m = (model ?? '').toLowerCase();
    return {
      'model-chip--pro':   m.includes('pro') || m.includes('ultra'),
      'model-chip--flash': m.includes('flash') || m.includes('haiku'),
      'model-chip--gpt':   m.includes('gpt'),
    };
  }

  private _scrollToBottom(): void {
    setTimeout(() => {
      const el = this.scrollEl?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 0);
  }
}
