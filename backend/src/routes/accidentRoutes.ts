import { Router } from 'express';
import { getAccidentDetails, getTrafficIncidents } from '../controllers/accidentController'
const router = Router();

router.get('/', getTrafficIncidents)
router.get('/:externalId', getAccidentDetails);



export default router;
