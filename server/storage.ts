import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import {
  users, countries, plantations, flowerTypes, products,
  customers, orders, orderItems, settings,
  type User, type InsertUser,
  type Country, type InsertCountry,
  type Plantation, type InsertPlantation,
  type FlowerType, type InsertFlowerType,
  type Product, type InsertProduct, type ProductWithDetails,
  type Customer, type InsertCustomer,
  type Order, type InsertOrder, type OrderWithDetails,
  type OrderItem, type InsertOrderItem,
  type Settings,
  type DashboardStats, type TopProduct, type TopCustomer,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getCountries(): Promise<Country[]>;
  getCountry(id: string): Promise<Country | undefined>;
  createCountry(country: InsertCountry): Promise<Country>;
  updateCountry(id: string, country: Partial<InsertCountry>): Promise<Country | undefined>;
  deleteCountry(id: string): Promise<boolean>;
  getPlantations(): Promise<Plantation[]>;
  getPlantation(id: string): Promise<Plantation | undefined>;
  createPlantation(plantation: InsertPlantation): Promise<Plantation>;
  updatePlantation(id: string, plantation: Partial<InsertPlantation>): Promise<Plantation | undefined>;
  deletePlantation(id: string): Promise<boolean>;
  getFlowerTypes(): Promise<FlowerType[]>;
  getFlowerType(id: string): Promise<FlowerType | undefined>;
  createFlowerType(flowerType: InsertFlowerType): Promise<FlowerType>;
  updateFlowerType(id: string, flowerType: Partial<InsertFlowerType>): Promise<FlowerType | undefined>;
  deleteFlowerType(id: string): Promise<boolean>;
  getProducts(): Promise<ProductWithDetails[]>;
  getProduct(id: string): Promise<ProductWithDetails | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;
  getCustomers(): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, customer: Partial<InsertCustomer>): Promise<Customer | undefined>;
  blockCustomer(id: string, isBlocked: boolean): Promise<Customer | undefined>;
  getCustomerOrders(customerId: string): Promise<Order[]>;
  getOrders(): Promise<OrderWithDetails[]>;
  getOrder(id: string): Promise<OrderWithDetails | undefined>;
  getRecentOrders(limit?: number): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrderStatus(id: string, status: string): Promise<Order | undefined>;
  createOrderItem(item: InsertOrderItem): Promise<OrderItem>;
  getOrderItems(orderId: string): Promise<OrderItem[]>;
  getSettings(): Promise<Settings[]>;
  getSetting(key: string): Promise<Settings | undefined>;
  updateSetting(key: string, value: string): Promise<Settings>;
  updateSettingsBulk(settings: { key: string; value: string }[]): Promise<Settings[]>;
  getDashboardStats(): Promise<DashboardStats>;
  getTopProducts(limit?: number): Promise<TopProduct[]>;
  getTopCustomers(limit?: number): Promise<TopCustomer[]>;
  getSalesByCountry(): Promise<{ country: string; sales: number }[]>;
  getSalesTrend(period: string): Promise<{ date: string; sales: number; orders: number }[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values({ ...insertUser, role: 'admin' }).returning();
    return user;
  }

  async getCountries(): Promise<Country[]> {
    return await db.select().from(countries);
  }

  async getCountry(id: string): Promise<Country | undefined> {
    const [c] = await db.select().from(countries).where(eq(countries.id, id));
    return c || undefined;
  }

  async createCountry(country: InsertCountry): Promise<Country> {
    const [c] = await db.insert(countries).values(country).returning();
    return c;
  }

  async updateCountry(id: string, country: Partial<InsertCountry>): Promise<Country | undefined> {
    const [c] = await db.update(countries).set(country).where(eq(countries.id, id)).returning();
    return c || undefined;
  }

  async deleteCountry(id: string): Promise<boolean> {
    const result = await db.delete(countries).where(eq(countries.id, id)).returning();
    return result.length > 0;
  }

  async getPlantations(): Promise<Plantation[]> {
    return await db.select().from(plantations);
  }

  async getPlantation(id: string): Promise<Plantation | undefined> {
    const [p] = await db.select().from(plantations).where(eq(plantations.id, id));
    return p || undefined;
  }

  async createPlantation(plantation: InsertPlantation): Promise<Plantation> {
    const [p] = await db.insert(plantations).values(plantation).returning();
    return p;
  }

  async updatePlantation(id: string, plantation: Partial<InsertPlantation>): Promise<Plantation | undefined> {
    const [p] = await db.update(plantations).set(plantation).where(eq(plantations.id, id)).returning();
    return p || undefined;
  }

  async deletePlantation(id: string): Promise<boolean> {
    const result = await db.delete(plantations).where(eq(plantations.id, id)).returning();
    return result.length > 0;
  }

  async getFlowerTypes(): Promise<FlowerType[]> {
    return await db.select().from(flowerTypes);
  }

  async getFlowerType(id: string): Promise<FlowerType | undefined> {
    const [ft] = await db.select().from(flowerTypes).where(eq(flowerTypes.id, id));
    return ft || undefined;
  }

  async createFlowerType(flowerType: InsertFlowerType): Promise<FlowerType> {
    const [ft] = await db.insert(flowerTypes).values(flowerType).returning();
    return ft;
  }

  async updateFlowerType(id: string, flowerType: Partial<InsertFlowerType>): Promise<FlowerType | undefined> {
    const [ft] = await db.update(flowerTypes).set(flowerType).where(eq(flowerTypes.id, id)).returning();
    return ft || undefined;
  }

  async deleteFlowerType(id: string): Promise<boolean> {
    const result = await db.delete(flowerTypes).where(eq(flowerTypes.id, id)).returning();
    return result.length > 0;
  }

  async getProducts(): Promise<ProductWithDetails[]> {
    const rows = await db.select().from(products);
    const countryList = await this.getCountries();
    const flowerTypeList = await this.getFlowerTypes();
    const plantationList = await this.getPlantations();

    return rows.map(p => ({
      ...p,
      country: countryList.find(c => c.id === p.countryId),
      flowerType: flowerTypeList.find(ft => ft.id === p.typeId),
      plantation: p.plantationId ? plantationList.find(pl => pl.id === p.plantationId) : undefined
    }));
  }

  async getProduct(id: string): Promise<ProductWithDetails | undefined> {
    const [p] = await db.select().from(products).where(eq(products.id, id));
    if (!p) return undefined;
    
    const country = await this.getCountry(p.countryId);
    const flowerType = await this.getFlowerType(p.typeId);
    const plantation = p.plantationId ? await this.getPlantation(p.plantationId) : undefined;

    return { ...p, country, flowerType, plantation };
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [p] = await db.insert(products).values(product).returning();
    return p;
  }

  async updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined> {
    const [p] = await db.update(products).set(product).where(eq(products.id, id)).returning();
    return p || undefined;
  }

  async deleteProduct(id: string): Promise<boolean> {
    const result = await db.delete(products).where(eq(products.id, id)).returning();
    return result.length > 0;
  }

  async getCustomers(): Promise<Customer[]> {
    return await db.select().from(customers);
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    const [c] = await db.select().from(customers).where(eq(customers.id, id));
    return c || undefined;
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const [c] = await db.insert(customers).values({
      ...customer,
      loyaltyPoints: 0,
      totalOrders: 0,
      totalSpent: "0",
      isBlocked: customer.isBlocked ?? false
    }).returning();
    return c;
  }

  async updateCustomer(id: string, customer: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const [c] = await db.update(customers).set(customer).where(eq(customers.id, id)).returning();
    return c || undefined;
  }

  async blockCustomer(id: string, isBlocked: boolean): Promise<Customer | undefined> {
    const [c] = await db.update(customers).set({ isBlocked }).where(eq(customers.id, id)).returning();
    return c || undefined;
  }

  async getCustomerOrders(customerId: string): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.customerId, customerId)).orderBy(desc(orders.createdAt));
  }

  async getOrders(): Promise<OrderWithDetails[]> {
    const rows = await db.select().from(orders).orderBy(desc(orders.createdAt));
    const customerList = await this.getCustomers();
    const allItems = await db.select().from(orderItems);
    const allProducts = await db.select().from(products);

    return rows.map(o => ({
      ...o,
      customer: customerList.find(c => c.id === o.customerId),
      items: allItems.filter(i => i.orderId === o.id).map(i => ({
        ...i,
        product: allProducts.find(p => p.id === i.productId)
      }))
    }));
  }

  async getOrder(id: string): Promise<OrderWithDetails | undefined> {
    const [o] = await db.select().from(orders).where(eq(orders.id, id));
    if (!o) return undefined;

    const customer = await this.getCustomer(o.customerId);
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, o.id));
    const productsList = await db.select().from(products);

    return {
      ...o,
      customer,
      items: items.map(i => ({
        ...i,
        product: productsList.find(p => p.id === i.productId)
      }))
    };
  }

  async getRecentOrders(limit: number = 5): Promise<Order[]> {
    return await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(limit);
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const [newOrder] = await db.insert(orders).values(order).returning();
    return newOrder;
  }

  async updateOrderStatus(id: string, status: string): Promise<Order | undefined> {
    const [o] = await db.update(orders).set({ status, updatedAt: new Date() }).where(eq(orders.id, id)).returning();
    return o || undefined;
  }

  async createOrderItem(item: InsertOrderItem): Promise<OrderItem> {
    const [ni] = await db.insert(orderItems).values(item).returning();
    return ni;
  }

  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    return await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  }

  async getSettings(): Promise<Settings[]> {
    return await db.select().from(settings);
  }

  async getSetting(key: string): Promise<Settings | undefined> {
    const [s] = await db.select().from(settings).where(eq(settings.key, key));
    return s || undefined;
  }

  async updateSetting(key: string, value: string): Promise<Settings> {
    const existing = await this.getSetting(key);
    if (existing) {
      const [s] = await db.update(settings).set({ value }).where(eq(settings.key, key)).returning();
      return s;
    }
    const [s] = await db.insert(settings).values({ key, value }).returning();
    return s;
  }

  async updateSettingsBulk(settingsList: { key: string; value: string }[]): Promise<Settings[]> {
    const result: Settings[] = [];
    for (const s of settingsList) {
      result.push(await this.updateSetting(s.key, s.value));
    }
    return result;
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const orderList = await db.select().from(orders);
    const customerList = await db.select().from(customers);
    const productList = await db.select().from(products);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayOrders = orderList.filter(o => new Date(o.createdAt!) >= today);
    const yesterdayOrders = orderList.filter(o => new Date(o.createdAt!) >= yesterday && new Date(o.createdAt!) < today);

    const totalRevenue = orderList.reduce((sum, o) => sum + Number(o.totalUah), 0);
    const todayRevenue = todayOrders.reduce((sum, o) => sum + Number(o.totalUah), 0);
    const yesterdayRevenue = yesterdayOrders.reduce((sum, o) => sum + Number(o.totalUah), 0);

    return {
      totalOrders: orderList.length,
      totalRevenue,
      totalCustomers: customerList.length,
      totalProducts: productList.length,
      newOrdersToday: todayOrders.length,
      revenueToday: todayRevenue,
      ordersChange: yesterdayOrders.length > 0 ? Math.round((todayOrders.length - yesterdayOrders.length) / yesterdayOrders.length * 100) : (todayOrders.length > 0 ? 100 : 0),
      revenueChange: yesterdayRevenue > 0 ? Math.round((todayRevenue - yesterdayRevenue) / yesterdayRevenue * 100) : (todayRevenue > 0 ? 100 : 0)
    };
  }

  async getTopProducts(limit: number = 10): Promise<TopProduct[]> {
    const items = await db.select().from(orderItems);
    const productList = await db.select().from(products);
    
    const sales = new Map<string, { qty: number, rev: number }>();
    items.forEach(i => {
      const s = sales.get(i.productId) || { qty: 0, rev: 0 };
      sales.set(i.productId, { qty: s.qty + i.quantity, rev: s.rev + Number(i.totalUah) });
    });

    return Array.from(sales.entries())
      .map(([id, s]) => {
        const p = productList.find(p => p.id === id);
        return { id, name: p?.name || "Unknown", variety: p?.variety || "", totalSold: s.qty, revenue: s.rev };
      })
      .sort((a, b) => b.totalSold - a.totalSold)
      .slice(0, limit);
  }

  async getTopCustomers(limit: number = 10): Promise<TopCustomer[]> {
    const list = await db.select().from(customers);
    return list
      .map(c => ({ id: c.id, name: c.name, shopName: c.shopName || "", totalOrders: c.totalOrders || 0, totalSpent: Number(c.totalSpent) }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, limit);
  }

  async getSalesByCountry(): Promise<{ country: string; sales: number }[]> {
    const items = await db.select().from(orderItems);
    const productList = await db.select().from(products);
    const countryList = await db.select().from(countries);

    const countrySales = new Map<string, number>();
    items.forEach(i => {
      const p = productList.find(p => p.id === i.productId);
      if (p) {
        const c = countryList.find(c => c.id === p.countryId);
        if (c) {
          countrySales.set(c.name, (countrySales.get(c.name) || 0) + Number(i.totalUah));
        }
      }
    });

    return Array.from(countrySales.entries()).map(([country, sales]) => ({ country, sales }));
  }

  async getSalesTrend(period: string): Promise<{ date: string; sales: number; orders: number }[]> {
    const days = period === "week" ? 7 : period === "month" ? 30 : 365;
    const orderList = await db.select().from(orders);
    const result = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const nextD = new Date(d);
      nextD.setDate(d.getDate() + 1);

      const dayOrders = orderList.filter(o => new Date(o.createdAt!) >= d && new Date(o.createdAt!) < nextD);
      result.push({
        date: d.toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit" }),
        sales: dayOrders.reduce((sum, o) => sum + Number(o.totalUah), 0),
        orders: dayOrders.length
      });
    }
    return result;
  }
}

export const storage = new DatabaseStorage();
