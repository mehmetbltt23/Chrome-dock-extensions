import { validateShortcutUrl } from './url';

export type NewTabTarget = { kind: 'url'; url: string } | { kind: 'search'; text: string } | { kind: 'empty' };

const MAX_INPUT_LENGTH = 2048;
// A bare host such as `github.com/org` or `localhost:5173`; anything with spaces is a search.
const HOST_LIKE = /^(?:localhost|[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,})(?::\d{1,5})?(?:[/?#]\S*)?$/u;

function toUrl(candidate: string): string | null {
  try { return validateShortcutUrl(candidate); } catch { return null; }
}

/** Resolves new-tab search box input the way the address bar would: addresses navigate, everything else searches. */
export function resolveNewTabInput(input: string): NewTabTarget {
  const text = input.trim().slice(0, MAX_INPUT_LENGTH);
  if (text.length === 0) return { kind: 'empty' };
  if (/^https?:\/\//i.test(text)) {
    const url = toUrl(text);
    return url === null ? { kind: 'search', text } : { kind: 'url', url };
  }
  if (HOST_LIKE.test(text)) {
    const url = toUrl(`${text.toLowerCase().startsWith('localhost') ? 'http' : 'https'}://${text}`);
    if (url !== null) return { kind: 'url', url };
  }
  return { kind: 'search', text };
}
