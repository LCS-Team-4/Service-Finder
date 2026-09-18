import { supabase } from '../../config/supabase'
import { setRateLimit, waitForRateLimit } from './http'

setRateLimit('supabase', 5, 1_000)

interface UpsertOptions {
  batchSize?: number
  limiter?: string
  onConflict?: string
}

export async function upsertToSupabase<T extends Record<string, unknown>>(
  table: string,
  rows: T[],
  { batchSize = 100, limiter = 'supabase', onConflict }: UpsertOptions = {}
): Promise<T[]> {
  if (batchSize < 1) throw new Error('batchSize must be at least 1')

  const results: T[] = []
  for (let start = 0; start < rows.length; start += batchSize) {
    await waitForRateLimit(limiter)

    const batch = rows.slice(start, start + batchSize)
    const { data, error } = await supabase
      .from(table)
      .upsert(batch as any, onConflict ? { onConflict } : undefined)
      .select()

    if (error) throw error
    if (data) results.push(...(data as T[]))
  }

  return results
}

export async function replaceInSupabase<T extends Record<string, unknown>>(
  table: string,
  rows: T[],
  { batchSize = 100, limiter = 'supabase' }: Omit<UpsertOptions, 'onConflict'> = {}
): Promise<T[]> {
  if (batchSize < 1) throw new Error('batchSize must be at least 1')

  await waitForRateLimit(limiter)
  const { error: deleteError } = await supabase
    .from(table)
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // delete-all trick — Supabase requires some filter

  if (deleteError) throw deleteError

  const results: T[] = []
  for (let start = 0; start < rows.length; start += batchSize) {
    await waitForRateLimit(limiter)

    const batch = rows.slice(start, start + batchSize)
    const { data, error } = await supabase.from(table).insert(batch as any).select()

    if (error) throw error
    if (data) results.push(...(data as T[]))
  }

  return results
}