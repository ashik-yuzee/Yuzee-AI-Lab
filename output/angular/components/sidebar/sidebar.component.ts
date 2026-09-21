import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ChatService, Conversation } from '../../services/chat.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
})
export class SidebarComponent implements OnInit, OnDestroy {
  @Input() isOpen = false;
  @Input() userEmail = '';
  @Output() closed = new EventEmitter<void>();

  conversations: Conversation[] = [];
  activeId: string | null = null;

  private sub!: Subscription;

  constructor(private chat: ChatService) {}

  ngOnInit(): void {
    this.sub = this.chat.state.subscribe(s => {
      this.conversations = s.conversations;
      this.activeId = s.activeConversationId;
    });
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }

  newConversation(): void {
    this.chat.newConversation();
    this.closed.emit();
  }

  select(id: string): void {
    this.chat.selectConversation(id);
    this.closed.emit();
  }

  get totalTokens(): number {
    return this.conversations.reduce((sum, c) =>
      sum + c.groups.reduce((g, turn) => {
        const msg = turn.assistantMessage;
        return g + (msg?.promptTokens ?? 0) + (msg?.completionTokens ?? 0);
      }, 0), 0);
  }

  // Rough cost: $0.075/M input + $0.30/M output (Gemini Flash pricing)
  get totalCostUsd(): number {
    return this.conversations.reduce((sum, c) =>
      sum + c.groups.reduce((g, turn) => {
        const msg = turn.assistantMessage;
        return g
          + ((msg?.promptTokens ?? 0) / 1_000_000) * 0.075
          + ((msg?.completionTokens ?? 0) / 1_000_000) * 0.30;
      }, 0), 0);
  }
}
