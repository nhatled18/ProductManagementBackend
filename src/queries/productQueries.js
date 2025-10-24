const GET_ALL_PRODUCTS = `
  SELECT 
    p.id,
    p.product_name as "productName",
    p.sku,
    p.group,
    p.quantity,
    p.display_stock as "displayStock",
    p.warehouse_stock as "warehouseStock",
    p.new_stock as "newStock",
    p.sold_stock as "soldStock",
    p.damaged_stock as "damagedStock",
    p.ending_stock as "endingStock",
    p.cost,
    p.retail_price as "retailPrice",
    p.created_at as "createdAt"
  FROM products p
  ORDER BY p.created_at DESC
`;


const SEARCH_PRODUCTS = `
  SELECT 
    p.id,
    p.product_name as "productName",
    p.sku,
    p.group,
    p.quantity,
    p.display_stock as "displayStock",
    p.warehouse_stock as "warehouseStock",
    p.new_stock as "newStock",
    p.sold_stock as "soldStock",
    p.damaged_stock as "damagedStock",
    p.ending_stock as "endingStock",
    p.cost,
    p.retail_price as "retailPrice"
  FROM products p
  WHERE 
    (p.product_name ILIKE $1 OR p.sku ILIKE $1 OR p.group ILIKE $1)
    AND ($2 = 'all' OR p.group = $2)
    AND p.quantity > 0
  ORDER BY p.product_name
`;

const GET_PRODUCT_BY_ID = `
  SELECT 
    p.id,
    p.product_name as "productName",
    p.sku,
    p.group,
    p.quantity,
    p.display_stock as "displayStock",
    p.warehouse_stock as "warehouseStock",
    p.new_stock as "newStock",
    p.sold_stock as "soldStock",
    p.damaged_stock as "damagedStock",
    p.ending_stock as "endingStock",
    p.cost,
    p.retail_price as "retailPrice",
    p.created_at as "createdAt",
    p.updated_at as "updatedAt"
  FROM products p
  WHERE p.id = $1
`;

const CREATE_PRODUCT = `
  INSERT INTO products (
    product_name, 
    sku, 
    group, 
    quantity, 
    display_stock,
    warehouse_stock,
    new_stock,
    sold_stock,
    damaged_stock,
    ending_stock,
    cost, 
    retail_price
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
  RETURNING *
`;

const UPDATE_PRODUCT = `
  UPDATE products
  SET 
    product_name = $1,
    sku = $2,
    group = $3,
    quantity = $4,
    display_stock = $5,
    warehouse_stock = $6,
    new_stock = $7,
    sold_stock = $8,
    damaged_stock = $9,
    ending_stock = $10,
    cost = $11,
    retail_price = $12,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = $13
  RETURNING *
`;
const DELETE_PRODUCT = `
  DELETE FROM products WHERE id = $1
  RETURNING *
`;

const UPDATE_PRODUCT_QUANTITY = `
  UPDATE products
  SET 
    quantity = quantity + $1,
    warehouse_stock = warehouse_stock + $1,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = $2
  RETURNING *
`;

const GET_TRANSACTIONS = `
  SELECT 
    t.id,
    t.product_id as "productId",
    t.type,
    t.quantity,
    t.note,
    t.date,
    p.product_name as "productName",
    p.sku as "productSku",
    p.group as "productGroup"
  FROM transactions t
  JOIN products p ON t.product_id = p.id
  ORDER BY t.date DESC
  LIMIT $1 OFFSET $2
`;

const CREATE_TRANSACTION = `
  INSERT INTO transactions (product_id, user_id, type, quantity, note, date)
  VALUES ($1, $2, $3, $4, $5, $6)
  RETURNING *
`;

const GET_HISTORY_LOGS = `
  SELECT 
    h.*,
    u.username
  FROM history_logs h
  LEFT JOIN users u ON h.user_id = u.id
  ORDER BY h.timestamp DESC
  LIMIT $1 OFFSET $2
`;


const CREATE_HISTORY_LOG = `
  INSERT INTO history_logs (action, product_id, user_id, product_name, product_sku, details)
  VALUES ($1, $2, $3, $4, $5, $6)
  RETURNING *
`;


const GET_DASHBOARD_STATS = `
  SELECT 
    COUNT(*) as total_products,
    SUM(quantity) as total_quantity,
    SUM(quantity * cost) as total_value,
    SUM(quantity * retail_price) as total_retail_value,
    COUNT(CASE WHEN quantity <= 5 THEN 1 END) as low_stock_count
  FROM products
`;


const GET_LOW_STOCK_PRODUCTS = `
  SELECT 
    p.id,
    p.product_name as "productName",
    p.sku,
    p.group,
    p.quantity,
    p.cost,
    p.retail_price as "retailPrice"
  FROM products p
  WHERE p.quantity <= 5
  ORDER BY p.quantity ASC
`;


const GET_RECENT_TRANSACTIONS = `
  SELECT 
    t.id,
    t.type,
    t.quantity,
    t.date,
    p.product_name as "productName",
    p.sku as "productSku"
  FROM transactions t
  JOIN products p ON t.product_id = p.id
  ORDER BY t.date DESC
  LIMIT 10
`;