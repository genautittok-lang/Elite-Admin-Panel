import { randomUUID } from "crypto";
import type {
  User, InsertUser,
  Country, InsertCountry,
  Plantation, InsertPlantation,
  FlowerType, InsertFlowerType,
  Product, InsertProduct, ProductWithDetails,
  Customer, InsertCustomer,
  Order, InsertOrder, OrderWithDetails,
  OrderItem, InsertOrderItem,
  Settings, InsertSettings,
  DashboardStats, TopProduct, TopCustomer,
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Countries
  getCountries(): Promise<Country[]>;
  getCountry(id: string): Promise<Country | undefined>;
  createCountry(country: InsertCountry): Promise<Country>;
  updateCountry(id: string, country: Partial<InsertCountry>): Promise<Country | undefined>;
  deleteCountry(id: string): Promise<boolean>;

  // Plantations
  getPlantations(): Promise<Plantation[]>;
  getPlantation(id: string): Promise<Plantation | undefined>;
  createPlantation(plantation: InsertPlantation): Promise<Plantation>;
  updatePlantation(id: string, plantation: Partial<InsertPlantation>): Promise<Plantation | undefined>;
  deletePlantation(id: string): Promise<boolean>;

  // Flower Types
  getFlowerTypes(): Promise<FlowerType[]>;
  getFlowerType(id: string): Promise<FlowerType | undefined>;
  createFlowerType(flowerType: InsertFlowerType): Promise<FlowerType>;
  updateFlowerType(id: string, flowerType: Partial<InsertFlowerType>): Promise<FlowerType | undefined>;
  deleteFlowerType(id: string): Promise<boolean>;

  // Products
  getProducts(): Promise<ProductWithDetails[]>;
  getProduct(id: string): Promise<ProductWithDetails | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;

  // Customers
  getCustomers(): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, customer: Partial<InsertCustomer>): Promise<Customer | undefined>;
  blockCustomer(id: string, isBlocked: boolean): Promise<Customer | undefined>;
  getCustomerOrders(customerId: string): Promise<Order[]>;

  // Orders
  getOrders(): Promise<OrderWithDetails[]>;
  getOrder(id: string): Promise<OrderWithDetails | undefined>;
  getRecentOrders(limit?: number): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrderStatus(id: string, status: string): Promise<Order | undefined>;
  createOrderItem(item: InsertOrderItem): Promise<OrderItem>;
  getOrderItems(orderId: string): Promise<OrderItem[]>;

  // Settings
  getSettings(): Promise<Settings[]>;
  getSetting(key: string): Promise<Settings | undefined>;
  updateSetting(key: string, value: string): Promise<Settings>;
  updateSettingsBulk(settings: { key: string; value: string }[]): Promise<Settings[]>;

  // Analytics
  getDashboardStats(): Promise<DashboardStats>;
  getTopProducts(limit?: number): Promise<TopProduct[]>;
  getTopCustomers(limit?: number): Promise<TopCustomer[]>;
  getSalesByCountry(): Promise<{ country: string; sales: number }[]>;
  getSalesTrend(period: string): Promise<{ date: string; sales: number; orders: number }[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private countries: Map<string, Country> = new Map();
  private plantations: Map<string, Plantation> = new Map();
  private flowerTypes: Map<string, FlowerType> = new Map();
  private products: Map<string, Product> = new Map();
  private customers: Map<string, Customer> = new Map();
  private orders: Map<string, Order> = new Map();
  private orderItems: Map<string, OrderItem> = new Map();
  private settings: Map<string, Settings> = new Map();
  private orderCounter = 1000;

  constructor() {
    this.seedData();
  }

  private seedData() {
    // Seed countries (using ISO codes as flags - display with flag icon in UI)
    const countriesData = [
      { code: "KE", name: "Kenya", flag: "KE" },
      { code: "EC", name: "Ecuador", flag: "EC" },
      { code: "CO", name: "Colombia", flag: "CO" },
      { code: "IT", name: "Italy", flag: "IT" },
      { code: "NL", name: "Netherlands", flag: "NL" },
      { code: "CL", name: "Chile", flag: "CL" },
    ];
    countriesData.forEach((c) => {
      const id = randomUUID();
      this.countries.set(id, { ...c, id });
    });

    // Seed flower types
    const flowerTypesData = [
      { name: "Троянда", category: "single" },
      { name: "Кущова троянда", category: "spray" },
      { name: "Хризантема", category: "spray" },
      { name: "Гербера", category: "single" },
      { name: "Тюльпан", category: "single" },
      { name: "Еустома", category: "single" },
      { name: "Гортензія", category: "single" },
    ];
    flowerTypesData.forEach((ft) => {
      const id = randomUUID();
      this.flowerTypes.set(id, { ...ft, id });
    });

    // Seed plantations
    const countryIds = Array.from(this.countries.values());
    const plantationsData = [
      { name: "Naivasha Roses", countryId: countryIds.find(c => c.code === "KE")?.id || "" },
      { name: "Tambuzi Farm", countryId: countryIds.find(c => c.code === "KE")?.id || "" },
      { name: "Rosaprima", countryId: countryIds.find(c => c.code === "EC")?.id || "" },
      { name: "Alexandra Farms", countryId: countryIds.find(c => c.code === "CO")?.id || "" },
    ];
    plantationsData.forEach((p) => {
      const id = randomUUID();
      this.plantations.set(id, { ...p, id });
    });

    // Seed some products
    const typeIds = Array.from(this.flowerTypes.values());
    const roseType = typeIds.find(t => t.name === "Троянда");
    const plantationIds = Array.from(this.plantations.values());
    
    const productsData = [
      { name: "Троянда", variety: "Freedom", typeId: roseType?.id || "", countryId: countryIds.find(c => c.code === "EC")?.id || "", plantationId: plantationIds[2]?.id, flowerClass: "Premium", height: 70, color: "Червоний", priceUsd: "0.85", priceUah: "35", status: "available", catalogType: "instock", packSize: 25 },
      { name: "Троянда", variety: "Explorer", typeId: roseType?.id || "", countryId: countryIds.find(c => c.code === "EC")?.id || "", plantationId: plantationIds[2]?.id, flowerClass: "Premium", height: 60, color: "Рожевий", priceUsd: "0.75", priceUah: "31", status: "available", catalogType: "instock", packSize: 25 },
      { name: "Троянда", variety: "White Ohara", typeId: roseType?.id || "", countryId: countryIds.find(c => c.code === "EC")?.id || "", plantationId: plantationIds[2]?.id, flowerClass: "Garden", height: 50, color: "Білий", priceUsd: "1.20", priceUah: "50", status: "available", catalogType: "preorder", packSize: 25 },
      { name: "Троянда", variety: "Juliet", typeId: roseType?.id || "", countryId: countryIds.find(c => c.code === "KE")?.id || "", plantationId: plantationIds[0]?.id, flowerClass: "Garden", height: 50, color: "Персиковий", priceUsd: "1.50", priceUah: null, status: "preorder", catalogType: "preorder", packSize: 25 },
    ];
    productsData.forEach((p) => {
      const id = randomUUID();
      this.products.set(id, { ...p, id, isPromo: false, images: null, expectedDate: null, createdAt: new Date() } as unknown as Product);
    });

    // Seed customers
    const customersData = [
      { name: "Олена Квіткова", phone: "+380501234567", shopName: "Квіти для Вас", city: "Київ", customerType: "flower_shop", language: "ua", totalOrders: 15, totalSpent: "45000", loyaltyPoints: 45, isBlocked: false },
      { name: "Андрій Петренко", phone: "+380671234567", shopName: "Флора Опт", city: "Львів", customerType: "wholesale", language: "ua", totalOrders: 32, totalSpent: "156000", loyaltyPoints: 156, isBlocked: false },
      { name: "Марія Шевченко", phone: "+380631234567", shopName: "Букет", city: "Одеса", customerType: "flower_shop", language: "ua", totalOrders: 8, totalSpent: "24000", loyaltyPoints: 24, isBlocked: false },
    ];
    customersData.forEach((c) => {
      const id = randomUUID();
      this.customers.set(id, { ...c, id, telegramId: null, createdAt: new Date() } as unknown as Customer);
    });

    // Seed orders
    const customerIds = Array.from(this.customers.values());
    const productIds = Array.from(this.products.values());
    
    const ordersData = [
      { orderNumber: "FL-1001", customerId: customerIds[0]?.id || "", status: "new", totalUah: "12500", comment: "Терміново потрібно" },
      { orderNumber: "FL-1002", customerId: customerIds[1]?.id || "", status: "confirmed", totalUah: "45000", comment: null },
      { orderNumber: "FL-1003", customerId: customerIds[2]?.id || "", status: "processing", totalUah: "8700", comment: null },
      { orderNumber: "FL-1004", customerId: customerIds[0]?.id || "", status: "shipped", totalUah: "15200", comment: "Доставка Новою Поштою" },
      { orderNumber: "FL-1005", customerId: customerIds[1]?.id || "", status: "completed", totalUah: "67500", comment: null },
    ];
    ordersData.forEach((o) => {
      const id = randomUUID();
      const order = { ...o, id, createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), updatedAt: new Date() } as unknown as Order;
      this.orders.set(id, order);
      
      // Add order items
      const numItems = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < numItems; i++) {
        const product = productIds[Math.floor(Math.random() * productIds.length)];
        const quantity = (Math.floor(Math.random() * 4) + 1) * 25;
        const itemId = randomUUID();
        this.orderItems.set(itemId, {
          id: itemId,
          orderId: id,
          productId: product?.id || "",
          quantity,
          priceUah: product?.priceUah || "35",
          totalUah: String(quantity * Number(product?.priceUah || 35)),
        });
      }
    });
    this.orderCounter = 1006;

    // Seed settings
    const settingsData = [
      { key: "usd_to_uah_rate", value: "41.50", description: "Курс USD/UAH" },
      { key: "min_order_amount", value: "5000", description: "Мінімальна сума замовлення" },
      { key: "wholesale_discount", value: "5", description: "Знижка для великого опту (%)" },
      { key: "loyalty_points_rate", value: "1000", description: "Грн на 1 бал" },
      { key: "auto_exchange_rate", value: "false", description: "Автоматичний курс" },
      { key: "notifications_enabled", value: "true", description: "Push-сповіщення" },
    ];
    settingsData.forEach((s) => {
      const id = randomUUID();
      this.settings.set(s.key, { ...s, id });
    });
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((u) => u.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id, role: "admin" };
    this.users.set(id, user);
    return user;
  }

  // Countries
  async getCountries(): Promise<Country[]> {
    return Array.from(this.countries.values());
  }

  async getCountry(id: string): Promise<Country | undefined> {
    return this.countries.get(id);
  }

  async createCountry(country: InsertCountry): Promise<Country> {
    const id = randomUUID();
    const newCountry: Country = { ...country, id };
    this.countries.set(id, newCountry);
    return newCountry;
  }

  async updateCountry(id: string, country: Partial<InsertCountry>): Promise<Country | undefined> {
    const existing = this.countries.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...country };
    this.countries.set(id, updated);
    return updated;
  }

  async deleteCountry(id: string): Promise<boolean> {
    return this.countries.delete(id);
  }

  // Plantations
  async getPlantations(): Promise<Plantation[]> {
    return Array.from(this.plantations.values());
  }

  async getPlantation(id: string): Promise<Plantation | undefined> {
    return this.plantations.get(id);
  }

  async createPlantation(plantation: InsertPlantation): Promise<Plantation> {
    const id = randomUUID();
    const newPlantation: Plantation = { ...plantation, id };
    this.plantations.set(id, newPlantation);
    return newPlantation;
  }

  async updatePlantation(id: string, plantation: Partial<InsertPlantation>): Promise<Plantation | undefined> {
    const existing = this.plantations.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...plantation };
    this.plantations.set(id, updated);
    return updated;
  }

  async deletePlantation(id: string): Promise<boolean> {
    return this.plantations.delete(id);
  }

  // Flower Types
  async getFlowerTypes(): Promise<FlowerType[]> {
    return Array.from(this.flowerTypes.values());
  }

  async getFlowerType(id: string): Promise<FlowerType | undefined> {
    return this.flowerTypes.get(id);
  }

  async createFlowerType(flowerType: InsertFlowerType): Promise<FlowerType> {
    const id = randomUUID();
    const newFlowerType: FlowerType = { ...flowerType, id };
    this.flowerTypes.set(id, newFlowerType);
    return newFlowerType;
  }

  async updateFlowerType(id: string, flowerType: Partial<InsertFlowerType>): Promise<FlowerType | undefined> {
    const existing = this.flowerTypes.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...flowerType };
    this.flowerTypes.set(id, updated);
    return updated;
  }

  async deleteFlowerType(id: string): Promise<boolean> {
    return this.flowerTypes.delete(id);
  }

  // Products
  async getProducts(): Promise<ProductWithDetails[]> {
    const products = Array.from(this.products.values());
    return products.map((p) => ({
      ...p,
      country: this.countries.get(p.countryId),
      plantation: p.plantationId ? this.plantations.get(p.plantationId) : undefined,
      flowerType: this.flowerTypes.get(p.typeId),
    }));
  }

  async getProduct(id: string): Promise<ProductWithDetails | undefined> {
    const product = this.products.get(id);
    if (!product) return undefined;
    return {
      ...product,
      country: this.countries.get(product.countryId),
      plantation: product.plantationId ? this.plantations.get(product.plantationId) : undefined,
      flowerType: this.flowerTypes.get(product.typeId),
    };
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const id = randomUUID();
    const newProduct: Product = { 
      ...product, 
      id, 
      createdAt: new Date(),
      isPromo: product.isPromo ?? false,
      images: product.images ?? null,
      expectedDate: product.expectedDate ?? null,
      packSize: product.packSize ?? 25,
      plantationId: product.plantationId ?? null,
      priceUsd: product.priceUsd ?? null,
      priceUah: product.priceUah ?? null,
    } as Product;
    this.products.set(id, newProduct);
    return newProduct;
  }

  async updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined> {
    const existing = this.products.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...product } as Product;
    this.products.set(id, updated);
    return updated;
  }

  async deleteProduct(id: string): Promise<boolean> {
    return this.products.delete(id);
  }

  // Customers
  async getCustomers(): Promise<Customer[]> {
    return Array.from(this.customers.values());
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    return this.customers.get(id);
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const id = randomUUID();
    const newCustomer: Customer = {
      ...customer,
      id,
      loyaltyPoints: 0,
      totalOrders: 0,
      totalSpent: "0",
      isBlocked: false,
      createdAt: new Date(),
    } as Customer;
    this.customers.set(id, newCustomer);
    return newCustomer;
  }

  async updateCustomer(id: string, customer: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const existing = this.customers.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...customer } as Customer;
    this.customers.set(id, updated);
    return updated;
  }

  async blockCustomer(id: string, isBlocked: boolean): Promise<Customer | undefined> {
    const existing = this.customers.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, isBlocked } as Customer;
    this.customers.set(id, updated);
    return updated;
  }

  async getCustomerOrders(customerId: string): Promise<Order[]> {
    return Array.from(this.orders.values()).filter((o) => o.customerId === customerId);
  }

  // Orders
  async getOrders(): Promise<OrderWithDetails[]> {
    const orders = Array.from(this.orders.values()).sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
    return orders.map((o) => ({
      ...o,
      customer: this.customers.get(o.customerId),
      items: Array.from(this.orderItems.values())
        .filter((item) => item.orderId === o.id)
        .map((item) => ({
          ...item,
          product: this.products.get(item.productId),
        })),
    }));
  }

  async getOrder(id: string): Promise<OrderWithDetails | undefined> {
    const order = this.orders.get(id);
    if (!order) return undefined;
    return {
      ...order,
      customer: this.customers.get(order.customerId),
      items: Array.from(this.orderItems.values())
        .filter((item) => item.orderId === order.id)
        .map((item) => ({
          ...item,
          product: this.products.get(item.productId),
        })),
    };
  }

  async getRecentOrders(limit: number = 5): Promise<Order[]> {
    return Array.from(this.orders.values())
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, limit);
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const id = randomUUID();
    const orderNumber = `FL-${this.orderCounter++}`;
    const newOrder: Order = {
      ...order,
      id,
      orderNumber,
      status: order.status || "new",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Order;
    this.orders.set(id, newOrder);
    return newOrder;
  }

  async updateOrderStatus(id: string, status: string): Promise<Order | undefined> {
    const existing = this.orders.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, status, updatedAt: new Date() } as Order;
    this.orders.set(id, updated);
    return updated;
  }

  async createOrderItem(item: InsertOrderItem): Promise<OrderItem> {
    const id = randomUUID();
    const newItem: OrderItem = { ...item, id };
    this.orderItems.set(id, newItem);
    return newItem;
  }

  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    return Array.from(this.orderItems.values()).filter((item) => item.orderId === orderId);
  }

  // Settings
  async getSettings(): Promise<Settings[]> {
    return Array.from(this.settings.values());
  }

  async getSetting(key: string): Promise<Settings | undefined> {
    return this.settings.get(key);
  }

  async updateSetting(key: string, value: string): Promise<Settings> {
    const existing = this.settings.get(key);
    if (existing) {
      const updated = { ...existing, value };
      this.settings.set(key, updated);
      return updated;
    }
    const id = randomUUID();
    const newSetting: Settings = { id, key, value, description: null };
    this.settings.set(key, newSetting);
    return newSetting;
  }

  async updateSettingsBulk(settings: { key: string; value: string }[]): Promise<Settings[]> {
    const result: Settings[] = [];
    for (const s of settings) {
      result.push(await this.updateSetting(s.key, s.value));
    }
    return result;
  }

  // Analytics
  async getDashboardStats(): Promise<DashboardStats> {
    const orders = Array.from(this.orders.values());
    const customers = Array.from(this.customers.values());
    const products = Array.from(this.products.values());
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayOrders = orders.filter((o) => new Date(o.createdAt || 0) >= today);
    const yesterdayStart = new Date(today);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayOrders = orders.filter((o) => {
      const date = new Date(o.createdAt || 0);
      return date >= yesterdayStart && date < today;
    });

    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.totalUah || 0), 0);
    const todayRevenue = todayOrders.reduce((sum, o) => sum + Number(o.totalUah || 0), 0);
    const yesterdayRevenue = yesterdayOrders.reduce((sum, o) => sum + Number(o.totalUah || 0), 0);

    return {
      totalOrders: orders.length,
      totalRevenue,
      totalCustomers: customers.length,
      totalProducts: products.length,
      newOrdersToday: todayOrders.length,
      revenueToday: todayRevenue,
      ordersChange: yesterdayOrders.length > 0 
        ? Math.round(((todayOrders.length - yesterdayOrders.length) / yesterdayOrders.length) * 100)
        : todayOrders.length > 0 ? 100 : 0,
      revenueChange: yesterdayRevenue > 0
        ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100)
        : todayRevenue > 0 ? 100 : 0,
    };
  }

  async getTopProducts(limit: number = 10): Promise<TopProduct[]> {
    const productSales = new Map<string, { totalSold: number; revenue: number }>();
    
    Array.from(this.orderItems.values()).forEach((item) => {
      const existing = productSales.get(item.productId) || { totalSold: 0, revenue: 0 };
      productSales.set(item.productId, {
        totalSold: existing.totalSold + item.quantity,
        revenue: existing.revenue + Number(item.totalUah || 0),
      });
    });

    const products = Array.from(this.products.values());
    return products
      .map((p) => {
        const sales = productSales.get(p.id) || { totalSold: 0, revenue: 0 };
        return {
          id: p.id,
          name: p.name,
          variety: p.variety,
          totalSold: sales.totalSold,
          revenue: sales.revenue,
        };
      })
      .filter((p) => p.totalSold > 0)
      .sort((a, b) => b.totalSold - a.totalSold)
      .slice(0, limit);
  }

  async getTopCustomers(limit: number = 10): Promise<TopCustomer[]> {
    return Array.from(this.customers.values())
      .map((c) => ({
        id: c.id,
        name: c.name,
        shopName: c.shopName || "",
        totalOrders: c.totalOrders || 0,
        totalSpent: Number(c.totalSpent || 0),
      }))
      .filter((c) => c.totalOrders > 0)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, limit);
  }

  async getSalesByCountry(): Promise<{ country: string; sales: number }[]> {
    const countrySales = new Map<string, number>();
    
    Array.from(this.orderItems.values()).forEach((item) => {
      const product = this.products.get(item.productId);
      if (product) {
        const country = this.countries.get(product.countryId);
        if (country) {
          const existing = countrySales.get(country.name) || 0;
          countrySales.set(country.name, existing + Number(item.totalUah || 0));
        }
      }
    });

    return Array.from(countrySales.entries())
      .map(([country, sales]) => ({ country, sales }))
      .sort((a, b) => b.sales - a.sales);
  }

  async getSalesTrend(period: string): Promise<{ date: string; sales: number; orders: number }[]> {
    const days = period === "week" ? 7 : period === "month" ? 30 : period === "quarter" ? 90 : 365;
    const result: { date: string; sales: number; orders: number }[] = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const dayOrders = Array.from(this.orders.values()).filter((o) => {
        const orderDate = new Date(o.createdAt || 0);
        return orderDate >= date && orderDate < nextDate;
      });
      
      result.push({
        date: date.toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit" }),
        sales: dayOrders.reduce((sum, o) => sum + Number(o.totalUah || 0), 0),
        orders: dayOrders.length,
      });
    }
    
    return result;
  }
}

export const storage = new MemStorage();
