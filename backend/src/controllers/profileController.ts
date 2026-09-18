// NOTE: not functional — references a `profiles` table that does not exist yet.
// Do not mount until that table is created (Step 7).
//
// Planned shape (Step 7):
// - GET  /api/profiles        (admin) — list profiles
// - GET  /api/profiles/:id    — single profile
// - PATCH /api/profiles/:id   — update own profile
// - PATCH /api/profiles/:id/role (admin) — promote/demote

import type { Request, Response } from 'express'
import { getProfilesDb } from '../models/profile'

export const getProfilesCon = async (req: Request, res: Response) => {
  const result = await getProfilesDb()
  if (!result.success) {
    return res.status(400).json(result)
  }
  return res.status(200).json(result)
}