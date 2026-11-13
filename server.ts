import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { parseCommandMultilingual } from './src/utils/multilingualParser';
import { AssistantLanguage } from './src/types';

process.env.VITE_CONFIG_NATIVE_IGNORE_WARNING = 'true';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function buildRuleBasedInsights(payload: any) {
  const currency = payload?.shopContext?.currency || '₹';
  const today = payload?.periodSummaries?.today || { revenue: 0, grossProfit: 0, billsCount: 0 };
  const week = payload?.periodSummaries?.week || { revenue: 0, grossProfit: 0, billsCount: 0 };
  const month = payload?.periodSummaries?.month || { revenue: 0, grossProfit: 0, billsCount: 0 };
  const current = payload?.analyticsSummary || {};
  const topSelling = payload?.topSelling || [];
  const slowMoving = payload?.slowMoving || [];
  const lowStockItems = payload?.lowStockItems || [];
  const incompleteCostCount = current.incompleteCostItemsCount || 0;

  const hasSales = (current.totalTransactions || 0) > 0;
  const executiveSummary = hasSales
    ? `Across ${current.totalTransactions} bills in the selected period, your shop generated ${currency}${current.totalRevenue} in revenue with ${currency}${current.totalCOGS} COGS and ${currency}${current.grossProfit} gross profit (${current.grossMarginPercent}% gross margin). Today's revenue is ${currency}${today.revenue} across ${today.billsCount} bills.`
    : `No sales transactions were recorded in the selected date range yet. Inventory currently tracks ${payload?.inventoryCount || 0} products (${lowStockItems.length} needing restock).`;

  const keyHighlights: string[] = [
    `Daily Revenue: ${currency}${today.revenue} (${today.billsCount} bills) | Weekly: ${currency}${week.revenue} | Monthly: ${currency}${month.revenue}`,
  ];

  if (topSelling.length > 0) {
    keyHighlights.push(
      `Top Seller: ${topSelling[0].name} (${topSelling[0].qtySold} ${topSelling[0].unit} sold, ${currency}${topSelling[0].grossProfit} gross profit).`
    );
  }
  if (current.totalDiscounts > 0) {
    keyHighlights.push(
      `Discounts Given: ${currency}${current.totalDiscounts} reduced gross margin from gross sales of ${currency}${current.grossSalesBeforeDiscount}.`
    );
  }
  if (current.creditPendingAmount > 0) {
    keyHighlights.push(
      `Pending Udhaar / Khata credit stands at ${currency}${current.creditPendingAmount} across ${current.creditPendingCount || 0} bills.`
    );
  }

  const stockManagementSuggestions: string[] = [];
  if (lowStockItems.length > 0) {
    const topLow = lowStockItems.slice(0, 3).map((i: any) => `${i.name} (${i.stockQuantity} ${i.unit})`).join(', ');
    stockManagementSuggestions.push(
      `Prioritize restocking ${lowStockItems.length} critical item(s): ${topLow} to prevent missed daily sales.`
    );
  } else {
    stockManagementSuggestions.push(
      'All monitored inventory items are currently above their minimum stock thresholds.'
    );
  }

  if (slowMoving.length > 0) {
    const totalLocked = slowMoving.reduce((acc: number, s: any) => acc + (s.stockValue || 0), 0);
    stockManagementSuggestions.push(
      `${slowMoving.length} slow-moving product(s) (e.g. ${slowMoving[0].name}) hold ${currency}${totalLocked.toFixed(0)} in inventory capital. Consider smaller reorder batches or shelf-front placement.`
    );
  }

  const profitabilitySuggestions: string[] = [];
  if (hasSales && current.grossMarginPercent < 15) {
    profitabilitySuggestions.push(
      `Average gross margin is ${current.grossMarginPercent}%. Review supplier purchase cost on high-volume staples and pair low-margin staples with higher-margin snacks/personal care items.`
    );
  } else if (hasSales) {
    profitabilitySuggestions.push(
      `Healthy gross margin at ${current.grossMarginPercent}%. Keep top-selling items consistently stocked to protect daily cashflow.`
    );
  } else {
    profitabilitySuggestions.push(
      'Record daily bills via POS or Voice Assistant to unlock margin and velocity optimization insights.'
    );
  }

  if (current.creditPendingAmount > 0) {
    profitabilitySuggestions.push(
      `Send polite payment reminders for ${currency}${current.creditPendingAmount} in pending Khata/Udhaar bills to strengthen working capital.`
    );
  }

  const warnings: string[] = [];
  if (incompleteCostCount > 0) {
    warnings.push(`${incompleteCostCount} sold line item(s) lacked recorded purchase cost; COGS may be understated.`);
  }
  if (current.operatingExpenses === null || current.operatingExpenses === undefined) {
    warnings.push('Net profit is excluded because operating expenses (rent, utilities, staff) are not recorded.');
  }

  return {
    executiveSummary,
    keyHighlights,
    stockManagementSuggestions,
    profitabilitySuggestions,
    warnings,
    generatedAt: new Date().toISOString(),
  };
}

