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
          { sku: { contains: q, mode: 'insensitive' } },
          { group: { contains: q, mode: 'insensitive' } }
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
        stockType1,
        stockType2,
        project,
        unit,
        cost = 0,
        retailPrice = 0,
        note
      } = req.body;

      console.log('📦 ===== TẠO SẢN PHẨM =====');
      console.log('📦 SKU nhận được:', `"${sku}"`);
      console.log('📦 Product Name:', productName);

      // Validate required fields
      if (!productName || !sku) {
        return res.status(400).json({ 
          error: 'Tên sản phẩm và SKU là bắt buộc' 
        });
      }

      // ✅ CHUẨN HÓA SKU NGAY TỪ ĐẦU
      const normalizedSku = sku.trim();
      console.log('📦 SKU sau trim:', `"${normalizedSku}"`);

      if (normalizedSku === '') {
        return res.status(400).json({ 
          error: 'SKU không được để trống' 
        });
      }

      // Validate price values
      if (cost < 0 || retailPrice < 0) {
        return res.status(400).json({ 
          error: 'Giá vốn và giá niêm yết phải >= 0' 
        });
      }

      // ✅ CHECK SKU TRÙNG VỚI SKU ĐÃ CHUẨN HÓA
      console.log('🔍 Kiểm tra SKU trùng...');
      const existingSku = await prisma.product.findUnique({
        where: { sku: normalizedSku }
      });

      if (existingSku) {
        console.log('❌ SKU đã tồn tại:', {
          id: existingSku.id,
          sku: existingSku.sku,
          productName: existingSku.productName
        });
        return res.status(400).json({ 
          error: 'SKU đã tồn tại trong hệ thống',
          existingProduct: {
            id: existingSku.id,
            sku: existingSku.sku,
            productName: existingSku.productName
          }
        });
      }

      console.log('✅ SKU hợp lệ, tiếp tục tạo...');

      // ✅ TẠO SẢN PHẨM VỚI SKU ĐÃ CHUẨN HÓA
      const product = await prisma.product.create({
        data: {
          productName: productName.trim(),
          sku: normalizedSku,
          group: group?.trim() || '',
          stockType1: stockType1?.trim() || '',
          stockType2: stockType2?.trim() || '',
          project: project?.trim() || '',
          unit: unit?.trim() || '',
          cost: Number(cost),
          retailPrice: Number(retailPrice),
          note: note?.trim() || ''
        }
      });

      console.log('✅ Tạo thành công! Product ID:', product.id);

      // Create history log
      await prisma.historyLog.create({
        data: {
          action: 'create',
          productId: product.id,
          userId: req.user?.id || null,
          productName: product.productName,
          productSku: product.sku,
          details: `Tạo sản phẩm mới: ${product.productName} (SKU: ${product.sku})`
        }
      });

      res.status(201).json(product);

    } catch (error) {
      console.error('❌ Create product error:', error);
      
      // ✅ BẮT LỖI UNIQUE CONSTRAINT TỪ DATABASE
      if (error.code === 'P2002') {
        console.error('❌ Prisma unique constraint violation');
        return res.status(400).json({ 
          error: 'SKU đã tồn tại trong hệ thống (database constraint)' 
        });
      }

      res.status(400).json({ 
        error: 'Lỗi khi tạo sản phẩm',
        details: error.message 
      });
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
        stockType1, 
        stockType2, 
        project, 
        unit, 
        cost, 
        retailPrice, 
        note 
      } = req.body;

      console.log('🔄 ===== CẬP NHẬT SẢN PHẨM =====');
      console.log('🔄 Product ID:', id);

      // 1. Tìm sản phẩm cũ
      const oldProduct = await prisma.product.findUnique({ 
        where: { id } 
      });

      if (!oldProduct) {
        return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
      }

      console.log('📋 Sản phẩm cũ:', {
        id: oldProduct.id,
        sku: oldProduct.sku,
        productName: oldProduct.productName
      });

      // 2. Chuẩn hóa SKU (nếu có gửi lên)
      let normalizedSku = undefined;
      if (sku !== undefined) {
        normalizedSku = sku.trim();
        console.log('📦 SKU mới sau trim:', `"${normalizedSku}"`);
        
        if (normalizedSku === '') {
          return res.status(400).json({ error: 'SKU không được để trống' });
        }
      }

      // 3. Kiểm tra SKU trùng (bỏ qua chính sản phẩm đang update)
      if (normalizedSku && normalizedSku !== oldProduct.sku) {
        console.log('🔍 Kiểm tra SKU trùng...');
        
        const existingSku = await prisma.product.findFirst({
          where: {
            sku: normalizedSku,
            id: { not: id }
          }
        });

        if (existingSku) {
          console.log('❌ SKU đã tồn tại (product khác):', existingSku.id);
          return res.status(400).json({ error: 'SKU đã tồn tại trong hệ thống' });
        }
        
        console.log('✅ SKU hợp lệ');
      }

      // 4. Build dữ liệu cập nhật
      const updateData = {};

      if (productName !== undefined) updateData.productName = productName.trim();
      if (normalizedSku !== undefined) updateData.sku = normalizedSku;
      if (group !== undefined) updateData.group = group?.trim() || '';
      if (stockType1 !== undefined) updateData.stockType1 = stockType1?.trim() || '';
      if (stockType2 !== undefined) updateData.stockType2 = stockType2?.trim() || '';
      if (project !== undefined) updateData.project = project?.trim() || '';
      if (unit !== undefined) updateData.unit = unit?.trim() || '';
      
      if (cost !== undefined) {
        const costNum = Number(cost);
        if (isNaN(costNum) || costNum < 0) {
          return res.status(400).json({ error: 'Giá vốn phải là số và >= 0' });
        }
        updateData.cost = costNum;
      }
      
      if (retailPrice !== undefined) {
        const retailNum = Number(retailPrice);
        if (isNaN(retailNum) || retailNum < 0) {
          return res.status(400).json({ error: 'Giá niêm yết phải là số và >= 0' });
        }
        updateData.retailPrice = retailNum;
      }
      
      if (note !== undefined) updateData.note = note?.trim() || '';

      // 5. Kiểm tra có thay đổi không
      const hasChanges = Object.keys(updateData).some(key => 
        oldProduct[key] !== updateData[key]
      );

      if (!hasChanges) {
        console.log('⚠️ Không có thay đổi');
        return res.json(oldProduct);
      }

      console.log('📝 Các field thay đổi:', Object.keys(updateData));

      // 6. Cập nhật sản phẩm
      const product = await prisma.product.update({
        where: { id },
        data: updateData
      });

      console.log('✅ Cập nhật thành công');

      // 7. Ghi log thay đổi
      const changeLabels = {
        productName: 'tên sản phẩm',
        sku: 'SKU',
        group: 'nhóm',
        stockType1: 'loại kho 1',
        stockType2: 'loại kho 2',
        project: 'dự án',
        unit: 'đơn vị',
        cost: 'giá vốn',
        retailPrice: 'giá niêm yết',
        note: 'ghi chú'
      };

      const changedFields = Object.keys(updateData)
        .filter(key => oldProduct[key] !== updateData[key])
        .map(key => changeLabels[key] || key);

      await prisma.historyLog.create({
        data: {
          action: 'update',
          productId: id,
          userId: req.user?.id || null,
          productName: product.productName,
          productSku: product.sku,
          details: `Cập nhật: ${changedFields.join(', ')}`
        }
      });

      res.json(product);

    } catch (error) {
      console.error('❌ Update product error:', error);

      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'SKU đã tồn tại trong hệ thống' });
      }

      res.status(500).json({ 
        error: 'Lỗi khi cập nhật sản phẩm',
        details: error.message 
      });
    }
  }

  // DELETE /api/products/:id
  async deleteProduct(req, res) {
    try {
      const id = Number(req.params.id);
      console.log('🗑️ ===== XÓA SẢN PHẨM =====');
      console.log('🗑️ Product ID:', id);

      // ✅ WRAP TOÀN BỘ TRONG TRANSACTION
      const result = await prisma.$transaction(async (tx) => {
        // 1. Tìm sản phẩm
        const product = await tx.product.findUnique({
          where: { id }
        });

        if (!product) {
          console.log('⚠️ Sản phẩm không tồn tại');
          return {
            success: true,
            message: 'Sản phẩm đã được xóa trước đó',
            deletedProduct: { id }
          };
        }

        console.log('📋 Sản phẩm tìm thấy:', {
          id: product.id,
          sku: product.sku,
          productName: product.productName
        });

        // 2. Ghi log
        await tx.historyLog.create({
          data: {
            action: 'delete',
            productId: id,
            userId: req.user?.id || null,
            productName: product.productName,
            productSku: product.sku,
            details: `Xóa sản phẩm: ${product.productName} (SKU: ${product.sku})`
          }
        });

        console.log('📝 Đã ghi log');

        // 3. Xóa sản phẩm
        await tx.product.delete({ where: { id } });

        console.log('✅ Đã xóa khỏi database');

        return {
          success: true,
          message: 'Xóa sản phẩm thành công',
          deletedProduct: {
            id: product.id,
            productName: product.productName,
            sku: product.sku
          }
        };
      }, {
        isolationLevel: 'Serializable',
        maxWait: 5000,
        timeout: 10000
      });

      console.log('✅ ===== XÓA HOÀN TẤT =====');

      res.json(result);

    } catch (error) {
      console.error('❌ Delete product error:', error);
      res.status(500).json({ 
        error: 'Lỗi server khi xóa sản phẩm',
        details: error.message 
      });
    }
  }

  // POST /api/transactions
  async createTransaction(req, res) {
    try {
      const { productId, type, quantity, note } = req.body;

      console.log('📦 ===== TẠO GIAO DỊCH =====');
      console.log('📦 Product ID:', productId);
      console.log('📦 Type:', type);
      console.log('📦 Quantity:', quantity);

      // Validate transaction type
      if (!['import', 'export'].includes(type)) {
        return res.status(400).json({ 
          error: 'Type phải là "import" hoặc "export"' 
        });
      }

      // Validate quantity
      if (!quantity || quantity <= 0) {
        return res.status(400).json({ 
          error: 'Số lượng phải lớn hơn 0' 
        });
      }

      // Find product
      const product = await prisma.product.findUnique({
        where: { id: productId }
      });

      if (!product) {
        return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
      }

      console.log('📋 Sản phẩm:', product.productName, '- SKU:', product.sku);

      // Check stock for export
      const currentQuantity = product.quantity || 0;
      if (type === 'export' && currentQuantity < quantity) {
        return res.status(400).json({ 
          error: `Không đủ hàng trong kho! Tồn kho hiện tại: ${currentQuantity}` 
        });
      }

      // Create transaction and update product in one transaction
      const result = await prisma.$transaction(async (tx) => {
        const transaction = await tx.transaction.create({
          data: {
            productId,
            userId: req.user?.id || null,
            type,
            quantity: Number(quantity),
            note: note?.trim() || ''
          }
        });

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

        await tx.historyLog.create({
          data: {
            action: type,
            productId,
            userId: req.user?.id || null,
            productName: product.productName,
            productSku: product.sku,
            details: `${type === 'import' ? 'Nhập' : 'Xuất'} ${quantity} sản phẩm${note ? `: ${note}` : ''}`
          }
        });

        return { transaction, updatedProduct };
      });

      console.log('✅ Giao dịch thành công');

      res.status(201).json(result);
    } catch (error) {
      console.error('❌ Create transaction error:', error);
      res.status(400).json({ 
        error: 'Lỗi khi tạo giao dịch',
        details: error.message 
      });
    }
  }

  // GET /api/transactions
  async getTransactions(req, res) {
    try {
      const { page = 1, limit = 20, type, productId } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const where = {};
      if (type) where.type = type;
      if (productId) where.productId = Number(productId);

      const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
          where,
          include: {
            product: {
              select: {
                productName: true,
                sku: true,
                group: true
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
        }),
        prisma.transaction.count({ where })
      ]);

      res.json({
        transactions,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        }
      });
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
        prisma.product.count(),

        prisma.product.findMany({
          where: {
            quantity: { lt: 10 }
          },
          select: {
            id: true,
            productName: true,
            sku: true,
            group: true,
            quantity: true,
            unit: true
          },
          orderBy: { quantity: 'asc' },
          take: 10
        }),

        prisma.transaction.findMany({
          include: {
            product: {
              select: {
                productName: true,
                sku: true,
                group: true
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

        prisma.product.aggregate({
          _sum: {
            quantity: true,
            soldStock: true,
            newStock: true
          },
          _count: { id: true }
        })
      ]);

      const products = await prisma.product.findMany({
        select: { quantity: true, cost: true }
      });

      const totalValue = products.reduce((sum, p) => {
        return sum + (Number(p.cost) * (p.quantity || 0));
      }, 0);

      const retailProducts = await prisma.product.findMany({
        select: { quantity: true, retailPrice: true }
      });

      const totalRetailValue = retailProducts.reduce((sum, p) => {
        return sum + (Number(p.retailPrice) * (p.quantity || 0));
      }, 0);

      res.json({
        totalProducts,
        totalQuantity: aggregations._sum.quantity || 0,
        totalNewStock: aggregations._sum.newStock || 0,
        totalSold: aggregations._sum.soldStock || 0,
        totalValue: Math.round(totalValue),
        totalRetailValue: Math.round(totalRetailValue),
        lowStockCount: lowStockProducts.length,
        lowStockProducts,
        recentTransactions
      });
    } catch (error) {
      console.error('Get dashboard stats error:', error);
      res.status(500).json({ error: 'Lỗi khi lấy thống kê dashboard' });
    }
  }

  // GET /api/products/groups
  async getGroups(req, res) {
    try {
      const groups = await prisma.product.findMany({
        where: { group: { not: '' } },
        distinct: ['group'],
        select: { group: true },
        orderBy: { group: 'asc' }
      });

      res.json(groups.map(g => g.group).filter(Boolean));
    } catch (error) {
      console.error('Get groups error:', error);
      res.status(500).json({ error: 'Lỗi khi lấy danh sách nhóm' });
    }
  }
}

export default new ProductController();