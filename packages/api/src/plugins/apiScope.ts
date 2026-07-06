import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { requireAuth } from '../middleware/auth.js';
import linkRoutes from '../routes/links.js';
import shortenRoutes from '../routes/shorten.js';
import statsRoutes from '../routes/stats.js';

/**
 * All `/api/*` JSON routes live here. 
 * This plugin creates a new scope so the `/api` prefix is applied,
 * and the requireAuth hook only affects these routes.
 */
const apiScopePlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', requireAuth);
  await fastify.register(shortenRoutes);
  await fastify.register(linkRoutes);
  await fastify.register(statsRoutes);
};

export default apiScopePlugin;
