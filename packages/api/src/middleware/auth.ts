import type { FastifyReply, FastifyRequest } from 'fastify';

const UNAUTHORIZED_BODY = {
  error: 'UNAUTHORIZED',
  message: 'Missing or invalid authentication token',
} as const;

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    await reply.status(401).send(UNAUTHORIZED_BODY);
    return;
  }

  const token = authHeader.slice(7);
  if (token.length === 0) {
    await reply.status(401).send(UNAUTHORIZED_BODY);
    return;
  }

  const { data, error } = await request.server.supabaseAdmin.auth.getUser(
    token
  );

  if (error || !data?.user?.id) {
    await reply.status(401).send(UNAUTHORIZED_BODY);
    return;
  }

  request.userId = data.user.id;
}
