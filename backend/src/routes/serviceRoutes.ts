import { Router } from 'express';
import { getServiceDetails, getServices, updateService } from '../controllers/serviceController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

router.get('/', getServices);
router.get('/:externalId', getServiceDetails);
router.patch('/:id', authenticateToken, requireAdmin, updateService);
// router.post('/suggest', suggestService);

export default router;
