import { Router } from 'express'
import { importServices } from '../api/geoapify/client'
import { requireAdminImportToken } from '../middleware/adminImportAuth'

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

export default router