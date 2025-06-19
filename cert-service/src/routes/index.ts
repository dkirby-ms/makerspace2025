import { Router } from 'express';
import { healthRoutes } from './health';
import { deviceRoutes } from './devices';
import { topicRoutes } from './topics';
import { webRoutes } from './web';

const router = Router();

// Mount route modules
router.use('/', healthRoutes);
router.use('/', deviceRoutes);
router.use('/', topicRoutes);
router.use('/', webRoutes);

export { router as routes };
