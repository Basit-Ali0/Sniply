'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Login } from '../components/Login';
import { ShortenForm } from '../components/ShortenForm';
import { supabase } from '../lib/supabase';

export default function HomePage() {
  const [session, setSession] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(!!data.session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(!!s);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen">
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <Link href="/" className="text-xl font-display font-bold text-accent">
          Snip.ly
        </Link>
        <div className="flex items-center gap-4">
          {session ? (
            <>
              <Link
                href="/dashboard"
                className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
              >
                Dashboard
              </Link>
              <button
                onClick={handleSignOut}
                className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/dashboard"
              className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>
      </nav>

      <main className="px-6">
        <section className="max-w-3xl mx-auto pt-24 pb-16 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/5 border border-accent/10 text-accent text-xs mb-8">
            ✦ Real-time analytics with every link
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-display font-bold text-gray-100 leading-tight mb-6 text-balance">
            Shorten URLs.
            <br />
            <span className="text-accent">Watch them live.</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto mb-12 text-balance">
            Every click streams to your dashboard in real time.
            Country, referrer, timestamp — all live, all yours.
          </p>

          {session ? (
            <ShortenForm />
          ) : (
            <Login />
          )}
        </section>

        <section className="max-w-5xl mx-auto py-20">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="glass rounded-xl p-6 text-center">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-gray-200 mb-2">Sub-5ms Redirects</h3>
              <p className="text-xs text-gray-500">Redis-cached hot path with zero database overhead.</p>
            </div>
            <div className="glass rounded-xl p-6 text-center">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-gray-200 mb-2">Live Dashboard</h3>
              <p className="text-xs text-gray-500">WebSocket-powered feed updates the moment a link is clicked.</p>
            </div>
            <div className="glass rounded-xl p-6 text-center">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-gray-200 mb-2">Global Analytics</h3>
              <p className="text-xs text-gray-500">Country-level geo breakdown and referrer tracking.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
