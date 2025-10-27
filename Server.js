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
  log: ['query', 'error', 'warn'],
});

// ===== MIDDLEWARE =====
// ⭐ FIX CORS
const allowedOrigins = [
  'https://product-management-frontend-six.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    // Cho phép requests không có origin (Postman, mobile apps)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('⚠️ Origin bị chặn:', origin);
      callback(null, true); // Tạm thời cho phép tất cả để test
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// ⭐ Xử lý preflight requests (QUAN TRỌNG!)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

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
    await prisma.$connect();
    console.log('✅ Kết nối database thành công!');

    if (process.env.NODE_ENV !== 'production') {
      const PORT = process.env.PORT || 5000;
      app.listen(PORT, () => {
        console.log('=================================');
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📡 API endpoint: http://localhost:${PORT}/api`);
        console.log(`💚 Health check: http://localhost:${PORT}/health`);
        console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log('=================================');
      });
    }
  } catch (err) {
    console.error('❌ Lỗi khởi động server:', err);
    process.exit(1);
  }
}

startServer();

export default app;

// ===== GRACEFUL SHUTDOWN =====
async function shutdown() {
  console.log('\n⏳ Đang đóng kết nối...');
  await prisma.$disconnect();
  console.log('✅ Đã đóng kết nối database');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err);
  prisma.$disconnect().then(() => process.exit(1));
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  prisma.$disconnect().then(() => process.exit(1));
});