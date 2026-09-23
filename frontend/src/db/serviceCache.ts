import { db } from './index';
import { getServices } from '../services/api';
import type { Service } from '../types/service.types';

const CACHE_TTL_MS = 60 * 60 * 1000;

// Debug log we can surface on screen
const debugLog: string[] = [];
export function getCacheDebugLog() { return debugLog.join('\n'); }
function log(line: string) {
  console.log('[cache]', line);
  debugLog.push(line);
}

async function isCacheStale(): Promise<boolean> {
  const row = await db.meta.get('services_last_synced');
  if (!row) { log('cache: empty (no last_synced)'); return true; }
  const age = Date.now() - Number(row.value);
  log(`cache: age ${Math.round(age / 1000)}s`);
  return age > CACHE_TTL_MS;
}

export async function refreshServicesIfStale(): Promise<boolean> {
  log('refreshServicesIfStale called');
  try {
    if (!(await isCacheStale())) { log('cache fresh, skipping'); return false; }

    log('fetching from backend...');
    const rows = await getServices({ limit: 500 });
    log(`got ${rows.length} rows`);
    log(`first row name: ${rows[0]?.name ?? '(none)'}`);
    log(`first row location type: ${typeof rows[0]?.location}`);
    log(`first row location value: ${String(rows[0]?.location).slice(0, 50)}`);

    await db.transaction('rw', db.services, db.meta, async () => {
      await db.services.clear();
      await db.services.bulkPut(rows);
      await db.meta.put({ key: 'services_last_synced', value: String(Date.now()) });
    });
    log(`wrote ${rows.length} rows to dexie`);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`ERROR: ${msg}`);
    return false;
  }
}

export async function getCachedServices(): Promise<Service[]> {
  return db.services.toArray();
}