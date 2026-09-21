import type { NextFunction, Request, Response } from 'express'
import { supabase } from '../config/supabase'

export type AuthRequest = Request & {
	auth?: {
		userId: string
		email?: string
		role?: string
	}
}

export async function authenticateToken(
	req: AuthRequest,
	res: Response,
	next: NextFunction,
) {
	const header = req.headers.authorization
	const token = header?.startsWith('Bearer ')
		? header.slice('Bearer '.length).trim()
		: undefined

	if (!token) {
		return res.status(401).json({ error: 'Access token required' })
	}

	try {
		const { data, error } = await supabase.auth.getUser(token)

		if (error || !data.user) {
			return res.status(401).json({ error: 'Invalid or expired access token' })
		}

		req.auth = {
			userId: data.user.id,
			email: data.user.email,
			role: typeof data.user.app_metadata?.role === 'string'
				? data.user.app_metadata.role
				: undefined,
		}

		next()
	} catch (error) {
		next(error)
	}
}

export function requireAdmin(
	req: AuthRequest,
	res: Response,
	next: NextFunction,
) {
	if (req.auth?.role !== 'admin') {
		return res.status(403).json({ error: 'Admin access required' })
	}

	next()
}
