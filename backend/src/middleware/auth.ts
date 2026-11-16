import type { NextFunction, Request, Response } from 'express'
import { createClient } from '@supabase/supabase-js'

export type AuthRequest = Request & {
  auth?: {
    userId: string
    email?: string
    role?: string
  }
}

// Dedicated client used ONLY for verifying JWTs. Kept separate from the
// shared service-role client in config/supabase.ts so that calling
// .auth.getUser() here never mutates the shared client's session.
const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY
if (!supabaseUrl) throw new Error('SUPABASE_URL is not configured')
if (!supabaseServiceKey) throw new Error('SUPABASE_SERVICE_KEY is not configured')

const supabaseAuthClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})

export async function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ')
    ? header.slice('Bearer '.length).trim()
    : undefined

  if (!token) return res.status(401).json({ error: 'Access token required' })

  try {
    const { data, error } = await supabaseAuthClient.auth.getUser(token)
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