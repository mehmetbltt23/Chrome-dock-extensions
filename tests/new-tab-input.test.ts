import { describe, expect, it } from 'vitest';
import { resolveNewTabInput } from '../src/domain/new-tab-input';

describe('new tab search box', () => {
  it('navigates to full and bare web addresses', () => {
    expect(resolveNewTabInput('https://github.com/org')).toEqual({ kind: 'url', url: 'https://github.com/org' });
    expect(resolveNewTabInput('  GitHub.com/org?tab=repos ')).toEqual({ kind: 'url', url: 'https://github.com/org?tab=repos' });
    expect(resolveNewTabInput('localhost:5173')).toEqual({ kind: 'url', url: 'http://localhost:5173/' });
  });
  it('searches for text, unsafe schemes, and credential URLs', () => {
    expect(resolveNewTabInput('chrome extension new tab')).toEqual({ kind: 'search', text: 'chrome extension new tab' });
    expect(resolveNewTabInput('javascript:alert(1)')).toEqual({ kind: 'search', text: 'javascript:alert(1)' });
    expect(resolveNewTabInput('https://user:secret@example.com/')).toEqual({ kind: 'search', text: 'https://user:secret@example.com/' });
    expect(resolveNewTabInput('react')).toEqual({ kind: 'search', text: 'react' });
  });
  it('ignores empty input and bounds long input', () => {
    expect(resolveNewTabInput('   ')).toEqual({ kind: 'empty' });
    const long = resolveNewTabInput('x '.repeat(3000));
    expect(long.kind === 'search' && long.text.length <= 2048).toBe(true);
  });
});
