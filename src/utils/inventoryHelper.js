import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Tự động cập nhật thông tin tồn kho cho một sản phẩm
 * Tính toán từ bảng Transaction và cập nhật vào Inventory
 * ✅ TỰ ĐỘNG XÓA inventory nếu không còn transactions và stock = 0
 */
export async function updateInventoryStock(productId) {
  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔍 [DEBUG] updateInventoryStock called for productId: ${productId}`);
    console.log(`${'='.repeat(80)}`);

    // 1. Kiểm tra product tồn tại
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      console.error(`❌ Product không tồn tại: ${productId}`);
      return null;
    }
    console.log(`✅ Product tìm thấy: [${product.sku}] ${product.productName}`);

    // 2. Lấy TẤT CẢ transactions (import, export, adjust)
    const allTransactions = await prisma.transaction.findMany({
      where: {
        productId: productId,
        type: { in: ['import', 'export', 'adjust'] }
      },
      select: { 
        id: true,
        type: true,
        quantity: true,
        reason: true,   // ✅ Cần reason để tính damaged
        date: true
      },
      orderBy: { date: 'asc' }
    });

    console.log(`\n📊 Tìm thấy ${allTransactions.length} transactions:`);
    
    // 3. Tính toán chi tiết
    let totalImport = 0;
    let totalExport = 0;
    let totalAdjust = 0;
    let totalDamaged = 0; // Chỉ để HIỂN THỊ cột HỎNG/LỖI

    allTransactions.forEach((tx, index) => {
      if (tx.type === 'import') {
        totalImport += tx.quantity;
        console.log(`   [${index + 1}] IMPORT: +${tx.quantity} (total: ${totalImport})`);
      } else if (tx.type === 'export') {
        totalExport += tx.quantity; // âm
        console.log(`   [${index + 1}] EXPORT: ${tx.quantity} (total: ${totalExport})`);
      } else if (tx.type === 'adjust') {
        // Nếu lý do là 'damaged' → cộng vào tổng Hỏng/Lỗi, KHÔNG gộp chung với totalAdjust
        if (tx.reason === 'damaged') {
          totalDamaged += Math.abs(tx.quantity);
          console.log(`   [${index + 1}] DAMAGED: ${tx.quantity} (totalDamaged: ${totalDamaged})`);
        } else {
          totalAdjust += tx.quantity; // âm (chỉ tính điều chỉnh khác)
          console.log(`   [${index + 1}] ADJUST: ${tx.quantity} (total: ${totalAdjust})`);
        }
      }
    });

    // 4. Lấy hoặc tạo inventory
    let inventory = await prisma.inventory.findFirst({
      where: { productId: productId }
    });

    if (!inventory) {
      console.log(`\n⚠️ Inventory không tồn tại! Đang tạo mới...`);
      
      inventory = await prisma.inventory.create({
        data: {
          productId: productId,
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
          note: `Auto-created for ${product.productName}`
        }
      });

      console.log(`✅ Inventory mới được tạo: ID ${inventory.id}`);
    } else {
      console.log(`✅ Inventory tồn tại: ID ${inventory.id}`);
    }

    // 5. Tính toán endingStock
    // ✅ Công thức: Đầu + Tổng nhập - Tổng xuất + Tổng adjust(âm) - Hỏng/lỗi
    const endingStock = inventory.initialStock + totalImport - totalExport + totalAdjust - totalDamaged;

    console.log(`\n📐 CÔNG THỨC TÍNH:`);
    console.log(`   Tồn đầu (initialStock): ${inventory.initialStock}`);
    console.log(`   + Tổng nhập (totalImport): +${totalImport}`);
    console.log(`   - Tổng xuất (totalExport): -${totalExport}`);
    console.log(`   + Điều chỉnh khác (totalAdjust, âm): ${totalAdjust}`);
    console.log(`   - Hỏng/Lỗi (totalDamaged): -${totalDamaged}`);
    console.log(`   = Tồn cuối (endingStock): ${endingStock}`);

    // ✅ 6. NẾU không còn transactions VÀ stock = 0 → XÓA inventory
    if (allTransactions.length === 0 && endingStock === 0 && inventory.initialStock === 0) {
      console.log(`\n🗑️ Không còn transactions và stock = 0 → Xóa inventory`);
      
      await prisma.inventory.delete({
        where: { id: inventory.id }
      });
      
      console.log(`✅ Đã xóa inventory ID ${inventory.id} cho product ${product.productName}`);
      console.log(`${'='.repeat(80)}\n`);
      
      return null; // Trả về null để biết inventory đã bị xóa
    }

    // 7. Nếu còn transactions hoặc stock > 0 → CẬP NHẬT inventory
    const updatedInventory = await prisma.inventory.update({
      where: { id: inventory.id },
      data: {
        stockIn: totalImport,
        stockOut: Math.abs(totalExport), // lưu dương để hiển thị
        damaged: totalDamaged,           // ✅ Tự tính từ transactions (hiển thị)
        endingStock: endingStock,
        retailPrice: product.retailPrice || inventory.retailPrice || 0,
        cost: product.cost || inventory.cost || 0,
        stockType1: product.stockType1 || inventory.stockType1 || '',
        stockType2: product.stockType2 || inventory.stockType2 || '',
        updatedAt: new Date()
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

    console.log(`\n✅ INVENTORY ĐÃ CẬP NHẬT THÀNH CÔNG:`);
    console.log(`   SKU: ${updatedInventory.product.sku}`);
    console.log(`   Name: ${updatedInventory.product.productName}`);
    console.log(`   Ending Stock: ${updatedInventory.endingStock}`);
    console.log(`   Stock In: ${updatedInventory.stockIn}`);
    console.log(`   Stock Out: ${updatedInventory.stockOut}`);
    console.log(`${'='.repeat(80)}\n`);

    return updatedInventory;

  } catch (error) {
    console.error(`\n❌ INVENTORY ERROR (Product ID: ${productId}):`);
    console.error(`   Message: ${error.message}`);
    console.error(`   Code: ${error.code}`);
    console.error(`${'='.repeat(80)}\n`);
    throw error;
  }
}

/**
 * Cập nhật tồn kho cho nhiều sản phẩm cùng lúc
 */
export async function updateMultipleInventoryStocks(productIds) {
  if (!productIds || productIds.length === 0) {
    console.log('⚠️ Không có sản phẩm nào để cập nhật');
    return [];
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔄 [BATCH] Cập nhật inventory cho ${productIds.length} sản phẩm`);
  console.log(`   Product IDs: ${productIds.join(', ')}`);
  console.log(`${'='.repeat(80)}\n`);

  const results = [];
  const uniqueProductIds = [...new Set(productIds)];
  
  for (const productId of uniqueProductIds) {
    try {
      const result = await updateInventoryStock(productId);
      results.push({ 
        productId, 
        success: true, 
        data: result,
        deleted: result === null // null nghĩa là đã bị xóa
      });
    } catch (error) {
      console.error(`❌ Lỗi khi cập nhật product ${productId}: ${error.message}`);
      results.push({ 
        productId, 
        success: false, 
        error: error.message 
      });
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  const failedCount = results.filter(r => !r.success).length;
  const deletedCount = results.filter(r => r.deleted).length;
  
  console.log(`${'='.repeat(80)}`);
  console.log(`📊 BATCH RESULT: ${successCount} ✅ | ${failedCount} ❌ | ${deletedCount} 🗑️ deleted`);
  console.log(`${'='.repeat(80)}\n`);
  
  return results;
}

/**
 * ✅ Xóa tất cả inventory có endingStock = 0 và không có transactions
 * Dùng để cleanup sau khi xóa transactions hàng loạt
 */
export async function cleanupEmptyInventories() {
  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log('🗑️ [CLEANUP] Đang xóa inventory rỗng...');
    console.log(`${'='.repeat(80)}\n`);
    
    // Lấy tất cả inventory có stock = 0
    const emptyInventories = await prisma.inventory.findMany({
      where: {
        endingStock: 0,
        initialStock: 0
      },
      select: {
        id: true,
        productId: true,
        product: {
          select: {
            productName: true,
            sku: true
          }
        }
      }
    });

    console.log(`📋 Tìm thấy ${emptyInventories.length} inventory có stock = 0`);

    let deletedCount = 0;
    
    // Kiểm tra từng inventory xem có transactions không
    for (const inv of emptyInventories) {
      const txCount = await prisma.transaction.count({
        where: {
          productId: inv.productId,
          type: { in: ['import', 'export', 'adjust'] }
        }
      });

      // Nếu không có transactions → Xóa
      if (txCount === 0) {
        await prisma.inventory.delete({
          where: { id: inv.id }
        });
        
        console.log(`   🗑️ Xóa: [${inv.product.sku}] ${inv.product.productName}`);
        deletedCount++;
      } else {
        console.log(`   ⏭️  Giữ lại: [${inv.product.sku}] ${inv.product.productName} (còn ${txCount} transactions)`);
      }
    }
    
    console.log(`\n✅ Đã xóa ${deletedCount}/${emptyInventories.length} inventory rỗng`);
    console.log(`${'='.repeat(80)}\n`);
    
    return { total: emptyInventories.length, deleted: deletedCount };
  } catch (error) {
    console.error('❌ Lỗi xóa inventory rỗng:', error);
    throw error;
  }
}

