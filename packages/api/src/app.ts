import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import Fastify from 'fastify';
import type { Env } from './config.js';
import apiScopePlugin from './plugins/apiScope.js';
import bullmqPlugin from './plugins/bullmq.js';
import postgresPlugin from './plugins/postgres.js';
import redisPlugin from './plugins/redis.js';
import websocketPlugin from './plugins/websocket.js';
import qrRoutes from './routes/qr.js';
import redirectRoutes from './routes/redirect.js';
import unlockRoutes from './routes/unlock.js';
import wsRoutes from './routes/ws.js';
import { AppHttpError } from './utils/errors.js';

export async function buildApp(config: Env) {
  const app = Fastify({
    trustProxy: true,
    logger:
      config.NODE_ENV === 'development'
        ? {
            level: 'debug',
            transport: {
              target: 'pino-pretty',
              options: { translateTime: 'SYS:standard' },
            },
          }
        : { level: 'info' },
  });

  app.decorate('config', config);

  await app.register(helmet);
  await app.register(cors, {
    origin:
      config.NODE_ENV === 'production'
        ? config.FRONTEND_URL
        : [config.FRONTEND_URL, 'http://localhost:3000'],
    credentials: true,
  });

  await app.register(postgresPlugin);
  await app.register(redisPlugin);
  await app.register(bullmqPlugin);
  await app.register(websocketPlugin);

  app.get('/health', {
    // Response schema enables Fastify's fast-json-stringify for the health check.
    schema: {
      response: {
        200: {
          type: 'object',
          required: ['ok'],
          properties: { ok: { type: 'boolean' } },
        },
      },
    },
  }, async () => ({ ok: true as const }));

  await app.register(unlockRoutes);
  await app.register(apiScopePlugin, { prefix: '/api' });
  await app.register(redirectRoutes);
  await app.register(qrRoutes);
  await app.register(wsRoutes);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppHttpError) {
      return reply.status(error.statusCode).send({
        error: error.errorCode,
        message: error.message,
      });
    }
    request.log.error({ err: error }, 'Unhandled error');
    return reply.status(500).send({
      error: 'INTERNAL_ERROR',
      message: 'Something went wrong on our end.',
    });
  });

  return app;
}
