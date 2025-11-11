import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';
import fs from 'fs';

const prisma = new PrismaClient();

class TransactionController {
  
  // 🔥 GET /api/transactions/type/:type
  async getByType(req, res) {
    try {
      const { type } = req.params;
      const { search, group, startDate, endDate } = req.query;

      if (!['import', 'export'].includes(type)) {
        return res.status(400).json({
          success: false,
          error: 'Type phải là "import" hoặc "export"'
        });
      }

      const where = { type };

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
      });

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

  async getAll(req, res) {
    try {
      const { 
        page = 1, 
        limit,
        type, 
        productId, 
        startDate, 
        endDate,
        search,
        group 
      } = req.query;

      const shouldPaginate = limit && limit !== 'undefined' && limit !== 'null';
      const parsedLimit = shouldPaginate ? Number(limit) : null;
      const skip = shouldPaginate ? (Number(page) - 1) * parsedLimit : 0;

      const where = {};

      if (type) where.type = type;
      if (productId) where.productId = Number(productId);

      if (startDate || endDate) {
        where.date = {};
        if (startDate) where.date.gte = new Date(startDate);
        if (endDate) where.date.lte = new Date(endDate);
      }

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

      if (shouldPaginate) {
        queryOptions.take = parsedLimit;
        queryOptions.skip = skip;
      }

      const [transactions, total] = await Promise.all([
        prisma.transaction.findMany(queryOptions),
        prisma.transaction.count({ where })
      ]);

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

      const response = {
        success: true,
        data: filtered,
        total: total
      };

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

  async findOrCreateProduct(productName, sku = null) {
    let product = null;

    if (sku) {
      product = await prisma.product.findFirst({
        where: { sku: sku }
      });
    }

    if (!product) {
      product = await prisma.product.findFirst({
        where: { productName: productName }
      });
    }

    if (!product) {
      product = await prisma.product.create({
        data: {
          productName: productName,
          sku: sku || `AUTO-${Date.now()}`,
          group: 'Chưa phân loại'
        }
      });
    }

    return product;
  }

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

  async createBatch(req, res) {
    try {
      const { transactions } = req.body;

      if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Dữ liệu transactions không hợp lệ'
        });
      }

      const results = { success: [], failed: [] };
      const CONCURRENT_BATCH = 10;
      
      for (let i = 0; i < transactions.length; i += CONCURRENT_BATCH) {
        const batch = transactions.slice(i, i + CONCURRENT_BATCH);
        
        const batchPromises = batch.map(async (txData) => {
          try {
            if (!txData.productName || !txData.quantity || !txData.type) {
              return {
                success: false,
                data: txData,
                error: 'Thiếu productName, quantity hoặc type'
              };
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

            return { success: true, result };
          } catch (error) {
            return {
              success: false,
              data: txData,
              error: error.message
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        
        batchResults.forEach(item => {
          if (item.success) {
            results.success.push(item.result);
          } else {
            results.failed.push({ data: item.data, error: item.error });
          }
        });
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

  async deleteMany(req, res) {
    try {
      const { ids } = req.body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Danh sách ID không hợp lệ'
        });
      }

      const MAX_DELETE = 100;
      if (ids.length > MAX_DELETE) {
        return res.status(400).json({
          success: false,
          error: `Chỉ có thể xóa tối đa ${MAX_DELETE} items mỗi lần`
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

        if (transactions.length <= 50) {
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

  // ✅ ULTRA-OPTIMIZED IMPORT - Tối ưu tối đa cho Vercel
  async importExcel(req, res) {
    const startTime = Date.now();
    
    try {
      console.log('📥 Import started');
      
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Không có file được upload'
        });
      }

      if (!fs.existsSync(req.file.path)) {
        return res.status(400).json({
          success: false,
          error: 'File không tồn tại'
        });
      }

      // ⚡ Read Excel
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(req.file.path);
      
      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          error: 'File không có dữ liệu'
        });
      }

      // ⚡ Parse header
      const headerRow = worksheet.getRow(1).values
        .slice(1)
        .map(v => (v || '').toString().trim().toUpperCase())
        .filter(v => v);

      if (headerRow.length === 0) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          error: 'File không có header'
        });
      }

      // ⚡ Detect type
      const headerString = headerRow.join(' ');
      const detectedType = (
        headerString.includes('LÝ DO XUẤT') || 
        headerString.includes('PHIẾU XUẤT')
      ) ? 'export' : 'import';

      // ⚡ Map columns
      const cols = {};
      headerRow.forEach((h, i) => {
        const col = i + 1;
        if (h.includes('NGÀY')) cols.date = col;
        else if (h.includes('MÃ PHIẾU')) cols.transactionCode = col;
        else if (h.includes('TÓM TẮT')) cols.summary = col;
        else if (h.includes('NGƯỜI LẬP')) cols.createdBy = col;
        else if (h === 'SKU') cols.sku = col;
        else if (h.includes('TÊN SẢN PHẨM')) cols.productName = col;
        else if (h.includes('SỐ LƯỢNG') || h === 'SL') cols.quantity = col;
        else if (h.includes('ĐƠN GIÁ')) cols.unitPrice = col;
        else if (h.includes('LÝ DO') || h.includes('NGUỒN')) cols.reason = col;
        else if (h.includes('GHI CHÚ')) cols.note = col;
      });

      // ⚡ Validate
      if (!cols.productName || !cols.quantity) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          error: 'Thiếu cột bắt buộc'
        });
      }

