import type { Job } from 'bullmq';
import { Worker } from 'bullmq';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Redis } from 'ioredis';

import { recordClick } from '../services/clickService.js';
import { lookupCountry } from '../services/geoService.js';
import { hashIp } from '../utils/hash.js';
import { wsEmitter } from '../utils/wsEmitter.js';

export type ClickJobData = {
  code: string;
  link_id: string;
  rawIp: string;
  referrer: string | null;
  user_agent: string | null;
};

export function startWorker(deps: {
  redis: Redis;
  supabase: SupabaseClient;
  geoipApiUrl: string;
}): Worker<ClickJobData> {
  const connection = deps.redis.duplicate();

  const worker = new Worker<ClickJobData>(
    'clickQueue',
    async (job: Job<ClickJobData>) => {
      const date = new Date().toISOString().slice(0, 10);
      const linkId = BigInt(job.data.link_id);
      const ipHash = hashIp(job.data.rawIp, linkId, date);

      const uniqKey = `uniq:${job.data.link_id}:${date}`;
      await deps.redis.sadd(uniqKey, ipHash);
      await deps.redis.expire(uniqKey, 172800);

      const country = await lookupCountry(
        deps.redis,
        job.data.rawIp,
        deps.geoipApiUrl
      );

      await recordClick(deps.supabase, {
        linkId,
        referrer: job.data.referrer,
        country,
        userAgent: job.data.user_agent,
        ipHash,
      });

      const { data: link } = await deps.supabase
        .from('links')
        .select('click_count, max_clicks')
        .eq('id', Number(linkId))
        .single();

      if (
        link &&
        link.max_clicks &&
        link.max_clicks > 0 &&
        link.click_count >= link.max_clicks
      ) {
        await deps.supabase
          .from('links')
          .update({ active: false, updated_at: new Date().toISOString() })
          .eq('id', Number(linkId));

        await deps.redis.del(`link:${job.data.code}`);

        wsEmitter.emit('link_updated', {
          code: job.data.code,
          active: false,
        });
      }

      let uniqueClicks = 0;
      const { data: events } = await deps.supabase
        .from('click_events')
        .select('ip_hash')
        .eq('link_id', Number(linkId));
      if (events) {
        const unique = new Set<string>();
        for (const e of events) {
          if (e.ip_hash) unique.add(e.ip_hash);
        }
        uniqueClicks = unique.size;
      }

      wsEmitter.emit('click_event', {
        code: job.data.code,
        clicked_at: new Date().toISOString(),
        country: country ?? 'UNKNOWN',
        referrer: job.data.referrer ?? 'direct',
        total_clicks: link?.click_count ?? 0,
        unique_clicks: uniqueClicks,
      });
    },
    { connection, concurrency: 5 }
  );

  worker.on('failed', (job, err) => {
    process.stderr.write(
      `Click job failed ${String(job?.id ?? '')}: ${String(err)}\n`
    );
  });

  return worker;
}
