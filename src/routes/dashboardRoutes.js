import { Router } from 'express';
import DashboardController from '../Controller/dashboardController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/stats', DashboardController.getStats);
router.get('/revenue', DashboardController.getRevenue);
router.get('/low-stock', DashboardController.getLowStockProducts);
router.get('/recent-transactions', DashboardController.getRecentTransactions);
router.get('/chart-data', DashboardController.getChartData);
router.get('/product-groups', DashboardController.getProductGroups);

export default router;