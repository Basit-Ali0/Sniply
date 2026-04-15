import { createClient } from '@supabase/supabase-js';
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

const postgresPlugin: FastifyPluginAsync = async (fastify) => {
  const supabase = createClient(
    fastify.config.SUPABASE_URL,
    fastify.config.SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  fastify.decorate('supabase', supabase);
};

export default fp(postgresPlugin, {
  name: 'sniply-postgres',
});
