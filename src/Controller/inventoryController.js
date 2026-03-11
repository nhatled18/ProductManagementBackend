import { PrismaClient } from '@prisma/client';
import { updateInventoryStock, updateMultipleInventoryStocks } from '../utils/inventoryHelper.js';

const prisma = new PrismaClient();

class InventoryController {

  // ============================================
  // 🔧 INIT & SYNC ENDPOINTS
  // ============================================

  /**
   * 🔧 POST /api/inventory/init/create-missing
   * Tạo Inventory cho tất cả Product chưa có Inventory
   */
  async createMissingInventories(req, res) {
    try {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🔧 [INIT] Creating missing inventories...`);
      console.log(`${'='.repeat(80)}\n`);

      // 1. Lấy tất cả product
      const allProducts = await prisma.product.findMany({
        select: { 
          id: true,
          productName: true,
          sku: true,
          retailPrice: true,
          cost: true,
          stockType1: true,
          stockType2: true
        },
        orderBy: { id: 'asc' }
      });

      console.log(`📦 Tìm thấy ${allProducts.length} sản phẩm`);

      // 2. Lấy tất cả inventory hiện tại
      const existingInventories = await prisma.inventory.findMany({
        select: { productId: true }
      });

      const existingProductIds = new Set(existingInventories.map(inv => inv.productId));
      console.log(`✅ Đã có inventory cho ${existingInventories.length} sản phẩm`);

      // 3. Tìm product chưa có inventory
      const missingProducts = allProducts.filter(p => !existingProductIds.has(p.id));
      console.log(`❌ Thiếu inventory cho ${missingProducts.length} sản phẩm\n`);

      if (missingProducts.length === 0) {
        return res.json({
          success: true,
          message: 'Tất cả sản phẩm đã có inventory!',
          data: {
            total: allProducts.length,
            existing: existingInventories.length,
            created: 0,
            missing: 0
          }
        });
      }

      // 4. Tạo inventory cho những sản phẩm thiếu
      let createdCount = 0;
      const createdInventories = [];

      for (const product of missingProducts) {
        try {
          const inventory = await prisma.inventory.create({
            data: {
              productId: product.id,
              initialStock: 0,
              stockIn: 0,
              stockOut: 0,
              endingStock: 0,
              damaged: 0,
              displayStock: 0,
              retailPrice: product.retailPrice || 0,
              cost: product.cost || 0,
              stockType1: product.stockType1 || '',
              stockType2: product.stockType2 || '',
              note: `Auto-created on ${new Date().toISOString()}`
            }
          });

          createdInventories.push({
            productId: product.id,
            sku: product.sku,
            name: product.productName
          });

          createdCount++;
          console.log(`   ✅ [${createdCount}/${missingProducts.length}] [${product.sku}] ${product.productName}`);
        } catch (error) {
          console.error(`   ❌ Error for product ${product.id}:`, error.message);
        }
      }

      console.log(`\n${'='.repeat(80)}`);
      console.log(`📊 RESULT:`);
      console.log(`   Total Products: ${allProducts.length}`);
      console.log(`   Existing Inventories: ${existingInventories.length}`);
      console.log(`   Created: ${createdCount}`);
      console.log(`   Failed: ${missingProducts.length - createdCount}`);
      console.log(`${'='.repeat(80)}\n`);

      res.json({
        success: true,
        message: `Tạo thành công ${createdCount} inventory, thất bại ${missingProducts.length - createdCount}`,
        data: {
          total: allProducts.length,
          existing: existingInventories.length,
          created: createdCount,
          missing: missingProducts.length - createdCount,
          createdItems: createdInventories.slice(0, 20)
        }
      });
    } catch (error) {
      console.error('❌ Init error:', error);
      res.status(500).json({
        success: false,
        error: 'Lỗi tạo inventory: ' + error.message
      });
    }
  }

  /**
   * 📊 GET /api/inventory/stats/missing
   * Kiểm tra có bao nhiêu sản phẩm chưa có inventory
   */
  async checkMissingInventories(req, res) {
    try {
      const [totalProducts, totalInventories] = await Promise.all([
        prisma.product.count(),
        prisma.inventory.count()
      ]);

      const missing = totalProducts - totalInventories;

      res.json({
        success: true,
        data: {
          totalProducts,
          totalInventories,
          missing,
          percentage: totalProducts > 0 ? Math.round((totalInventories / totalProducts) * 100) : 0
        }
      });
    } catch (error) {
      console.error('❌ Stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Lỗi lấy thống kê: ' + error.message
      });
    }
  }

  /**
   * 🔄 POST /api/inventory/sync/all
   * Đồng bộ lại TẤT CẢ tồn kho từ transactions
   */
  async syncAllInventories(req, res) {
    try {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🔄 [SYNC ALL] Started at ${new Date().toISOString()}`);
      console.log(`${'='.repeat(80)}\n`);

      // Lấy tất cả inventory
      const inventories = await prisma.inventory.findMany({
        select: { productId: true },
        orderBy: { productId: 'asc' }
      });

      if (inventories.length === 0) {
        return res.json({
          success: true,
          message: 'Không có inventory nào để đồng bộ',
          data: {
            total: 0,
            success: 0,
            failed: 0
          }
        });
      }

      const productIds = inventories.map(inv => inv.productId);
      console.log(`📦 Đồng bộ ${productIds.length} sản phẩm...`);

      // Cập nhật từng sản phẩm
      const results = await updateMultipleInventoryStocks(productIds);

      const successCount = results.filter(r => r.success).length;
      const failedCount = results.filter(r => !r.success).length;

      console.log(`\n${'='.repeat(80)}`);
      console.log(`✅ SYNC COMPLETED:`);
      console.log(`   Total: ${results.length}`);
      console.log(`   Success: ${successCount}`);
      console.log(`   Failed: ${failedCount}`);
      console.log(`${'='.repeat(80)}\n`);

      res.json({
        success: true,
        message: `Đồng bộ hoàn tất: ${successCount} thành công, ${failedCount} thất bại`,
        data: {
          total: results.length,
          success: successCount,
          failed: failedCount,
          failedItems: results.filter(r => !r.success)
        }
      });
    } catch (error) {
      console.error('❌ Sync all error:', error);
      res.status(500).json({
        success: false,
        error: 'Lỗi đồng bộ tồn kho: ' + error.message
      });
    }
  }

  /**
   * 🔄 POST /api/inventory/:productId/sync
   * Đồng bộ tồn kho cho 1 sản phẩm
   */
  async syncInventoryByProduct(req, res) {
    try {
      const { productId } = req.params;

      console.log(`\n🔄 [SYNC] Syncing inventory for product ${productId}`);

      const inventory = await prisma.inventory.findFirst({
        where: { productId: Number(productId) }
      });

      if (!inventory) {
        return res.status(404).json({
          success: false,
          error: 'Inventory không tồn tại cho sản phẩm này'
        });
      }

      const updated = await updateInventoryStock(Number(productId));

      res.json({
        success: true,
        message: 'Đồng bộ tồn kho thành công',
        data: updated
      });
    } catch (error) {
      console.error('❌ Sync product error:', error);
      res.status(500).json({
        success: false,
        error: 'Lỗi đồng bộ tồn kho: ' + error.message
      });
    }
  }

  // ============================================
  // 📋 CRUD ENDPOINTS
  // ============================================

  // GET /api/inventory - Get all inventory records
  async getAllInventories(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const [inventories, total] = await Promise.all([
        prisma.inventory.findMany({
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
          skip,
          take: Number(limit),
          orderBy: { createdAt: 'desc' }
        }),
        prisma.inventory.count()
      ]);

      res.json({
        success: true,
        data: inventories,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        }
      });
    } catch (error) {
      console.error('Get all inventories error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Lỗi khi lấy danh sách tồn kho' 
      });
    }
  }

  // GET /api/inventory/search?q=...&group=...&stockType1=...
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

      res.json({
        success: true,
        data: inventories
      });
    } catch (error) {
      console.error('Search inventories error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Lỗi khi tìm kiếm tồn kho' 
      });
    }
  }

  // GET /api/inventory/:id - Get inventory by ID
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
        return res.status(404).json({ 
          success: false,
          error: 'Không tìm thấy bản ghi tồn kho' 
        });
      }

      res.json({
        success: true,
        data: inventory
      });
    } catch (error) {
      console.error('Get inventory error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Lỗi khi lấy thông tin tồn kho' 
      });
    }
  }

  // POST /api/inventory - Create new inventory record
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
        note
      } = req.body;

      // Validate required fields
      if (!productId) {
        return res.status(400).json({ 
          success: false,
          error: 'Product ID là bắt buộc' 
        });
      }

      // Check if product exists
      const product = await prisma.product.findUnique({
        where: { id: Number(productId) }
      });

      if (!product) {
        return res.status(400).json({ 
          success: false,
          error: 'Không tìm thấy sản phẩm' 
        });
      }

      // Check if inventory already exists
      const existingInventory = await prisma.inventory.findFirst({
        where: { productId: Number(productId) }
      });

      if (existingInventory) {
        return res.status(400).json({ 
          success: false,
          error: 'Sản phẩm này đã có inventory' 
        });
      }

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
          stockIn: 0,
          stockOut: 0,
          damaged: 0,
          endingStock: Number(initialStock),
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
          details: `Tạo bản ghi tồn kho: ${inventory.endingStock} sản phẩm`
        }
      });

      res.status(201).json({
        success: true,
        message: 'Tạo tồn kho thành công',
        data: inventory
      });
    } catch (error) {
      console.error('Create inventory error:', error);
      res.status(400).json({ 
        success: false,
        error: 'Lỗi khi tạo tồn kho',
        details: error.message 
      });
    }
  }

  // PUT /api/inventory/:id - Update inventory
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
        damaged,      // ✅ Thêm damaged
        stockIn,      // ✅ Thêm stockIn
        stockOut,     // ✅ Thêm stockOut
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
        return res.status(404).json({ 
          success: false,
          error: 'Không tìm thấy bản ghi tồn kho' 
        });
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
      if (damaged !== undefined) updateData.damaged = Number(damaged);   // ✅ Lưu damaged
      if (stockIn !== undefined) updateData.stockIn = Number(stockIn);   // ✅ Lưu stockIn
      if (stockOut !== undefined) updateData.stockOut = Number(stockOut); // ✅ Lưu stockOut
      if (note !== undefined) updateData.note = note?.trim() || '';

      // ✅ Recalculate ending stock dùng giá trị mới (ưu tiên từ request, fallback về DB)
      const newInitial  = initialStock !== undefined ? Number(initialStock) : oldInventory.initialStock;
      const newStockIn  = stockIn      !== undefined ? Number(stockIn)      : oldInventory.stockIn;
      const newStockOut = stockOut     !== undefined ? Number(stockOut)     : oldInventory.stockOut;
      const newDamaged  = damaged      !== undefined ? Number(damaged)      : oldInventory.damaged;
      updateData.endingStock = newInitial + newStockIn - newStockOut - newDamaged;

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

      res.json({
        success: true,
        message: 'Cập nhật tồn kho thành công',
        data: inventory
      });
    } catch (error) {
      console.error('Update inventory error:', error);
      res.status(400).json({ 
        success: false,
        error: 'Lỗi khi cập nhật tồn kho',
        details: error.message 
      });
    }
  }

  // DELETE /api/inventory/:id - Delete inventory
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
        return res.status(404).json({ 
          success: false,
          error: 'Không tìm thấy bản ghi tồn kho' 
        });
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
        success: true,
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
        success: false,
        error: 'Lỗi khi xóa tồn kho',
        details: error.message 
      });
    }
  }

  // ============================================
  // 📊 STATS & ANALYSIS ENDPOINTS
  // ============================================

  // GET /api/inventory/stats - Get inventory statistics
  async getInventoryStats(req, res) {
    try {
      const [
        totalRecords,
        lowStockItems,
        aggregations
      ] = await Promise.all([
        prisma.inventory.count(),

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
          cost: true,
          retailPrice: true
        }
      });

      const totalValue = inventories.reduce((sum, inv) => {
        return sum + (Number(inv.cost) * inv.endingStock);
      }, 0);

      const totalRetailValue = inventories.reduce((sum, inv) => {
        return sum + (Number(inv.retailPrice || 0) * inv.endingStock);
      }, 0);

      res.json({
        success: true,
        data: {
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
        }
      });
    } catch (error) {
      console.error('Get inventory stats error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Lỗi khi lấy thống kê tồn kho' 
      });
    }
  }

  // GET /api/inventory/stock-types - Get all unique stock types
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
        success: true,
        data: {
          stockType1: stockTypes1.map(st => st.stockType1).filter(Boolean),
          stockType2: stockTypes2.map(st => st.stockType2).filter(Boolean)
        }
      });
    } catch (error) {
      console.error('Get stock types error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Lỗi khi lấy danh sách phân loại kho' 
      });
    }
  }

  // ============================================
  // 🔄 BATCH OPERATIONS
  // ============================================

  // POST /api/inventory/batch - Batch create inventories
  async batchCreateInventories(req, res) {
    try {
      const { inventories } = req.body;

      if (!inventories || !Array.isArray(inventories) || inventories.length === 0) {
        return res.status(400).json({ 
          success: false,
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
              stockIn: 0,
              stockOut: 0,
              damaged: 0,
              endingStock: Number(invData.initialStock || 0),
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
        success: true,
        message: `Batch import hoàn tất: ${results.success.length} thành công, ${results.failed.length} thất bại`,
        data: {
          successCount: results.success.length,
          failedCount: results.failed.length,
          successItems: results.success,
          failedItems: results.failed
        }
      });
    } catch (error) {
      console.error('Batch create inventories error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Lỗi khi import dữ liệu',
        details: error.message 
      });
    }
  }
}

export default new InventoryController();