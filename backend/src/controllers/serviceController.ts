import { NextFunction, Request, Response } from 'express'
import { supabase } from '../config/supabase'
import { fetchServiceDetails, fetchServicesInRadius, updateServiceDetails, findServiceById } from '../models/Service'
import { HttpError } from '../utils/httpError'

export async function getServices(req: Request, res: Response, next: NextFunction) {
	try {
		const type = typeof req.query.type === 'string' ? req.query.type : undefined
		const search = typeof req.query.q === 'string' ? req.query.q.trim() : undefined
		const requestedLimit = Number(req.query.limit ?? 100)
		const limit = Number.isInteger(requestedLimit)
			? Math.min(Math.max(requestedLimit, 1), 500)
			: 100

		let query = supabase
			.from('services')
			.select('*, category:service_categories(id,name,slug,parent_id)')
			.limit(limit)

		if (type) query = query.eq('category.slug', type)
		if (search) query = query.ilike('name', `%${search}%`)

		const { data, error } = await query
		if (error) throw error

		res.json(data ?? [])
	} catch (error) {
		next(error)
	}
}

//fetch service details
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

export async function getNearbyServices(req: Request, res: Response, next: NextFunction) {
	try {
		const lat = Number(req.query.lat)
		const lng = Number(req.query.lng)
		const radiusKm = Number(req.query.radiusKm ?? 5)
		const precision = req.query.precision === 'approximate' ? 'approximate' : 'exact'
		const limit = clamp(Number(req.query.limit ?? 100), 1, 200)

		if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
			throw new HttpError(400, 'lat and lng are required and must be numbers')
		}
		if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
			throw new HttpError(400, 'lat/lng out of range')
		}
		if (!Number.isFinite(radiusKm) || radiusKm <= 0) {
			throw new HttpError(400, 'radiusKm must be a positive number')
		}

		const clampedRadiusKm = clamp(radiusKm, 0.5, 50)
		const useLat = precision === 'approximate' ? Math.round(lat * 100) / 100 : lat
		const useLng = precision === 'approximate' ? Math.round(lng * 100) / 100 : lng

		const results = await fetchServicesInRadius(useLat, useLng, clampedRadiusKm * 1000, limit)

		res.json({
			precision,
			radiusKm: clampedRadiusKm,
			count: results.length,
			results,
		})
	} catch (error) {
		next(error)
	}
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max)
}

//update service details 
export const updateService = async (req: Request, res: Response, next: NextFunction) => {
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
		} = req.body

		const updates = Object.fromEntries(
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
			}).filter(([, value]) => value !== undefined),
		)

		if (Object.keys(updates).length === 0) {
			return res.status(400).json({ message: 'At least one service field is required' })
		}

		const { data, error } = await updateServiceDetails(id, updates)
		if (error) throw error

		return res.status(200).json({ data })
	} catch (error) {
		next(error)
	}
}