/**
 * Tính toán và trả về thông tin tồn kho mà không lưu vào database
 */
export async function calculateInventoryStock(productId) {
  try {
    console.log(`\n📐 Tính toán tồn kho cho product ${productId}`);

    const [allTransactions, inventory, product] = await Promise.all([
      prisma.transaction.findMany({
        where: { 
          productId, 
          type: { in: ['import', 'export', 'adjust'] }
        },
        select: { type: true, quantity: true, reason: true }
      }),
      prisma.inventory.findFirst({
        where: { productId }
      }),
      prisma.product.findUnique({
        where: { id: productId }
      })
    ]);

    if (!inventory || !product) {
      console.log(`⚠️ Inventory hoặc Product không tồn tại cho ID ${productId}`);
      return null;
    }

    let totalImport = 0;
    let totalExport = 0;
    let totalAdjust = 0;
    let totalDamaged = 0;

    allTransactions.forEach(tx => {
      if (tx.type === 'import') {
        totalImport += tx.quantity;
      } else if (tx.type === 'export') {
        totalExport += tx.quantity;
      } else if (tx.type === 'adjust') {
        if (tx.reason === 'damaged') {
          totalDamaged += Math.abs(tx.quantity);
        } else {
          totalAdjust += tx.quantity;
        }
      }
    });

    const endingStock = inventory.initialStock + totalImport - totalExport + totalAdjust - totalDamaged;

    return {
      productId,
      productName: product.productName,
      sku: product.sku,
      initialStock: inventory.initialStock,
      stockIn: totalImport,
      stockOut: Math.abs(totalExport),
      adjust: totalAdjust,
      damaged: inventory.damaged,
      endingStock: endingStock,
      displayStock: inventory.displayStock
    };
  } catch (error) {
    console.error(`❌ Lỗi tính toán inventory product ${productId}:`, error.message);
    throw error;
  }
}

