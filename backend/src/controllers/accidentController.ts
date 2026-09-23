import { NextFunction, Request, Response } from 'express'
import { supabase } from '../config/supabase'
import { fetchAccidentDetails } from '../models/accident'

export async function getTrafficIncidents(_req: Request, res: Response, next: NextFunction) {
    try {
        const { data, error } = await supabase
            .from('traffic_incidents')
            .select('id,icon_category,magnitude_of_delay,from_road,to_road,length_m,delay_seconds,road_numbers,description,geometry,imported_at')
            .order('imported_at', { ascending: false })

        if (error) throw error

        res.json(data ?? [])
    } catch (error) {
        next(error)
    }
}

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