      // ⚡ Read rows (skip header)
      const rows = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) rows.push(row.values);
      });

      if (rows.length === 0) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          error: 'Không có dữ liệu'
        });
      }

      console.log(`📊 ${rows.length} rows detected`);

      // ⚡ Helpers
      const str = (v) => v ? String(v).trim() : '';
      const parseDate = (v) => {
        if (!v) return new Date();
        if (v instanceof Date && !isNaN(v)) return v;
        if (typeof v === 'string') {
          const d = new Date(v);
          return isNaN(d) ? new Date() : d;
        }
        if (typeof v === 'number') {
          const d = new Date((v - 25569) * 86400 * 1000);
          return isNaN(d) ? new Date() : d;
        }
        return new Date();
      };

      // ⚡ ULTRA FAST PROCESSING
      const MAX_TIME = 55000; // 55s buffer
      const BATCH_SIZE = 20; // Optimal for Vercel
      const results = { success: [], failed: [] };
      let processed = 0;
      let stopped = false;

      // Cache products để tránh query lại
      const productCache = new Map();

      for (let i = 0; i < rows.length && !stopped; i += BATCH_SIZE) {
        const elapsed = Date.now() - startTime;
        
        if (elapsed > MAX_TIME) {
          console.log(`⏰ Timeout at ${elapsed}ms, processed ${processed}/${rows.length}`);
          stopped = true;
          break;
        }

        const batch = rows.slice(i, i + BATCH_SIZE);
        
        const promises = batch.map(async (row, idx) => {
          try {
            const productName = str(row[cols.productName]);
            const quantity = Number(row[cols.quantity]) || 0;

            if (!productName || quantity <= 0) {
              return {
                ok: false,
                row: i + idx + 2,
                error: 'Thiếu tên sản phẩm hoặc số lượng'
              };
            }

            const sku = str(row[cols.sku]);
            const cacheKey = sku || productName;
            
            // Get from cache or find/create
            let product = productCache.get(cacheKey);
            if (!product) {
              product = await this.findOrCreateProduct(productName, sku);
              productCache.set(cacheKey, product);
            }

            // Create transaction (NO nested $transaction for speed)
            const tx = await prisma.transaction.create({
              data: {
                date: parseDate(row[cols.date]),
                transactionCode: str(row[cols.transactionCode]),
                summary: str(row[cols.summary]),
                createdBy: str(row[cols.createdBy]) || req.user?.username || 'System',
                productId: product.id,
                userId: req.user?.id || null,
                quantity,
                unitPrice: Number(row[cols.unitPrice]) || 0,
                reason: str(row[cols.reason]),
                note: str(row[cols.note]),
                type: detectedType
              }
            });

            // Fire-and-forget history log
            prisma.historyLog.create({
              data: {
                action: `${detectedType}_transaction`,
                productId: product.id,
                userId: req.user?.id || null,
                productName: product.productName,
                productSku: product.sku,
                details: `Import: ${detectedType === 'import' ? 'Nhập' : 'Xuất'} ${quantity}`
              }
            }).catch(() => {});

            return { ok: true, id: tx.id };
          } catch (error) {
            return {
              ok: false,
              row: i + idx + 2,
              error: error.message
            };
          }
        });

        const batchResults = await Promise.all(promises);
        
        batchResults.forEach(r => {
          if (r.ok) {
            results.success.push(r);
          } else {
            results.failed.push({ row: r.row, error: r.error });
          }
        });

        processed += batch.length;
      }

      // Cleanup
      fs.unlinkSync(req.file.path);

      const time = Date.now() - startTime;
      console.log(`✅ Done in ${time}ms`);

      res.json({
        success: true,
        message: stopped 
          ? `⚠️ Import từng phần: ${results.success.length}/${rows.length} (timeout)`
          : `✅ Import: ${results.success.length} thành công, ${results.failed.length} thất bại`,
        data: {
          successCount: results.success.length,
          failedCount: results.failed.length,
          totalRows: rows.length,
          processedRows: processed,
          wasPartial: stopped,
          detectedType,
          processingTime: time,
          failedItems: results.failed.slice(0, 20)
        }
      });

    } catch (error) {
      console.error('❌ Import error:', error);
      
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.status(500).json({
        success: false,
        error: 'Lỗi import: ' + error.message
      });
    }
  }
}

export default new TransactionController();