// server/routes/transactionRoutes.js
import { Router } from 'express';
import TransactionController from '../Controller/TransactionController.js';
import { authMiddleware } from '../middleware/auth.js'; // Optional

const router = Router();

// Apply auth middleware if neede
// router.use(authMiddleware);

// ⚠️ QUAN TRỌNG: Các route cụ thể phải đặt TRƯỚC /:id

// GET /api/transactions/stats - Thống kê
router.get('/stats', TransactionController.getStats);

// GET /api/transactions/export - Export Excel
router.get('/export', TransactionController.exportTransactions);

// POST /api/transactions/batch - Tạo nhiều transactions
router.post('/batch', TransactionController.createBatch);

// POST /api/transactions/delete-many - Xóa nhiều
router.post('/delete-many', TransactionController.deleteMany);

// POST /api/transactions/import-excel - Import Excel
router.post('/import-excel', TransactionController.importExcel);

// GET /api/transactions/product/:productId - Lấy theo product
router.get('/product/:productId', TransactionController.getByProduct);

// GET /api/transactions - Lấy tất cả (có filter)
router.get('/', TransactionController.getAll);

// POST /api/transactions - Tạo mới
router.post('/', TransactionController.create);

// GET /api/transactions/:id - Lấy theo ID
router.get('/:id', TransactionController.getById);

// PUT /api/transactions/:id - Cập nhật
router.put('/:id', TransactionController.update);

// DELETE /api/transactions/:id - Xóa
router.delete('/:id', TransactionController.delete);

export default router;