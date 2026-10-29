import { Router } from 'express'
import { importServices } from '../api/geoapify/client'
import { importTrafficIncidents } from '../api/tomtom/client'
import { requireAdminJwt } from '../middleware/adminImportAuth'
import { backfillServiceCategories } from '../services/categoryService'

const router = Router()

router.post('/import/services', requireAdminJwt, async (_req, res, next) => {
  try {
    const result = await importServices()
    res.json(result)
  } catch (error) {
    console.error('IMPORT ERROR:', error)
    next(error)
  }
})

router.post('/import/accidents', requireAdminJwt, async (_req, res, next) => {
  try {
    const result = await importTrafficIncidents()
    res.json(result)
  } catch (error) {
    console.error('ACCIDENT IMPORT ERROR:', error)
    next(error)
  }
})

router.post('/sync/service-categories', requireAdminJwt, async (_req, res, next) => {
  try {
    const updated = await backfillServiceCategories()
    res.json({ updated })
  } catch (error) {
    next(error)
  }
})

export default router