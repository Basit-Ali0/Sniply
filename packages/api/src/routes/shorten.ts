import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { rateLimitShortenPreHandler } from '../middleware/rateLimitShorten.js';
import { createLink, type ShortenBody } from '../services/linkService.js';

const shortenBodySchema = {
  type: 'object',
  required: ['url'],
  additionalProperties: false,
  properties: {
    url: {
      type: 'string',
      minLength: 1,
      maxLength: 2048,
      pattern: '^https?://',
    },
    slug: {
      type: 'string',
      minLength: 3,
      maxLength: 32,
      pattern: '^[a-zA-Z0-9-]+$',
    },
    expiry_at: { type: 'string', minLength: 1 },
    max_clicks: { type: 'integer', minimum: 1 },
    password: { type: 'string', minLength: 1 },
  },
} as const;

const shortenResponseSchema = {
  type: 'object',
  required: [
    'code',
    'short_url',
    'long_url',
    'qr_url',
    'created_at',
    'expiry_at',
    'max_clicks',
    'password_protected',
  ],
  properties: {
    code: { type: 'string' },
    short_url: { type: 'string' },
    long_url: { type: 'string' },
    qr_url: { type: 'string' },
    created_at: { type: 'string' },
    expiry_at: { type: ['string', 'null'] },
    max_clicks: { type: ['integer', 'null'] },
    password_protected: { type: 'boolean' },
  },
} as const;

const shortenRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/shorten',
    {
      preHandler: [rateLimitShortenPreHandler],
      schema: {
        body: shortenBodySchema,
        response: { 201: shortenResponseSchema },
      },
    },
    async (request, reply) => {
      const body = request.body as ShortenBody;
      const root = request.server;
      const payload = await createLink(
        root.supabase,
        root.redis,
        root.config,
        body,
        request.userId!
      );
      return reply.code(201).send(payload);
    }
  );
};

export default fp(shortenRoutes, {
  name: 'sniply-shorten',
});
