import { useEffect, useRef, useState, useCallback } from 'react';

import { supabase } from '../lib/supabase';

export type WebSocketEvent =
  | { type: 'subscribed'; code: string; current_stats: { total_clicks: number; unique_clicks: number } }
  | { type: 'click_event'; code: string; clicked_at: string; country: string; referrer: string; total_clicks: number; unique_clicks: number }
  | { type: 'link_updated'; code: string; active: boolean }
  | { type: 'link_deleted'; code: string }
  | { type: 'error'; message: string };

interface UseWebSocketOptions {
  url: string;
  code?: string;
}

export function useWebSocket({ url, code }: UseWebSocketOptions) {
  const [events, setEvents] = useState<WebSocketEvent[]>([]);
  const [stats, setStats] = useState<{ total_clicks: number; unique_clicks: number } | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const retryCount = useRef(0);
  const maxRetries = 5;

  const connect = useCallback(async () => {
    if (!code || !url) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    const wsUrl = `${url}?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      retryCount.current = 0;
      ws.send(JSON.stringify({ type: 'subscribe', code }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WebSocketEvent;
        if (data.type === 'subscribed') {
          setStats(data.current_stats);
        } else if (data.type === 'click_event') {
          setStats({ total_clicks: data.total_clicks, unique_clicks: data.unique_clicks });
          setEvents((prev) => [data, ...prev].slice(0, 50));
        } else if (data.type === 'link_updated' || data.type === 'link_deleted') {
          setEvents((prev) => [data, ...prev].slice(0, 50));
        } else if (data.type === 'error') {
          console.error('WebSocket Error:', data.message);
        }
      } catch (err) {
        console.error('Failed to parse WS message', err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;
      if (retryCount.current < maxRetries) {
        const timeout = Math.pow(2, retryCount.current) * 1000;
        retryCount.current += 1;
        setTimeout(connect, timeout);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket encountered an error', error);
    };
  }, [url, code]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        if (code) {
          wsRef.current.send(JSON.stringify({ type: 'unsubscribe', code }));
        }
        wsRef.current.close();
      }
    };
  }, [connect, code]);

  return { events, stats, isConnected };
}
