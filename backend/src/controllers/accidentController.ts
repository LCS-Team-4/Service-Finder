import { NextFunction, Request, Response } from 'express'
import { supabase } from '../config/supabase'
import { fetchAccidentDetails } from '../models/accident'

//fetch accident details
export async function getAccidentDetails(req: Request, res: Response, next: NextFunction) {
    try {
        const service = await fetchAccidentDetails(req.params.externalId)

        if (!service) {
            res.status(404).json({ message: 'Service not found' })
            return
        }

        res.json(service)
    } catch (error) {
        next(error)
    }
}