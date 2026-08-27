import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface SharedSettings {
  systemPromptMode: 'default' | 'custom';
  customSystemPrompt: string;
  contextBudget: number;
  recentTurnsToKeep: number;
  strategy: string;
  updatedAt: number;
}

const FILE = path.join(process.cwd(), 'data', 'shared-settings.json');

const DEFAULTS: SharedSettings = {
  systemPromptMode: 'default',
  customSystemPrompt: '',
  contextBudget: 270000,
  recentTurnsToKeep: 100,
  strategy: 'ADAPTIVE_HYBRID',
  updatedAt: 0,
};

export class SharedSettingsManager {
  private s: SharedSettings;

  constructor() {
    this.s = this.load();
  }

  private load(): SharedSettings {
    try {
      if (fs.existsSync(FILE)) {
        return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(FILE, 'utf-8')) };
      }
    } catch (e) {
      console.error('[SharedSettings] load failed:', e);
    }
    return { ...DEFAULTS };
  }

  private save(): void {
    try {
      fs.mkdirSync(path.dirname(FILE), { recursive: true });
      fs.writeFileSync(FILE, JSON.stringify(this.s, null, 2), 'utf-8');
    } catch (e) {
      console.error('[SharedSettings] save failed:', e);
    }
  }

  get(): SharedSettings {
    return { ...this.s };
  }

  update(patch: Partial<Omit<SharedSettings, 'updatedAt'>>): SharedSettings {
    this.s = { ...this.s, ...patch, updatedAt: Date.now() };
    this.save();
    return this.get();
  }

  /** Reset system prompt to default, keep retention settings. */
  resetPrompt(): SharedSettings {
    return this.update({ systemPromptMode: 'default', customSystemPrompt: '' });
  }

  /** Returns the system prompt content to use: custom if set, otherwise default. */
  effectivePrompt(defaultContent: string): string {
    if (this.s.systemPromptMode === 'custom' && this.s.customSystemPrompt.trim()) {
      return this.s.customSystemPrompt.trim();
    }
    return defaultContent;
  }

  /**
   * Returns a stable hash for the current effective prompt.
   * Used to key the Gemini explicit context cache — ensures cache is
   * invalidated when the prompt changes, and shared across all users
   * sending the same prompt.
   */
  effectiveHash(defaultHash: string): string {
    if (this.s.systemPromptMode === 'custom' && this.s.customSystemPrompt.trim()) {
      return crypto
        .createHash('sha256')
        .update(this.s.customSystemPrompt.trim())
        .digest('hex')
        .slice(0, 16);
    }
    return defaultHash;
  }
}
