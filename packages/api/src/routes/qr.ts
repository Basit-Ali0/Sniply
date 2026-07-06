import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import qrcode from 'qrcode';

import { getLinkByCode } from '../services/linkService.js';
import { createError } from '../utils/errors.js';

const qrRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/qr/:code',
    {
      schema: {
        params: {
          type: 'object',
          required: ['code'],
          properties: {
            code: { type: 'string', minLength: 1, maxLength: 256 },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            size: { type: 'integer', minimum: 100, maximum: 1000, default: 200 },
            format: { type: 'string', enum: ['png', 'svg'], default: 'png' },
          },
        },
      },
    },
    async (request, reply) => {
      const { code } = request.params as { code: string };
      const query = request.query as { size?: string; format?: string };
      const size = Math.min(1000, Math.max(100, Number(query.size) || 200));
      const format = query.format === 'svg' ? 'svg' : 'png';

      const link = await getLinkByCode(fastify.supabase, code);
      if (!link) {
        throw createError('LINK_NOT_FOUND', 'Short code does not exist.', 404);
      }

      if (format === 'svg') {
        const svg = await qrcode.toString(link.long_url, {
          type: 'svg',
          width: size,
          margin: 2,
        });
        reply.header('Content-Type', 'image/svg+xml');
        reply.header('Cache-Control', 'public, max-age=86400');
        return reply.send(svg);
      }

      const buf = await qrcode.toBuffer(link.long_url, {
        type: 'image/png',
        width: size,
        margin: 2,
      });
      reply.header('Content-Type', 'image/png');
      reply.header('Cache-Control', 'public, max-age=86400');
      return reply.send(buf);
    }
  );
};

export default fp(qrRoutes, {
  name: 'sniply-qr',
  dependencies: ['sniply-postgres'],
});
