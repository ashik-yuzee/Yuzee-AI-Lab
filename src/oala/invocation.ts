/** Explicit, per-message addressing. Quoted mentions, email addresses and old turns do not activate Oala. */
export function parseOalaMention(value: unknown): { active: boolean; message: string } {
  const text = typeof value === 'string' ? value : '';
  const match = text.match(/^\s*@\s*oala(?=$|\s|[:,!?])[:,!?]?\s*/i);
  return { active: !!match, message: match ? text.slice(match[0].length).trim() : text };
}

export function addressOala(text: string): string {
  if (parseOalaMention(text).active) return text;
  return '@Oala ' + (isOalaSuggestion(text) ? '' : text);
}

export function isOalaSuggestion(text: string): boolean {
  return /^\s*@(?:o(?:a(?:l(?:a)?)?)?)?$/i.test(text);
}
