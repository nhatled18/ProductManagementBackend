import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

class ProductController {

  // GET /api/products
  async getAllProducts(req, res) {
    try {
      const products = await prisma.product.findMany({
        orderBy: { createdAt: 'desc' }
      });
      res.json(products);
    } catch (error) {
      console.error('Get all products error:', error);
      res.status(500).json({ error: 'Lỗi khi lấy danh sách sản phẩm' });
    }
  }

  // GET /api/products/search?q=...&group=...
  async searchProducts(req, res) {
    try {
      const { q = '', group } = req.query;
      
      const where = {
        OR: [
          { productName: { contains: q, mode: 'insensitive' } },
          { sku: { contains: q, mode: 'insensitive' } }
        ]
      };

      if (group && group !== 'all') {
        where.group = group;
      }

      const products = await prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' }
      });

      res.json(products);
    } catch (error) {
      console.error('Search products error:', error);
      res.status(500).json({ error: 'Lỗi khi tìm kiếm sản phẩm' });
    }
  }

  // GET /api/products/:id
  async getProductById(req, res) {
    try {
      const id = Number(req.params.id);
      
      const product = await prisma.product.findUnique({
        where: { id },
        include: {
          transactions: {
            take: 10,
            orderBy: { date: 'desc' }
          }
        }
      });

      if (!product) {
        return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
      }

      res.json(product);
    } catch (error) {
      console.error('Get product error:', error);
      res.status(500).json({ error: 'Lỗi khi lấy thông tin sản phẩm' });
    }
  }

  // POST /api/products
  async createProduct(req, res) {
    try {
      const { 
        productName, 
        sku, 
        group,
        displayStock = 0,
        warehouseStock = 0,
        cost = 0,
        retailPrice = 0
      } = req.body;

      // Validate
      if (!productName || !sku) {
        return res.status(400).json({ 
          error: 'Tên sản phẩm và SKU là bắt buộc' 
        });
      }

      // Check SKU duplicate
      const existingSku = await prisma.product.findUnique({
        where: { sku }
      });

      if (existingSku) {
        return res.status(400).json({ 
          error: 'SKU đã tồn tại trong hệ thống' 
        });
      }

      const quantity = displayStock + warehouseStock;

      const product = await prisma.product.create({
        data: {
          productName,
          sku,
          group,
          quantity,
          displayStock,
          warehouseStock,
          endingStock: quantity,
          cost,
          retailPrice
        }
      });

      // Tạo history log
      await prisma.historyLog.create({
        data: {
          action: 'create',
          productId: product.id,
          userId: req.user?.id || null,
          productName: product.productName,
          productSku: product.sku,
          details: `Tạo sản phẩm mới với số lượng ${quantity}`
        }
      });

      res.status(201).json(product);
    } catch (error) {
      console.error('Create product error:', error);
      res.status(400).json({ error: 'Lỗi khi tạo sản phẩm' });
    }
  }

  // PUT /api/products/:id
  async updateProduct(req, res) {
    try {
      const id = Number(req.params.id);
      const { 
        productName, 
        sku, 
        group,
        displayStock,
        warehouseStock,
        cost,
        retailPrice
      } = req.body;

      const oldProduct = await prisma.product.findUnique({
        where: { id }
      });

      if (!oldProduct) {
        return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
      }

      // Check SKU duplicate (nếu thay đổi SKU)
      if (sku && sku !== oldProduct.sku) {
        const existingSku = await prisma.product.findUnique({
          where: { sku }
        });
        if (existingSku) {
          return res.status(400).json({ 
            error: 'SKU đã tồn tại trong hệ thống' 
          });
        }
      }

      const updateData = {};
      if (productName !== undefined) updateData.productName = productName;
      if (sku !== undefined) updateData.sku = sku;
      if (group !== undefined) updateData.group = group;
      if (cost !== undefined) updateData.cost = cost;
      if (retailPrice !== undefined) updateData.retailPrice = retailPrice;

      // Cập nhật stock nếu có
      if (displayStock !== undefined || warehouseStock !== undefined) {
        const newDisplay = displayStock ?? oldProduct.displayStock;
        const newWarehouse = warehouseStock ?? oldProduct.warehouseStock;
        const newQuantity = newDisplay + newWarehouse;

        updateData.displayStock = newDisplay;
        updateData.warehouseStock = newWarehouse;
        updateData.quantity = newQuantity;
        updateData.endingStock = newQuantity;
      }

      const product = await prisma.product.update({
        where: { id },
        data: updateData
      });

      // History log
      await prisma.historyLog.create({
        data: {
          action: 'update',
          productId: id,
          userId: req.user?.id || null,
          productName: product.productName,
          productSku: product.sku,
          details: `Cập nhật thông tin sản phẩm`
        }
      });

      res.json(product);
    } catch (error) {
      console.error('Update product error:', error);
      res.status(400).json({ error: 'Lỗi khi cập nhật sản phẩm' });
    }
  }

  // DELETE /api/products/:id
  async deleteProduct(req, res) {
    try {
      const id = Number(req.params.id);

      const product = await prisma.product.findUnique({
        where: { id }
      });

      if (!product) {
        return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
      }

      // History log trước khi xóa
      await prisma.historyLog.create({
        data: {
          action: 'delete',
          productId: null, // Product sẽ bị xóa
          userId: req.user?.id || null,
          productName: product.productName,
          productSku: product.sku,
          details: 'Xóa sản phẩm khỏi hệ thống'
        }
      });

      await prisma.product.delete({
        where: { id }
      });

      res.json({ message: 'Xóa sản phẩm thành công' });
    } catch (error) {
      console.error('Delete product error:', error);
      res.status(400).json({ error: 'Lỗi khi xóa sản phẩm' });
    }
  }

  // POST /api/transactions
  async createTransaction(req, res) {
    try {
      const { productId, type, quantity, note } = req.body;

      if (!['import', 'export'].includes(type)) {
        return res.status(400).json({ 
          error: 'Type phải là "import" hoặc "export"' 
        });
      }

      if (!quantity || quantity <= 0) {
        return res.status(400).json({ 
          error: 'Số lượng phải lớn hơn 0' 
        });
      }

      const product = await prisma.product.findUnique({
        where: { id: productId }
      });

      if (!product) {
        return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
      }

      // Kiểm tra tồn kho khi xuất
      if (type === 'export' && product.quantity < quantity) {
        return res.status(400).json({ 
          error: `Không đủ hàng trong kho! Tồn kho hiện tại: ${product.quantity}` 
        });
      }

      // Tạo transaction và cập nhật product trong 1 transaction
      const result = await prisma.$transaction(async (tx) => {
        // Tạo transaction
        const transaction = await tx.transaction.create({
          data: {
            productId,
            userId: req.user?.id || null,
            type,
            quantity,
            note
          }
        });

        // Cập nhật product
        const qtyChange = type === 'import' ? quantity : -quantity;
        const updatedProduct = await tx.product.update({
          where: { id: productId },
          data: {
            quantity: { increment: qtyChange },
            newStock: type === 'import' ? { increment: quantity } : undefined,
            soldStock: type === 'export' ? { increment: quantity } : undefined,
            endingStock: { increment: qtyChange }
          }
        });

        // History log
        await tx.historyLog.create({
          data: {
            action: type,
            productId,
            userId: req.user?.id || null,
            productName: product.productName,
            productSku: product.sku,
            details: `${type === 'import' ? 'Nhập' : 'Xuất'} ${quantity} sản phẩm. ${note || ''}`
          }
        });

        return { transaction, updatedProduct };
      });

      res.status(201).json(result);
    } catch (error) {
      console.error('Create transaction error:', error);
      res.status(400).json({ error: 'Lỗi khi tạo giao dịch' });
    }
  }

  // GET /api/transactions
  async getTransactions(req, res) {
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
              productName: true,
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

      res.json(transactions);
    } catch (error) {
      console.error('Get transactions error:', error);
      res.status(500).json({ error: 'Lỗi khi lấy danh sách giao dịch' });
    }
  }

  // GET /api/dashboard/stats
  async getDashboardStats(req, res) {
    try {
      const [
        totalProducts,
        lowStockProducts,
        recentTransactions,
        aggregations
      ] = await Promise.all([
        // Total products
        prisma.product.count(),

        // Low stock (quantity < 10)
        prisma.product.findMany({
          where: {
            quantity: { lt: 10 }
          },
          select: {
            id: true,
            productName: true,
            sku: true,
            quantity: true,
            displayStock: true,
            warehouseStock: true
          },
          orderBy: { quantity: 'asc' },
          take: 10
        }),

        // Recent transactions
        prisma.transaction.findMany({
          include: {
            product: {
              select: {
                productName: true,
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
          take: 10
        }),

        // Aggregations
        prisma.product.aggregate({
          _sum: {
            quantity: true,
            soldStock: true
          },
          _count: {
            id: true
          }
        })
      ]);

      // Calculate total value (example)
      const products = await prisma.product.findMany({
        select: {
          quantity: true,
          cost: true
        }
      });

      const totalValue = products.reduce((sum, p) => {
        return sum + (Number(p.cost) * p.quantity);
      }, 0);

      res.json({
        totalProducts,
        totalQuantity: aggregations._sum.quantity || 0,
        totalSold: aggregations._sum.soldStock || 0,
        totalValue: totalValue.toFixed(2),
        lowStockCount: lowStockProducts.length,
        lowStockProducts,
        recentTransactions
      });
    } catch (error) {
      console.error('Get dashboard stats error:', error);
      res.status(500).json({ error: 'Lỗi khi lấy thống kê dashboard' });
    }
  }
}

export default new ProductController();