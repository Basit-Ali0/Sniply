'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { GeoMap } from '../../../components/GeoMap';
import { LiveClickFeed } from '../../../components/LiveClickFeed';
import { Login } from '../../../components/Login';
import { QRModal } from '../../../components/QRModal';
import { StatsChart } from '../../../components/StatsChart';
import {
  api,
  type LinkDetailResponse,
  type StatsResponse,
} from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import { formatNumber, timeAgo } from '../../../lib/utils';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001/ws';

export default function LinkDetailPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [session, setSession] = useState<boolean | null>(null);
  const [link, setLink] = useState<LinkDetailResponse | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(!!data.session);
    });
  }, []);

  const fetchData = useCallback(async () => {
    if (!session) { setLoading(false); return; }
    try {
      const [linkData, statsData] = await Promise.all([
        api.getLink(code),
        api.getStats(code),
      ]);
      setLink(linkData);
      setStats(statsData);
      setNewUrl(linkData.long_url);
    } catch {
      setLink(null);
    } finally {
      setLoading(false);
    }
  }, [code, session]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpdate = async () => {
    if (!newUrl.trim()) return;
    try {
      await api.updateLink(code, { url: newUrl });
      setEditing(false);
      fetchData();
    } catch {
      /* ignore */
    }
  };

  const handleDelete = async () => {
    try {
      await api.deleteLink(code);
      router.push('/dashboard');
    } catch {
      /* ignore */
    }
  };

  if (session === null || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen">
        <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
          <Link href="/" className="text-lg font-display font-bold text-accent">Snip.ly</Link>
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-300">Back</Link>
        </nav>
        <Login />
      </div>
    );
  }

  if (!link) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Link not found</p>
          <Link href="/dashboard" className="btn-primary px-5 py-2 rounded-xl text-sm">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <Link href="/" className="text-lg font-display font-bold text-accent">
          Snip.ly
        </Link>
        <Link
          href="/dashboard"
          className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          Dashboard
        </Link>
      </nav>

      <main className="px-6 pb-16 max-w-7xl mx-auto">
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-display font-bold text-gray-100">/{link.code}</h1>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${link.active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-500'}`}>
                {link.active ? 'active' : 'inactive'}
              </span>
            </div>
            <p className="text-sm text-gray-500 truncate max-w-lg">{link.long_url}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowQr(true)}
              className="btn-secondary px-3 py-2 rounded-lg text-xs"
            >
              QR Code
            </button>
            <button
              onClick={() => setDeleting(true)}
              className="px-3 py-2 rounded-lg text-xs border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="glass rounded-xl p-4">
            <p className="label mb-1">Total Clicks</p>
            <p className="text-2xl font-bold text-gray-100">{formatNumber(link.click_count)}</p>
          </div>
          <div className="glass rounded-xl p-4">
            <p className="label mb-1">Unique Clicks</p>
            <p className="text-2xl font-bold text-gray-100">{formatNumber(link.unique_clicks)}</p>
          </div>
          <div className="glass rounded-xl p-4">
            <p className="label mb-1">Created</p>
            <p className="text-sm font-medium text-gray-300">{timeAgo(link.created_at)}</p>
          </div>
          <div className="glass rounded-xl p-4">
            <p className="label mb-1">Status</p>
            <p className={`text-sm font-medium ${link.active ? 'text-emerald-400' : 'text-gray-500'}`}>
              {link.active ? 'Active' : 'Inactive'}
            </p>
          </div>
        </div>

        <div className="glass rounded-xl p-5 mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-400">Destination URL</h3>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="text-xs text-accent hover:text-accent-light transition-colors"
              >
                Edit
              </button>
            )}
          </div>
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                className="input-field flex-1 px-3 py-2 rounded-lg text-sm"
              />
              <button onClick={handleUpdate} className="btn-primary px-4 py-2 rounded-lg text-xs">
                Save
              </button>
              <button
                onClick={() => { setEditing(false); setNewUrl(link.long_url); }}
                className="btn-secondary px-4 py-2 rounded-lg text-xs"
              >
                Cancel
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-300 break-all">{link.long_url}</p>
          )}
        </div>

        {stats && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <StatsChart data={stats.hourly_breakdown} />
            <GeoMap data={stats.top_countries} />
          </div>
        )}

        {stats && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="glass rounded-xl p-6">
              <h3 className="text-sm font-medium text-gray-400 mb-4">Top Referrers</h3>
              {stats.top_referrers.length === 0 ? (
                <p className="text-sm text-gray-600">No referrer data yet</p>
              ) : (
                <div className="space-y-2">
                  {stats.top_referrers.map((item) => (
                    <div key={item.referrer} className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">{item.referrer}</span>
                      <span className="text-xs text-gray-500 font-mono">{formatNumber(item.clicks)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="lg:col-span-2">
          <LiveClickFeed code={code} wsUrl={WS_URL} />
        </div>
      </main>

      <QRModal code={code} open={showQr} onClose={() => setShowQr(false)} />

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleting(false)} />
          <div className="relative glass rounded-2xl p-6 max-w-sm w-full animate-slide-up">
            <h3 className="text-lg font-semibold text-gray-100 mb-2">Delete link?</h3>
            <p className="text-sm text-gray-500 mb-5">
              This will permanently delete <span className="text-accent font-mono">/{link.code}</span> and all its click data.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setDeleting(false)}
                className="btn-secondary flex-1 px-4 py-2.5 rounded-xl text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
