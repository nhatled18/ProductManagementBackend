// server/routes/transactionRoutes.js
import { Router } from 'express';
import TransactionController from '../Controller/TransactionController.js';
import { authMiddleware } from '../middleware/auth.js'; // Optional
const router = Router();

// ✅ FIXED: Wrap tất cả methods để giữ context

// GET /api/transactions/stats - Thống kê
router.get('/stats', (req, res) => TransactionController.getStats(req, res));

// GET /api/transactions/export - Export Excel
router.get('/export', (req, res) => TransactionController.exportTransactions(req, res));

// POST /api/transactions/batch - Tạo nhiều transactions
router.post('/batch', (req, res) => TransactionController.createBatch(req, res));

// POST /api/transactions/delete-many - Xóa nhiều
router.post('/delete-many', (req, res) => TransactionController.deleteMany(req, res));

// POST /api/transactions/import-excel - Import Excel
router.post('/import-excel', (req, res) => TransactionController.importExcel(req, res));

// GET /api/transactions/product/:productId - Lấy theo product
router.get('/product/:productId', (req, res) => TransactionController.getByProduct(req, res));

// GET /api/transactions - Lấy tất cả (có filter)
router.get('/', (req, res) => TransactionController.getAll(req, res));

// POST /api/transactions - Tạo mới
router.post('/', (req, res) => TransactionController.create(req, res));

// PUT /api/transactions/:id - Cập nhật
router.put('/:id', (req, res) => TransactionController.update(req, res));

// DELETE /api/transactions/:id - Xóa
router.delete('/:id', (req, res) => TransactionController.delete(req, res));
export default router;