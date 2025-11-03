import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import TransactionController from '../Controller/TransactionController.js';

const router = Router();

// ✅ Setup multer (giữ nguyên như cũ)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const uploadDir = path.join(__dirname, '../../uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `import-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file Excel (.xlsx, .xls)'));
    }
  }
});

// ✅ THỨ TỰ ROUTES QUAN TRỌNG: SPECIFIC TRƯỚC, GENERAL SAU

// ========== POST ROUTES (SPECIFIC) ==========
// POST /api/transactions/import-excel
router.post('/import-excel', 
  upload.single('file'),
  (req, res) => TransactionController.importExcel(req, res)
);

// POST /api/transactions/batch
router.post('/batch', 
  (req, res) => TransactionController.createBatch(req, res)
);

// POST /api/transactions/delete-many
router.post('/delete-many', 
  (req, res) => TransactionController.deleteMany(req, res)
);

// ========== GET ROUTES (SPECIFIC) ==========
// GET /api/transactions/stats
router.get('/stats', 
  (req, res) => TransactionController.getStats(req, res)
);

// GET /api/transactions/export
router.get('/export', 
  (req, res) => TransactionController.exportTransactions(req, res)
);

// GET /api/transactions/product/:productId
router.get('/product/:productId', 
  (req, res) => TransactionController.getByProduct(req, res)
);

// ========== GENERAL ROUTES (SAU CÙNG) ==========
// GET /api/transactions (list all - có query params)
router.get('/', 
  (req, res) => TransactionController.getAll(req, res)
);

// POST /api/transactions (create one)
router.post('/', 
  (req, res) => TransactionController.create(req, res)
);

// GET /api/transactions/:id (get by ID - ĐẶT SAU CÙNG)
router.get('/:id', 
  (req, res) => TransactionController.getById(req, res)
);

// PUT /api/transactions/:id
router.put('/:id', 
  (req, res) => TransactionController.update(req, res)
);

// DELETE /api/transactions/:id
router.delete('/:id', 
  (req, res) => TransactionController.delete(req, res)
);

export default router;