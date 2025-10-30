import { Router } from 'express';
const router = Router();

import authRoutes from './authRoutes.js';
import productRoutes from './productRoutes.js';
import transactionsRoutes from './transactionsRoutes.js';
import historyRoutes from './historyRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
import inventoryRoutes from './inventoryRoutes.js';

// Mount routes
router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/transactions', transactionsRoutes);
// router.use('/imports', transactionsRoutes); 
router.use('/history', historyRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/inventory', inventoryRoutes);

// Health check (optional)
// router.get('/health', (req, res) => {
//   res.json({ status: 'OK', message: 'Product Management API is running', timestamp: new Date().toISOString() });
// });

export default router;
