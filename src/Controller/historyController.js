import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

class HistoryController {
  
  // GET /api/history
  async getAllHistory(req, res) {
    try {
      const { page = 1, limit = 50, action } = req.query;
      const skip = (page - 1) * limit;

      const where = {};
      if (action) {
        where.action = action;
      }

      const logs = await prisma.historyLog.findMany({
        where,
        include: {
          user: {
            select: { 
              username: true 
            }
          },
          product: {
            select: {
              productName: true,  // ✅ Sửa từ name -> productName
              sku: true
            }
          }
        },
        orderBy: { timestamp: 'desc' },
        take: Number(limit),
        skip: Number(skip)
      });

      const formatted = logs.map(log => ({
        id: log.id,
        action: log.action,
        productId: log.productId,
        productName: log.productName,
        productSku: log.productSku,
        details: log.details,
        timestamp: log.timestamp,
        username: log.user?.username || 'System'
      }));

      res.json(formatted);
    } catch (error) {
      console.error('Get history error:', error);
      res.status(500).json({ error: 'Lỗi khi lấy lịch sử hoạt động' });
    }
  }

  // GET /api/history/user/:userId
  async getHistoryByUser(req, res) {
    try {
      const { userId } = req.params;

      const logs = await prisma.historyLog.findMany({
        where: { 
          userId: Number(userId) 
        },
        include: {
          user: {
            select: { username: true }
          },
          product: {
            select: { 
              productName: true,  // ✅ Sửa
              sku: true 
            }
          }
        },
        orderBy: { timestamp: 'desc' }
      });

      res.json(logs);
    } catch (error) {
      console.error('Get history by user error:', error);
      res.status(500).json({ error: 'Lỗi khi lấy lịch sử theo user' });
    }
  }

  // GET /api/history/product/:productId
  async getHistoryByProduct(req, res) {
    try {
      const { productId } = req.params;

      const logs = await prisma.historyLog.findMany({
        where: { 
          productId: Number(productId) 
        },
        include: {
          user: {
            select: { username: true }
          }
        },
        orderBy: { timestamp: 'desc' }
      });

      res.json(logs);
    } catch (error) {
      console.error('Get history by product error:', error);
      res.status(500).json({ error: 'Lỗi khi lấy lịch sử theo sản phẩm' });
    }
  }
}

export default new HistoryController();