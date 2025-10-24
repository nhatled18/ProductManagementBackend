import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

class TransactionController {
  
  // GET /api/transactions
  async getAllTransactions(req, res) {
    try {
      const { page = 1, limit = 20, type, productId } = req.query;
      const skip = (page - 1) * limit;

      const where = {};
      if (type) where.type = type;
      if (productId) where.productId = Number(productId);

      const transactions = await prisma.transaction.findMany({
        where,
        include: {
          product: {
            select: { 
              productName: true,  // ✅ Sửa từ name -> productName
              sku: true 
            }
          },
          user: {
            select: {
              username: true
            }
          }
        },
        orderBy: { date: 'desc' },
        take: Number(limit),
        skip: Number(skip)
      });

      const formatted = transactions.map(t => ({
        id: t.id,
        productId: t.productId,
        productName: t.product.productName,  // ✅ Sửa
        productSku: t.product.sku,
        type: t.type,
        quantity: t.quantity,
        note: t.note,
        date: t.date,
        username: t.user?.username || 'System'
      }));

      res.json(formatted);
    } catch (error) {
      console.error('Get transactions error:', error);
      res.status(500).json({ error: 'Lỗi khi lấy danh sách giao dịch' });
    }
  }

  // POST /api/transactions
  async createTransaction(req, res) {
    try {
      const { productId, type, quantity, note } = req.body;

      // Validation
      if (!productId || !type || !quantity) {
        return res.status(400).json({ 
          error: 'Vui lòng điền đầy đủ thông tin giao dịch' 
        });
      }

      if (!['import', 'export'].includes(type)) {
        return res.status(400).json({ 
          error: 'Loại giao dịch phải là "import" hoặc "export"' 
        });
      }

      if (quantity <= 0) {
        return res.status(400).json({ 
          error: 'Số lượng phải lớn hơn 0' 
        });
      }

      // Lấy product
      const product = await prisma.product.findUnique({ 
        where: { id: Number(productId) } 
      });

      if (!product) {
        return res.status(404).json({ 
          error: 'Không tìm thấy sản phẩm' 
        });
      }

      // Kiểm tra tồn kho khi xuất
      if (type === 'export') {
        if (product.quantity < quantity) {
          return res.status(400).json({ 
            error: `Không đủ hàng trong kho! Tồn kho hiện tại: ${product.quantity}` 
          });
        }
      }

      const quantityChange = type === 'import' ? Number(quantity) : -Number(quantity);

      // Tạo transaction và cập nhật quantity trong 1 transaction
      const result = await prisma.$transaction(async (tx) => {
        // Tạo transaction record
        const transaction = await tx.transaction.create({
          data: {
            productId: Number(productId),
            userId: req.user?.id || null,
            type,
            quantity: Number(quantity),
            note: note || '',
            date: new Date()
          },
          include: {
            product: {
              select: {
                productName: true,  // ✅ Sửa
                sku: true
              }
            }
          }
        });

        // ✅ Update product với đầy đủ stock fields
        const updatedProduct = await tx.product.update({
          where: { id: Number(productId) },
          data: { 
            quantity: { increment: quantityChange },
            newStock: type === 'import' ? { increment: Number(quantity) } : undefined,
            soldStock: type === 'export' ? { increment: Number(quantity) } : undefined,
            endingStock: { increment: quantityChange }
          }
        });

        // Tạo history log
        await tx.historyLog.create({
          data: {
            action: type,
            productId: Number(productId),
            userId: req.user?.id || null,
            productName: updatedProduct.productName,  // ✅ Sửa
            productSku: updatedProduct.sku,
            details: `${type === 'import' ? 'Nhập' : 'Xuất'} ${quantity} sản phẩm. ${note || ''}`
          }
        });

        return { transaction, updatedProduct };
      });

      res.status(201).json({
        message: `${type === 'import' ? 'Nhập' : 'Xuất'} kho thành công`,
        transaction: {
          id: result.transaction.id,
          productName: result.transaction.product.productName,  // ✅ Sửa
          type: result.transaction.type,
          quantity: result.transaction.quantity,
          date: result.transaction.date
        },
        updatedQuantity: result.updatedProduct.quantity
      });
    } catch (error) {
      console.error('Create transaction error:', error);
      res.status(500).json({ error: 'Lỗi khi tạo giao dịch' });
    }
  }

