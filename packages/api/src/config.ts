import { z } from 'zod';

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
  API_KEY_SALT: z
    .string()
    .min(8, 'API_KEY_SALT must be at least 8 characters'),
  GEOIP_API_URL: z.string().url('GEOIP_API_URL must be a valid URL'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    console.error('Invalid environment variables:', fieldErrors);
    process.exit(1);
  }
  return parsed.data;
}
