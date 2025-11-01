import express from 'express';
import InventoryController from '../Controller/inventoryController.js';

const router = express.Router();

// ✅ FIXED: Bỏ /inventories, chỉ dùng / vì đã có prefix /inventory

// GET /api/inventory/stats
router.get('/stats', (req, res) => InventoryController.getInventoryStats(req, res));

// GET /api/inventory/stock-types
router.get('/stock-types', (req, res) => InventoryController.getStockTypes(req, res));

// GET /api/inventory/search
router.get('/search', (req, res) => InventoryController.searchInventories(req, res));

// POST /api/inventory/batch
router.post('/batch', (req, res) => InventoryController.batchCreateInventories(req, res));

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