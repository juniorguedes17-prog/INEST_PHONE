export function normalizeCanonicalText(value: string | null | undefined) {
  return (value ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u{1F4B0}\u{1F4B2}\u{1F4B5}]\s*\d[\d.,]*\b/gu, ' ')
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}]/gu, ' ')
    .replace(/\*|~|`/g, ' ')
    .replace(/\b\d{1,2}[\s/.-]+\d{1,2}[\s/.-]+20\d{2}\b/g, ' ')
    .replace(/\br\$?\s*\d[\d.,]*\b|\$\s*\d[\d.,]*/gi, ' ')
    .replace(/\b\d{2,4}[.,]\d{2}\b/g, ' ')
    .replace(/[|_()[\]{}:;,+-]/g, ' ')
    .replace(/\b(\d+)\s*(gb|tb|mm)\b/gi, '$1$2')
    .replace(/\b(\d+)\s*g\b/gi, '$1g')
    .replace(/\b(\d+(?:\.\d+)?)\s*(?:inch|inches|polegadas?)\b/gi, '$1inch')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function containsCanonicalPhrase(text: string, phrase: string) {
  return new RegExp(`(?:^|\\s)${escapeRegExp(phrase)}(?:$|\\s)`).test(text);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
