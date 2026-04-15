import type { SupabaseClient } from '@supabase/supabase-js';
import type { Redis } from 'ioredis';

import type { Env } from '../config.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: Env;
    supabase: SupabaseClient;
    redis: Redis;
  }
}
