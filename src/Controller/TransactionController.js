import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';

const prisma = new PrismaClient();

class TransactionController {
  
  // GET /api/transactions
  async getAll(req, res) {
    try {
      const { 
        page = 1, 
        limit = 50, 
        type, 
        productId, 
        startDate, 
        endDate,
        search,
        group 
      } = req.query;

      const skip = (page - 1) * limit;
      const where = {};

      if (type) where.type = type;
      if (productId) where.productId = Number(productId);

      if (startDate || endDate) {
        where.date = {};
        if (startDate) where.date.gte = new Date(startDate);
        if (endDate) where.date.lte = new Date(endDate);
      }

      const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
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
          orderBy: { date: 'desc' },
          take: Number(limit),
          skip: Number(skip)
        }),
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

      res.json({
        success: true,
        data: filtered,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
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

      // ✅ Validation
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

      // ✅ Tìm hoặc tạo product
      const product = await this.findOrCreateProduct(productName, sku);

      // Tạo transaction
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
          // ✅ Validation
          if (!txData.productName || !txData.quantity || !txData.type) {
            results.failed.push({
              data: txData,
              error: 'Thiếu productName, quantity hoặc type'
            });
            continue;
          }

          // ✅ Tìm hoặc tạo product
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

      // Nếu thay đổi productName → tìm/tạo product mới
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
      res.status(501).json({
        success: false,
        message: 'Tính năng đang phát triển'
      });
    } catch (error) {
      console.error('Import Excel error:', error);
      res.status(500).json({
        success: false,
        error: 'Lỗi khi import Excel'
      });
    }
  }
}

export default new TransactionController();