async function startServer() {
  const app = express();

  let PORT = 3000;
  const portArgIndex = process.argv.indexOf('--port');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    PORT = parseInt(process.argv[portArgIndex + 1]);
  } else if (process.env.PORT && process.env.PORT !== '8080') {
    PORT = parseInt(process.env.PORT);
  }

  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasApiKey: !!process.env.GEMINI_API_KEY,
      time: new Date().toISOString(),
    });
  });

  // Multilingual Voice & Text Shopkeeper Command endpoint (Kannada, Hindi, English)
  app.post('/api/gemini/command', async (req, res) => {
    const { command, language, inventoryContext, salesContext, shopContext } = req.body;

    if (!command || typeof command !== 'string' || !command.trim()) {
      res.status(400).json({ error: 'Command text is required' });
      return;
    }

    const selectedLang: AssistantLanguage =
      language === 'kn' || language === 'hi' || language === 'en' ? language : 'en';

    const languageNameMap: Record<AssistantLanguage, string> = {
      kn: 'Kannada (ಕನ್ನಡ script)',
      hi: 'Hindi (हिन्दी Devanagari script)',
      en: 'English',
    };

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      const fallbackResult = parseCommandMultilingual(
        command,
        inventoryContext || [],
        shopContext?.shopName || 'Apna Dukan',
        shopContext?.currency || '₹',
        selectedLang,
        salesContext
      );
      res.json({
        success: true,
        data: fallbackResult,
        mode: 'smart_fallback',
      });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const prompt = `
You are DUKAN AI, an intelligent multilingual retail shopkeeper assistant supporting Kannada (ಕನ್ನಡ), Hindi (हिन्दी), and English (including Kanglish and Hinglish mixed-language speech).

Shopkeeper's input command: "${command}"
Selected response language: ${languageNameMap[selectedLang]} (code: "${selectedLang}")

Current shop context:
- Shop name: "${shopContext?.shopName || 'My Dukan'}"
- Currency: "${shopContext?.currency || '₹'}"
- Today's actual sales summary: ${JSON.stringify(salesContext || { todayRevenue: 0, todayGrossProfit: 0, todayBillsCount: 0, todayItemsCount: 0 })}

Current shop inventory (match products accurately using English, Kannada, or Hindi names — e.g. ಅಕ್ಕಿ/चावल = Rice, ಉಪ್ಪು/नमक = Salt, ಹಾಲು/दूध = Milk, ಹಿಟ್ಟು/आटा = Atta, ಸಕ್ಕರೆ/चीनी = Sugar, ಎಣ್ಣೆ/तेल = Oil, ಬೆಣ್ಣೆ/मक्खन = Butter):
${JSON.stringify(inventoryContext || [], null, 2)}

Map the command to ONE of these intents:
1. "RECORD_SALE": Selling items to customer (e.g., "Sold 2 packets of salt", "ಎರಡು ಪ್ಯಾಕೆಟ್ ಉಪ್ಪು ಮಾರಾಟ ಆಯಿತು", "दो पैकेट नमक बेच दिया").
2. "ADD_PRODUCT": Adding new product or stock to inventory (e.g., "Add 2 kg rice to inventory", "ಎರಡು ಕೆಜಿ ಅಕ್ಕಿ ಸ್ಟಾಕ್ಗೆ ಸೇರಿಸು", "दो किलो चावल स्टॉक में जोड़ो").
3. "UPDATE_PRODUCT": Updating stock or price of an existing product.
4. "DELETE_PRODUCT": Deleting a product.
5. "QUERY_INFO": Checking available stock, low-stock / out-of-stock items ("Which products are low in stock?", "ಯಾವ ವಸ್ತುಗಳ ಸ್ಟಾಕ್ ಕಡಿಮೆ ಇದೆ?", "कौन से सामान का स्टॉक कम है?"), checking daily sales ("Show today's sales", "ಇವತ್ತು ಎಷ್ಟು ಸೇಲ್ ಆಗಿದೆ?", "आज कितनी बिक्री हुई?"), or checking product price.
6. "CONVERSATIONAL": Greetings or general chat.

CRITICAL RULES:
- ALWAYS write "speechResponse" and "queryAnswer" in the selected language: ${languageNameMap[selectedLang]}.
- ALWAYS provide "interpretedCommand" in concise English summarizing the structured interpretation (e.g. "Add 2 kg India Gate Basmati Rice to inventory" or "Sell 2 pkt Tata Salt for ₹56 (Cash)").
- When recording a sale or checking stock/price, match against "inventoryContext" carefully and set "matchedProductId" to the exact product "id" whenever a match exists.
- If a sale or product action is ambiguous (unclear product name, multiple equally likely products without exact match, unclear quantity, or requested sale quantity exceeds current stockQuantity), set "isAmbiguous": true and explain clearly in "ambiguityReason" (in ${languageNameMap[selectedLang]}).
- For daily sales queries, use the EXACT numbers from Today's actual sales summary above. NEVER invent or fabricate sales figures.
- For low-stock queries, inspect inventoryContext where stockQuantity <= minStockThreshold.
- For ADD_PRODUCT, if price is not mentioned and an existing product matches in inventoryContext, reuse its price; otherwise estimate a realistic Indian retail price in INR and set costPrice ~ 80% of sellingPrice.
`;

      const commandResponseSchema = {
        type: Type.OBJECT,
        properties: {
          intent: {
            type: Type.STRING,
            description: 'Must be one of: RECORD_SALE, ADD_PRODUCT, UPDATE_PRODUCT, DELETE_PRODUCT, QUERY_INFO, CONVERSATIONAL',
          },
          confidence: { type: Type.NUMBER },
          interpretedCommand: {
            type: Type.STRING,
            description: 'Clear structured summary of the interpreted command in English',
          },
          isAmbiguous: {
            type: Type.BOOLEAN,
            description: 'True if product match, quantity, or stock availability is uncertain/ambiguous',
          },
          ambiguityReason: {
            type: Type.STRING,
            description: 'Explanation in the selected language if isAmbiguous is true',
          },
          speechResponse: {
            type: Type.STRING,
            description: 'Natural, concise response in the selected language suitable for Text-to-Speech',
          },
          saleData: {
            type: Type.OBJECT,
            properties: {
              customerName: { type: Type.STRING },
              customerPhone: { type: Type.STRING },
              paymentMode: { type: Type.STRING },
              paymentStatus: { type: Type.STRING },
              notes: { type: Type.STRING },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    matchedProductId: { type: Type.STRING },
                    productName: { type: Type.STRING },
                    quantity: { type: Type.NUMBER },
                    unit: { type: Type.STRING },
                    unitPrice: { type: Type.NUMBER },
                  },
                  required: ['productName', 'quantity'],
                },
              },
            },
          },
          productData: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              category: { type: Type.STRING },
              costPrice: { type: Type.NUMBER },
              sellingPrice: { type: Type.NUMBER },
              stockQuantity: { type: Type.NUMBER },
              minStockThreshold: { type: Type.NUMBER },
              unit: { type: Type.STRING },
              barcode: { type: Type.STRING },
            },
          },
          updateData: {
            type: Type.OBJECT,
            properties: {
              matchedProductId: { type: Type.STRING },
              productName: { type: Type.STRING },
              stockAdjustmentType: { type: Type.STRING },
              stockQuantity: { type: Type.NUMBER },
              newSellingPrice: { type: Type.NUMBER },
              newCostPrice: { type: Type.NUMBER },
            },
          },
          deleteData: {
            type: Type.OBJECT,
            properties: {
              matchedProductId: { type: Type.STRING },
              productName: { type: Type.STRING },
            },
          },
          queryAnswer: {
            type: Type.STRING,
            description: 'Detailed answer in the selected language for QUERY_INFO',
          },
        },
        required: ['intent', 'speechResponse'],
      };

      let response: any;
      let usedModel = 'gemini_3.8_flash';
      try {
        response = await Promise.race([
          ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
            config: {
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              responseMimeType: 'application/json',
              responseSchema: commandResponseSchema,
            },
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Primary model timeout')), 6000)),
        ]);
      } catch {
        usedModel = 'gemini_3.1_flash_lite';
        response = await Promise.race([
          ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema: commandResponseSchema,
            },
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Secondary model timeout')), 6000)),
        ]);
      }

      const parsedData = JSON.parse(response.text || '{}');
      parsedData.language = selectedLang;

      if (parsedData.intent) {
        const upper = String(parsedData.intent).toUpperCase();
        if (upper === 'ADD_INVENTORY' || upper === 'ADD_ITEM' || upper === 'NEW_PRODUCT') {
          parsedData.intent = 'ADD_PRODUCT';
        } else if (upper === 'SELL' || upper === 'NEW_SALE') {
          parsedData.intent = 'RECORD_SALE';
        } else {
          parsedData.intent = upper;
        }
      }

      if (parsedData.intent === 'ADD_PRODUCT' && parsedData.productData) {
        if (!parsedData.productData.sellingPrice || parsedData.productData.sellingPrice <= 0) {
          const lowerName = (parsedData.productData.name || '').toLowerCase();
          if (lowerName.includes('salt')) parsedData.productData.sellingPrice = 28;
          else if (lowerName.includes('atta')) parsedData.productData.sellingPrice = 245;
          else if (lowerName.includes('rice')) parsedData.productData.sellingPrice = 75;
          else if (lowerName.includes('milk')) parsedData.productData.sellingPrice = 28;
          else parsedData.productData.sellingPrice = 50;
        }
        if (!parsedData.productData.costPrice || parsedData.productData.costPrice <= 0) {
          parsedData.productData.costPrice = Math.max(1, Math.round(parsedData.productData.sellingPrice * 0.8));
        }
      }

      res.json({
        success: true,
        data: parsedData,
        mode: usedModel,
      });
    } catch (error: any) {
      console.warn('Gemini command error/timeout, using multilingual smart fallback:', error.message);
      const fallbackResult = parseCommandMultilingual(
        command,
        inventoryContext || [],
        shopContext?.shopName || 'Apna Dukan',
        shopContext?.currency || '₹',
        selectedLang,
        salesContext
      );
      res.json({
        success: true,
        data: fallbackResult,
        mode: 'smart_fallback',
      });
    }
  });

  // AI-Powered Business Insights & Profit Analytics endpoint (Gemini 3.8 Flash)
  app.post('/api/gemini/insights', async (req, res) => {
    const payload = req.body;
    if (!payload || !payload.analyticsSummary) {
      res.status(400).json({ error: 'Analytics summary payload is required' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      res.json({
        success: true,
        data: { ...buildRuleBasedInsights(payload), mode: 'smart_fallback' },
      });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const prompt = `
You are a senior retail business advisor for LUMORA Dukaan AI.
Analyze the shopkeeper's ACTUAL sales, COGS, gross profit, and inventory metrics below and provide concise, practical business insights.

STRICT DATA INTEGRITY RULES:
1. Use ONLY the actual numbers provided below. NEVER invent, estimate, or fabricate sales or products.
2. Distinguish clearly between Revenue (Sales Total), Cost of Goods Sold (COGS), Gross Profit (Revenue - COGS), and Net Profit.
3. Do NOT claim a Net Profit figure unless operatingExpenses is explicitly a non-null number in the data.
4. Keep advice actionable, specific to small/medium Kirana & retail shopkeepers, referencing actual product names from topSelling, slowMoving, and lowStockItems.

Shop Metrics Data:
${JSON.stringify(payload, null, 2)}
`;

      const insightsResponseSchema = {
        type: Type.OBJECT,
        properties: {
          executiveSummary: {
            type: Type.STRING,
            description: '2-3 sentence summary grounded strictly in the provided revenue, COGS, and gross profit figures',
          },
          keyHighlights: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '3-4 concise bullet highlights citing real numbers and top products',
          },
          stockManagementSuggestions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '2-3 practical stock actions covering low-stock items and slow-moving stock capital',
          },
          profitabilitySuggestions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '2-3 practical suggestions to improve gross margin, reduce discount leakage, or collect credit/Udhaar',
          },
          warnings: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Any data caveats such as missing operating expenses or incomplete cost data',
          },
        },
        required: ['executiveSummary', 'keyHighlights', 'stockManagementSuggestions', 'profitabilitySuggestions'],
      };

      let response: any;
      let usedModel = 'gemini_3.8_flash';
      try {
        response = await Promise.race([
          ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
            config: {
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              responseMimeType: 'application/json',
              responseSchema: insightsResponseSchema,
            },
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Primary insights timeout')), 6000)),
        ]);
      } catch {
        usedModel = 'gemini_3.1_flash_lite';
        response = await Promise.race([
          ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema: insightsResponseSchema,
            },
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Secondary insights timeout')), 6000)),
        ]);
      }

      const parsed = JSON.parse(response.text || '{}');

      res.json({
        success: true,
        data: {
          ...parsed,
          generatedAt: new Date().toISOString(),
          mode: usedModel,
        },
      });
    } catch (error: any) {
      console.warn('Gemini insights error, using deterministic insights:', error.message);
      res.json({
        success: true,
        data: { ...buildRuleBasedInsights(payload), mode: 'smart_fallback' },
      });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DUKAN AI Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
