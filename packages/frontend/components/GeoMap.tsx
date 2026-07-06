'use client';

import type { StatsTopItem } from '../lib/api';
import { formatNumber } from '../lib/utils';

interface GeoMapProps {
  data: StatsTopItem[];
}

const COUNTRY_FLAGS: Record<string, string> = {
  US: '🇺🇸', GB: '🇬🇧', IN: '🇮🇳', DE: '🇩🇪', FR: '🇫🇷',
  CA: '🇨🇦', AU: '🇦🇺', BR: '🇧🇷', JP: '🇯🇵', CN: '🇨🇳',
  NL: '🇳🇱', IT: '🇮🇹', ES: '🇪🇸', KR: '🇰🇷', SG: '🇸🇬',
  RU: '🇷🇺', MX: '🇲🇽', SE: '🇸🇪', NO: '🇳🇴', DK: '🇩🇰',
  FI: '🇫🇮', CH: '🇨🇭', AT: '🇦🇹', BE: '🇧🇪', IE: '🇮🇪',
  NZ: '🇳🇿', HK: '🇭🇰', TW: '🇹🇼', TH: '🇹🇭', VN: '🇻🇳',
  ZA: '🇿🇦', AR: '🇦🇷', CO: '🇨🇴', PT: '🇵🇹', PL: '🇵🇱',
};

export function GeoMap({ data }: GeoMapProps) {
  if (!data.length) {
    return (
      <div className="glass rounded-xl p-6">
        <h3 className="text-sm font-medium text-gray-400 mb-4">Top Countries</h3>
        <div className="h-40 flex items-center justify-center text-gray-600 text-sm">
          No geographic data yet
        </div>
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.clicks), 1);

  return (
    <div className="glass rounded-xl p-6">
      <h3 className="text-sm font-medium text-gray-400 mb-4">Top Countries</h3>
      <div className="space-y-2">
        {data.map((item) => {
          const width = (item.clicks / maxVal) * 100;
          return (
            <div key={item.country} className="flex items-center gap-3">
              <span className="text-lg w-8 text-center shrink-0">
                {COUNTRY_FLAGS[item.country ?? ''] ?? '🌍'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-300">{item.country ?? 'Unknown'}</span>
                  <span className="text-xs text-gray-500 font-mono">{formatNumber(item.clicks)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-lighter overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${width}%`,
                      background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.6), rgba(245, 158, 11, 0.9))',
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
