// server/controllers/InventoryController.js
import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs'; // npm install exceljs

const prisma = new PrismaClient();

class InventoryController {
  
  // GET /api/inventory
  async getAllInventory(req, res) {
    try {
      const { page = 1, limit = 20, group, search } = req.query;
      const skip = (page - 1) * limit;

      const where = {};
      if (group && group !== 'all') where.group = group;
      if (search) {
        where.OR = [
          { sku: { contains: search, mode: 'insensitive' } },
          { productName: { contains: search, mode: 'insensitive' } }
        ];
      }

      const [items, total] = await Promise.all([
        prisma.product.findMany({
          where,
          select: {
            id: true,
            group: true,
            sku: true,
            productName: true,
            quantity: true,
            displayStock: true,
            warehouseStock: true,
            newStock: true,
            soldStock: true,
            damagedStock: true,
            endingStock: true,
            cost: true,
            retailPrice: true
          },
          orderBy: { productName: 'asc' },
          take: Number(limit),
          skip: Number(skip)
        }),
        prisma.product.count({ where })
      ]);

      res.json({
        success: true,
        data: items,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Get inventory error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Lỗi khi lấy danh sách tồn kho' 
      });
    }
  }

  // GET /api/inventory/:id
  async getProductById(req, res) {
    try {
      const { id } = req.params;
      
      const product = await prisma.product.findUnique({
        where: { id: Number(id) }
      });

      if (!product) {
        return res.status(404).json({ 
          success: false, 
          error: 'Không tìm thấy sản phẩm' 
        });
      }

      res.json({
        success: true,
        data: product
      });
    } catch (error) {
      console.error('Get product by ID error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Lỗi khi lấy thông tin sản phẩm' 
      });
    }
  }

  // POST /api/inventory
  async createProduct(req, res) {
    try {
      const {
        group,
        sku,
        productName,
        quantity = 0,
        displayStock = 0,
        warehouseStock = 0,
        cost = 0,
        retailPrice = 0
      } = req.body;

      if (!group || !sku || !productName) {
        return res.status(400).json({ 
          success: false, 
          error: 'Vui lòng nhập Nhóm, SKU và Tên sản phẩm' 
        });
      }

      const existing = await prisma.product.findUnique({ where: { sku } });
      if (existing) {
        return res.status(400).json({ 
          success: false, 
          error: `SKU "${sku}" đã tồn tại` 
        });
      }

      const result = await prisma.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: {
            group,
            sku,
            productName,
            quantity: Number(quantity),
            displayStock: Number(displayStock),
            warehouseStock: Number(warehouseStock),
            newStock: 0,
            soldStock: 0,
            damagedStock: 0,
            endingStock: Number(quantity),
            cost: Number(cost),
            retailPrice: Number(retailPrice)
          }
        });

        await tx.historyLog.create({
          data: {
            action: 'create_product',
            productId: product.id,
            userId: req.user?.id || null,
            productName: product.productName,
            productSku: product.sku,
            details: `Tạo sản phẩm mới: ${quantity} cái`
          }
        });

        return product;
      });

      res.status(201).json({
        success: true,
        message: 'Tạo sản phẩm thành công',
        data: result
      });
    } catch (error) {
      console.error('Create product error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Lỗi khi tạo sản phẩm' 
      });
    }
  }

  // PUT /api/inventory/:id
  async updateProduct(req, res) {
    try {
      const { id } = req.params;
      const data = req.body;

      const product = await prisma.product.findUnique({ 
        where: { id: Number(id) } 
      });
      
      if (!product) {
        return res.status(404).json({ 
          success: false, 
          error: 'Không tìm thấy sản phẩm' 
        });
      }

      if (data.sku && data.sku !== product.sku) {
        const existing = await prisma.product.findUnique({ 
          where: { sku: data.sku } 
        });
        if (existing) {
          return res.status(400).json({ 
            success: false, 
            error: `SKU "${data.sku}" đã tồn tại` 
          });
        }
      }

      const updated = await prisma.$transaction(async (tx) => {
        const updatedProduct = await tx.product.update({
          where: { id: Number(id) },
          data: {
            ...data,
            cost: data.cost !== undefined ? Number(data.cost) : undefined,
            retailPrice: data.retailPrice !== undefined ? Number(data.retailPrice) : undefined,
          }
        });

        await tx.historyLog.create({
          data: {
            action: 'update_product',
            productId: updatedProduct.id,
            userId: req.user?.id || null,
            productName: updatedProduct.productName,
            productSku: updatedProduct.sku,
            details: 'Cập nhật thông tin sản phẩm'
          }
        });

        return updatedProduct;
      });

      res.json({ 
        success: true, 
        message: 'Cập nhật thành công', 
        data: updated 
      });
    } catch (error) {
      console.error('Update error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Lỗi khi cập nhật' 
      });
    }
  }

  // DELETE /api/inventory/:id
  async deleteProduct(req, res) {
    try {
      const { id } = req.params;
      const product = await prisma.product.findUnique({
        where: { id: Number(id) },
        include: { transactions: true }
      });

      if (!product) {
        return res.status(404).json({ 
          success: false, 
          error: 'Không tìm thấy' 
        });
      }

      if (product.transactions.length > 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Không thể xóa sản phẩm đã có giao dịch' 
        });
      }

      await prisma.$transaction(async (tx) => {
        await tx.product.delete({ where: { id: Number(id) } });
        await tx.historyLog.create({
          data: {
            action: 'delete_product',
            productId: Number(id),
            userId: req.user?.id || null,
            productName: product.productName,
            productSku: product.sku,
            details: 'Xóa sản phẩm'
          }
        });
      });

      res.json({ 
        success: true, 
        message: 'Xóa thành công' 
      });
    } catch (error) {
      console.error('Delete error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Lỗi khi xóa' 
      });
    }
  }

  // POST /api/inventory/delete-many
  async deleteMany(req, res) {
    try {
      const { ids } = req.body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Danh sách ID không hợp lệ'
        });
      }

      // Kiểm tra xem có sản phẩm nào có giao dịch không
      const productsWithTransactions = await prisma.product.findMany({
        where: {
          id: { in: ids.map(id => Number(id)) }
        },
        include: {
          transactions: true
        }
      });

      const cannotDelete = productsWithTransactions.filter(
        p => p.transactions.length > 0
      );

      if (cannotDelete.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Không thể xóa ${cannotDelete.length} sản phẩm đã có giao dịch`,
          cannotDeleteIds: cannotDelete.map(p => p.id)
        });
      }

      const result = await prisma.$transaction(async (tx) => {
        // Xóa các sản phẩm
        const deleteResult = await tx.product.deleteMany({
          where: { id: { in: ids.map(id => Number(id)) } }
        });

        // Log lịch sử cho mỗi sản phẩm bị xóa
        for (const product of productsWithTransactions) {
          await tx.historyLog.create({
            data: {
              action: 'delete_product',
              productId: product.id,
              userId: req.user?.id || null,
              productName: product.productName,
              productSku: product.sku,
              details: 'Xóa sản phẩm (batch delete)'
            }
          });
        }

        return deleteResult;
      });

      res.json({
        success: true,
        message: `Xóa thành công ${result.count} sản phẩm`,
        deletedCount: result.count
      });
    } catch (error) {
      console.error('Delete many error:', error);
      res.status(500).json({
        success: false,
        error: 'Lỗi khi xóa nhiều sản phẩm'
      });
    }
  }

  // POST /api/inventory/import
  async importInventory(req, res) {
    try {
      const { inventories } = req.body;

      if (!inventories || !Array.isArray(inventories) || inventories.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Dữ liệu import không hợp lệ'
        });
      }

      const results = {
        success: [],
        failed: []
      };

      for (const item of inventories) {
        try {
          // Kiểm tra SKU đã tồn tại chưa
          const existing = await prisma.product.findUnique({
            where: { sku: item.sku }
          });

          if (existing) {
            // Cập nhật sản phẩm hiện có
            const updated = await prisma.product.update({
              where: { sku: item.sku },
              data: {
                productName: item.productName || existing.productName,
                group: item.group || existing.group,
                quantity: Number(item.quantity || existing.quantity),
                displayStock: Number(item.displayStock || existing.displayStock),
                warehouseStock: Number(item.warehouseStock || existing.warehouseStock),
                cost: Number(item.cost || existing.cost),
                retailPrice: Number(item.retailPrice || existing.retailPrice),
                endingStock: Number(item.quantity || existing.quantity)
              }
            });
            results.success.push(updated);
          } else {
            // Tạo sản phẩm mới
            const created = await prisma.product.create({
              data: {
                group: item.group,
                sku: item.sku,
                productName: item.productName,
                quantity: Number(item.quantity || 0),
                displayStock: Number(item.displayStock || 0),
                warehouseStock: Number(item.warehouseStock || 0),
                newStock: 0,
                soldStock: 0,
                damagedStock: 0,
                endingStock: Number(item.quantity || 0),
                cost: Number(item.cost || 0),
                retailPrice: Number(item.retailPrice || 0)
              }
            });
            results.success.push(created);
          }
        } catch (error) {
          results.failed.push({
            item,
            error: error.message
          });
        }
      }

      res.json({
        success: true,
        message: `Import hoàn tất: ${results.success.length} thành công, ${results.failed.length} thất bại`,
        data: {
          successCount: results.success.length,
          failedCount: results.failed.length,
          successItems: results.success,
          failedItems: results.failed
        }
      });
    } catch (error) {
      console.error('Import error:', error);
      res.status(500).json({
        success: false,
        error: 'Lỗi khi import dữ liệu'
      });
    }
  }

  // GET /api/inventory/export
  async exportInventory(req, res) {
    try {
      const { group, search } = req.query;

      const where = {};
      if (group && group !== 'all') where.group = group;
      if (search) {
        where.OR = [
          { sku: { contains: search, mode: 'insensitive' } },
          { productName: { contains: search, mode: 'insensitive' } }
        ];
      }

      const products = await prisma.product.findMany({
        where,
        orderBy: { productName: 'asc' }
      });

      // Tạo Excel file với ExcelJS
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Tồn kho');

      // Định nghĩa columns
      worksheet.columns = [
        { header: 'STT', key: 'stt', width: 10 },
        { header: 'NHÓM', key: 'group', width: 20 },
        { header: 'SKU', key: 'sku', width: 15 },
        { header: 'TÊN SẢN PHẨM', key: 'productName', width: 30 },
        { header: 'SỐ LƯỢNG', key: 'quantity', width: 15 },
        { header: 'TRƯNG BÀY', key: 'displayStock', width: 15 },
        { header: 'KHO', key: 'warehouseStock', width: 15 },
        { header: 'GIÁ VỐN', key: 'cost', width: 15 },
        { header: 'GIÁ BÁN', key: 'retailPrice', width: 15 },
        { header: 'TỒN KHO CUỐI', key: 'endingStock', width: 15 },
      ];

      // Thêm dữ liệu
      products.forEach((product, index) => {
        worksheet.addRow({
          stt: index + 1,
          group: product.group,
          sku: product.sku,
          productName: product.productName,
          quantity: product.quantity,
          displayStock: product.displayStock,
          warehouseStock: product.warehouseStock,
          cost: product.cost,
          retailPrice: product.retailPrice,
          endingStock: product.endingStock
        });
      });

      // Style header
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F46E5' }
      };

      // Set response headers
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=ton-kho-${new Date().toISOString().split('T')[0]}.xlsx`
      );

      // Write to response
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({
        success: false,
        error: 'Lỗi khi export dữ liệu'
      });
    }
  }

  // GET /api/inventory/stats
  async getStats(req, res) {
    try {
      const stats = await prisma.product.aggregate({
        _sum: {
          quantity: true,
          displayStock: true,
          warehouseStock: true,
          newStock: true,
          soldStock: true,
          damagedStock: true,
          endingStock: true
        },
        _count: { id: true }
      });

      // Tính giá trị tồn kho
      const products = await prisma.product.findMany({
        select: {
          quantity: true,
          cost: true,
          endingStock: true
        }
      });

      const totalValue = products.reduce(
        (sum, p) => sum + (p.endingStock || 0) * (p.cost || 0), 
        0
      );

      // Đếm sản phẩm tồn kho thấp
      const lowStockCount = await prisma.product.count({
        where: { endingStock: { lt: 50 } }
      });

      res.json({
        success: true,
        data: {
          totalProducts: stats._count.id,
          totalQuantity: stats._sum.quantity || 0,
          totalEndingStock: stats._sum.endingStock || 0,
          totalValue: Number(totalValue.toFixed(2)),
          lowStockCount,
          displayStock: stats._sum.displayStock || 0,
          warehouseStock: stats._sum.warehouseStock || 0
        }
      });
    } catch (error) {
      console.error('Stats error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Lỗi thống kê' 
      });
    }
  }
}

export default new InventoryController();