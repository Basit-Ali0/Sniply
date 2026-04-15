import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { Redis } from 'ioredis';

const redisPlugin: FastifyPluginAsync = async (fastify) => {
  const redis = new Redis(fastify.config.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });

  redis.on('error', (err: Error) => {
    fastify.log.error({ err }, 'Redis client error');
  });

  await redis.ping();

  fastify.decorate('redis', redis);

  fastify.addHook('onClose', async () => {
    await redis.quit();
  });
};

export default fp(redisPlugin, {
  name: 'sniply-redis',
});
