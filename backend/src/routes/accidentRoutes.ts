import { Router } from 'express';
import { getAccidentDetails} from '../controllers/accidentController'
const router = Router();

router.get('/:externalId', getAccidentDetails);



export default router;
