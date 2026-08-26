import assert from 'node:assert/strict';
import test from 'node:test';
import { formatColorLabel } from './color-label';

test('normalizes Portuguese and English color aliases to visual labels', () => {
  const cases: Array<[string, string]> = [
    ['Preto', '⚫️ Preto'],
    ['🖤 Black', '⚫️ Preto'],
    ['Prata', '⚪️ Prata'],
    ['Silver', '⚪️ Prata'],
    ['Space Gray', '⚫️ Cinza Espacial'],
    ['Cinza Espacial', '⚫️ Cinza Espacial'],
    ['Graphite', '⚫️ Cinza Espacial'],
    ['Blue', '🔵 Azul'],
    ['Deep Blue', '🔵 Azul'],
    ['Lilás', '🟣 Lilás'],
    ['Lavender', '🟣 Lilás'],
    ['Pink', '🩷 Rosa'],
    ['Rose', '🩷 Rosa'],
    ['Blush', '🩷 Rosa'],
    ['Sage', '🟢 Verde'],
    ['Gold', '🟡 Dourado'],
    ['Starlight', '⭐️ Starlight'],
    ['Natural Titanium', '🩶 Titânio Natural'],
    ['Desert', '🟤 Desert'],
    ['Cosmic Orange', '🟠 Laranja'],
  ];

  cases.forEach(([input, expected]) => assert.equal(formatColorLabel(input), expected));
});

test('removes source emoji and handles case and accents', () => {
  assert.equal(formatColorLabel('🩶 CINZA ESPACIAL'), '⚫️ Cinza Espacial');
  assert.equal(formatColorLabel('  aZuL  '), '🔵 Azul');
});

test('keeps unknown colors legible without inventing an emoji', () => {
  assert.equal(formatColorLabel('🎨 Mystery Finish'), 'Mystery Finish');
  assert.equal(formatColorLabel(''), '');
  assert.equal(formatColorLabel('🎨'), '');
});
