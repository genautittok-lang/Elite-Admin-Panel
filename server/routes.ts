import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { 
  insertCountrySchema, 
  insertPlantationSchema, 
  insertFlowerTypeSchema,
  insertProductSchema,
  insertCustomerSchema,
  insertOrderSchema,
} from "@shared/schema";

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
      const result = insertProductSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Validation failed", details: result.error.flatten() });
      }
      const product = await storage.createProduct(result.data);
      res.status(201).json(product);
    } catch (error) {
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  app.patch("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.updateProduct(req.params.id, req.body);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ error: "Failed to update product" });
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
      const order = await storage.updateOrderStatus(req.params.id, status);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
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
      // Mock sending - in real app would integrate with Telegram bot
      const customers = await storage.getCustomers();
      const targeted = targetGroup === "all" 
        ? customers 
        : customers.filter((c) => c.customerType === targetGroup);
      res.json({ sent: targeted.length, message: "Notifications sent" });
    } catch (error) {
      res.status(500).json({ error: "Failed to send notifications" });
    }
  });

  return httpServer;
}
