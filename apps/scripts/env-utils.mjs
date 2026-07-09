import { readFileSync } from 'node:fs';

export function parseEnvFile(filePath) {
  const env = {};
  const content = readFileSync(filePath, 'utf8');

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

export function envFileFor(target) {
  const normalizedTarget = target || 'development';

  if (!['development', 'staging', 'production'].includes(normalizedTarget)) {
    throw new Error(`Ambiente invalido: ${normalizedTarget}`);
  }

  return `.env.${normalizedTarget}`;
}
