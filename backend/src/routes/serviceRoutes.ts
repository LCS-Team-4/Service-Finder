import { Router } from 'express';
import {
  getServiceDetails,
  getServices,
  updateService,
  getServicesByStatus,
  suggestService,
  getMySuggestions,
} from '../controllers/serviceController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

router.get('/', getServices);
router.get('/by-status', authenticateToken, requireAdmin, getServicesByStatus);
router.get('/mine', authenticateToken, getMySuggestions);
router.post('/suggest', authenticateToken, suggestService);
router.patch('/:id', authenticateToken, requireAdmin, updateService);  // ← renamed

export default router;