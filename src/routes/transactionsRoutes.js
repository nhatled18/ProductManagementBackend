import { Router } from 'express';
import TransactionController from '../Controller/TransactionController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', TransactionController.getAllTransactions);
router.get('/stats', TransactionController.getTransactionStats);
router.get('/product/:productId', TransactionController.getTransactionsByProduct);
router.post('/', TransactionController.createTransaction);
router.delete('/:id', TransactionController.deleteTransaction);

export default router;