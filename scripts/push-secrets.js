// Reads SERVER-ONLY keys from your local .env and stores them as Supabase secrets.
// Only keys listed below are sent. They must NOT start with EXPO_PUBLIC_, so they
// never get bundled into the app. Your .env stays gitignored.
// Usage (from the project folder):  node scripts/push-secrets.js
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const SERVER_KEYS = ['OPENROUTER_API_KEY', 'OPENROUTER_MODEL', 'SERVICE_KEY'];

const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  console.error('No .env file found in the project folder.');
  process.exit(1);
}

const values = {};
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, '');
}

const found = SERVER_KEYS.filter((k) => values[k]);
if (found.length === 0) {
  console.error(`None of ${SERVER_KEYS.join(', ')} were found in .env.`);
  process.exit(1);
}

const pairs = found.map((k) => `${k}=${values[k]}`);
const result = spawnSync('supabase', ['secrets', 'set', ...pairs], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (result.status !== 0) {
  console.error('Could not store the secrets. Check that you ran "supabase login" and "supabase link".');
  process.exit(result.status ?? 1);
}
console.log(`Stored in Supabase: ${found.join(', ')}. Values were not printed.`);
