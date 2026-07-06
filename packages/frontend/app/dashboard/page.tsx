'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { LinkCard } from '../../components/LinkCard';
import { LiveClickFeed } from '../../components/LiveClickFeed';
import { Login } from '../../components/Login';
import { api, type LinkListItem, type Pagination } from '../../lib/api';
import { supabase } from '../../lib/supabase';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001/ws';

export default function DashboardPage() {
  const [session, setSession] = useState<boolean | null>(null);
  const [links, setLinks] = useState<LinkListItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(!!data.session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(!!s);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchLinks = useCallback(async () => {
    if (!session) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await api.getLinks({ page, limit: 10, status });
      setLinks(res.links);
      setPagination(res.pagination);
    } catch {
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }, [page, status, session]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const statusTabs = ['all', 'active', 'inactive', 'expired'];

  if (session === null) {
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

  return (
    <div className="min-h-screen">
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <Link href="/" className="text-lg font-display font-bold text-accent">
          Snip.ly
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/" className="text-gray-500 hover:text-gray-300 transition-colors">
            Home
          </Link>
          <Link href="/privacy" className="text-gray-500 hover:text-gray-300 transition-colors">
            Privacy
          </Link>
          <button
            onClick={handleSignOut}
            className="text-gray-500 hover:text-gray-300 transition-colors"
          >
            Sign out
          </button>
        </div>
      </nav>

      <main className="px-6 pb-16 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold text-gray-100 mb-1">Dashboard</h1>
          <p className="text-sm text-gray-500">Monitor your links and watch clicks arrive in real time.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              {statusTabs.map((s) => (
                <button
                  key={s}
                  onClick={() => { setStatus(s); setPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    status === s
                      ? 'bg-accent/10 text-accent border border-accent/20'
                      : 'text-gray-500 hover:text-gray-300 border border-transparent'
                  }`}
                >
                  {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="glass rounded-xl p-4 animate-pulse">
                    <div className="h-4 bg-surface-lighter rounded w-1/3 mb-3" />
                    <div className="h-3 bg-surface-lighter rounded w-2/3" />
                  </div>
                ))}
              </div>
            ) : links.length === 0 ? (
              <div className="glass rounded-xl p-12 text-center">
                <div className="w-12 h-12 rounded-xl bg-surface-lighter flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <p className="text-gray-500 text-sm">No links yet. Shorten your first URL from the home page.</p>
                <Link href="/" className="btn-primary inline-block mt-4 px-5 py-2 rounded-xl text-xs">
                  Shorten a URL
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {links.map((link) => (
                  <div key={link.code} className="card-stagger">
                    <button
                      onClick={() => setSelectedCode(selectedCode === link.code ? null : link.code)}
                      className="w-full text-left"
                    >
                      <LinkCard link={link} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {pagination && pagination.total_pages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="btn-secondary px-3 py-1.5 rounded-lg text-xs disabled:opacity-30"
                >
                  Previous
                </button>
                <span className="text-xs text-gray-500">
                  Page {pagination.page} of {pagination.total_pages}
                </span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= pagination.total_pages}
                  className="btn-secondary px-3 py-1.5 rounded-lg text-xs disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            {selectedCode ? (
              <LiveClickFeed code={selectedCode} wsUrl={WS_URL} />
            ) : (
              <div className="glass rounded-xl p-6 text-center text-gray-600 text-sm">
                <div className="w-10 h-10 rounded-xl bg-surface-lighter flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                Select a link to see live clicks
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
