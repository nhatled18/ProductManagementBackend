import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';

const prisma = new PrismaClient();

class TransactionController {
  
  // 🔥 THÊM MỚI: GET /api/transactions/type/:type - Lấy TẤT CẢ theo type
  async getByType(req, res) {
    try {
      const { type } = req.params;
      const { 
        search,
        group,
        startDate, 
        endDate 
      } = req.query;

      console.log('🔍 getByType called with:', { type, search, group, startDate, endDate });

      // Validate type
      if (!['import', 'export'].includes(type)) {
        return res.status(400).json({
          success: false,
          error: 'Type phải là "import" hoặc "export"'
        });
      }

      // Build where clause
      const where = { type };

      if (startDate || endDate) {
        where.date = {};
        if (startDate) where.date.gte = new Date(startDate);
        if (endDate) where.date.lte = new Date(endDate);
      }

      // ✅ LẤY TẤT CẢ - KHÔNG GIỚI HẠN
      const transactions = await prisma.transaction.findMany({
        where,
        include: {
          product: {
            select: { 
              id: true,
              productName: true,
              sku: true,
              group: true
            }
          },
          user: {
            select: {
              id: true,
              username: true
            }
          }
        },
        orderBy: [
          { date: 'desc' },
          { createdAt: 'desc' }
        ]
        // ⚠️ KHÔNG CÓ take/skip - LẤY TẤT CẢ!
      });

      console.log(`✅ Found ${transactions.length} transactions of type "${type}"`);

      // Format data
      const formatted = transactions.map(t => ({
        id: t.id,
        date: t.date.toISOString().split('T')[0],
        transactionCode: t.transactionCode || '',
        summary: t.summary || '',
        createdBy: t.user?.username || t.createdBy || 'System',
        sku: t.product.sku,
        productName: t.product.productName,
        group: t.product.group,
        quantity: t.quantity,
        unitPrice: t.unitPrice || 0,
        reason: t.reason || '',
        note: t.note || '',
        type: t.type,
        createdAt: t.createdAt
      }));

      // Client-side filtering (nếu cần)
      let filtered = formatted;
      
      if (search) {
        const searchLower = search.toLowerCase();
        filtered = filtered.filter(t => 
          t.sku?.toLowerCase().includes(searchLower) ||
          t.productName?.toLowerCase().includes(searchLower) ||
          t.transactionCode?.toLowerCase().includes(searchLower)
        );
      }

      if (group && group !== 'all') {
        filtered = filtered.filter(t => t.group === group);
      }

      console.log(`📊 After filtering: ${filtered.length} transactions`);

      res.json({
        success: true,
        data: filtered,
        total: filtered.length,
        type: type
      });
    } catch (error) {
      console.error('❌ Get by type error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Lỗi khi lấy giao dịch theo loại: ' + error.message
      });
    }
  }

  // 🔧 SỬA: GET /api/transactions - Cho phép không giới hạn
  async getAll(req, res) {
    try {
      const { 
        page = 1, 
        limit, // ✅ KHÔNG MẶC ĐỊNH NỮA
        type, 
        productId, 
        startDate, 
        endDate,
        search,
        group 
      } = req.query;

      // ✅ Chỉ apply pagination nếu có limit
      const shouldPaginate = limit && limit !== 'undefined' && limit !== 'null';
      const parsedLimit = shouldPaginate ? Number(limit) : null;
      const skip = shouldPaginate ? (Number(page) - 1) * parsedLimit : 0;

      console.log('🔍 getAll params:', { page, limit: parsedLimit, shouldPaginate, type });

      const where = {};

      if (type) where.type = type;
      if (productId) where.productId = Number(productId);

      if (startDate || endDate) {
        where.date = {};
        if (startDate) where.date.gte = new Date(startDate);
        if (endDate) where.date.lte = new Date(endDate);
      }

      // Query với hoặc không pagination
      const queryOptions = {
        where,
        include: {
          product: {
            select: { 
              id: true,
              productName: true,
              sku: true,
              group: true
            }
          },
          user: {
            select: {
              id: true,
              username: true
            }
          }
        },
        orderBy: [
          { date: 'desc' },
          { createdAt: 'desc' }
        ]
      };

      // Chỉ thêm pagination nếu cần
      if (shouldPaginate) {
        queryOptions.take = parsedLimit;
        queryOptions.skip = skip;
      }

      const [transactions, total] = await Promise.all([
        prisma.transaction.findMany(queryOptions),
        prisma.transaction.count({ where })
      ]);

      console.log(`✅ Found ${transactions.length} transactions (total: ${total})`);

      const formatted = transactions.map(t => ({
        id: t.id,
        date: t.date.toISOString().split('T')[0],
        transactionCode: t.transactionCode || '',
        summary: t.summary || '',
        createdBy: t.user?.username || t.createdBy || 'System',
        sku: t.product.sku,
        productName: t.product.productName,
        group: t.product.group,
        quantity: t.quantity,
        unitPrice: t.unitPrice || 0,
        reason: t.reason || '',
        note: t.note || '',
        type: t.type,
        createdAt: t.createdAt
      }));

      let filtered = formatted;
      if (search) {
        const searchLower = search.toLowerCase();
        filtered = filtered.filter(t => 
          t.sku?.toLowerCase().includes(searchLower) ||
          t.productName?.toLowerCase().includes(searchLower) ||
          t.transactionCode?.toLowerCase().includes(searchLower)
        );
      }

      if (group && group !== 'all') {
        filtered = filtered.filter(t => t.group === group);
      }

      // Response format
      const response = {
        success: true,
        data: filtered,
        total: total
      };

      // Chỉ thêm pagination info nếu có pagination
      if (shouldPaginate) {
        response.pagination = {
          page: Number(page),
          limit: parsedLimit,
          total,
          totalPages: Math.ceil(total / parsedLimit)
        };
      }

      res.json(response);
    } catch (error) {
      console.error('Get transactions error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Lỗi khi lấy danh sách giao dịch' 
      });
    }
  }

  // GET /api/transactions/:id
  async getById(req, res) {
    try {
      const { id } = req.params;

      const transaction = await prisma.transaction.findUnique({
        where: { id: Number(id) },
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
        }
      });

      if (!transaction) {
        return res.status(404).json({
          success: false,
          error: 'Không tìm thấy giao dịch'
        });
      }

      res.json({
        success: true,
        data: {
          id: transaction.id,
          date: transaction.date.toISOString().split('T')[0],
          transactionCode: transaction.transactionCode,
          summary: transaction.summary,
          createdBy: transaction.user?.username || transaction.createdBy,
          sku: transaction.product.sku,
          productName: transaction.product.productName,
          group: transaction.product.group,
          quantity: transaction.quantity,
          unitPrice: transaction.unitPrice,
          reason: transaction.reason,
          note: transaction.note,
          type: transaction.type
        }
      });
    } catch (error) {
      console.error('Get transaction error:', error);
      res.status(500).json({
        success: false,
        error: 'Lỗi khi lấy thông tin giao dịch'
      });
    }
  }

  // Helper: Tìm hoặc tạo product
  async findOrCreateProduct(productName, sku = null) {
    let product = null;

    // 1. Tìm theo SKU nếu có
    if (sku) {
      product = await prisma.product.findFirst({
        where: { sku: sku }
      });
    }

    // 2. Tìm theo tên sản phẩm nếu chưa tìm thấy
    if (!product) {
      product = await prisma.product.findFirst({
        where: { productName: productName }
      });
    }

    // 3. Tạo mới nếu không tìm thấy
    if (!product) {
      product = await prisma.product.create({
        data: {
          productName: productName,
          sku: sku || `AUTO-${Date.now()}`,
          group: 'Chưa phân loại'
        }
      });
      console.log('✅ Auto-created product:', product.id, product.productName);
    }

    return product;
  }

  // POST /api/transactions
  async create(req, res) {
    try {
      const {
        date,
        transactionCode,
        summary,
        createdBy,
        productName,
        sku,
        quantity,
        unitPrice,
        reason,
        note,
        type
      } = req.body;

      // Validation
      if (!productName || !quantity || !type) {
        return res.status(400).json({
          success: false,
          error: 'Vui lòng điền đầy đủ: productName, quantity, type'
        });
      }

      if (!['import', 'export'].includes(type)) {
        return res.status(400).json({
          success: false,
          error: 'Type phải là "import" hoặc "export"'
        });
      }

      const product = await this.findOrCreateProduct(productName, sku);

      const result = await prisma.$transaction(async (tx) => {
        const transaction = await tx.transaction.create({
          data: {
            date: date ? new Date(date) : new Date(),
            transactionCode: transactionCode || '',
            summary: summary || '',
            createdBy: createdBy || req.user?.username || 'System',
            productId: product.id,
            userId: req.user?.id || null,
            quantity: Number(quantity),
            unitPrice: Number(unitPrice) || 0,
            reason: reason || '',
            note: note || '',
            type
          },
          include: {
            product: {
              select: {
                productName: true,
                sku: true,
                group: true
              }
            }
          }
        });

        await tx.historyLog.create({
          data: {
            action: type === 'import' ? 'import_transaction' : 'export_transaction',
            productId: product.id,
            userId: req.user?.id || null,
            productName: product.productName,
            productSku: product.sku,
            details: `${type === 'import' ? 'Nhập' : 'Xuất'} ${quantity} ${product.productName}. ${note || ''}`
          }
        });

        return { transaction };
      });

      res.status(201).json({
        success: true,
        message: `${type === 'import' ? 'Nhập' : 'Xuất'} kho thành công`,
        data: {
          id: result.transaction.id,
          date: result.transaction.date.toISOString().split('T')[0],
          transactionCode: result.transaction.transactionCode,
          productName: result.transaction.product.productName,
          quantity: result.transaction.quantity,
          type: result.transaction.type
        }
      });
    } catch (error) {
      console.error('Create transaction error:', error);
      res.status(500).json({
        success: false,
        error: 'Lỗi khi tạo giao dịch: ' + error.message
      });
    }
  }

  // POST /api/transactions/batch
  async createBatch(req, res) {
    try {
      const { transactions } = req.body;

      if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Dữ liệu transactions không hợp lệ'
        });
      }

      const results = {
        success: [],
        failed: []
      };

      for (const txData of transactions) {
        try {
          if (!txData.productName || !txData.quantity || !txData.type) {
            results.failed.push({
              data: txData,
              error: 'Thiếu productName, quantity hoặc type'
            });
            continue;
          }

          const product = await this.findOrCreateProduct(txData.productName, txData.sku);

          const result = await prisma.$transaction(async (tx) => {
            const transaction = await tx.transaction.create({
              data: {
                date: txData.date ? new Date(txData.date) : new Date(),
                transactionCode: txData.transactionCode || '',
                summary: txData.summary || '',
                createdBy: txData.createdBy || req.user?.username || 'System',
                productId: product.id,
                userId: req.user?.id || null,
                quantity: Number(txData.quantity),
                unitPrice: Number(txData.unitPrice) || 0,
                reason: txData.reason || '',
                note: txData.note || '',
                type: txData.type
              }
            });

            return transaction;
          });

          results.success.push(result);
        } catch (error) {
          console.error('Error processing transaction:', error);
          results.failed.push({
            data: txData,
            error: error.message
          });
        }
      }

      res.json({
        success: true,
        message: `Hoàn tất: ${results.success.length} thành công, ${results.failed.length} thất bại`,
        data: {
          successCount: results.success.length,
          failedCount: results.failed.length,
          successItems: results.success,
          failedItems: results.failed
        }
      });
    } catch (error) {
      console.error('Batch create error:', error);
      res.status(500).json({
        success: false,
        error: 'Lỗi khi tạo batch transactions: ' + error.message
      });
    }
  }

  // PUT /api/transactions/:id
  async update(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const transaction = await prisma.transaction.findUnique({
        where: { id: Number(id) },
        include: { product: true }
      });

      if (!transaction) {
        return res.status(404).json({
          success: false,
          error: 'Không tìm thấy giao dịch'
        });
      }

      let newProductId = transaction.productId;
      if (updateData.productName && updateData.productName !== transaction.product.productName) {
        const newProduct = await this.findOrCreateProduct(updateData.productName, updateData.sku);
        newProductId = newProduct.id;
      }

      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.transaction.update({
          where: { id: Number(id) },
          data: {
            date: updateData.date ? new Date(updateData.date) : undefined,
            transactionCode: updateData.transactionCode,
            summary: updateData.summary,
            createdBy: updateData.createdBy,
            productId: newProductId,
            quantity: updateData.quantity !== undefined ? Number(updateData.quantity) : undefined,
            unitPrice: updateData.unitPrice !== undefined ? Number(updateData.unitPrice) : undefined,
            reason: updateData.reason,
            note: updateData.note,
            type: updateData.type
          },
          include: {
            product: {
              select: {
                productName: true,
                sku: true,
                group: true
              }
            }
          }
        });

        return updated;
      });

      res.json({
        success: true,
        message: 'Cập nhật giao dịch thành công',
        data: {
          id: result.id,
          date: result.date.toISOString().split('T')[0],
          transactionCode: result.transactionCode,
          summary: result.summary,
          createdBy: result.createdBy,
          sku: result.product.sku,
          productName: result.product.productName,
          group: result.product.group,
          quantity: result.quantity,
          unitPrice: result.unitPrice,
          reason: result.reason,
          note: result.note,
          type: result.type
        }
      });
    } catch (error) {
      console.error('Update transaction error:', error);
      res.status(500).json({
        success: false,
        error: 'Lỗi khi cập nhật giao dịch: ' + error.message
      });
    }
  }

  // DELETE /api/transactions/:id
  async delete(req, res) {
    try {
      const { id } = req.params;

      const transaction = await prisma.transaction.findUnique({
        where: { id: Number(id) },
        include: { product: true }
      });

      if (!transaction) {
        return res.status(404).json({
          success: false,
          error: 'Không tìm thấy giao dịch'
        });
      }

      await prisma.$transaction(async (tx) => {
        await tx.transaction.delete({
          where: { id: Number(id) }
        });

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

      res.json({
        success: true,
        message: 'Xóa giao dịch thành công'
      });
    } catch (error) {
      console.error('Delete transaction error:', error);
      res.status(500).json({
        success: false,
        error: 'Lỗi khi xóa giao dịch: ' + error.message
      });
    }
  }

  // POST /api/transactions/delete-many
  async deleteMany(req, res) {
    try {
      const { ids } = req.body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Danh sách ID không hợp lệ'
        });
      }

      const transactions = await prisma.transaction.findMany({
        where: { id: { in: ids.map(id => Number(id)) } },
        include: { product: true }
      });

      await prisma.$transaction(async (tx) => {
        await tx.transaction.deleteMany({
          where: { id: { in: ids.map(id => Number(id)) } }
        });

        for (const transaction of transactions) {
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
        }
      });

      res.json({
        success: true,
        message: `Xóa thành công ${transactions.length} giao dịch`,
        deletedCount: transactions.length
      });
    } catch (error) {
      console.error('Delete many error:', error);
      res.status(500).json({
        success: false,
        error: 'Lỗi khi xóa nhiều giao dịch: ' + error.message
      });
    }
  }

  // GET /api/transactions/product/:productId
  async getByProduct(req, res) {
    try {
      const { productId } = req.params;

      const transactions = await prisma.transaction.findMany({
        where: { productId: Number(productId) },
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
        orderBy: { date: 'desc' }
      });

      res.json({
        success: true,
        data: transactions.map(t => ({
          id: t.id,
          date: t.date.toISOString().split('T')[0],
          transactionCode: t.transactionCode,
          summary: t.summary,
          createdBy: t.user?.username || t.createdBy,
          quantity: t.quantity,
          unitPrice: t.unitPrice,
          reason: t.reason,
          note: t.note,
          type: t.type
        }))
      });
    } catch (error) {
      console.error('Get by product error:', error);
      res.status(500).json({
        success: false,
        error: 'Lỗi khi lấy giao dịch theo sản phẩm'
      });
    }
  }

  // GET /api/transactions/stats
  async getStats(req, res) {
    try {
      const { startDate, endDate, type } = req.query;

      const where = {};
      if (type) where.type = type;
      if (startDate || endDate) {
        where.date = {};
        if (startDate) where.date.gte = new Date(startDate);
        if (endDate) where.date.lte = new Date(endDate);
      }

      const [imports, exports, total, transactions] = await Promise.all([
        prisma.transaction.aggregate({
          where: { ...where, type: 'import' },
          _sum: { quantity: true, unitPrice: true },
          _count: true
        }),
        prisma.transaction.aggregate({
          where: { ...where, type: 'export' },
          _sum: { quantity: true, unitPrice: true },
          _count: true
        }),
        prisma.transaction.count({ where }),
        prisma.transaction.findMany({
          where,
          include: {
            product: {
              select: {
                productName: true,
                sku: true
              }
            }
          }
        })
      ]);

      const totalAmount = transactions.reduce((sum, t) => 
        sum + (t.quantity * t.unitPrice), 0
      );

      const uniqueProducts = new Set(transactions.map(t => t.productId)).size;

      const now = new Date();
      const thisMonth = transactions.filter(t => {
        const tDate = new Date(t.date);
        return tDate.getMonth() === now.getMonth() && 
               tDate.getFullYear() === now.getFullYear();
      }).length;

      res.json({
        success: true,
        data: {
          total,
          totalAmount,
          totalProducts: uniqueProducts,
          thisMonth,
          imports: {
            count: imports._count,
            totalQuantity: imports._sum.quantity || 0
          },
          exports: {
            count: exports._count,
            totalQuantity: exports._sum.quantity || 0
          }
        }
      });
    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Lỗi khi lấy thống kê'
      });
    }
  }

  // GET /api/transactions/export
  async exportTransactions(req, res) {
    try {
      const { type, startDate, endDate } = req.query;

      const where = {};
      if (type) where.type = type;
      if (startDate || endDate) {
        where.date = {};
        if (startDate) where.date.gte = new Date(startDate);
        if (endDate) where.date.lte = new Date(endDate);
      }

      const transactions = await prisma.transaction.findMany({
        where,
        include: {
          product: {
            select: {
              productName: true,
              sku: true,
              group: true
            }
          }
        },
        orderBy: { date: 'desc' }
      });

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Giao dịch');

      worksheet.columns = [
        { header: 'NGÀY', key: 'date', width: 12 },
        { header: 'MÃ PHIẾU', key: 'transactionCode', width: 15 },
        { header: 'TÓM TẮT', key: 'summary', width: 25 },
        { header: 'NGƯỜI LẬP', key: 'createdBy', width: 15 },
        { header: 'SKU', key: 'sku', width: 12 },
        { header: 'TÊN SẢN PHẨM', key: 'productName', width: 30 },
        { header: 'NHÓM', key: 'group', width: 15 },
        { header: 'LOẠI', key: 'type', width: 10 },
        { header: 'SỐ LƯỢNG', key: 'quantity', width: 12 },
        { header: 'ĐƠN GIÁ', key: 'unitPrice', width: 15 },
        { header: 'THÀNH TIỀN', key: 'totalPrice', width: 15 },
        { header: 'LÝ DO', key: 'reason', width: 20 },
        { header: 'GHI CHÚ', key: 'note', width: 25 }
      ];

      transactions.forEach(t => {
        worksheet.addRow({
          date: t.date.toISOString().split('T')[0],
          transactionCode: t.transactionCode,
          summary: t.summary,
          createdBy: t.createdBy,
          sku: t.product.sku,
          productName: t.product.productName,
          group: t.product.group,
          type: t.type === 'import' ? 'Nhập' : 'Xuất',
          quantity: t.quantity,
          unitPrice: t.unitPrice,
          totalPrice: t.quantity * t.unitPrice,
          reason: t.reason,
          note: t.note
        });
      });

      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF667eea' }
      };

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=giao-dich-${new Date().toISOString().split('T')[0]}.xlsx`
      );

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({
        success: false,
        error: 'Lỗi khi export'
      });
    }
  }

  // POST /api/transactions/import-excel
  async importExcel(req, res) {
    try {
      console.log('📥 Import Excel called');
      const expectedType = req.body.type || 'import';
      console.log('📌 Expected Type từ frontend:', expectedType);
      
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Không có file được upload'
        });
      }

      console.log('📁 File info:', {
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: req.file.path
      });

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(req.file.path);
      const worksheet = workbook.worksheets[0];
      
      if (!worksheet) {
        return res.status(400).json({
          success: false,
          error: 'File Excel không có dữ liệu'
        });
      }

      // Đọc header row
      const headerRowValues = worksheet.getRow(1).values;
      const headerRow = headerRowValues
        .slice(1)
        .map(v => (v || '').toString().trim().toUpperCase())
        .filter(v => v);

      console.log('📋 Header Row:', headerRow);

      if (headerRow.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'File Excel không có header hoặc header trống'
        });
      }

      // Xác định loại phiếu từ header
      let detectedType = 'import';
      const headerString = headerRow.join(' ');
      
      if (headerString.includes('LÝ DO XUẤT') || 
          headerString.includes('LY DO XUAT') ||
          headerString.includes('PHIẾU XUẤT') ||
          headerString.includes('PHIEU XUAT') ||
          headerString.includes('MÃ PHIẾU XUẤT')) {
        detectedType = 'export';
      } else if (headerString.includes('NGUỒN NHẬP') || 
                 headerString.includes('NGUON NHAP') ||
                 headerString.includes('PHIẾU NHẬP') ||
                 headerString.includes('PHIEU NHAP') ||
                 headerString.includes('MÃ PHIẾU NHẬP')) {
        detectedType = 'import';
      }

      console.log('📌 Detected type:', detectedType);

      // Xác định vị trí các cột động
      const colIndexes = {};
      headerRow.forEach((header, index) => {
        const col = index + 1;
        
        if (header.includes('NGÀY') || header.includes('NGAY')) {
          colIndexes.date = col;
        } else if (header.includes('MÃ PHIẾU') || header.includes('MA PHIEU')) {
          colIndexes.transactionCode = col;
        } else if (header.includes('TÓM TẮT') || header.includes('TOM TAT')) {
          colIndexes.summary = col;
        } else if (header.includes('NGƯỜI LẬP') || header.includes('NGUOI LAP')) {
          colIndexes.createdBy = col;
        } else if (header === 'SKU') {
          colIndexes.sku = col;
        } else if (header.includes('TÊN SẢN PHẨM') || header.includes('TEN SAN PHAM')) {
          colIndexes.productName = col;
        } else if (header === 'SL' || header.includes('SỐ LƯỢNG') || header.includes('SO LUONG')) {
          colIndexes.quantity = col;
        } else if (header.includes('ĐƠN GIÁ') || header.includes('DON GIA')) {
          colIndexes.unitPrice = col;
        } else if (header.includes('THÀNH TIỀN') || header.includes('THANH TIEN')) {
          colIndexes.totalPrice = col;
        } else if (header.includes('LÝ DO XUẤT') || 
                   header.includes('LY DO XUAT') || 
                   header.includes('LÝ DO') ||
                   header.includes('LY DO') ||
                   header.includes('NGUỒN NHẬP') || 
                   header.includes('NGUON NHAP') ||
                   header.includes('NGUỒN') ||
                   header.includes('NGUON')) {
          colIndexes.reason = col;
        } else if (header.includes('GHI CHÚ') || header.includes('GHI CHU')) {
          colIndexes.note = col;
        }
      });

      console.log('📍 Column indexes:', colIndexes);

      // Validation: Kiểm tra cột bắt buộc
      const requiredCols = ['productName', 'quantity'];
      const missingCols = requiredCols.filter(col => !colIndexes[col]);
      
      if (missingCols.length > 0) {
        return res.status(400).json({
          success: false,
          error: `File Excel thiếu cột bắt buộc: ${missingCols.join(', ')}`
        });
      }

      const results = { success: [], failed: [] };
      const rows = [];

      // Đọc rows từ row 2 trở đi
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          rows.push(row.values);
        }
      });

      console.log(`📊 Total rows data: ${rows.length}`);

      if (rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'File Excel không có dữ liệu (chỉ có header)',
          data: {
            successCount: 0,
            failedCount: 0,
            detectedType
          }
        });
      }

      // Helper functions
      const toString = (value) => {
        if (value === null || value === undefined) return '';
        return String(value).trim();
      };

      const parseDate = (value) => {
        if (!value) return new Date();
        
        if (value instanceof Date && !isNaN(value)) {
          return value;
        }
        
        if (typeof value === 'string') {
          const parsed = new Date(value);
          return isNaN(parsed) ? new Date() : parsed;
        }
        
        if (typeof value === 'number') {
          const parsed = new Date((value - 25569) * 86400 * 1000);
          return isNaN(parsed) ? new Date() : parsed;
        }
        
        return new Date();
      };

      // Process rows
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        
        try {
          const dateValue = row[colIndexes.date];
          const transactionCode = toString(row[colIndexes.transactionCode]);
          const summary = toString(row[colIndexes.summary]);
          const createdBy = toString(row[colIndexes.createdBy]) || req.user?.username || 'System';
          const sku = toString(row[colIndexes.sku]);
          const productName = toString(row[colIndexes.productName]);
          const quantity = Number(row[colIndexes.quantity]) || 0;
          const unitPrice = Number(row[colIndexes.unitPrice]) || 0;
          const reason = toString(row[colIndexes.reason] || '');
          const note = toString(row[colIndexes.note] || '');

          console.log(`Row ${i + 2}: ${productName} | Qty: ${quantity} | Type: ${detectedType}`);

          // Validation
          if (!productName) {
            results.failed.push({
              row: i + 2,
              data: { productName, quantity, sku },
              error: 'Thiếu tên sản phẩm'
            });
            continue;
          }

          if (!quantity || quantity <= 0) {
            results.failed.push({
              row: i + 2,
              data: { productName, quantity, sku },
              error: 'Số lượng không hợp lệ hoặc bằng 0'
            });
            continue;
          }

          const parsedDate = parseDate(dateValue);
          
          // Tìm hoặc tạo product
          const product = await this.findOrCreateProduct(productName, sku);

          // Tạo transaction
          const transaction = await prisma.$transaction(async (tx) => {
            const newTransaction = await tx.transaction.create({
              data: {
                date: parsedDate,
                transactionCode,
                summary,
                createdBy,
                productId: product.id,
                userId: req.user?.id || null,
                quantity,
                unitPrice,
                reason,
                note,
                type: detectedType
              }
            });

            // Log history
            await tx.historyLog.create({
              data: {
                action: `${detectedType}_transaction`,
                productId: product.id,
                userId: req.user?.id || null,
                productName: product.productName,
                productSku: product.sku,
                details: `Import Excel: ${detectedType === 'import' ? 'Nhập' : 'Xuất'} ${quantity} ${product.productName}. ${note || ''}`
              }
            });

            return newTransaction;
          });

          results.success.push({
            row: i + 2,
            transactionId: transaction.id,
            productName: product.productName,
            sku: product.sku,
            quantity,
            unitPrice,
            type: detectedType
          });

        } catch (error) {
          console.error(`❌ Error at row ${i + 2}:`, error.message);
          results.failed.push({
            row: i + 2,
            data: {
              productName: toString(row[colIndexes.productName]),
              sku: toString(row[colIndexes.sku]),
              quantity: row[colIndexes.quantity]
            },
            error: error.message
          });
        }
      }

      // Cleanup uploaded file
      const fs = await import('fs');
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
        console.log('🗑️ Cleaned up temp file');
      }

      console.log(`✅ Import completed: ${results.success.length} success, ${results.failed.length} failed`);

      res.json({
        success: true,
        message: `Import hoàn tất: ${results.success.length} thành công, ${results.failed.length} thất bại`,
        data: {
          successCount: results.success.length,
          failedCount: results.failed.length,
          successItems: results.success.slice(0, 10),
          failedItems: results.failed.slice(0, 10),
          detectedType,
          totalRows: rows.length,
          columnMapping: colIndexes
        }
      });

    } catch (error) {
      console.error('❌ Import Excel error:', error);
      console.error('Stack trace:', error.stack);
      
      // Cleanup file on error
      if (req.file) {
        const fs = await import('fs');
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      }

      res.status(500).json({
        success: false,
        error: 'Lỗi khi import Excel: ' + error.message,
        details: error.stack
      });
    }
  }
}

export default new TransactionController();