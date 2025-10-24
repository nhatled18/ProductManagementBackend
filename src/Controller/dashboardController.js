import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

class DashboardController {
  
  // GET /api/dashboard/stats
  async getStats(req, res) {
    try {
      // Thống kê sản phẩm
      const productStats = await prisma.product.aggregate({
        _count: { id: true },
        _sum: { 
          quantity: true,
          displayStock: true,
          warehouseStock: true,
          soldStock: true
        }
      });

      // Tính tổng giá trị hàng tồn kho (dùng cost)
      const products = await prisma.product.findMany({
        select: {
          quantity: true,
          cost: true  // ✅ Sửa từ price -> cost
        }
      });

      const totalValue = products.reduce((sum, p) => {
        return sum + (p.quantity * Number(p.cost));
      }, 0);

      // ✅ Sản phẩm tồn kho thấp (quantity < 10)
      const LOW_STOCK_THRESHOLD = 10;
      const lowStockProducts = await prisma.product.findMany({
        where: {
          quantity: {
            lt: LOW_STOCK_THRESHOLD
          }
        },
        select: {
          id: true,
          productName: true,  // ✅ Sửa
          sku: true,
          quantity: true,
          displayStock: true,
          warehouseStock: true,
          group: true  // ✅ Thay category
        },
        orderBy: { quantity: 'asc' },
        take: 20
      });

      // Transactions gần đây
      const recentTransactions = await prisma.transaction.findMany({
        take: 10,
        orderBy: { date: 'desc' },
        include: {
          product: {
            select: { 
              productName: true,  // ✅ Sửa
              sku: true
            }
          },
          user: {
            select: { username: true }
          }
        }
      });

      // Thống kê transactions
      const [importStats, exportStats] = await Promise.all([
        prisma.transaction.aggregate({
          where: { type: 'import' },
          _sum: { quantity: true },
          _count: true
        }),
        prisma.transaction.aggregate({
          where: { type: 'export' },
          _sum: { quantity: true },
          _count: true
        })
      ]);

      res.json({
        totalProducts: productStats._count.id,
        totalQuantity: productStats._sum.quantity || 0,
        totalDisplayStock: productStats._sum.displayStock || 0,
        totalWarehouseStock: productStats._sum.warehouseStock || 0,
        totalSold: productStats._sum.soldStock || 0,
        totalValue: totalValue.toFixed(2),
        lowStockCount: lowStockProducts.length,
        lowStockProducts: lowStockProducts.map(p => ({
          id: p.id,
          productName: p.productName,  // ✅ Sửa
          sku: p.sku,
          quantity: p.quantity,
          displayStock: p.displayStock,
          warehouseStock: p.warehouseStock,
          group: p.group  // ✅ Sửa
        })),
        recentTransactions: recentTransactions.map(t => ({
          id: t.id,
          type: t.type,
          quantity: t.quantity,
          date: t.date,
          productName: t.product.productName,  // ✅ Sửa
          productSku: t.product.sku,
          username: t.user?.username || 'System'
        })),
        transactionStats: {
          totalImports: importStats._count,
          totalImportQuantity: importStats._sum.quantity || 0,
          totalExports: exportStats._count,
          totalExportQuantity: exportStats._sum.quantity || 0
        }
      });
    } catch (error) {
      console.error('Get dashboard stats error:', error);
      res.status(500).json({ error: 'Lỗi khi lấy thống kê dashboard' });
    }
  }

  // GET /api/dashboard/revenue
  async getRevenue(req, res) {
    try {
      const { period = 'month', startDate, endDate } = req.query;

      const where = { type: 'export' };
      
      // ✅ Thêm date filter nếu có
      if (startDate || endDate) {
        where.date = {};
        if (startDate) where.date.gte = new Date(startDate);
        if (endDate) where.date.lte = new Date(endDate);
      }

      // Tính revenue từ exports (xuất kho)
      const exports = await prisma.transaction.findMany({
        where,
        include: {
          product: {
            select: { 
              retailPrice: true  // ✅ Dùng retailPrice thay vì price
            }
          }
        }
      });

      const revenue = exports.reduce((sum, t) => {
        return sum + (t.quantity * Number(t.product.retailPrice));
      }, 0);

      // ✅ Tính cost để có profit
      const exportsWithCost = await prisma.transaction.findMany({
        where,
        include: {
          product: {
            select: { 
              cost: true,
              retailPrice: true
            }
          }
        }
      });

      const totalCost = exportsWithCost.reduce((sum, t) => {
        return sum + (t.quantity * Number(t.product.cost));
      }, 0);

      const profit = revenue - totalCost;

      res.json({
        period,
        totalRevenue: revenue.toFixed(2),
        totalCost: totalCost.toFixed(2),
        profit: profit.toFixed(2),
        profitMargin: revenue > 0 ? ((profit / revenue) * 100).toFixed(2) + '%' : '0%',
        transactionCount: exports.length
      });
    } catch (error) {
      console.error('Get revenue error:', error);
      res.status(500).json({ error: 'Lỗi khi lấy doanh thu' });
    }
  }

