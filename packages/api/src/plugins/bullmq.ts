import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { Queue } from 'bullmq';

const bullmqPlugin: FastifyPluginAsync = async (fastify) => {
  const connection = fastify.redis.duplicate();

  const clickQueue = new Queue('clickQueue', {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 500 },
    },
  });

  fastify.decorate('clickQueue', clickQueue);

  fastify.addHook('onClose', async () => {
    await clickQueue.close();
    await connection.quit();
  });
};

export default fp(bullmqPlugin, {
  name: 'sniply-bullmq',
  dependencies: ['sniply-redis'],
});
