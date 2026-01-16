import express from 'express';
import InventoryController from '../Controller/inventoryController.js';

const router = express.Router();

// ============================================
// 🔧 INIT & SYNC ENDPOINTS (chạy trước tiên)
// ============================================

/**
 * POST /api/inventory/init/create-missing
 * Tạo Inventory cho tất cả Product chưa có Inventory
 * ⚠️ Chạy 1 lần sau khi khôi phục dữ liệu
 */
router.post('/init/create-missing', (req, res) => 
  InventoryController.createMissingInventories(req, res)
);

/**
 * GET /api/inventory/stats/missing
 * Kiểm tra có bao nhiêu sản phẩm chưa có inventory
 */
router.get('/stats/missing', (req, res) => 
  InventoryController.checkMissingInventories(req, res)
);

/**
 * POST /api/inventory/sync/all
 * Đồng bộ lại TẤT CẢ tồn kho từ transactions
 */
router.post('/sync/all', (req, res) => 
  InventoryController.syncAllInventories(req, res)
);

/**
 * POST /api/inventory/:productId/sync
 * Đồng bộ tồn kho cho 1 sản phẩm
 */
router.post('/:productId/sync', (req, res) => 
  InventoryController.syncInventoryByProduct(req, res)
);

// ============================================
// 📊 STATS & SEARCH ENDPOINTS
// ============================================

// GET /api/inventory/stats
router.get('/stats', (req, res) => InventoryController.getInventoryStats(req, res));

// GET /api/inventory/stock-types
router.get('/stock-types', (req, res) => InventoryController.getStockTypes(req, res));

// GET /api/inventory/search
router.get('/search', (req, res) => InventoryController.searchInventories(req, res));

// ============================================
// 🔄 BATCH OPERATIONS
// ============================================

// POST /api/inventory/batch
router.post('/batch', (req, res) => InventoryController.batchCreateInventories(req, res));

// ============================================
// CRUD ENDPOINTS
// ============================================

// GET /api/inventory/:id
router.get('/:id', (req, res) => InventoryController.getInventoryById(req, res));

// GET /api/inventory
router.get('/', (req, res) => InventoryController.getAllInventories(req, res));

// POST /api/inventory
router.post('/', (req, res) => InventoryController.createInventory(req, res));

// PUT /api/inventory/:id
router.put('/:id', (req, res) => InventoryController.updateInventory(req, res));

// DELETE /api/inventory/:id
router.delete('/:id', (req, res) => InventoryController.deleteInventory(req, res));

export default router;