import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';

import serviceRoutes from './routes/serviceRoutes';
import authRoutes from './routes/authRoutes';
import adminRoutes from './routes/adminRoutes';
import accidentRoutes from './routes/accidentRoutes';

import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const app = express();
app.use(cors());
app.use(express.json());

// API routes
app.use('/api/services', serviceRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/traffic-incidents', accidentRoutes);

// Serve the built frontend for demo purposes
const frontendDist = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = Number(process.env.DEMO_PORT ?? 5050);
app.listen(PORT, () => console.log(`Demo server running on port ${PORT}`));