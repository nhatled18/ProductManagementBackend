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

// ===== INIT PRISMA (CHỈ 1 INSTANCE) =====
let prisma;
if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient({
      log: ['query', 'error', 'warn'],
    });
  }
  prisma = global.prisma;
}

// ===== CONFIG =====
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://product-management-frontend-six.vercel.app';
const LOCAL_URLS = ['http://localhost:5173', 'http://localhost:3000'];
const allowedOrigins = [FRONTEND_URL, ...LOCAL_URLS];

// ===== CORS =====
const corsOptions = {
  origin: (origin, callback) => {
    // Cho phép requests không có origin (Postman, mobile apps)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
};

app.use(cors(corsOptions));

// ✅ Handle preflight cho tất cả routes
// Middleware cors() đã tự động xử lý OPTIONS, nhưng có thể thêm explicit handler:
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    return res.sendStatus(200);
  }
  next();
});

// ===== BODY PARSING =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== DEBUG LOGGER =====
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// ===== DEFAULT ROUTE =====
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Backend đang hoạt động!',
    availableEndpoints: ['/api', '/health'],
    environment: process.env.NODE_ENV || 'development',
  });
});

// ===== API ROUTES =====
app.use('/api', routes);

// ===== HEALTH CHECK =====
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'OK',
      db: 'connected',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (err) {
    res.status(500).json({
      status: 'ERROR',
      db: 'disconnected',
      message: err.message,
    });
  }
});

// ===== ERROR HANDLERS =====
app.use(notFound);
app.use(errorHandler);

// ===== LOCAL DEVELOPMENT SERVER =====
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

// ===== EXPORT CHO VERCEL =====
export default app;

// ===== GRACEFUL SHUTDOWN (CHỈ LOCAL) =====
if (process.env.NODE_ENV !== 'production') {
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
}