  // GET /api/transactions/product/:productId
  async getTransactionsByProduct(req, res) {
    try {
      const { productId } = req.params;

      const transactions = await prisma.transaction.findMany({
        where: { 
          productId: Number(productId) 
        },
        include: {
          product: {
            select: {
              productName: true,  // ✅ Sửa
              sku: true
            }
          },
          user: {
            select: {
              username: true
            }
          }
        },
        orderBy: { date: 'desc' }
      });

      res.json(transactions);
    } catch (error) {
      console.error('Get transactions by product error:', error);
      res.status(500).json({ error: 'Lỗi khi lấy giao dịch theo sản phẩm' });
    }
  }

  // GET /api/transactions/stats
  async getTransactionStats(req, res) {
    try {
      const { startDate, endDate } = req.query;

      const where = {};
      if (startDate || endDate) {
        where.date = {};
        if (startDate) where.date.gte = new Date(startDate);
        if (endDate) where.date.lte = new Date(endDate);
      }

      const [imports, exports, total] = await Promise.all([
        prisma.transaction.aggregate({
          where: { ...where, type: 'import' },
          _sum: { quantity: true },
          _count: true
        }),
        prisma.transaction.aggregate({
          where: { ...where, type: 'export' },
          _sum: { quantity: true },
          _count: true
        }),
        prisma.transaction.count({ where })
      ]);

      res.json({
        total,
        imports: {
          count: imports._count,
          totalQuantity: imports._sum.quantity || 0
        },
        exports: {
          count: exports._count,        // ✅ Sửa typo
          totalQuantity: exports._sum.quantity || 0  // ✅ Sửa typo
        }
      });
    } catch (error) {
      console.error('Get transaction stats error:', error);
      res.status(500).json({ error: 'Lỗi khi lấy thống kê giao dịch' });
    }
  }

  // DELETE /api/transactions/:id (Optional - xóa giao dịch)
  async deleteTransaction(req, res) {
    try {
      const { id } = req.params;

      const transaction = await prisma.transaction.findUnique({
        where: { id: Number(id) },
        include: { product: true }
      });

      if (!transaction) {
        return res.status(404).json({ error: 'Không tìm thấy giao dịch' });
      }

      // Hoàn nguyên quantity
      const quantityChange = transaction.type === 'import' 
        ? -transaction.quantity 
        : transaction.quantity;

      await prisma.$transaction(async (tx) => {
        // Xóa transaction
        await tx.transaction.delete({
          where: { id: Number(id) }
        });

        // Hoàn nguyên quantity
        await tx.product.update({
          where: { id: transaction.productId },
          data: {
            quantity: { increment: quantityChange },
            newStock: transaction.type === 'import' 
              ? { decrement: transaction.quantity } 
              : undefined,
            soldStock: transaction.type === 'export' 
              ? { decrement: transaction.quantity } 
              : undefined,
            endingStock: { increment: quantityChange }
          }
        });

        // Log
        await tx.historyLog.create({
          data: {
            action: 'delete_transaction',
            productId: transaction.productId,
            userId: req.user?.id || null,
            productName: transaction.product.productName,
            productSku: transaction.product.sku,
            details: `Xóa giao dịch ${transaction.type} ${transaction.quantity} sản phẩm`
          }
        });
      });

      res.json({ message: 'Xóa giao dịch thành công' });
    } catch (error) {
      console.error('Delete transaction error:', error);
      res.status(500).json({ error: 'Lỗi khi xóa giao dịch' });
    }
  }
}

export default new TransactionController();