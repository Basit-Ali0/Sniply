import { config as dotenvConfig } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// Load .env from monorepo root (two levels up from packages/api/)
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '..', '..', '..', '.env') });

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  REDIS_TOKEN: z.string().optional(),
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  FRONTEND_URL: z.string().url('FRONTEND_URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  GEOIP_API_URL: z.string().url('GEOIP_API_URL must be a valid URL'),
  /** Public base URL of this API (used for `qr_url`). Defaults to http://127.0.0.1:$PORT when unset. */
  PUBLIC_API_URL: z.string().url().optional(),
  /** Comma-separated substrings; if destination URL contains any, `POST /api/shorten` returns `URL_BLOCKED`. */
  URL_BLOCKLIST: z.string().optional(),
});

export type Env = z.infer<typeof envSchema> & {
  /** Always set after `loadEnv()` (defaults to loopback + PORT). */
  PUBLIC_API_URL: string;
};

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    console.error('Invalid environment variables:', fieldErrors);
    process.exit(1);
  }
  const data = parsed.data;
  const withDefaults = {
    ...data,
    PUBLIC_API_URL:
      data.PUBLIC_API_URL ??
      `http://127.0.0.1:${String(data.PORT)}`,
  };
  return withDefaults as Env;
}
