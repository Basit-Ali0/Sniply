'use client';

import { useState, FormEvent } from 'react';

import type { ShortenResponse } from '../lib/api';
import { api } from '../lib/api';

interface ShortenFormProps {
  onCreated?: (result: ShortenResponse) => void;
}

export function ShortenForm({ onCreated }: ShortenFormProps) {
  const [url, setUrl] = useState('');
  const [slug, setSlug] = useState('');
  const [password, setPassword] = useState('');
  const [maxClicks, setMaxClicks] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ShortenResponse | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const payload: Parameters<typeof api.shorten>[0] = { url };
      if (slug.trim()) payload.slug = slug.trim();
      if (password.trim()) payload.password = password;
      if (maxClicks) payload.max_clicks = Number(maxClicks);
      if (expiryDate) payload.expiry_at = new Date(expiryDate).toISOString();

      const res = await api.shorten(payload);
      setResult(res);
      onCreated?.(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create link');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.short_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="glass rounded-2xl p-1">
        <div className="flex items-center gap-2 p-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste your long URL here..."
            className="input-field flex-1 px-4 py-3 rounded-xl text-sm bg-transparent border-0 focus:ring-0"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="btn-primary px-6 py-3 rounded-xl text-sm whitespace-nowrap disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Snip...
              </span>
            ) : (
              'Snip it!'
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 px-4 py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          <svg className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          Advanced options
        </button>

        {showAdvanced && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-4 pb-4 animate-fade-in">
            <div>
              <label className="label block mb-1.5">Custom slug</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="my-custom-link"
                maxLength={32}
                className="input-field w-full px-3 py-2 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="label block mb-1.5">Max clicks</label>
              <input
                type="number"
                value={maxClicks}
                onChange={(e) => setMaxClicks(e.target.value)}
                placeholder="Unlimited"
                min={1}
                className="input-field w-full px-3 py-2 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="label block mb-1.5">Password</label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Optional password"
                className="input-field w-full px-3 py-2 rounded-lg text-sm"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="label block mb-1.5">Expiry date</label>
              <input
                type="datetime-local"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="input-field w-full px-3 py-2 rounded-lg text-sm"
              />
            </div>
          </div>
        )}
      </form>

      {error && (
        <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-fade-in">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6 glass rounded-2xl p-5 animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <span className="label">Your short link is ready!</span>
            <span className="text-xs text-gray-500">{result.code}</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={result.short_url}
              className="flex-1 px-4 py-3 rounded-xl text-sm bg-surface-light border border-accent/10 text-accent-light font-medium"
            />
            <button
              type="button"
              onClick={copyToClipboard}
              className="btn-secondary px-4 py-3 rounded-xl text-sm whitespace-nowrap"
            >
              {copied ? (
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied
                </span>
              ) : (
                'Copy'
              )}
            </button>
          </div>
          {result.password_protected && (
            <p className="mt-3 text-xs text-accent/50 flex items-center gap-1.5">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Password protected
            </p>
          )}
        </div>
      )}
    </div>
  );
}
