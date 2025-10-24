generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        Int      @id @default(autoincrement())
  username  String   @unique
  email     String   @unique
  password  String
  fullName  String?  @map("full_name")
  role      String   @default("user")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  
  historyLogs  HistoryLog[]
  transactions Transaction[]
  
  @@map("users")
}

model Product {
  id             Int      @id @default(autoincrement())
  productName    String   @map("product_name")
  sku            String   @unique
  group          String?
  quantity       Int      @default(0)
  displayStock   Int      @default(0) @map("display_stock")
  warehouseStock Int      @default(0) @map("warehouse_stock")
  newStock       Int      @default(0) @map("new_stock")
  soldStock      Int      @default(0) @map("sold_stock")
  damagedStock   Int      @default(0) @map("damaged_stock")
  endingStock    Int      @default(0) @map("ending_stock")
  cost           Decimal  @default(0) @db.Decimal(12, 2)
  retailPrice    Decimal  @default(0) @map("retail_price") @db.Decimal(12, 2)
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")
  
  transactions Transaction[]
  historyLogs  HistoryLog[]
  
  @@index([sku])
  @@index([group])
  @@map("products")
}

model Transaction {
  id        Int      @id @default(autoincrement())
  productId Int      @map("product_id")
  userId    Int?     @map("user_id")
  type      String   // 'import' or 'export'
  quantity  Int
  note      String?
  date      DateTime @default(now())
  createdAt DateTime @default(now()) @map("created_at")
  
  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  user    User?   @relation(fields: [userId], references: [id])
  
  @@index([productId])
  @@index([type])
  @@index([date])
  @@map("transactions")
}

model HistoryLog {
  id          Int      @id @default(autoincrement())
  action      String   // 'add', 'update', 'delete', 'import', 'export'
  productId   Int?     @map("product_id")
  userId      Int?     @map("user_id")
  productName String   @map("product_name")
  productSku  String   @map("product_sku")
  details     String?
  timestamp   DateTime @default(now())
  
  product Product? @relation(fields: [productId], references: [id], onDelete: SetNull)
  user    User?    @relation(fields: [userId], references: [id])
  
  @@index([userId])
  @@index([timestamp])
  @@map("history_logs")
}