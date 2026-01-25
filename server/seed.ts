import { db } from "./db";
import { countries, flowerTypes, settings } from "@shared/schema";

async function seed() {
  console.log("Seeding database...");

  const existingSettings = await db.select().from(settings);
  if (existingSettings.length === 0) {
    console.log("Seeding settings...");
    await db.insert(settings).values([
      { key: "usd_to_uah_rate", value: "41.50", description: "Курс USD/UAH" },
      { key: "min_order_amount", value: "5000", description: "Мінімальна сума замовлення" },
      { key: "wholesale_discount", value: "5", description: "Знижка для великого опту (%)" },
      { key: "loyalty_points_rate", value: "1000", description: "Грн на 1 бал" },
      { key: "auto_exchange_rate", value: "false", description: "Автоматичний курс" },
      { key: "notifications_enabled", value: "true", description: "Push-сповіщення" },
    ]);
  }

  const existingCountries = await db.select().from(countries);
  if (existingCountries.length === 0) {
    console.log("Seeding countries...");
    await db.insert(countries).values([
      { code: "KE", name: "Kenya", flag: "KE" },
      { code: "EC", name: "Ecuador", flag: "EC" },
      { code: "CO", name: "Colombia", flag: "CO" },
      { code: "IT", name: "Italy", flag: "IT" },
      { code: "NL", name: "Netherlands", flag: "NL" },
      { code: "CL", name: "Chile", flag: "CL" },
    ]);
  }

  const existingFlowerTypes = await db.select().from(flowerTypes);
  if (existingFlowerTypes.length === 0) {
    console.log("Seeding flower types...");
    await db.insert(flowerTypes).values([
      { name: "Троянда", category: "single" },
      { name: "Кущова троянда", category: "spray" },
      { name: "Хризантема", category: "spray" },
      { name: "Гербера", category: "single" },
      { name: "Тюльпан", category: "single" },
      { name: "Еустома", category: "single" },
      { name: "Гортензія", category: "single" },
    ]);
  }

  console.log("Seeding complete!");
}

seed().catch(console.error);
