import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { bot, sendBulkNotification } from "./telegram";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import { 
  insertCountrySchema, 
  insertPlantationSchema, 
  insertFlowerTypeSchema,
  insertProductSchema,
  insertCustomerSchema,
  insertOrderSchema,
} from "@shared/schema";

// Configure multer for file uploads
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage_multer = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'product-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage_multer,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit for images
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
  }
});

// Video upload config - larger file size limit with strict filtering
const uploadVideo = multer({ 
  storage: storage_multer,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit for videos
  fileFilter: (req, file, cb) => {
    // Strict video type whitelist - require BOTH extension AND mimetype to match
    const allowedVideo: Record<string, string[]> = {
      '.mp4': ['video/mp4'],
      '.mov': ['video/quicktime'],
      '.avi': ['video/x-msvideo', 'video/avi'],
      '.webm': ['video/webm'],
      '.mkv': ['video/x-matroska']
    };
    const ext = path.extname(file.originalname).toLowerCase();
    const validMimes = allowedVideo[ext];
    if (validMimes && validMimes.includes(file.mimetype)) {
      return cb(null, true);
    }
    cb(new Error('Invalid video file type. Allowed: MP4, MOV, AVI, WEBM, MKV'));
  }
});

// Validation middleware helper
function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: any, res: any, next: any) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: result.error.flatten() 
      });
    }
    req.validatedBody = result.data;
    next();
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Serve uploaded files (in development; production handled by static.ts)

  // Single file upload
  app.post("/api/upload", upload.single('image'), (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const url = `/uploads/${file.filename}`;
      res.json({ url });
    } catch (error) {
      res.status(500).json({ error: "Upload failed" });
    }
  });

  // Multiple files upload
  app.post("/api/upload-multiple", upload.array('images', 10), (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }
      const urls = files.map(file => `/uploads/${file.filename}`);
      res.json({ urls });
    } catch (error) {
      res.status(500).json({ error: "Upload failed" });
    }
  });

  // Video upload
  app.post("/api/upload-video", uploadVideo.single('video'), (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No video uploaded" });
      }
      const url = `/uploads/${file.filename}`;
      res.json({ url });
    } catch (error) {
      res.status(500).json({ error: "Video upload failed" });
    }
  });

  // Multiple videos upload
  app.post("/api/upload-videos", uploadVideo.array('videos', 5), (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No videos uploaded" });
      }
      const urls = files.map(file => `/uploads/${file.filename}`);
      res.json({ urls });
    } catch (error) {
      res.status(500).json({ error: "Videos upload failed" });
    }
  });

  // Dashboard
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to get stats" });
    }
  });

  // Countries
  app.get("/api/countries", async (req, res) => {
    try {
      const countries = await storage.getCountries();
      res.json(countries);
    } catch (error) {
      res.status(500).json({ error: "Failed to get countries" });
    }
  });

  app.post("/api/countries", async (req, res) => {
    try {
      const result = insertCountrySchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Validation failed", details: result.error.flatten() });
      }
      const country = await storage.createCountry(result.data);
      res.status(201).json(country);
    } catch (error) {
      res.status(500).json({ error: "Failed to create country" });
    }
  });

  app.patch("/api/countries/:id", async (req, res) => {
    try {
      const country = await storage.updateCountry(req.params.id, req.body);
      if (!country) {
        return res.status(404).json({ error: "Country not found" });
      }
      res.json(country);
    } catch (error) {
      res.status(500).json({ error: "Failed to update country" });
    }
  });

  app.delete("/api/countries/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteCountry(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Country not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete country" });
    }
  });

  // Plantations
  app.get("/api/plantations", async (req, res) => {
    try {
      const plantations = await storage.getPlantations();
      res.json(plantations);
    } catch (error) {
      res.status(500).json({ error: "Failed to get plantations" });
    }
  });

  app.post("/api/plantations", async (req, res) => {
    try {
      const result = insertPlantationSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Validation failed", details: result.error.flatten() });
      }
      const plantation = await storage.createPlantation(result.data);
      res.status(201).json(plantation);
    } catch (error) {
      res.status(500).json({ error: "Failed to create plantation" });
    }
  });

  app.patch("/api/plantations/:id", async (req, res) => {
    try {
      const plantation = await storage.updatePlantation(req.params.id, req.body);
      if (!plantation) {
        return res.status(404).json({ error: "Plantation not found" });
      }
      res.json(plantation);
    } catch (error) {
      res.status(500).json({ error: "Failed to update plantation" });
    }
  });

  app.delete("/api/plantations/:id", async (req, res) => {
    try {
      const deleted = await storage.deletePlantation(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Plantation not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete plantation" });
    }
  });

  // Flower Types
  app.get("/api/flower-types", async (req, res) => {
    try {
      const flowerTypes = await storage.getFlowerTypes();
      res.json(flowerTypes);
    } catch (error) {
      res.status(500).json({ error: "Failed to get flower types" });
    }
  });

  app.post("/api/flower-types", async (req, res) => {
    try {
      const result = insertFlowerTypeSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Validation failed", details: result.error.flatten() });
      }
      const flowerType = await storage.createFlowerType(result.data);
      res.status(201).json(flowerType);
    } catch (error) {
      res.status(500).json({ error: "Failed to create flower type" });
    }
  });

  app.patch("/api/flower-types/:id", async (req, res) => {
    try {
      const flowerType = await storage.updateFlowerType(req.params.id, req.body);
      if (!flowerType) {
        return res.status(404).json({ error: "Flower type not found" });
      }
      res.json(flowerType);
    } catch (error) {
      res.status(500).json({ error: "Failed to update flower type" });
    }
  });

  app.delete("/api/flower-types/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteFlowerType(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Flower type not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete flower type" });
    }
  });

  // Products
  app.get("/api/products", async (req, res) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: "Failed to get products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ error: "Failed to get product" });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      // Clean up data - handle date fields that come as strings
      const productData = { ...req.body };
      
      // Convert date strings to Date objects
      if (productData.expectedDate && typeof productData.expectedDate === 'string') {
        productData.expectedDate = productData.expectedDate ? new Date(productData.expectedDate) : null;
      }
      if (productData.promoEndDate && typeof productData.promoEndDate === 'string') {
        productData.promoEndDate = productData.promoEndDate ? new Date(productData.promoEndDate) : null;
      }
      
      // Handle empty values
      if (productData.priceUsd === "" || productData.priceUsd === undefined) {
        productData.priceUsd = null;
      }
      if (productData.plantationId === "" || productData.plantationId === undefined) {
        productData.plantationId = null;
      }
      if (!productData.promoEndDate || productData.promoEndDate === "") {
        productData.promoEndDate = null;
      }
      if (!productData.expectedDate || productData.expectedDate === "") {
        productData.expectedDate = null;
      }
      
      const result = insertProductSchema.safeParse(productData);
      if (!result.success) {
        return res.status(400).json({ error: "Validation failed", details: result.error.flatten() });
      }
      const product = await storage.createProduct(result.data);
      res.status(201).json(product);
    } catch (error) {
      console.error("Create product error:", error);
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  app.patch("/api/products/:id", async (req, res) => {
    try {
      // Clean up data - handle empty string values
      const updateData = { ...req.body };
      if (updateData.priceUsd === "" || updateData.priceUsd === undefined) {
        updateData.priceUsd = null;
      }
      if (updateData.priceUah === "" || updateData.priceUah === "0.00") {
        delete updateData.priceUah; // Don't update if empty/zero
      }
      if (updateData.plantationId === "" || updateData.plantationId === undefined) {
        updateData.plantationId = null;
      }
      
      // Handle all timestamp fields - convert strings to Date objects or null
      // Remove createdAt - should never be updated
      delete updateData.createdAt;
      
      // Handle expectedDate
      if ('expectedDate' in updateData) {
        if (!updateData.expectedDate || updateData.expectedDate === "") {
          updateData.expectedDate = null;
        } else if (typeof updateData.expectedDate === 'string') {
          updateData.expectedDate = new Date(updateData.expectedDate);
        }
      }
      
      // Handle promoEndDate
      if ('promoEndDate' in updateData) {
        if (!updateData.promoEndDate || updateData.promoEndDate === "") {
          updateData.promoEndDate = null;
        } else if (typeof updateData.promoEndDate === 'string') {
          updateData.promoEndDate = new Date(updateData.promoEndDate);
        }
      }
      
      const product = await storage.updateProduct(req.params.id, updateData);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Product update error:", error);
      res.status(500).json({ error: "Failed to update product", details: String(error) });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteProduct(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  // Customers
  app.get("/api/customers", async (req, res) => {
    try {
      const customers = await storage.getCustomers();
      res.json(customers);
    } catch (error) {
      res.status(500).json({ error: "Failed to get customers" });
    }
  });

  app.get("/api/customers/:id", async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      res.status(500).json({ error: "Failed to get customer" });
    }
  });

  app.get("/api/customers/:id/orders", async (req, res) => {
    try {
      const orders = await storage.getCustomerOrders(req.params.id);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: "Failed to get customer orders" });
    }
  });

  app.patch("/api/customers/:id/block", async (req, res) => {
    try {
      const { isBlocked } = req.body;
      const customer = await storage.blockCustomer(req.params.id, isBlocked);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      res.status(500).json({ error: "Failed to update customer" });
    }
  });

  app.get("/api/customers/export", async (req, res) => {
    try {
      const customers = await storage.getCustomers();
      const csv = [
        "ID,Name,Shop,Phone,City,Type,Orders,Spent,Points",
        ...customers.map((c) => 
          `${c.id},"${c.name}","${c.shopName || ""}","${c.phone || ""}","${c.city || ""}",${c.customerType},${c.totalOrders},${c.totalSpent},${c.loyaltyPoints}`
        ),
      ].join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=customers.csv");
      res.send(csv);
    } catch (error) {
      res.status(500).json({ error: "Failed to export customers" });
    }
  });

  // Orders
  app.get("/api/orders", async (req, res) => {
    try {
      const orders = await storage.getOrders();
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: "Failed to get orders" });
    }
  });

  app.get("/api/orders/recent", async (req, res) => {
    try {
      const orders = await storage.getRecentOrders(5);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: "Failed to get recent orders" });
    }
  });

  app.get("/api/orders/export", async (req, res) => {
    try {
      const orders = await storage.getOrders();
      const csv = [
        "Order Number,Customer,Status,Total,Date",
        ...orders.map((o) => 
          `${o.orderNumber},"${o.customer?.name || ""}",${o.status},${o.totalUah},${o.createdAt}`
        ),
      ].join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=orders.csv");
      res.send(csv);
    } catch (error) {
      res.status(500).json({ error: "Failed to export orders" });
    }
  });

  app.get("/api/orders/:id", async (req, res) => {
    try {
      const order = await storage.getOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      res.status(500).json({ error: "Failed to get order" });
    }
  });

  app.patch("/api/orders/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      const oldOrder = await storage.getOrder(req.params.id);
      if (!oldOrder) {
        return res.status(404).json({ error: "Order not found" });
      }

      const order = await storage.updateOrderStatus(req.params.id, status);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      // Points logic: only add when status changes TO completed
      if (status === 'completed' && oldOrder.status !== 'completed' && order.customerId) {
        const customer = await storage.getCustomer(order.customerId);
        if (customer) {
          const totalSpentNum = parseFloat(customer.totalSpent || "0") + parseFloat(order.totalUah || "0");
          const totalOrders = (customer.totalOrders || 0) + 1;
          
          // 1 point per 1000 UAH
          const newPoints = Math.floor(parseFloat(order.totalUah || "0") / 1000);
          const loyaltyPoints = (customer.loyaltyPoints || 0) + newPoints;

          // Discount logic: every 10th order
          let nextOrderDiscount = customer.nextOrderDiscount || "0";
          if (totalOrders % 10 === 0) {
            nextOrderDiscount = "1000";
          }
          
          await storage.updateCustomer(customer.id, {
            totalSpent: totalSpentNum.toString(),
            totalOrders,
            loyaltyPoints,
            nextOrderDiscount
          } as any);
          
          // Referral bonus: award 200 UAH to referrer on first completed order
          // Use referralBonusAwarded flag to ensure idempotency (bonus only given once ever)
          if (!customer.referralBonusAwarded && customer.referredBy) {
            try {
              const REFERRAL_BONUS = 200;
              await storage.addReferralBonus(customer.referredBy, REFERRAL_BONUS);
              // Mark as awarded so it can never be given again even if order status changes
              await storage.updateCustomer(customer.id, { referralBonusAwarded: true } as any);
              console.log(`Referral bonus ${REFERRAL_BONUS} UAH given to ${customer.referredBy} for customer ${customer.id}`);
            } catch (e) {
              console.error('Failed to award referral bonus:', e);
            }
          }
          
          // Deduct referral balance that was used for this order (only on first completion)
          const pendingDiscount = parseFloat((order as any).referralDiscountPending || '0');
          if (pendingDiscount > 0 && oldOrder.status !== 'completed') {
            try {
              await storage.useReferralBalance(customer.id, pendingDiscount);
              // Clear the pending amount so it's not deducted again
              await storage.updateOrder(order.id, { referralDiscountPending: '0' } as any);
              console.log(`Referral balance ${pendingDiscount} UAH deducted from customer ${customer.id} for order ${order.id}`);
            } catch (e) {
              console.error('Failed to deduct referral balance:', e);
            }
          }
        }
      }

      // Deduct points and stats if changing FROM completed TO something else (e.g. cancelled)
      if (oldOrder.status === 'completed' && status !== 'completed' && order.customerId) {
        const customer = await storage.getCustomer(order.customerId);
        if (customer) {
          const totalSpentNum = Math.max(0, parseFloat(customer.totalSpent || "0") - parseFloat(order.totalUah || "0"));
          const totalOrders = Math.max(0, (customer.totalOrders || 0) - 1);
          
          // Deduct points
          const pointsToDeduct = Math.floor(parseFloat(order.totalUah || "0") / 1000);
          const loyaltyPoints = Math.max(0, (customer.loyaltyPoints || 0) - pointsToDeduct);

          // Note: We don't easily know if this was a 10th order to reset discount, 
          // but usually status changes from completed are rare.
          
          await storage.updateCustomer(customer.id, {
            totalSpent: totalSpentNum.toString(),
            totalOrders,
            loyaltyPoints
          } as any);
        }
      }
      
      // Send notification if bot is active
      const orderWithDetails = await storage.getOrder(req.params.id) as any;
      if (orderWithDetails?.customer?.telegramId) {
        try {
          const totalUah = parseFloat(orderWithDetails.totalUah).toLocaleString('uk-UA');
          
          // Detailed messages for each status
          const statusMessages: Record<string, string> = {
            new: `🆕 *Нове замовлення*\n\n📦 Замовлення: *${orderWithDetails.orderNumber}*\n💰 Сума: ${totalUah} грн\n\nОчікуйте підтвердження!`,
            confirmed: `✅ *Замовлення підтверджено!*\n\n📦 Замовлення: *${orderWithDetails.orderNumber}*\n💰 Сума: ${totalUah} грн\n\nДякуємо! Ми почнемо підготовку вашого замовлення найближчим часом.`,
            processing: `⚙️ *Замовлення в обробці*\n\n📦 Замовлення: *${orderWithDetails.orderNumber}*\n💰 Сума: ${totalUah} грн\n\nВаше замовлення готується до відправки. Очікуйте сповіщення про відправку!`,
            shipped: `🚚 *Замовлення відправлено!*\n\n📦 Замовлення: *${orderWithDetails.orderNumber}*\n💰 Сума: ${totalUah} грн\n\n📍 Ваше замовлення вже в дорозі! Очікуйте доставку найближчим часом.\n\nЯкщо є питання - зверніться до менеджера.`,
            completed: `✨ *Замовлення завершено!*\n\n📦 Замовлення: *${orderWithDetails.orderNumber}*\n💰 Сума: ${totalUah} грн\n\n🌹 Дякуємо за покупку!\nСподіваємось, квіти вам сподобались.\n\nЧекаємо на вас знову!`,
            cancelled: `❌ *Замовлення скасовано*\n\n📦 Замовлення: *${orderWithDetails.orderNumber}*\n💰 Сума: ${totalUah} грн\n\nЯкщо у вас є питання, зверніться до менеджера.`
          };
          
          const message = statusMessages[status] || `🔔 Статус замовлення ${orderWithDetails.orderNumber} змінено`;
          await bot?.telegram.sendMessage(orderWithDetails.customer.telegramId, message, { parse_mode: 'Markdown' });
        } catch (e) {
          console.error("Failed to send telegram notification", e);
        }
      }

      res.json(order);
    } catch (error) {
      res.status(500).json({ error: "Failed to update order status" });
    }
  });

  // Settings
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to get settings" });
    }
  });

  app.post("/api/settings/bulk", async (req, res) => {
    try {
      const { settings } = req.body;
      const updated = await storage.updateSettingsBulk(settings);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  app.post("/api/settings/fetch-exchange-rate", async (req, res) => {
    try {
      // Mock exchange rate fetch - in real app would call external API
      const rate = "41.50";
      await storage.updateSetting("usd_to_uah_rate", rate);
      res.json({ rate });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch exchange rate" });
    }
  });

  // Analytics
  app.get("/api/analytics/top-products", async (req, res) => {
    try {
      const topProducts = await storage.getTopProducts(10);
      res.json(topProducts);
    } catch (error) {
      res.status(500).json({ error: "Failed to get top products" });
    }
  });

  app.get("/api/analytics/top-customers", async (req, res) => {
    try {
      const topCustomers = await storage.getTopCustomers(10);
      res.json(topCustomers);
    } catch (error) {
      res.status(500).json({ error: "Failed to get top customers" });
    }
  });

  app.get("/api/analytics/sales-by-country", async (req, res) => {
    try {
      const salesByCountry = await storage.getSalesByCountry();
      res.json(salesByCountry);
    } catch (error) {
      res.status(500).json({ error: "Failed to get sales by country" });
    }
  });

  app.get("/api/analytics/sales-trend", async (req, res) => {
    try {
      const period = (req.query.period as string) || "month";
      const salesTrend = await storage.getSalesTrend(period);
      res.json(salesTrend);
    } catch (error) {
      res.status(500).json({ error: "Failed to get sales trend" });
    }
  });

  // Notifications
  app.post("/api/notifications/send", async (req, res) => {
    try {
      const { message, targetGroup, language } = req.body;
      const customers = await storage.getCustomers();
      const targeted = targetGroup === "all" 
        ? customers 
        : customers.filter((c) => c.customerType === targetGroup);
      
      const telegramIds = targeted
        .map(c => c.telegramId)
        .filter((id): id is string => !!id);

      if (telegramIds.length > 0) {
        await sendBulkNotification(message, telegramIds);
      }

      res.json({ sent: targeted.length, message: "Notifications sent" });
    } catch (error) {
      res.status(500).json({ error: "Failed to send notifications" });
    }
  });

  return httpServer;
}
