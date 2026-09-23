import { supabase } from '../config/supabase'
import type { ServiceDetails } from './Service'

export async function fetchAccidentDetails(externalId: string): Promise<ServiceDetails | null> {
    const normalizedExternalId = externalId.trim()

    if (!normalizedExternalId) {
        throw new Error('A service external_id is required')
    }

    const { data, error } = await supabase
        .from('services')
        .select('id,external_id,name,type,category_id,category:service_categories(id,name,slug,parent_id),formatted_address,location,opening_hours,website,phone,wheelchair,sourcename,imported_at')
        .eq('external_id', normalizedExternalId)
        .maybeSingle()

    if (error) throw error

    return data as ServiceDetails | null
}

