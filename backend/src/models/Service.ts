import { supabase } from '../config/supabase'
import { HttpError } from '../utils/httpError'

export interface ServiceDetails {
    id: string
    external_id: string
    name: string
    type: string
    category_id: string | null
    category?: {
        id: string
        name: string
        slug: string
        parent_id: string | null
    } | null
    formatted_address: string
    location: string
    lat: number
    lng: number
    opening_hours: string | null
    website: string | null
    phone: string | null
    wheelchair: string | null
    sourcename: string | null
    imported_at: string | null
}

export async function fetchServiceDetails(externalId: string): Promise<ServiceDetails | null> {
    const normalizedExternalId = externalId.trim()

    if (!normalizedExternalId) {
        throw new HttpError(400, 'A service external_id is required')
    }

    const { data, error } = await supabase
        .from('services')
        .select('id,external_id,name,type,category_id,category:service_categories(id,name,slug,parent_id),formatted_address,location,opening_hours,website,phone,wheelchair,sourcename,imported_at')
        .eq('external_id', normalizedExternalId)
        .maybeSingle()

    if (error) throw error

    return data as ServiceDetails | null
}

export async function fetchServicesInRadius(
    latitude: number,
    longitude: number,
    radiusMeters: number,
    limit: number,
): Promise<ServiceDetails[]> {
    const { data, error } = await supabase.rpc('services_within_radius', {
        center_lat: latitude,
        center_lng: longitude,
        radius_meters: radiusMeters,
        result_limit: limit,
    })

    if (error) throw error

    return (data ?? []) as ServiceDetails[]
}

export async function updateServiceDetails(
    id: string,
    updates: {
        name?: string
        type?: string
        formatted_address?: string
        location?: string
        opening_hours?: string | null
        website?: string | null
        phone?: string | null
        wheelchair?: string | null
        sourcename?: string | null
    }
){
    const { data, error } = await supabase
    .from('services')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

    return { data, error }
}

export async function findServiceById(id: string) {
  const { data, error } = await supabase
    .from('services')
    .select('id')
    .eq('id', id)
    .single()

  return { data, error }
}