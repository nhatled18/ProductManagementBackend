import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

import routes from './src/routes/index.js';
import { errorHandler, notFound } from './src/middleware/errorHandle.js';

// ===== LOAD ENV =====
dotenv.config();

// ===== INIT APP =====
const app = express();

// ===== INIT PRISMA =====
const prisma = new PrismaClient();

// ===== CHECK DATABASE CONNECTION =====
prisma.$connect()
  .then(() => console.log('✅ Kết nối database thành công!'))
  .catch((err) => console.error('❌ Lỗi kết nối database:', err.message));

// ===== MIDDLEWARE =====
// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging (development only)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// ===== ROUTES =====

// Default route — kiểm tra backend có chạy không
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Backend đang hoạt động!',
    availableEndpoints: ['/api', '/health'],
    environment: process.env.NODE_ENV || 'development'
  });
});

// API chính
app.use('/api', routes);

// Health check
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'OK',
      db: 'connected',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (err) {
    res.status(500).json({
      status: 'ERROR',
      db: 'disconnected',
      message: err.message
    });
  }
});

// ===== ERROR HANDLING =====
app.use(notFound);
app.use(errorHandler);

// ===== EXPORT APP (Vercel sẽ tự chạy app) =====
export default app;

// ===== LOCAL DEVELOPMENT ONLY =====
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log('=================================');
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 API endpoint: http://localhost:${PORT}/api`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('=================================');
  });
}

// ===== ERROR MONITORING =====
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});
