import { Router } from 'express';
import HistoryController from '../Controller/historyController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', HistoryController.getAllHistory);
router.get('/user/:userId', HistoryController.getHistoryByUser);
router.get('/product/:productId', HistoryController.getHistoryByProduct);

export default router;