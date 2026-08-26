/**
 * Manages per-model explicit context caches for the Yuzee system prompt.
 * The system prompt is ~28k tokens; caching it reduces input cost by ~75% on cache hits.
 * Cache creation happens in the background — first 1-2 requests per model use systemInstruction.
 * Refreshes automatically when < 10 minutes remain on the TTL.
 */

import { GoogleGenAI } from '@google/genai';

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
  private failed = new Set<string>(); // models that don't support caching on this tier

  /**
   * Returns the cachedContent name when ready, null otherwise.
   * Kicks off background creation on first call per model.
   * Refreshes TTL proactively when close to expiry.
   * If the prompt hash changed (new deploy), rebuilds the cache.
   */
  async getCacheForModel(
    model: string,
    ai: GoogleGenAI,
    systemInstruction: string,
    promptHash: string
  ): Promise<string | null> {
    const entry = this.caches.get(model);
    if (entry) {
      const msRemaining = entry.expiresAt - Date.now();
      const isStale = entry.promptHash !== promptHash;

      if (!isStale && msRemaining > 0) {
        if (msRemaining < REFRESH_BEFORE_MS && !this.creating.has(model)) {
          this._refresh(model, entry.name, ai, promptHash).catch(() => {});
        }
        return entry.name;
      }
      // Expired or stale prompt — remove and rebuild
      this.caches.delete(model);
      if (isStale) {
        // Prompt changed: delete old remote cache to avoid paying storage for unused content
        ai.caches.delete({ name: entry.name }).catch(() => {});
      }
    }

    if (!this.creating.has(model) && !this.failed.has(model)) {
      this._create(model, ai, systemInstruction, promptHash).catch(() => {});
    }
    return null;
  }

  getStatus(model: string): CacheStatus {
    const entry = this.caches.get(model);
    if (entry && entry.expiresAt > Date.now()) {
      return { active: true, name: entry.name, ttlMs: entry.expiresAt - Date.now(), creating: false };
    }
    return { active: false, creating: this.creating.has(model) };
  }

  private async _create(model: string, ai: GoogleGenAI, systemInstruction: string, promptHash: string): Promise<void> {
    this.creating.add(model);
    try {
      const geminiModel = model.startsWith('models/') ? model : `models/${model}`;
      const cache = await ai.caches.create({
        model: geminiModel,
        config: {
          systemInstruction,
          ttl: `${TTL_SECONDS}s`,
          displayName: `yuzee-prompt-v0.12-${model}`,
        },
      });
      if (cache.name) {
        this.caches.set(model, {
          name: cache.name,
          promptHash,
          expiresAt: Date.now() + (TTL_SECONDS - 60) * 1000,
        });
        console.log(`[CacheManager] Created cache ${cache.name} for ${model}`);
      }
    } catch (err) {
      this.failed.add(model); // don't retry — caching not supported on this tier/model
    } finally {
      this.creating.delete(model);
    }
  }

  private async _refresh(model: string, name: string, ai: GoogleGenAI, promptHash: string): Promise<void> {
    this.creating.add(model);
    try {
      await ai.caches.update({ name, config: { ttl: `${TTL_SECONDS}s` } });
      this.caches.set(model, { name, promptHash, expiresAt: Date.now() + (TTL_SECONDS - 60) * 1000 });
    } catch {
      this.caches.delete(model); // will be recreated on next request
    } finally {
      this.creating.delete(model);
    }
  }
}
