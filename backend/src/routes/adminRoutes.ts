import { Router } from 'express'
import { importServices } from '../api/geoapify/client'
import { importTomTomServices, importTrafficIncidents } from '../api/tomtom/client'
import { requireAdminImportToken } from '../middleware/adminImportAuth'
import { backfillServiceCategories } from '../services/categoryService'

const router = Router()

router.post('/import/services', requireAdminImportToken, async (_req, res, next) => {
  try {
    const result = await importServices()
    res.json(result)
  } catch (error) {
    console.error('IMPORT ERROR:', error)
    next(error)
  }
  
})

router.post('/import/accidents', requireAdminImportToken, async (_req, res, next) => {
  try {
    const result = await importTrafficIncidents()
    res.json(result)
  } catch (error) {
    console.error('ACCIDENT IMPORT ERROR:', error)
    next(error)
  }
})

router.post('/import/tomtom/services', requireAdminImportToken, async (_req, res, next) => {
  try {
    const result = await importTomTomServices()
    res.json(result)
  } catch (error) {
    console.error('TOMTOM SERVICE IMPORT ERROR:', error)
    next(error)
  }
})

router.post('/sync/service-categories', requireAdminImportToken, async (_req, res, next) => {
  try {
    const updated = await backfillServiceCategories()
    res.json({ updated })
  } catch (error) {
    next(error)
  }
})

export default router