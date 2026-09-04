import { NextFunction, Request, Response } from 'express'
import { supabase } from '../config/supabase'

export async function getServices(req: Request, res: Response, next: NextFunction) {
	try {
		const type = typeof req.query.type === 'string' ? req.query.type : undefined
		const search = typeof req.query.q === 'string' ? req.query.q.trim() : undefined
		const requestedLimit = Number(req.query.limit ?? 100)
		const limit = Number.isInteger(requestedLimit)
			? Math.min(Math.max(requestedLimit, 1), 500)
			: 100

		let query = supabase.from('services').select('*').limit(limit)

		if (type) query = query.eq('type', type)
		if (search) query = query.ilike('name', `%${search}%`)

		const { data, error } = await query
		if (error) throw error

		res.json(data ?? [])
	} catch (error) {
		next(error)
	}
}
