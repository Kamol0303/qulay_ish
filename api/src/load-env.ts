import { config } from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Read api/.env before any other module. Auth reads JWT_SECRET while the file
 * is still being imported, which is earlier than Nest's own env loader.
 */
const candidates = [
  join(__dirname, '..', '.env'),
  join(__dirname, '..', '..', '.env'),
  join(process.cwd(), '.env'),
  join(process.cwd(), 'api', '.env'),
];

let loaded = false;
for (const path of candidates) {
  if (!existsSync(path)) continue;
  config({ path, override: false });
  if (!loaded) {
    console.log(`API settings: ${path}`);
    loaded = true;
  }
}

if (!loaded) {
  console.error('API settings topilmadi. api/.env bo‘lishi kerak.');
}
if (!process.env.DATABASE_URL?.trim()) {
  console.error('DATABASE_URL yo‘q. api/.env ichidagi bazani tekshiring.');
}
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET?.trim()) {
  console.error('JWT_SECRET yo‘q. api/.env ichida bo‘lishi kerak.');
}
