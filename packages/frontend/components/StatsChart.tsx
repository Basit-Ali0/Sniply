'use client';

import type { StatsHourlyItem } from '../lib/api';

interface StatsChartProps {
  data: StatsHourlyItem[];
}

export function StatsChart({ data }: StatsChartProps) {
  if (!data.length) {
    return (
      <div className="glass rounded-xl p-6">
        <h3 className="text-sm font-medium text-gray-400 mb-4">Hourly Clicks</h3>
        <div className="h-40 flex items-center justify-center text-gray-600 text-sm">
          No click data yet
        </div>
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.clicks), 1);
  const recent = data.slice(-24);

  return (
    <div className="glass rounded-xl p-6">
      <h3 className="text-sm font-medium text-gray-400 mb-4">Hourly Clicks</h3>
      <div className="flex items-end gap-1 h-40">
        {recent.map((item) => {
          const height = (item.clicks / maxVal) * 100;
          return (
            <div
              key={item.hour}
              className="flex-1 flex flex-col items-center justify-end h-full group relative"
            >
              <div
                className="w-full rounded-t-sm transition-all duration-300 hover:brightness-125"
                style={{
                  height: `${Math.max(height, 2)}%`,
                  background: `linear-gradient(to top, rgba(245, 158, 11, 0.8), rgba(245, 158, 11, 0.3))`,
                }}
              />
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-surface-lighter text-xs text-gray-300 px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                {item.clicks} clicks
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-2 text-[10px] text-gray-600">
        <span>{recent[0]?.hour ? new Date(recent[0].hour).toLocaleDateString() : ''}</span>
        <span>{recent[recent.length - 1]?.hour ? new Date(recent[recent.length - 1].hour).toLocaleDateString() : ''}</span>
      </div>
    </div>
  );
}
