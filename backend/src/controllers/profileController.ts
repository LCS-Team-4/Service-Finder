import type { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import {
getProfilesDb,
} from '../models/profile'

//fetch profiles
export const getProfilesCon = async (req: Request, res: Response) => {
try {
const result = await getProfilesDb()

if (!result.success) {
return res.status(400).json(result)
}

return res.status(200).json(result)
} catch (error: any) {
return res.status(500).json({ success: false, error: error.message })
}
}
