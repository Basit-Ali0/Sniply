import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { getLinkStats } from '../services/statsService.js';

/**
 * Response schema for `GET /api/links/:code/stats`. Matches the `StatsResult`
 * shape returned by `getLinkStats` field-for-field.
 */
const statsResponseSchema = {
  type: 'object',
  required: [
    'code',
    'period',
    'totals',
    'top_referrers',
    'top_countries',
    'hourly_breakdown',
  ],
  properties: {
    code: { type: 'string' },
    period: {
      type: 'object',
      required: ['from', 'to'],
      properties: {
        from: { type: 'string' },
        to: { type: 'string' },
      },
    },
    totals: {
      type: 'object',
      required: ['clicks', 'unique_clicks'],
      properties: {
        clicks: { type: 'integer' },
        unique_clicks: { type: 'integer' },
      },
    },
    top_referrers: {
      type: 'array',
      items: {
        type: 'object',
        required: ['referrer', 'clicks'],
        properties: {
          referrer: { type: 'string' },
          clicks: { type: 'integer' },
        },
      },
    },
    top_countries: {
      type: 'array',
      items: {
        type: 'object',
        required: ['country', 'clicks'],
        properties: {
          country: { type: 'string' },
          clicks: { type: 'integer' },
        },
      },
    },
    hourly_breakdown: {
      type: 'array',
      items: {
        type: 'object',
        required: ['hour', 'clicks'],
        properties: {
          hour: { type: 'string' },
          clicks: { type: 'integer' },
        },
      },
    },
  },
} as const;

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
        response: { 200: statsResponseSchema },
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
