import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { WebSocket } from 'ws';

import { countUniqueClicks } from '../services/linkService.js';
import { wsEmitter } from '../utils/wsEmitter.js';

/**
 * Per-code subscription rooms. Each value is the set of connected WebSocket
 * clients subscribed to that short code. Typed as `ws.WebSocket` (re-exported
 * by @fastify/websocket) — never `any`.
 */
const rooms = new Map<string, Set<WebSocket>>();

const wsRoutesPlugin: FastifyPluginAsync = async (fastify) => {
  wsEmitter.on('click_event', (payload) => {
    const clients = rooms.get(payload.code);
    if (clients) {
      const message = JSON.stringify({ type: 'click_event', ...payload });
      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }
  });

  wsEmitter.on('link_updated', (payload) => {
    const clients = rooms.get(payload.code);
    if (clients) {
      const message = JSON.stringify({ type: 'link_updated', ...payload });
      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }
  });

  wsEmitter.on('link_deleted', (payload) => {
    const clients = rooms.get(payload.code);
    if (clients) {
      const message = JSON.stringify({ type: 'link_deleted', ...payload });
      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }
  });

  fastify.get('/ws', { websocket: true }, async (connection, request) => {
    const { token } = request.query as { token?: string };

    if (!token) {
      connection.send(JSON.stringify({ type: 'error', message: 'Missing authentication token' }));
      connection.close(4001, 'Unauthorized');
      return;
    }

    const { data, error } = await fastify.supabaseAdmin.auth.getUser(token);

    if (error || !data?.user?.id) {
      connection.send(JSON.stringify({ type: 'error', message: 'Invalid authentication token' }));
      connection.close(4001, 'Unauthorized');
      return;
    }

    const userId = data.user.id;
    const subscriptions = new Set<string>();

    connection.on('message', async (messageBuffer: Buffer) => {
      try {
        const payload = JSON.parse(messageBuffer.toString());

        if (payload.type === 'subscribe' && payload.code) {
          const { code } = payload;

          // Single link query — fetch id + click_count in one round-trip.
          const { data: link } = await fastify.supabase
            .from('links')
            .select('id, click_count')
            .eq('code', code)
            .eq('user_id', userId)
            .maybeSingle();

          if (!link) {
            connection.send(JSON.stringify({ type: 'error', message: 'Link not found or access denied' }));
            return;
          }

          // Unique count via the count_unique_clicks RPC (COUNT(DISTINCT ip_hash)
          // in Postgres) instead of loading every click_events row into memory.
          const uniqueClicks = await countUniqueClicks(
            fastify.supabase,
            String(link.id)
          );

          if (!rooms.has(code)) {
            rooms.set(code, new Set());
          }
          rooms.get(code)!.add(connection);
          subscriptions.add(code);

          connection.send(JSON.stringify({
            type: 'subscribed',
            code,
            current_stats: {
              total_clicks: link.click_count ?? 0,
              unique_clicks: uniqueClicks,
            }
          }));
        } else if (payload.type === 'unsubscribe' && payload.code) {
          const { code } = payload;
          rooms.get(code)?.delete(connection);
          subscriptions.delete(code);
        }
      } catch (err) {
        connection.send(JSON.stringify({ type: 'error', message: 'Malformed message' }));
      }
    });

    connection.on('close', () => {
      subscriptions.forEach((code) => {
        rooms.get(code)?.delete(connection);
        if (rooms.get(code)?.size === 0) {
          rooms.delete(code);
        }
      });
    });
  });
};

export default fp(wsRoutesPlugin, {
  name: 'sniply-ws-routes',
  dependencies: ['sniply-websocket', 'sniply-postgres'],
});
