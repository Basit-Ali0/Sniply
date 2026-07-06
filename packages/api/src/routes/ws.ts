import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { wsEmitter } from '../utils/wsEmitter.js';

const rooms = new Map<string, Set<any>>();

const wsRoutesPlugin: FastifyPluginAsync = async (fastify) => {
  wsEmitter.on('click_event', (payload) => {
    const clients = rooms.get(payload.code);
    if (clients) {
      const message = JSON.stringify({ type: 'click_event', ...payload });
      clients.forEach((client) => {
        if (client.readyState === 1) {
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
        if (client.readyState === 1) {
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
        if (client.readyState === 1) {
          client.send(message);
        }
      });
    }
  });

  fastify.get('/ws', { websocket: true }, async (connection, request) => {
    const { token } = request.query as { token?: string };

    if (!token) {
      connection.socket.send(JSON.stringify({ type: 'error', message: 'Missing authentication token' }));
      connection.socket.close(4001, 'Unauthorized');
      return;
    }

    const { data, error } = await fastify.supabaseAdmin.auth.getUser(token);

    if (error || !data?.user?.id) {
      connection.socket.send(JSON.stringify({ type: 'error', message: 'Invalid authentication token' }));
      connection.socket.close(4001, 'Unauthorized');
      return;
    }

    const userId = data.user.id;
    const subscriptions = new Set<string>();

    connection.socket.on('message', async (messageBuffer: Buffer) => {
      try {
        const payload = JSON.parse(messageBuffer.toString());
        
        if (payload.type === 'subscribe' && payload.code) {
          const { code } = payload;
          const { data: link } = await fastify.supabase
            .from('links')
            .select('click_count')
            .eq('code', code)
            .eq('user_id', userId)
            .maybeSingle();

          if (!link) {
            connection.socket.send(JSON.stringify({ type: 'error', message: 'Link not found or access denied' }));
            return;
          }

          // Let's refetch link with id
          const { data: fullLink } = await fastify.supabase
            .from('links')
            .select('id, click_count')
            .eq('code', code)
            .eq('user_id', userId)
            .single();

          let uniqueClicks = 0;
          if (fullLink) {
             const { data: uniqueEvents } = await fastify.supabase
               .from('click_events')
               .select('ip_hash')
               .eq('link_id', Number(fullLink.id));
             const unique = new Set<string>();
             for (const e of uniqueEvents ?? []) {
               if (e.ip_hash) unique.add(e.ip_hash);
             }
             uniqueClicks = unique.size;
          }

          if (!rooms.has(code)) {
            rooms.set(code, new Set());
          }
          rooms.get(code)!.add(connection.socket);
          subscriptions.add(code);

          connection.socket.send(JSON.stringify({
            type: 'subscribed',
            code,
            current_stats: {
              total_clicks: fullLink?.click_count ?? 0,
              unique_clicks: uniqueClicks,
            }
          }));
        } else if (payload.type === 'unsubscribe' && payload.code) {
          const { code } = payload;
          rooms.get(code)?.delete(connection.socket);
          subscriptions.delete(code);
        }
      } catch (err) {
        connection.socket.send(JSON.stringify({ type: 'error', message: 'Malformed message' }));
      }
    });

    connection.socket.on('close', () => {
      subscriptions.forEach((code) => {
        rooms.get(code)?.delete(connection.socket);
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