/**
 * Đồng bộ lại toàn bộ inventory từ transactions
 */
export async function syncAllInventories() {
  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔄 BẮT ĐẦU ĐỒNG BỘ TẤT CẢ INVENTORY`);
    console.log(`${'='.repeat(80)}\n`);
    
    const inventories = await prisma.inventory.findMany({
      select: { productId: true },
      orderBy: { productId: 'asc' }
    });

    if (inventories.length === 0) {
      console.log('⚠️ Không có inventory nào để đồng bộ');
      return {
        total: 0,
        success: 0,
        failed: 0,
        deleted: 0,
        failedItems: []
      };
    }

    const productIds = inventories.map(inv => inv.productId);
    console.log(`📊 Tìm thấy ${productIds.length} sản phẩm cần đồng bộ\n`);
    
    const results = await updateMultipleInventoryStocks(productIds);
    
    const stats = {
      total: results.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      deleted: results.filter(r => r.deleted).length,
      failedItems: results.filter(r => !r.success).map(r => ({
        productId: r.productId,
        error: r.error
      }))
    };
    
    console.log(`${'='.repeat(80)}`);
    console.log(`✅ HOÀN THÀNH ĐỒNG BỘ:`);
    console.log(`   Total: ${stats.total}`);
    console.log(`   Success: ${stats.success}`);
    console.log(`   Failed: ${stats.failed}`);
    console.log(`   Deleted: ${stats.deleted}`);
    if (stats.failed > 0) {
      stats.failedItems.forEach(item => {
        console.log(`   - Product ${item.productId}: ${item.error}`);
      });
    }
    console.log(`${'='.repeat(80)}\n`);
    
    return stats;
  } catch (error) {
    console.error('❌ Lỗi đồng bộ inventory:', error.message);
    throw error;
  }
}

/**
 * Lấy thông tin inventory + product chi tiết
 */
export async function getInventoryDetail(productId) {
  try {
    const inventory = await prisma.inventory.findFirst({
      where: { productId },
      include: {
        product: {
          select: {
            id: true,
            productName: true,
            sku: true,
            group: true,
            unit: true,
            cost: true,
            retailPrice: true
          }
        }
      }
    });

    if (!inventory) {
      return null;
    }

    return {
      id: inventory.id,
      product: inventory.product,
      initialStock: inventory.initialStock,
      stockIn: inventory.stockIn,
      stockOut: inventory.stockOut,
      damaged: inventory.damaged,
      endingStock: inventory.endingStock,
      displayStock: inventory.displayStock,
      retailPrice: inventory.retailPrice,
      cost: inventory.cost,
      totalValue: inventory.endingStock * inventory.retailPrice,
      totalCost: inventory.endingStock * inventory.cost,
      createdAt: inventory.createdAt,
      updatedAt: inventory.updatedAt
    };
  } catch (error) {
    console.error(`❌ Lỗi lấy inventory detail:`, error.message);
    throw error;
  }
}

/**
 * Lấy danh sách tất cả inventory với pagination
 */
export async function getAllInventories(page = 1, limit = 20, search = '') {
  try {
    const skip = (page - 1) * limit;
    
    const where = search ? {
      OR: [
        { product: { sku: { contains: search, mode: 'insensitive' } } },
        { product: { productName: { contains: search, mode: 'insensitive' } } }
      ]
    } : {};

    const [inventories, total] = await Promise.all([
      prisma.inventory.findMany({
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
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' }
      }),
      prisma.inventory.count({ where })
    ]);

    return {
      data: inventories,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('❌ Lỗi lấy danh sách inventory:', error.message);
    throw error;
  }
}

export default {
  updateInventoryStock,
  updateMultipleInventoryStocks,
  cleanupEmptyInventories, // ✅ Thêm export
  calculateInventoryStock,
  syncAllInventories,
  getInventoryDetail,
  getAllInventories
};