import { describe, expect, it } from 'vitest';
import { formatSourceDisplayName } from './source-display-name';

describe('formatSourceDisplayName', () => {
  it('formats a MacBook only from available source attributes', () => {
    expect(
      formatSourceDisplayName({
        sourceName: 'Notebook Apple MacBook Air 2026 Apple M5 Memoria 16GB SSD 512GB 13.6"',
      }),
    ).toBe('MacBook Air 13” Chip M5 16GB/512GB');
  });

  it('formats the Canon example only when the explicit manufacturer is available', () => {
    const sourceName = 'Camera Digital Canon EOS Rebel T7 24.1MP Lente EF-S 18-55MM IS II';
    expect(formatSourceDisplayName({ sourceName, sourceManufacturer: 'Canon' })).toBe(
      'Canon EOS Rebel T7 24.1MP + Lente EF-S 18-55mm',
    );
    expect(formatSourceDisplayName({ sourceName })).toBe(sourceName);
  });
});
