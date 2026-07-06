import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { getLinkStats } from '../services/statsService.js';

const statsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/links/:code/stats',
    {
      schema: {
        params: {
          type: 'object',
          required: ['code'],
          properties: {
            code: { type: 'string', minLength: 1 },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            from: { type: 'string', minLength: 1 },
            to: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request) => {
      const { code } = request.params as { code: string };
      const query = request.query as { from?: string; to?: string };

      const stats = await getLinkStats(
        fastify.supabase,
        code,
        request.userId!,
        query.from,
        query.to
      );

      return stats;
    }
  );
};

export default fp(statsRoutes, {
  name: 'sniply-stats',
  dependencies: ['sniply-bullmq'],
});
