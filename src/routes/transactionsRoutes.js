import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import TransactionController from '../Controller/TransactionController.js';

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const uploadDir = process.env.NODE_ENV === 'production' 
  ? '/tmp/uploads'
  : path.join(__dirname, '../../uploads');

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

// ========== POST ROUTES (SPECIFIC FIRST) ==========
router.post('/import-excel', 
  upload.single('file'),
  (req, res) => TransactionController.importExcel(req, res)
);

router.post('/batch', 
  (req, res) => TransactionController.createBatch(req, res)
);

router.post('/delete-many', 
  (req, res) => TransactionController.deleteMany(req, res)
);

// ========== GET ROUTES (SPECIFIC FIRST) ==========
router.get('/stats', 
  (req, res) => TransactionController.getStats(req, res)
);

router.get('/export', 
  (req, res) => TransactionController.exportTransactions(req, res)
);

// 🔥 THÊM ROUTE MỚI - Lấy theo type (KHÔNG GIỚI HẠN)
router.get('/type/:type', 
  (req, res) => TransactionController.getByType(req, res)
);

router.get('/product/:productId', 
  (req, res) => TransactionController.getByProduct(req, res)
);

// ========== GENERAL ROUTES (LAST) ==========
router.get('/', 
  (req, res) => TransactionController.getAll(req, res)
);

router.post('/', 
  (req, res) => TransactionController.create(req, res)
);

router.get('/:id', 
  (req, res) => TransactionController.getById(req, res)
);

router.put('/:id', 
  (req, res) => TransactionController.update(req, res)
);

router.delete('/:id', 
  (req, res) => TransactionController.delete(req, res)
);

export default router;