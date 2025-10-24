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
const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'], // Bật logging để debug
});

// ===== MIDDLEWARE =====
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// ===== ROUTES =====
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Backend đang hoạt động!',
    availableEndpoints: ['/api', '/health'],
    environment: process.env.NODE_ENV || 'development'
  });
});

app.use('/api', routes);

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

// ===== STARTUP FUNCTION =====
async function startServer() {
  try {
    // 1. Connect database trước
    await prisma.$connect();
    console.log('✅ Kết nối database thành công!');

    // 2. Sau đó mới start server
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
  } catch (err) {
    console.error('❌ Lỗi khởi động server:', err);
    process.exit(1);
  }
}

// ===== START SERVER =====
startServer();

// ===== EXPORT APP (cho Vercel) =====
export default app;

// ===== GRACEFUL SHUTDOWN =====
async function shutdown() {
  console.log('\n🔄 Đang đóng kết nối...');
  await prisma.$disconnect();
  console.log('✅ Đã đóng kết nối database');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// ===== ERROR MONITORING =====
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err);
  prisma.$disconnect().then(() => process.exit(1));
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  prisma.$disconnect().then(() => process.exit(1));
});