  // GET /api/dashboard/low-stock
  async getLowStockProducts(req, res) {
    try {
      const { threshold = 10 } = req.query;

      const products = await prisma.product.findMany({
        where: {
          quantity: {
            lt: Number(threshold)  // ✅ Dynamic threshold
          }
        },
        select: {
          id: true,
          productName: true,  // ✅ Sửa
          sku: true,
          quantity: true,
          displayStock: true,
          warehouseStock: true,
          cost: true,  // ✅ Sửa
          retailPrice: true,
          group: true  // ✅ Sửa
        },
        orderBy: { quantity: 'asc' }
      });

      const formatted = products.map(p => ({
        id: p.id,
        productName: p.productName,  // ✅ Sửa
        sku: p.sku,
        quantity: p.quantity,
        displayStock: p.displayStock,
        warehouseStock: p.warehouseStock,
        cost: Number(p.cost),
        retailPrice: Number(p.retailPrice),
        group: p.group  // ✅ Sửa
      }));

      res.json(formatted);
    } catch (error) {
      console.error('Get low stock error:', error);
      res.status(500).json({ error: 'Lỗi khi lấy sản phẩm tồn kho thấp' });
    }
  }

  // GET /api/dashboard/recent-transactions
  async getRecentTransactions(req, res) {
    try {
      const { limit = 10 } = req.query;

      const transactions = await prisma.transaction.findMany({
        take: Number(limit),
        orderBy: { date: 'desc' },
        include: {
          product: {
            select: { 
              productName: true,  // ✅ Sửa
              sku: true 
            }
          },
          user: {
            select: { username: true }
          }
        }
      });

      const formatted = transactions.map(t => ({
        id: t.id,
        type: t.type,
        quantity: t.quantity,
        date: t.date,
        productName: t.product.productName,  // ✅ Sửa
        productSku: t.product.sku,
        username: t.user?.username || 'System',
        note: t.note
      }));

      res.json(formatted);
    } catch (error) {
      console.error('Get recent transactions error:', error);
      res.status(500).json({ error: 'Lỗi khi lấy giao dịch gần đây' });
    }
  }

  // GET /api/dashboard/chart-data
  async getChartData(req, res) {
    try {
      const { days = 7 } = req.query;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - Number(days));
      startDate.setHours(0, 0, 0, 0);

      const transactions = await prisma.transaction.findMany({
        where: {
          date: {
            gte: startDate
          }
        },
        orderBy: { date: 'asc' }
      });

      // Group by date
      const chartData = {};
      
      // ✅ Initialize all dates
      for (let i = 0; i < Number(days); i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateKey = date.toISOString().split('T')[0];
        
        chartData[dateKey] = {
          date: dateKey,
          imports: 0,
          exports: 0,
          importCount: 0,
          exportCount: 0
        };
      }

      // Fill with actual data
      transactions.forEach(t => {
        const dateKey = t.date.toISOString().split('T')[0];
        
        if (chartData[dateKey]) {
          if (t.type === 'import') {
            chartData[dateKey].imports += t.quantity;
            chartData[dateKey].importCount += 1;
          } else {
            chartData[dateKey].exports += t.quantity;
            chartData[dateKey].exportCount += 1;
          }
        }
      });

      res.json(Object.values(chartData));
    } catch (error) {
      console.error('Get chart data error:', error);
      res.status(500).json({ error: 'Lỗi khi lấy dữ liệu biểu đồ' });
    }
  }

  // ✅ BONUS: GET /api/dashboard/product-groups
  async getProductGroups(req, res) {
    try {
      // Group products by "group" field
      const products = await prisma.product.groupBy({
        by: ['group'],
        _count: {
          id: true
        },
        _sum: {
          quantity: true,
          soldStock: true
        }
      });

      const formatted = products.map(g => ({
        group: g.group || 'Không phân loại',
        productCount: g._count.id,
        totalQuantity: g._sum.quantity || 0,
        totalSold: g._sum.soldStock || 0
      }));

      res.json(formatted);
    } catch (error) {
      console.error('Get product groups error:', error);
      res.status(500).json({ error: 'Lỗi khi lấy nhóm sản phẩm' });
    }
  }
}

export default new DashboardController();  