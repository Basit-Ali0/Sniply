import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { getLinkByCode, parseRedisLinkFields } from '../services/linkService.js';
import { createError } from '../utils/errors.js';
import { verifyPassword } from '../utils/hash.js';

const unlockRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/api/links/:code/unlock',
    {
      schema: {
        params: {
          type: 'object',
          required: ['code'],
          properties: {
            code: { type: 'string', minLength: 1, maxLength: 256 },
          },
        },
        body: {
          type: 'object',
          required: ['password'],
          properties: {
            password: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { code } = request.params as { code: string };
      const { password } = request.body as { password: string };

      const cacheKey = `link:${code}`;
      const fields = await fastify.redis.hgetall(cacheKey);
      let parsed = parseRedisLinkFields(fields);
      let link;

      if (parsed) {
        link = {
          long_url: parsed.long_url,
          active: parsed.active,
          expiry_at: parsed.expiry_at,
          max_clicks: parsed.max_clicks,
          click_count: parsed.click_count,
          password_hash: parsed.password_hash,
        };
      } else {
        const row = await getLinkByCode(fastify.supabase, code);
        if (!row) {
          throw createError('LINK_NOT_FOUND', 'Short code does not exist.', 404);
        }
        link = {
          long_url: row.long_url,
          active: row.active,
          expiry_at: row.expiry_at
            ? Math.floor(new Date(row.expiry_at).getTime() / 1000)
            : 0,
          max_clicks: row.max_clicks ?? 0,
          click_count: row.click_count,
          password_hash: row.password_hash ?? '',
        };
      }

      if (!link.active) {
        throw createError('LINK_INACTIVE', 'This link has been deactivated.', 410);
      }

      const nowSec = Math.floor(Date.now() / 1000);
      if (link.expiry_at > 0 && nowSec >= link.expiry_at) {
        throw createError('LINK_EXPIRED', 'This link has expired.', 410);
      }

      if (link.max_clicks > 0 && link.click_count >= link.max_clicks) {
        throw createError('CLICK_LIMIT_REACHED', 'This link has reached its click limit.', 410);
      }

      if (!link.password_hash) {
        throw createError('NOT_PROTECTED', 'This link is not password protected.', 400);
      }

      const valid = await verifyPassword(password, link.password_hash);
      if (!valid) {
        throw createError('INVALID_PASSWORD', 'Incorrect password.', 401);
      }

      return reply.send({ long_url: link.long_url });
    }
  );
};

export default fp(unlockRoutes, {
  name: 'sniply-unlock',
  dependencies: ['sniply-postgres', 'sniply-redis'],
});
