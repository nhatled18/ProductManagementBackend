// server/routes/inventoryRoutes.js
import express from 'express';
import InventoryController from '../Controller/inventoryController.js';

const router = express.Router();

// ⚠️ QUAN TRỌNG: Các route cụ thể phải đặt TRƯỚC các route có params (:id)

// GET /api/inventory/stats - Thống kê
router.get('/stats', InventoryController.getStats);

// POST /api/inventory/delete-many - Xóa nhiều
router.post('/delete-many', InventoryController.deleteMany);

// POST /api/inventory/import - Import Excel
router.post('/import', InventoryController.importInventory);

// GET /api/inventory/export - Export Excel
router.get('/export', InventoryController.exportInventory);

// GET /api/inventory - Lấy danh sách
router.get('/', InventoryController.getAllInventory);

// POST /api/inventory - Tạo mới
router.post('/', InventoryController.createProduct);

// GET /api/inventory/:id - Lấy theo ID
router.get('/:id', InventoryController.getProductById);

// PUT /api/inventory/:id - Cập nhật
router.put('/:id', InventoryController.updateProduct);

// DELETE /api/inventory/:id - Xóa
router.delete('/:id', InventoryController.deleteProduct);

export default router;