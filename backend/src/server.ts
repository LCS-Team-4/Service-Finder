import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import serviceRoutes from './routes/serviceRoutes';
import authRoutes from './routes/authRoutes';
import adminRoutes from './routes/adminRoutes';
import accidentRoutes from './routes/accidentRoutes';
import { importServices } from './api/geoapify/client';
import { importTrafficIncidents } from './api/tomtom/client';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/services', serviceRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/traffic-incidents', accidentRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

const importIntervalMs = Number(process.env.IMPORT_INTERVAL_MS || 0);
if (process.env.AUTO_IMPORT_SERVICES === 'true') {
	importServices().catch((error) => console.error('[import] initial import failed', error));
}

if (importIntervalMs > 0) {
	setInterval(() => {
		importServices().catch((error) => console.error('[import] failed', error));
	}, importIntervalMs);
}

// Traffic incidents are a "present" snapshot, so they are refreshed on an interval.
// The importer's own lock returns { skipped: true } if a run is still in flight.
const trafficImportIntervalMs = Number(process.env.TRAFFIC_IMPORT_INTERVAL_MS || 0);
if (process.env.AUTO_IMPORT_TRAFFIC === 'true') {
	importTrafficIncidents().catch((error) => console.error('[import] initial traffic import failed', error));
}

if (trafficImportIntervalMs > 0) {
	setInterval(() => {
		importTrafficIncidents().catch((error) => console.error('[import] traffic import failed', error));
	}, trafficImportIntervalMs);
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
