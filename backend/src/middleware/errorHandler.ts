import { NextFunction, Request, Response } from 'express'

export function notFoundHandler(req: Request, res: Response) {
	res.status(404).json({
		error: 'Route not found',
		path: req.originalUrl,
		method: req.method,
	})
}

export function errorHandler(
	error: unknown,
	_req: Request,
	res: Response,
	_next: NextFunction,
) {
	console.error('REQUEST ERROR:', error)
	const isUpstreamError = typeof error === 'object' && error !== null &&
		'message' in error
	const status = isUpstreamError ? 502 : 500

	if (error instanceof Error) {
		res.status(status).json({ error: error.message })
		return
	}

	if (typeof error === 'object' && error !== null) {
		const upstreamError = error as {
			message?: unknown
			code?: unknown
			details?: unknown
		}
		const message = typeof upstreamError.message === 'string'
			? upstreamError.message
			: 'Internal server error'
		const response: { error: string; code?: string; details?: string } = { error: message }

		if (typeof upstreamError.code === 'string' && upstreamError.code) {
			response.code = upstreamError.code
		}
		if (typeof upstreamError.details === 'string' && upstreamError.details) {
			response.details = upstreamError.details
		}

		res.status(status).json(response)
		return
	}

	res.status(500).json({ error: 'Internal server error' })
}
