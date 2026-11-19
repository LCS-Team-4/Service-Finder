import { Router } from 'express';
import {
  getServiceDetails,
  getServices,
  updateService,
  getServicesByStatus,
  suggestService,
  getUserSuggestions
} from '../controllers/serviceController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

router.get('/', getServices);
router.get('/by-status', authenticateToken, requireAdmin, getServicesByStatus);
router.get('/my-suggestions', authenticateToken, getUserSuggestions); 
router.get('/:externalId', getServiceDetails);
router.post('/suggest', authenticateToken, suggestService);
router.patch('/:id', authenticateToken, requireAdmin, updateService);

export default router;