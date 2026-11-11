// backend/src/routes/serviceRoutes.ts
import { Router } from 'express';
import {
  getServiceDetails,
  getServices,
  updateService,
  getServicesByStatus,
  suggestService,
} from '../controllers/serviceController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

router.get('/', getServices);
router.get('/by-status', authenticateToken, requireAdmin, getServicesByStatus);
router.post('/suggest', authenticateToken, suggestService);
router.patch('/:id', authenticateToken, requireAdmin, updateService);
// router.post('/', authenticateToken, requireAdmin, createService);  ← comment out or delete

export default router;