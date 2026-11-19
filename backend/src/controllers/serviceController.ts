import { NextFunction, Request, Response } from 'express'
import { supabase } from '../config/supabase'
import {
  fetchServiceDetails,
  updateServiceDetails,
  findServiceById,
  // createServiceSuggestion,
} from '../models/Service'
import type { AuthRequest } from '../middleware/auth'

export async function getServices(req: Request, res: Response, next: NextFunction) {
  try {
    const type = typeof req.query.type === 'string' ? req.query.type : undefined
    const search = typeof req.query.q === 'string' ? req.query.q.trim() : undefined
    const requestedLimit = Number(req.query.limit ?? 100)
    const limit = Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 1000)
      : 100

    let query = supabase
      .from('services')
      .select('*, category:service_categories(id,name,slug,parent_id)')
      .eq('status', 'approved')
      .limit(limit)

    if (type) query = query.eq('category.slug', type)
    if (search) query = query.ilike('name', `%${search}%`)

    const { data, error } = await query
    if (error) throw error

    const rows = data ?? []
    const byCategoryId = new Map<string, { id: string; name: string; slug: string; parent_id: string | null }>()
    for (const row of rows) {
      const cat = (row as any).category
      if (cat) byCategoryId.set(cat.id, cat)
    }

    const parentIds = new Set(
      [...byCategoryId.values()]
        .map((c) => c.parent_id)
        .filter((id): id is string => !!id),
    )

    let parents = new Map<string, { id: string; name: string; slug: string; parent_id: string | null }>()
    if (parentIds.size > 0) {
      const { data: parentRows, error: parentError } = await supabase
        .from('service_categories')
        .select('id,name,slug,parent_id')
        .in('id', [...parentIds])
      if (parentError) throw parentError
      parents = new Map((parentRows ?? []).map((p) => [p.id, p]))
    }

    const enriched = rows.map((row: any) => {
      const cat = row.category
      if (!cat) return row
      return {
        ...row,
        category: {
          ...cat,
          parent: cat.parent_id ? parents.get(cat.parent_id) ?? null : null,
        },
      }
    })

    res.json(enriched)
  } catch (error) {
    next(error)
  }
}

export async function getServiceDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const service = await fetchServiceDetails(req.params.externalId)

    if (!service) {
      res.status(404).json({ message: 'Service not found' })
      return
    }

    res.json(service)
  } catch (error) {
    next(error)
  }
}

export const updateService = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id?.trim()
  if (!id) return res.status(400).json({ message: 'Service id is required' })

  try {
    const { data: existing, error: findError } = await findServiceById(id)
    if (findError || !existing) {
      return res.status(404).json({ message: 'Service not found' })
    }

    const {
      name,
      type,
      formatted_address,
      location,
      opening_hours,
      website,
      phone,
      wheelchair,
      sourcename,
      status,
    } = req.body

    const updates: Record<string, any> = Object.fromEntries(
      Object.entries({
        name,
        type,
        formatted_address,
        location,
        opening_hours,
        website,
        phone,
        wheelchair,
        sourcename,
        status,
      }).filter(([, value]) => value !== undefined),
    )

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'At least one service field is required' })
    }

    // Record the reviewer when the admin is changing status.
    if (status && req.auth?.userId) {
      updates.reviewed_by = req.auth.userId
      updates.review_note = status === 'approved' ? 'Approved by admin' : 'Rejected by admin'
    }

    const { data, error } = await updateServiceDetails(id, updates)
    if (error) throw error

    return res.status(200).json({ data })
  } catch (error) {
    next(error)
  }
}

export async function getServicesByStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 200)

    // Construct the raw PostgREST URL
    const url = new URL(`${process.env.SUPABASE_URL}/rest/v1/services`)
    url.searchParams.set('select', '*,category:service_categories(id,name,slug,parent_id)')
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('order', 'created_at.desc')
    
    if (status) {
      url.searchParams.set('status', `eq.${status}`)
    }

    // Use raw fetch with the service-role key to BYPASS the SDK entirely
    const response = await fetch(url.toString(), {
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_KEY!,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY!}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Supabase returned ${response.status}: ${errorText}`)
    }

    const data = await response.json()

    const enriched = (data ?? []).map((row: any) => ({
      ...row,
      type: row.category?.name ?? row.type ?? 'Service',
    }))

    res.json(enriched)
  } catch (error) {
    next(error)
  }
}

export async function suggestService(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ message: 'Authentication required to suggest a service' })
    }

    const { name, type, formatted_address, phone, website, opening_hours } = req.body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'A service name is required' })
    }

    // Insert into the NEW service_suggestions table
    const { data, error } = await supabase
      .from('service_suggestions')
      .insert({
        user_id: req.auth.userId,
        name: name.trim(),
        type: type ?? null,
        formatted_address: formatted_address ?? null,
        phone: phone ?? null,
        website: website ?? null,
        opening_hours: opening_hours ?? null,
        // DO NOT include 'location' or 'submitted_by' here. Our table doesn't have those columns!
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return res.status(201).json({ data })
  } catch (error) {
    next(error)
  }
}

export async function getUserSuggestions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ message: 'Authentication required' })
    }

    const { data, error } = await supabase
      .from('service_suggestions')
      .select('*')
      .eq('user_id', req.auth.userId)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }
    
    res.json(data ?? [])
  } catch (error) {
    next(error)
  }
}