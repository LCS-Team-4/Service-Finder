import { NextFunction, Request, Response } from 'express'
import { supabase } from '../config/supabase'
import { fetchServiceDetails, updateServiceDetails, findServiceById } from '../models/Service'
  
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
