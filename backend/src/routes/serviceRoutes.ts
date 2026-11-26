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
router.patch('/:id', authenticateToken, requireAdmin, updateService);

// ORS routing proxy — keeps the API key server-side and avoids CORS
router.post('/route', async (req, res, next) => {
  try {
    const { fromLng, fromLat, toLng, toLat, mode } = req.body;

    if (
      typeof fromLng !== 'number' ||
      typeof fromLat !== 'number' ||
      typeof toLng !== 'number' ||
      typeof toLat !== 'number'
    ) {
      return res.status(400).json({ error: 'fromLng, fromLat, toLng, toLat required' });
    }

    const apiKey = process.env.ORS_API_KEY;
    if (!apiKey) {
      console.error('[ORS Proxy] ORS_API_KEY is not set in .env');
      return res.status(500).json({ error: 'ORS API key missing on server' });
    }

    const profiles: Record<string, string> = {
      driving: 'driving-car',
      walking: 'foot-walking',
      cycling: 'cycling-regular',
    };
    const profile = profiles[String(mode)] || 'driving-car';

    const orsRes = await fetch(
      `https://api.heigit.org/openrouteservice/v2/directions/${profile}/geojson`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json, application/geo+json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          coordinates: [
            [fromLng, fromLat],
            [toLng, toLat],
          ],
        }),
      }
    );

    if (!orsRes.ok) {
      const errorText = await orsRes.text();
      console.error('[ORS Proxy] Upstream error:', orsRes.status, errorText.slice(0, 500));
      return res.status(502).json({ error: 'ORS upstream failed', detail: errorText.slice(0, 300) });
    }

    const data = await orsRes.json();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;