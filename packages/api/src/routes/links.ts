import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import type { LinkRow } from '../services/linkService.js';
import {
  countUniqueClicks,
  deleteLink,
  formatLinkDetailResponse,
  formatLinkResponse,
  getLinkByCodeAndUser,
  getLinks,
  updateLink,
} from '../services/linkService.js';
import { createError } from '../utils/errors.js';

const linkRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/links',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            status: { type: 'string', enum: ['active', 'inactive', 'expired', 'all'] },
            sort: { type: 'string', enum: ['created_at', 'click_count'], default: 'created_at' },
            order: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          },
        },
      },
    },
    async (request, _reply) => {
      const query = request.query as {
        page?: number;
        limit?: number;
        status?: string;
        sort?: string;
        order?: string;
      };

      const result = await getLinks(
        fastify.supabase,
        request.userId!,
        query.page ?? 1,
        query.limit ?? 20,
        query.status,
        query.sort,
        query.order
      );

      const frontendBase = fastify.config.FRONTEND_URL;

      return {
        links: result.links.map((link: LinkRow) =>
          formatLinkResponse(link, frontendBase)
        ),
        pagination: result.pagination,
      };
    }
  );

  fastify.get(
    '/links/:code',
    {
      schema: {
        params: {
          type: 'object',
          required: ['code'],
          properties: {
            code: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request) => {
      const { code } = request.params as { code: string };
      const link = await getLinkByCodeAndUser(fastify.supabase, code, request.userId!);

      if (!link) {
        throw createError('LINK_NOT_FOUND', 'Link does not exist or access denied.', 404);
      }

      const uniqueClicks = await countUniqueClicks(fastify.supabase, link.id);

      return formatLinkDetailResponse(
        link,
        uniqueClicks,
        fastify.config.FRONTEND_URL,
        fastify.config.PUBLIC_API_URL
      );
    }
  );

  fastify.patch(
    '/links/:code',
    {
      schema: {
        params: {
          type: 'object',
          required: ['code'],
          properties: {
            code: { type: 'string', minLength: 1 },
          },
        },
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            url: { type: 'string', maxLength: 2048, pattern: '^https?://' },
            active: { type: 'boolean' },
            expiry_at: { type: ['string', 'null'], minLength: 1 },
            max_clicks: { type: ['integer', 'null'], minimum: 1 },
          },
        },
      },
    },
    async (request) => {
      const { code } = request.params as { code: string };
      const body = request.body as {
        url?: string;
        active?: boolean;
        expiry_at?: string | null;
        max_clicks?: number | null;
      };

      const link = await updateLink(
        fastify.supabase,
        fastify.redis,
        request.userId!,
        code,
        body
      );

      if (!link) {
        throw createError('LINK_NOT_FOUND', 'Link does not exist or access denied.', 404);
      }

      const frontendBase = fastify.config.FRONTEND_URL;

      return {
        code: link.code,
        short_url: `${frontendBase.endsWith('/') ? frontendBase.slice(0, -1) : frontendBase}/${link.code}`,
        long_url: link.long_url,
        active: link.active,
        updated_at: link.updated_at,
      };
    }
  );

  fastify.delete(
    '/links/:code',
    {
      schema: {
        params: {
          type: 'object',
          required: ['code'],
          properties: {
            code: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { code } = request.params as { code: string };
      const deleted = await deleteLink(fastify.supabase, fastify.redis, request.userId!, code);

      if (!deleted) {
        throw createError('LINK_NOT_FOUND', 'Link does not exist or access denied.', 404);
      }

      return reply.code(204).send();
    }
  );
};

export default fp(linkRoutes, {
  name: 'sniply-links',
  dependencies: ['sniply-bullmq'],
});
