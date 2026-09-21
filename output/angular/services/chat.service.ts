import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;              // raw markdown or JSON string
  structured?: StructuredResponse | null;
  timestamp: Date;
  isStreaming?: boolean;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  durationMs?: number;
}

export interface TurnGroup {
  id: string;
  timestamp: Date;
  userMessage: Message;
  assistantMessage?: Message;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  groups: TurnGroup[];
}

export interface StructuredResponse {
  version: string;           // "1.3"
  output_sections: OutputSection[];
  meta?: { model?: string; duration_ms?: number; prompt_tokens?: number; completion_tokens?: number };
}

export interface OutputSection {
  type: string;
  variant?: string;
  heading?: string;
  items?: GuidanceItem[];
  body?: string;
  columns?: string[];
  rows?: string[][];
  value?: number;
  max?: number;
  label?: string;
  question?: string;
  hint?: string;
  choices?: { id: string; label: string; description?: string }[];
  allow_own?: boolean;
  fields?: { id: string; label: string; placeholder?: string; required?: boolean }[];
  content?: string;
  title?: string;
}

export interface GuidanceItem {
  icon?: string;
  title: string;
  description?: string;
  meta?: string[];
  level?: string;
  type?: string;
  badge?: string;
  percentage?: number;
}

export interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  isStreaming: boolean;
  streamingText: string;
  streamingStatus: string;
  error: string | null;
  model: string;
  mode: string;
}

const DEFAULT_STATE: ChatState = {
  conversations: [],
  activeConversationId: null,
  isStreaming: false,
  streamingText: '',
  streamingStatus: '',
  error: null,
  model: 'gemini-2.0-flash',
  mode: 'standard',
};

@Injectable({ providedIn: 'root' })
export class ChatService {
  private state$ = new BehaviorSubject<ChatState>(DEFAULT_STATE);

  get snapshot(): ChatState { return this.state$.getValue(); }
  get state(): Observable<ChatState> { return this.state$.asObservable(); }

  get activeConversation(): Conversation | undefined {
    const s = this.snapshot;
    return s.conversations.find(c => c.id === s.activeConversationId);
  }

  patch(partial: Partial<ChatState>): void {
    this.state$.next({ ...this.snapshot, ...partial });
  }

  newConversation(): void {
    const id = crypto.randomUUID();
    const conv: Conversation = { id, title: 'New conversation', createdAt: new Date(), updatedAt: new Date(), groups: [] };
    this.patch({
      conversations: [conv, ...this.snapshot.conversations],
      activeConversationId: id,
      error: null,
    });
  }

  selectConversation(id: string): void {
    this.patch({ activeConversationId: id, error: null });
  }

  addUserMessage(text: string, attachments: File[] = []): string {
    const msgId = crypto.randomUUID();
    const groupId = crypto.randomUUID();
    const msg: Message = { id: msgId, role: 'user', content: text, timestamp: new Date() };
    const group: TurnGroup = { id: groupId, timestamp: new Date(), userMessage: msg };

    this._mutateActive(conv => {
      conv.groups = [...conv.groups, group];
      conv.updatedAt = new Date();
      if (conv.groups.length === 1) {
        conv.title = text.slice(0, 55) + (text.length > 55 ? '…' : '');
      }
    });
    return groupId;
  }

  startStreaming(groupId: string): void {
    this.patch({ isStreaming: true, streamingText: '', streamingStatus: 'Thinking…', error: null });
  }

  appendStreamChunk(chunk: string): void {
    this.patch({ streamingText: this.snapshot.streamingText + chunk });
  }

  setStreamingStatus(status: string): void {
    this.patch({ streamingStatus: status });
  }

  finaliseAssistantMessage(groupId: string, raw: string, parsed: StructuredResponse | null, meta?: Partial<Message>): void {
    const msg: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: raw,
      structured: parsed,
      timestamp: new Date(),
      ...meta,
    };
    this._mutateActive(conv => {
      const g = conv.groups.find(g => g.id === groupId);
      if (g) g.assistantMessage = msg;
      conv.updatedAt = new Date();
    });
    this.patch({ isStreaming: false, streamingText: '', streamingStatus: '' });
  }

  stopStreaming(): void {
    this.patch({ isStreaming: false, streamingStatus: '' });
  }

  setError(message: string): void {
    this.patch({ isStreaming: false, streamingText: '', streamingStatus: '', error: message });
  }

  private _mutateActive(fn: (c: Conversation) => void): void {
    const convs = this.snapshot.conversations.map(c => {
      if (c.id !== this.snapshot.activeConversationId) return c;
      const clone = { ...c, groups: [...c.groups] };
      fn(clone);
      return clone;
    });
    this.patch({ conversations: convs });
  }
}
