import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { createError } from '../utils/errors.js';
import {
  getLinkByCode,
  parseRedisLinkFields,
  populateRedisCache,
} from '../services/linkService.js';
import type { ClickJobData } from '../workers/clickWorker.js';

function normalizeFrontendBase(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function formatReferrer(header: string | undefined): string | null {
  if (!header) return null;
  const trimmed = header.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const redirectRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/:code',
    {
      schema: {
        params: {
          type: 'object',
          required: ['code'],
          properties: {
            code: { type: 'string', minLength: 1, maxLength: 256 },
          },
        },
      },
    },
    async (request, reply) => {
      const started = Date.now();
      const { code } = request.params as { code: string };

      const cacheKey = `link:${code}`;
      const fields = await fastify.redis.hgetall(cacheKey);
      let cacheStatus: 'HIT' | 'MISS' = 'HIT';
      let parsed = parseRedisLinkFields(fields);

      if (!parsed) {
        cacheStatus = 'MISS';
        const link = await getLinkByCode(fastify.supabase, code);
        if (!link) {
          throw createError('LINK_NOT_FOUND', 'Short code does not exist.', 404);
        }
        await populateRedisCache(fastify.redis, link);
        const reRead = await fastify.redis.hgetall(cacheKey);
        parsed = parseRedisLinkFields(reRead);
        if (!parsed) {
          throw createError('INTERNAL_ERROR', 'Failed to load link cache.', 500);
        }
      }

      if (!parsed.active) {
        throw createError(
          'LINK_INACTIVE',
          'This link has been deactivated.',
          410
        );
      }

      const nowSec = Math.floor(Date.now() / 1000);
      if (parsed.expiry_at > 0 && nowSec >= parsed.expiry_at) {
        const expiredAtIso = new Date(parsed.expiry_at * 1000).toISOString();
        throw createError(
          'LINK_EXPIRED',
          `This link expired on ${expiredAtIso}.`,
          410
        );
      }

      if (parsed.max_clicks > 0 && parsed.click_count >= parsed.max_clicks) {
        throw createError(
          'CLICK_LIMIT_REACHED',
          'This link has reached its click limit.',
          410
        );
      }

      const frontend = normalizeFrontendBase(fastify.config.FRONTEND_URL);

      if (parsed.password_hash.length > 0) {
        reply.header('X-Cache', cacheStatus);
        reply.header('X-Response-Time', `${Date.now() - started}ms`);
        return reply
          .code(302)
          .header(
            'Location',
            `${frontend}/enter-password/${encodeURIComponent(code)}`
          )
          .send();
      }

      reply.header('X-Cache', cacheStatus);
      reply.header('X-Response-Time', `${Date.now() - started}ms`);
      await reply.code(302).header('Location', parsed.long_url).send();

      const job: ClickJobData = {
        code,
        link_id: parsed.link_id.toString(),
        rawIp: request.ip,
        referrer: formatReferrer(request.headers.referer),
        user_agent:
          typeof request.headers['user-agent'] === 'string'
            ? request.headers['user-agent']
            : null,
      };

      setImmediate(() => {
        void fastify.clickQueue
          .add('click', job)
          .catch((err: unknown) => {
            fastify.log.error({ err }, 'Failed to enqueue click job');
          });
      });

      return reply;
    }
  );
};

export default fp(redirectRoutes, {
  name: 'sniply-redirect',
  dependencies: ['sniply-bullmq'],
});
