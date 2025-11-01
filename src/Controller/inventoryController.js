import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

class InventoryController {

  // GET /api/inventories - Get all inventory records
  async getAllInventories(req, res) {
    try {
      const inventories = await prisma.inventory.findMany({
        include: {
          product: {
            select: {
              id: true,
              productName: true,
              sku: true,
              group: true,
              unit: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json(inventories);
    } catch (error) {
      console.error('Get all inventories error:', error);
      res.status(500).json({ error: 'Lỗi khi lấy danh sách tồn kho' });
    }
  }

  // GET /api/inventories/search?q=...&group=...&stockType1=...
  async searchInventories(req, res) {
    try {
      const { q = '', group, stockType1 } = req.query;
      
      const where = {};

      // Filter by stockType1
      if (stockType1) {
        where.stockType1 = stockType1;
      }

      // Filter by product group or search term
      if (group || q) {
        where.product = {};
        
        if (group && group !== 'all') {
          where.product.group = group;
        }
        
        if (q) {
          where.product.OR = [
            { productName: { contains: q, mode: 'insensitive' } },
            { sku: { contains: q, mode: 'insensitive' } },
            { group: { contains: q, mode: 'insensitive' } }
          ];
        }
      }

      const inventories = await prisma.inventory.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              productName: true,
              sku: true,
              group: true,
              unit: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json(inventories);
    } catch (error) {
      console.error('Search inventories error:', error);
      res.status(500).json({ error: 'Lỗi khi tìm kiếm tồn kho' });
    }
  }

  // GET /api/inventories/:id - Get inventory by ID
  async getInventoryById(req, res) {
    try {
      const id = Number(req.params.id);
      
      const inventory = await prisma.inventory.findUnique({
        where: { id },
        include: {
          product: {
            select: {
              id: true,
              productName: true,
              sku: true,
              group: true,
              stockType1: true,
              stockType2: true,
              unit: true
            }
          }
        }
      });

      if (!inventory) {
        return res.status(404).json({ error: 'Không tìm thấy bản ghi tồn kho' });
      }

      res.json(inventory);
    } catch (error) {
      console.error('Get inventory error:', error);
      res.status(500).json({ error: 'Lỗi khi lấy thông tin tồn kho' });
    }
  }

  // POST /api/inventories - Create new inventory record
  async createInventory(req, res) {
    try {
      const {
        productId,
        stockType1,
        stockType2,
        retailPrice = 0,
        cost = 0,
        initialStock = 0,
        displayStock = 0,
        stockIn = 0,
        stockOut = 0,
        damaged = 0,
        note
      } = req.body;

      // Validate required fields
      if (!productId) {
        return res.status(400).json({ 
          error: 'Product ID là bắt buộc' 
        });
      }

      // Check if product exists
      const product = await prisma.product.findUnique({
        where: { id: Number(productId) }
      });

      if (!product) {
        return res.status(400).json({ 
          error: 'Không tìm thấy sản phẩm' 
        });
      }

      // Calculate ending stock
      const endingStock = initialStock + stockIn - stockOut - damaged;

      // Create inventory record
      const inventory = await prisma.inventory.create({
        data: {
          productId: Number(productId),
          stockType1: stockType1?.trim() || '',
          stockType2: stockType2?.trim() || '',
          retailPrice: Number(retailPrice),
          cost: Number(cost),
          initialStock: Number(initialStock),
          displayStock: Number(displayStock),
          stockIn: Number(stockIn),
          stockOut: Number(stockOut),
          damaged: Number(damaged),
          endingStock: endingStock,
          note: note?.trim() || ''
        },
        include: {
          product: {
            select: {
              id: true,
              productName: true,
              sku: true,
              group: true
            }
          }
        }
      });

      // Create history log
      await prisma.historyLog.create({
        data: {
          action: 'create_inventory',
          productId: product.id,
          userId: req.user?.id || null,
          productName: product.productName,
          productSku: product.sku,
          details: `Tạo bản ghi tồn kho: ${endingStock} sản phẩm`
        }
      });

      res.status(201).json(inventory);
    } catch (error) {
      console.error('Create inventory error:', error);
      res.status(400).json({ 
        error: 'Lỗi khi tạo tồn kho',
        details: error.message 
      });
    }
  }

  // PUT /api/inventories/:id - Update inventory
  async updateInventory(req, res) {
    try {
      const id = Number(req.params.id);
      const {
        productId,
        stockType1,
        stockType2,
        retailPrice,
        cost,
        initialStock,
        displayStock,
        stockIn,
        stockOut,
        damaged,
        note
      } = req.body;

      // Find existing inventory
      const oldInventory = await prisma.inventory.findUnique({
        where: { id },
        include: {
          product: true
        }
      });

      if (!oldInventory) {
        return res.status(404).json({ error: 'Không tìm thấy bản ghi tồn kho' });
      }

      // Build update data
      const updateData = {};
      
      if (productId !== undefined) updateData.productId = Number(productId);
      if (stockType1 !== undefined) updateData.stockType1 = stockType1?.trim() || '';
      if (stockType2 !== undefined) updateData.stockType2 = stockType2?.trim() || '';
      if (retailPrice !== undefined) updateData.retailPrice = Number(retailPrice);
      if (cost !== undefined) updateData.cost = Number(cost);
      if (initialStock !== undefined) updateData.initialStock = Number(initialStock);
      if (displayStock !== undefined) updateData.displayStock = Number(displayStock);
      if (stockIn !== undefined) updateData.stockIn = Number(stockIn);
      if (stockOut !== undefined) updateData.stockOut = Number(stockOut);
      if (damaged !== undefined) updateData.damaged = Number(damaged);
      if (note !== undefined) updateData.note = note?.trim() || '';

      // Recalculate ending stock if any stock field changed
      if (initialStock !== undefined || stockIn !== undefined || 
          stockOut !== undefined || damaged !== undefined) {
        const newInitial = initialStock !== undefined ? Number(initialStock) : oldInventory.initialStock;
        const newStockIn = stockIn !== undefined ? Number(stockIn) : oldInventory.stockIn;
        const newStockOut = stockOut !== undefined ? Number(stockOut) : oldInventory.stockOut;
        const newDamaged = damaged !== undefined ? Number(damaged) : oldInventory.damaged;
        
        updateData.endingStock = newInitial + newStockIn - newStockOut - newDamaged;
      }

      // Update inventory
      const inventory = await prisma.inventory.update({
        where: { id },
        data: updateData,
        include: {
          product: {
            select: {
              id: true,
              productName: true,
              sku: true,
              group: true
            }
          }
        }
      });

      // Create history log
      await prisma.historyLog.create({
        data: {
          action: 'update_inventory',
          productId: oldInventory.productId,
          userId: req.user?.id || null,
          productName: oldInventory.product.productName,
          productSku: oldInventory.product.sku,
          details: `Cập nhật tồn kho: ${inventory.endingStock} sản phẩm`
        }
      });

      res.json(inventory);
    } catch (error) {
      console.error('Update inventory error:', error);
      res.status(400).json({ 
        error: 'Lỗi khi cập nhật tồn kho',
        details: error.message 
      });
    }
  }

  // DELETE /api/inventories/:id - Delete inventory
  async deleteInventory(req, res) {
    try {
      const id = Number(req.params.id);

      const inventory = await prisma.inventory.findUnique({
        where: { id },
        include: {
          product: true
        }
      });

      if (!inventory) {
        return res.status(404).json({ error: 'Không tìm thấy bản ghi tồn kho' });
      }

      // Create history log before deleting
      await prisma.historyLog.create({
        data: {
          action: 'delete_inventory',
          productId: inventory.productId,
          userId: req.user?.id || null,
          productName: inventory.product.productName,
          productSku: inventory.product.sku,
          details: `Xóa bản ghi tồn kho: ${inventory.endingStock} sản phẩm`
        }
      });

      // Delete inventory
      await prisma.inventory.delete({
        where: { id }
      });

      res.json({ 
        message: 'Xóa tồn kho thành công',
        deletedInventory: {
          id: inventory.id,
          productName: inventory.product.productName,
          sku: inventory.product.sku
        }
      });
    } catch (error) {
      console.error('Delete inventory error:', error);
      res.status(400).json({ 
        error: 'Lỗi khi xóa tồn kho',
        details: error.message 
      });
    }
  }

  // GET /api/inventories/stats - Get inventory statistics
  async getInventoryStats(req, res) {
    try {
      const [
        totalRecords,
        lowStockItems,
        aggregations
      ] = await Promise.all([
        // Total inventory records
        prisma.inventory.count(),

        // Low stock items (endingStock < 50)
        prisma.inventory.findMany({
          where: {
            endingStock: { lt: 50 }
          },
          include: {
            product: {
              select: {
                productName: true,
                sku: true,
                group: true
              }
            }
          },
          orderBy: { endingStock: 'asc' },
          take: 10
        }),

        // Aggregations
        prisma.inventory.aggregate({
          _sum: {
            initialStock: true,
            stockIn: true,
            stockOut: true,
            damaged: true,
            endingStock: true
          },
          _count: {
            id: true
          }
        })
      ]);

      // Calculate total inventory value
      const inventories = await prisma.inventory.findMany({
        select: {
          endingStock: true,
          cost: true
        }
      });

      const totalValue = inventories.reduce((sum, inv) => {
        return sum + (Number(inv.cost) * inv.endingStock);
      }, 0);

      // Calculate total retail value
      const totalRetailValue = inventories.reduce((sum, inv) => {
        return sum + (Number(inv.retailPrice || 0) * inv.endingStock);
      }, 0);

      res.json({
        totalRecords,
        totalInitialStock: aggregations._sum.initialStock || 0,
        totalStockIn: aggregations._sum.stockIn || 0,
        totalStockOut: aggregations._sum.stockOut || 0,
        totalDamaged: aggregations._sum.damaged || 0,
        totalEndingStock: aggregations._sum.endingStock || 0,
        totalValue: Math.round(totalValue),
        totalRetailValue: Math.round(totalRetailValue),
        lowStockCount: lowStockItems.length,
        lowStockItems
      });
    } catch (error) {
      console.error('Get inventory stats error:', error);
      res.status(500).json({ error: 'Lỗi khi lấy thống kê tồn kho' });
    }
  }

  // GET /api/inventories/stock-types - Get all unique stock types
  async getStockTypes(req, res) {
    try {
      const [stockTypes1, stockTypes2] = await Promise.all([
        prisma.inventory.findMany({
          where: {
            stockType1: {
              not: ''
            }
          },
          distinct: ['stockType1'],
          select: {
            stockType1: true
          },
          orderBy: {
            stockType1: 'asc'
          }
        }),
        prisma.inventory.findMany({
          where: {
            stockType2: {
              not: ''
            }
          },
          distinct: ['stockType2'],
          select: {
            stockType2: true
          },
          orderBy: {
            stockType2: 'asc'
          }
        })
      ]);

      res.json({
        stockType1: stockTypes1.map(st => st.stockType1).filter(Boolean),
        stockType2: stockTypes2.map(st => st.stockType2).filter(Boolean)
      });
    } catch (error) {
      console.error('Get stock types error:', error);
      res.status(500).json({ error: 'Lỗi khi lấy danh sách phân loại kho' });
    }
  }

  // POST /api/inventories/batch - Batch create inventories (for import)
  async batchCreateInventories(req, res) {
    try {
      const { inventories } = req.body;

      if (!inventories || !Array.isArray(inventories)) {
        return res.status(400).json({ 
          error: 'Dữ liệu không hợp lệ' 
        });
      }

      const results = {
        success: [],
        failed: []
      };

      for (const invData of inventories) {
        try {
          // Check if product exists
          const product = await prisma.product.findUnique({
            where: { id: Number(invData.productId) }
          });

          if (!product) {
            results.failed.push({
              data: invData,
              error: 'Không tìm thấy sản phẩm'
            });
            continue;
          }

          // Calculate ending stock
          const endingStock = (invData.initialStock || 0) + 
                             (invData.stockIn || 0) - 
                             (invData.stockOut || 0) - 
                             (invData.damaged || 0);

          // Create inventory
          const inventory = await prisma.inventory.create({
            data: {
              productId: Number(invData.productId),
              stockType1: invData.stockType1?.trim() || '',
              stockType2: invData.stockType2?.trim() || '',
              retailPrice: Number(invData.retailPrice || 0),
              cost: Number(invData.cost || 0),
              initialStock: Number(invData.initialStock || 0),
              displayStock: Number(invData.displayStock || 0),
              stockIn: Number(invData.stockIn || 0),
              stockOut: Number(invData.stockOut || 0),
              damaged: Number(invData.damaged || 0),
              endingStock: endingStock,
              note: invData.note?.trim() || ''
            }
          });

          results.success.push(inventory);
        } catch (error) {
          results.failed.push({
            data: invData,
            error: error.message
          });
        }
      }

      res.json({
        message: `Batch import hoàn tất: ${results.success.length} thành công, ${results.failed.length} thất bại`,
        successCount: results.success.length,
        failedCount: results.failed.length,
        successItems: results.success,
        failedItems: results.failed
      });
    } catch (error) {
      console.error('Batch create inventories error:', error);
      res.status(500).json({ 
        error: 'Lỗi khi import dữ liệu',
        details: error.message 
      });
    }
  }
}

export default new InventoryController();