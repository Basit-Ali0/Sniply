'use client';

import { useWebSocket } from '../hooks/useWebSocket';

export function LiveClickFeed({ code, wsUrl }: { code: string; wsUrl: string }) {
  const { events, stats, isConnected } = useWebSocket({ url: wsUrl, code });

  return (
    <div className="glass rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-medium text-gray-400">Live Clicks</h3>
        <span className={`px-2.5 py-1 text-[10px] font-semibold rounded-full flex items-center gap-1.5 ${isConnected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
          {isConnected ? 'Live' : 'Disconnected'}
        </span>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-3 rounded-lg bg-surface-light/50">
            <p className="text-[10px] text-gray-500 font-medium label">Total Clicks</p>
            <p className="text-xl font-bold text-gray-100 mt-0.5">{stats.total_clicks}</p>
          </div>
          <div className="p-3 rounded-lg bg-surface-light/50">
            <p className="text-[10px] text-gray-500 font-medium label">Unique Visitors</p>
            <p className="text-xl font-bold text-gray-100 mt-0.5">{stats.unique_clicks}</p>
          </div>
        </div>
      )}

      <div className="space-y-2 h-96 overflow-y-auto">
        {events.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-600">
            <svg className="w-10 h-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <p className="text-xs">Waiting for clicks...</p>
          </div>
        ) : (
          events.map((ev, i) => {
            if (ev.type === 'click_event') {
              return (
                <div
                  key={`${ev.clicked_at}-${i}`}
                  className="flex items-center gap-3 p-3 rounded-lg bg-surface-light/30 border border-surface-lighter/50 animate-fade-in"
                >
                  <span className="text-lg shrink-0">{ev.country === 'UNKNOWN' ? '🌐' : ev.country}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-300 truncate">
                      {ev.referrer === 'direct' ? 'Direct Traffic' : ev.referrer}
                    </p>
                    <p className="text-[10px] text-gray-600">From {ev.country}</p>
                  </div>
                  <span className="text-[10px] text-gray-600 font-mono shrink-0">
                    {new Date(ev.clicked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            }
            if (ev.type === 'link_updated' || ev.type === 'link_deleted') {
              return (
                <div key={`${ev.type}-${i}`} className="p-3 rounded-lg bg-accent/5 border border-accent/10 text-accent text-[10px] animate-fade-in">
                  Link {ev.type === 'link_updated' ? (ev.active ? 'activated' : 'deactivated') : 'deleted'}
                </div>
              );
            }
            return null;
          })
        )}
      </div>
    </div>
  );
}
