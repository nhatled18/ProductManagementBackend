import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import routes from './src/routes/index.js';
import { errorHandler, notFound } from './src/middleware/errorHandle.js';

const app = express();

// ===== INIT PRISMA =====
const prisma = new PrismaClient();

// ===== CORS =====
app.use(cors({
  origin: '*', // Cho phép mọi origin để test trước, sau này sửa lại sau
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== ROUTES =====
app.get('/', (req, res) => {
  res.json({ message: 'Backend is running!' });
});

app.use('/api', routes);

app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'OK', db: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

app.use(notFound);
app.use(errorHandler);

// ===== KHỞI CHẠY SERVER (QUAN TRỌNG) =====
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});

export default app;