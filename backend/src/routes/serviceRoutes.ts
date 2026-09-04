import { Router } from 'express';
import { getServices } from '../controllers/serviceController';

const router = Router();

router.get('/', getServices);
// router.post('/suggest', suggestService);

export default router;
