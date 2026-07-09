import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { envFileFor, parseEnvFile } from './env-utils.mjs';

const [, , target, command, ...args] = process.argv;

if (!target || !command) {
  console.error('Uso: node scripts/run-env.mjs <development|staging|production> <comando> [...args]');
  process.exit(1);
}

const envFile = envFileFor(target);

if (!existsSync(envFile)) {
  console.error(`Arquivo de ambiente nao encontrado: ${envFile}`);
  process.exit(1);
}

const localEnv = existsSync('.env.local') ? parseEnvFile('.env.local') : {};
const fileEnv = {
  ...parseEnvFile(envFile),
  ...localEnv,
};
const commandText = [command, ...args].join(' ');
const isBuildCommand = /\bbuild\b/.test(commandText);
const invocation = resolveInvocation(command, args);
const child = spawn(invocation.command, invocation.args, {
  env: {
    ...process.env,
    ...fileEnv,
    NODE_ENV: isBuildCommand ? 'production' : fileEnv.NODE_ENV,
    APP_ENV: target,
  },
  stdio: 'inherit',
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});

function resolveInvocation(value, commandArgs) {
  if (value === 'pnpm' && process.env.npm_execpath) {
    return {
      command: process.execPath,
      args: [process.env.npm_execpath, ...commandArgs],
    };
  }

  if (value === 'prisma') {
    return {
      command: process.execPath,
      args: [resolve('node_modules/prisma/build/index.js'), ...commandArgs],
    };
  }

  return {
    command: value,
    args: commandArgs,
  };
}
