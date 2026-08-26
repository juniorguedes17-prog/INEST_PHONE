import {
  canonicalColorAliases,
  normalizeCanonicalProductIdentity,
  normalizeCanonicalText,
} from '@inest/product-identity';

interface VisualColor {
  emoji: string;
  label: string;
}

const visualColors: Record<string, VisualColor> = {
  preto: { emoji: '⚫️', label: 'Preto' },
  'cinza-espacial': { emoji: '⚫️', label: 'Cinza Espacial' },
  branco: { emoji: '⚪️', label: 'Branco' },
  prata: { emoji: '⚪️', label: 'Prata' },
  'azul-profundo': { emoji: '🔵', label: 'Azul' },
  azul: { emoji: '🔵', label: 'Azul' },
  rosa: { emoji: '🩷', label: 'Rosa' },
  roxo: { emoji: '🟣', label: 'Roxo' },
  verde: { emoji: '🟢', label: 'Verde' },
  laranja: { emoji: '🟠', label: 'Laranja' },
  amarelo: { emoji: '🟡', label: 'Amarelo' },
  dourado: { emoji: '🟡', label: 'Dourado' },
  'titanio-natural': { emoji: '🩶', label: 'Titânio Natural' },
  deserto: { emoji: '🟤', label: 'Desert' },
};

export function formatColorLabel(value: string | null | undefined) {
  const cleanValue = removeSourceEmoji(value);
  if (!cleanValue) return '';

  const identity = normalizeCanonicalProductIdentity({ color: cleanValue });
  const canonicalColor = identity.canonicalColor;
  const canonicalAlias = canonicalColorAliases.find((alias) => alias.value === canonicalColor);
  if (!canonicalAlias) return cleanValue;

  const visual = visualColors[canonicalAlias.value];
  if (!visual) return cleanValue;

  const normalizedInput = normalizeCanonicalText(cleanValue);
  if (canonicalColor === 'dourado' && normalizedInput === 'starlight') {
    return '⭐️ Starlight';
  }
  if (canonicalColor === 'roxo' && /^(lilas|lavender)$/.test(normalizedInput)) {
    return '🟣 Lilás';
  }

  return `${visual.emoji} ${visual.label}`;
}

function removeSourceEmoji(value: string | null | undefined) {
  return (value ?? '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\p{Emoji_Presentation}/gu, '')
    .replace(/\p{Emoji_Modifier}/gu, '')
    .replace(/\u200D/g, '')
    .replace(/\uFE0F/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
