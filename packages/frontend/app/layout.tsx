import type { Metadata } from 'next';
import { DM_Sans, Outfit } from 'next/font/google';
import type { ReactNode } from 'react';

import './globals.css';

const display = Outfit({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const body = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Snip.ly — URL Shortener with Real-Time Analytics',
  description:
    'High-performance URL shortener with a live WebSocket analytics dashboard. Track clicks, geolocation, and referrers in real time.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="font-body text-gray-100 antialiased">{children}</body>
    </html>
  );
}
