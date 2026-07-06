import type { FastifyReply, FastifyRequest } from 'fastify';

const RATE_LIMIT = 10 as const;
const RL_TTL_SECONDS = 60 as const;

const RATE_LIMIT_BODY = {
  error: 'RATE_LIMITED',
  message: 'Too many shorten requests. Please wait a minute and try again.',
} as const;

function minuteBucketKey(userId: string): string {
  const minute = Math.floor(Date.now() / 60_000);
  return `rl:${userId}:${String(minute)}`;
}

export async function rateLimitShortenPreHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.userId) return;

  const key = minuteBucketKey(request.userId);
  const pipeline = request.server.redis.multi();
  pipeline.incr(key);
  pipeline.expire(key, RL_TTL_SECONDS);
  const results = await pipeline.exec();
  const count = results?.[0]?.[1];
  const n = typeof count === 'number' ? count : Number(count);
  if (Number.isFinite(n) && n > RATE_LIMIT) {
    await reply.status(429).send(RATE_LIMIT_BODY);
  }
}
