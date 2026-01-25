import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Countries for flower origins
export const countries = pgTable("countries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code", { length: 2 }).notNull().unique(),
  name: text("name").notNull(),
  flag: text("flag").notNull(),
});

export const insertCountrySchema = createInsertSchema(countries).omit({ id: true });
export type InsertCountry = z.infer<typeof insertCountrySchema>;
export type Country = typeof countries.$inferSelect;

// Plantations/Farms
export const plantations = pgTable("plantations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  countryId: varchar("country_id").notNull(),
});

export const insertPlantationSchema = createInsertSchema(plantations).omit({ id: true });
export type InsertPlantation = z.infer<typeof insertPlantationSchema>;
export type Plantation = typeof plantations.$inferSelect;

// Flower types (rose, tulip, etc.)
export const flowerTypes = pgTable("flower_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull(), // single, spray
});

export const insertFlowerTypeSchema = createInsertSchema(flowerTypes).omit({ id: true });
export type InsertFlowerType = z.infer<typeof insertFlowerTypeSchema>;
export type FlowerType = typeof flowerTypes.$inferSelect;

// Products (flowers)
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  variety: text("variety").notNull(),
  typeId: varchar("type_id").notNull(),
  countryId: varchar("country_id").notNull(),
  plantationId: varchar("plantation_id"),
  flowerClass: text("flower_class").notNull(), // Standard, Premium, Garden
  height: integer("height").notNull(), // in cm
  color: text("color").notNull(),
  priceUsd: decimal("price_usd", { precision: 10, scale: 2 }),
  priceUah: decimal("price_uah", { precision: 10, scale: 2 }),
  packSize: integer("pack_size").default(25),
  status: text("status").notNull().default("available"), // available, preorder, expected
  expectedDate: timestamp("expected_date"),
  isPromo: boolean("is_promo").default(false),
  images: text("images").array(),
  catalogType: text("catalog_type").notNull().default("preorder"), // preorder, instock
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

// Customer types
export const customerTypes = ["flower_shop", "wholesale"] as const;
export type CustomerType = typeof customerTypes[number];

// Customers
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  telegramId: text("telegram_id").unique(),
  name: text("name").notNull(),
  phone: text("phone"),
  shopName: text("shop_name"),
  city: text("city"),
  customerType: text("customer_type").notNull().default("flower_shop"),
  language: text("language").default("ua"),
  loyaltyPoints: integer("loyalty_points").default(0),
  totalOrders: integer("total_orders").default(0),
  totalSpent: decimal("total_spent", { precision: 12, scale: 2 }).default("0"),
  isBlocked: boolean("is_blocked").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true, loyaltyPoints: true, totalOrders: true, totalSpent: true });
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

// Order statuses
export const orderStatuses = ["new", "confirmed", "processing", "shipped", "completed", "cancelled"] as const;
export type OrderStatus = typeof orderStatuses[number];

// Orders
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderNumber: text("order_number").notNull().unique(),
  customerId: varchar("customer_id").notNull(),
  status: text("status").notNull().default("new"),
  totalUah: decimal("total_uah", { precision: 12, scale: 2 }).notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

// Order items
export const orderItems = pgTable("order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull(),
  productId: varchar("product_id").notNull(),
  quantity: integer("quantity").notNull(),
  priceUah: decimal("price_uah", { precision: 10, scale: 2 }).notNull(),
  totalUah: decimal("total_uah", { precision: 12, scale: 2 }).notNull(),
});

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({ id: true });
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItems.$inferSelect;

// Settings
export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
});

export const insertSettingsSchema = createInsertSchema(settings).omit({ id: true });
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;

// Users (admin panel)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").default("admin"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Extended types for frontend display
export type ProductWithDetails = Product & {
  country?: Country;
  plantation?: Plantation;
  flowerType?: FlowerType;
};

export type OrderWithDetails = Order & {
  customer?: Customer;
  items?: (OrderItem & { product?: Product })[];
};

// Analytics types
export type DashboardStats = {
  totalOrders: number;
  totalRevenue: number;
  totalCustomers: number;
  totalProducts: number;
  newOrdersToday: number;
  revenueToday: number;
  ordersChange: number;
  revenueChange: number;
};

export type TopProduct = {
  id: string;
  name: string;
  variety: string;
  totalSold: number;
  revenue: number;
};

export type TopCustomer = {
  id: string;
  name: string;
  shopName: string;
  totalOrders: number;
  totalSpent: number;
};
