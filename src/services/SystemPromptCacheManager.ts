/**
 * Manages explicit Gemini context caches for system prompts.
 * Caches are keyed by (model, slot). A slot holds one prompt: when its hash changes (redeploy,
 * custom prompt) the old remote cache is deleted and rebuilt. Different slots — the default
 * counsellor prompt and the EXP-RAG core prompt — coexist without evicting each other.
 * Cache creation happens in the background — first 1-2 requests per slot use systemInstruction.
 * Refreshes automatically when < 10 minutes remain on the TTL.
 */

import { GoogleGenAI } from '@google/genai';
import { QUIZ_PROMPT_VERSION } from '../prompts/quizPrompt';

const TTL_SECONDS = 3600; // 1 hour
const REFRESH_BEFORE_MS = 10 * 60 * 1000; // refresh when < 10 min left

interface CacheEntry {
  name: string;          // 'cachedContents/xxxx'
  promptHash: string;    // detect stale cache on prompt redeploy
  expiresAt: number;     // epoch ms
}

export interface CacheStatus {
  active: boolean;
  name?: string;
  ttlMs?: number;
  creating: boolean;
  stale?: boolean;
}

export class SystemPromptCacheManager {
  private caches = new Map<string, CacheEntry>();
  private creating = new Set<string>();
  // key → retry-after epoch ms. Unsupported tiers keep failing and back off; transient errors (429, network) recover.
  private failedUntil = new Map<string, number>();

  /**
   * Returns the cachedContent name when ready, null otherwise.
   * Kicks off background creation on first call per (model, slot).
   * Refreshes TTL proactively when close to expiry.
   * If the slot's prompt hash changed (new deploy), rebuilds the cache.
   */
  async getCacheForModel(
    model: string,
    ai: GoogleGenAI,
    systemInstruction: string,
    promptHash: string,
    slot = 'default',
    label = `yuzee-prompt-v${QUIZ_PROMPT_VERSION}`
  ): Promise<string | null> {
    const key = slot === 'default' ? model : `${model}|${slot}`;
    const entry = this.caches.get(key);
    if (entry) {
      const msRemaining = entry.expiresAt - Date.now();
      const isStale = entry.promptHash !== promptHash;

      if (!isStale && msRemaining > 0) {
        if (msRemaining < REFRESH_BEFORE_MS && !this.creating.has(key)) {
          this._refresh(key, entry.name, ai, promptHash).catch(() => {});
        }
        return entry.name;
      }
      // Expired or stale prompt — remove and rebuild
      this.caches.delete(key);
      if (isStale) {
        // Prompt changed: delete old remote cache to avoid paying storage for unused content
        ai.caches.delete({ name: entry.name }).catch(() => {});
      }
    }

    if (!this.creating.has(key) && (this.failedUntil.get(key) ?? 0) < Date.now()) {
      this._create(key, model, ai, systemInstruction, promptHash, label).catch(() => {});
    }
    return null;
  }

  getStatus(model: string, slot = 'default'): CacheStatus {
    const key = slot === 'default' ? model : `${model}|${slot}`;
    const entry = this.caches.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return { active: true, name: entry.name, ttlMs: entry.expiresAt - Date.now(), creating: false };
    }
    return { active: false, creating: this.creating.has(key) };
  }

  private async _create(key: string, model: string, ai: GoogleGenAI, systemInstruction: string, promptHash: string, label: string): Promise<void> {
    this.creating.add(key);
    try {
      const geminiModel = model.startsWith('models/') ? model : `models/${model}`;
      const cache = await ai.caches.create({
        model: geminiModel,
        config: {
          systemInstruction,
          ttl: `${TTL_SECONDS}s`,
          displayName: `${label}-${model}`,
        },
      });
      if (cache.name) {
        this.caches.set(key, {
          name: cache.name,
          promptHash,
          expiresAt: Date.now() + (TTL_SECONDS - 60) * 1000,
        });
        console.log(`[CacheManager] Created cache ${cache.name} for ${key}`);
      }
    } catch (err) {
      this.failedUntil.set(key, Date.now() + 10 * 60 * 1000);
    } finally {
      this.creating.delete(key);
    }
  }

  private async _refresh(key: string, name: string, ai: GoogleGenAI, promptHash: string): Promise<void> {
    this.creating.add(key);
    try {
      await ai.caches.update({ name, config: { ttl: `${TTL_SECONDS}s` } });
      this.caches.set(key, { name, promptHash, expiresAt: Date.now() + (TTL_SECONDS - 60) * 1000 });
    } catch {
      this.caches.delete(key); // will be recreated on next request
    } finally {
      this.creating.delete(key);
    }
  }
}
