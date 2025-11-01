import express from 'express';
import ProductController from '../Controller/productController.js';

const router = express.Router();

// ========== PRODUCT ROUTES ==========
// Đã có /api/products từ index.js rồi, nên chỉ cần thêm phần sau

// GET /api/products - Get all products
router.get('/', ProductController.getAllProducts); // ✅

// GET /api/products/groups - Get all unique groups
router.get('/groups', ProductController.getGroups); // ✅ Bỏ /products

// GET /api/products/search - Search products
router.get('/search', ProductController.searchProducts); // ✅ Bỏ /products

// GET /api/products/:id - Get product by ID
router.get('/:id', ProductController.getProductById); // ✅ Bỏ /products

// POST /api/products - Create new product
router.post('/', ProductController.createProduct); // ✅

// PUT /api/products/:id - Update product
router.put('/:id', ProductController.updateProduct); // ✅ Bỏ /products

// DELETE /api/products/:id - Delete product
router.delete('/:id', ProductController.deleteProduct); // ✅ Bỏ /products

export default router;