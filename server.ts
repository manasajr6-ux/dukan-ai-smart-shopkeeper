import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

process.env.VITE_CONFIG_NATIVE_IGNORE_WARNING = 'true';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Intelligent fallback parser when GEMINI_API_KEY is slow or unavailable
function parseCommandRuleBased(command: string, inventory: any[], shopName: string, currency: string) {
  const lower = command.toLowerCase().trim();

  // 1. Check for sales intent
  if (
    lower.includes('sold') ||
    lower.includes('sell') ||
    lower.includes('sale') ||
    lower.includes('becha') ||
    lower.includes('bik gaya') ||
    lower.includes('bika') ||
    lower.includes('khareeda') ||
    lower.includes('bill') ||
    lower.includes('udhar') ||
    lower.includes('khata')
  ) {
    let paymentMode = 'cash';
    if (lower.includes('upi') || lower.includes('qr') || lower.includes('online') || lower.includes('gpay') || lower.includes('phonepe')) {
      paymentMode = 'upi';
    } else if (lower.includes('udhar') || lower.includes('khata') || lower.includes('credit')) {
      paymentMode = 'credit_khata';
    } else if (lower.includes('card')) {
      paymentMode = 'card';
    }

    // Extract customer name if mentioned (e.g., "to Ramesh" or "Ramesh took")
    let customerName = 'Walk-in Customer';
    const toMatch = command.match(/(?:to|ko|customer)\s+([A-Za-z]+)/i);
    const tookMatch = command.match(/^([A-Za-z]+)\s+(?:took|bought|ne liya)/i);
    if (toMatch && toMatch[1]) customerName = toMatch[1];
    else if (tookMatch && tookMatch[1]) customerName = tookMatch[1];

    // Attempt to match items in inventory
    const matchedItems: any[] = [];
    inventory.forEach((item) => {
      const itemNameLower = item.name.toLowerCase();
      // Look for individual meaningful words from the product name
      const words = itemNameLower.split(/[\s,()\-]+/).filter((w: string) => w.length > 2);
      const matchedWord = words.find((w: string) => lower.includes(w));

      if (matchedWord) {
        // Regex before the matched word: "4 milk", "2 packets milk", "2 pkt of milk"
        const regexBefore = new RegExp(
          `(\\d+(?:\\.\\d+)?)\\s*(?:kg|pkt|pcs|packet|packets|pack|packs|bottle|bottles|box|boxes|litre|litres|ltr|l|product|products|item|items)?\\s*(?:of)?\\s*${matchedWord}`,
          'i'
        );
        // Regex after the matched word: "milk 4", "milk 2 packets"
        const regexAfter = new RegExp(
          `${matchedWord}\\s*(?:packet|packets|pkt|pcs|product|products|item|items)?\\s*(\\d+(?:\\.\\d+)?)`,
          'i'
        );

        const m = lower.match(regexBefore) || lower.match(regexAfter);
        let quantity = m ? parseFloat(m[1]) : 1;

        // If no direct quantity matched next to the word, check if there is a number at start or after action
        if (!m) {
          const actionNumMatch =
            lower.match(/^(\d+(?:\.\d+)?)/) ||
            lower.match(/(?:sold|sell|becha|bik gaya)\s+(\d+(?:\.\d+)?)/i);
          if (actionNumMatch) {
            quantity = parseFloat(actionNumMatch[1]);
          }
        }

        matchedItems.push({
          matchedProductId: item.id,
          productName: item.name,
          quantity: quantity > 0 ? quantity : 1,
          unit: item.unit,
          unitPrice: item.sellingPrice,
        });
      }
    });

    if (matchedItems.length === 0 && inventory.length > 0) {
      // Default to closest or first item
      const fallbackItem = inventory[0];
      const actionNumMatch = lower.match(/(?:sold|sell|becha|bik gaya)\s+(\d+(?:\\.\d+)?)/i);
      const quantity = actionNumMatch ? parseFloat(actionNumMatch[1]) : 1;

      matchedItems.push({
        matchedProductId: fallbackItem.id,
        productName: fallbackItem.name,
        quantity: quantity > 0 ? quantity : 1,
        unit: fallbackItem.unit,
        unitPrice: fallbackItem.sellingPrice,
      });
    }

    const itemsSummary = matchedItems.map((it) => `${it.quantity} ${it.unit || 'unit'} ${it.productName}`).join(' and ');
    const totalAmount = matchedItems.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0);

    return {
      intent: 'RECORD_SALE',
      confidence: 0.95,
      speechResponse: `Recorded sale of ${itemsSummary} to ${customerName} for ${currency}${totalAmount} via ${paymentMode.replace('_', ' ')}. Inventory has been updated!`,
      saleData: {
        customerName,
        paymentMode,
        paymentStatus: paymentMode === 'credit_khata' ? 'pending_credit' : 'paid',
        items: matchedItems,
      },
    };
  }

  // 2. Check for low stock or restock query (e.g. "Show me products that need restocking", "low stock items", "khatam ho gaya")
  if (
    lower.includes('low stock') ||
    lower.includes('kam stock') ||
    lower.includes('khatam') ||
    lower.includes('out of stock') ||
    lower.includes('restock') ||
    lower.includes('restocking') ||
    lower.includes('need restocking') ||
    lower.includes('needs restocking') ||
    lower.includes('reorder')
  ) {
    const criticalItems = inventory.filter((i) => i.stockQuantity <= (i.minStockThreshold || 5));
    const summaryItems = criticalItems.map((i) => {
      const isOut = i.stockQuantity <= 0;
      const statusLabel = isOut ? 'OUT OF STOCK' : 'LOW STOCK';
      const suggestedReorder = Math.max(i.minStockThreshold * 2 - i.stockQuantity, i.minStockThreshold || 5, 10);
      return {
        ...i,
        statusLabel,
        suggestedReorder,
      };
    });

    const spokenNames = summaryItems
      .slice(0, 4)
      .map((i) => `${i.name} (${i.stockQuantity} ${i.unit || 'unit'} left, suggest reorder +${i.suggestedReorder})`)
      .join('; ');

    return {
      intent: 'QUERY_INFO',
      confidence: 0.95,
      speechResponse: summaryItems.length > 0
        ? `You have ${summaryItems.length} products that need restocking: ${spokenNames}. You can restock directly from your dashboard.`
        : 'All inventory is currently healthy with stock levels above minimum thresholds!',
      queryAnswer: summaryItems.length > 0
        ? `Products Requiring Restock (${summaryItems.length} items):\n` +
          summaryItems
            .map(
              (i) =>
                `• [${i.statusLabel}] ${i.name}: Available ${i.stockQuantity} ${i.unit || 'pcs'} (Min Threshold: ${i.minStockThreshold}) → Suggested Reorder: +${i.suggestedReorder} ${i.unit || 'pcs'}`
            )
            .join('\n')
        : 'All products currently have healthy inventory levels above minimum thresholds.',
    };
  }

  // 3. Check for add product (e.g. "Add 2 kg Tata Salt to my inventory", "Add 50 kg basmati rice at 90 rupees")
  if (lower.startsWith('add') || lower.includes('naya item') || lower.includes('nayi item') || lower.includes('add karo') || lower.includes('nayi entry')) {
    // Extract price if specified with explicit word boundary
    const priceMatch = command.match(/\b(?:at|for|selling\s+price|price|rate|cost|rs\.?|inr|₹)\s*(\d+(?:\.\d+)?)/i);
    let sellingPrice = priceMatch ? parseFloat(priceMatch[1]) : 0;

    // Extract quantity and unit: e.g. "2 kg", "25 packets", "10 pcs", "5 ltr"
    let quantity = 1;
    let unit = 'pcs';
    const qtyUnitRegex = /\b(\d+(?:\.\d+)?)\s*(kg|g|gm|grams|pkt|packet|packets|pcs|piece|pieces|bottle|bottles|box|boxes|litre|litres|ltr|l|can|cans|pouch|pouches)\b/i;
    const qtyUnitMatch = command.match(qtyUnitRegex);

    if (qtyUnitMatch) {
      quantity = parseFloat(qtyUnitMatch[1]);
      const rawUnit = qtyUnitMatch[2].toLowerCase();
      if (rawUnit === 'pkt' || rawUnit === 'packet' || rawUnit === 'packets') unit = 'pkt';
      else if (rawUnit === 'kg') unit = 'kg';
      else if (rawUnit === 'g' || rawUnit === 'gm' || rawUnit === 'grams') unit = 'g';
      else if (rawUnit === 'litre' || rawUnit === 'litres' || rawUnit === 'ltr' || rawUnit === 'l') unit = 'ltr';
      else if (rawUnit === 'bottle' || rawUnit === 'bottles') unit = 'bottle';
      else if (rawUnit === 'box' || rawUnit === 'boxes') unit = 'box';
      else unit = 'pcs';
    } else {
      // Look for plain number after 'add'
      const plainNumMatch = command.match(/^(?:add|naya item|nayi item)\s+(\d+(?:\.\d+)?)\b/i);
      if (plainNumMatch) {
        quantity = parseFloat(plainNumMatch[1]);
      }
    }

    // Clean name: remove "add", quantity+unit, "to my inventory", "to stock", price clauses
    let cleanName = command
      .replace(/^(?:add|naya item|nayi item|add karo)\s+/i, '')
      .replace(qtyUnitRegex, '')
      .replace(/\b(?:to\s+(?:my\s+)?(?:inventory|stock|dukan|store|catalog)|in\s+(?:my\s+)?(?:inventory|stock))\b/gi, '')
      .replace(/\b(?:at|for|selling\s+price|price|rate|cost|rs\.?|inr|₹)\s*\d+(?:\.\d+)?(?:\s*(?:rupees|rs|per\s+\w+))?/gi, '')
      .replace(/^\s*(?:of|a|an)\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanName || cleanName.length < 2) {
      cleanName = 'New Item';
    }

    // Estimate realistic default price if not provided
    if (sellingPrice <= 0) {
      const lowerClean = cleanName.toLowerCase();
      if (lowerClean.includes('salt')) sellingPrice = 28;
      else if (lowerClean.includes('rice')) sellingPrice = 75;
      else if (lowerClean.includes('atta')) sellingPrice = 240;
      else if (lowerClean.includes('sugar')) sellingPrice = 45;
      else if (lowerClean.includes('oil')) sellingPrice = 160;
      else if (lowerClean.includes('milk')) sellingPrice = 30;
      else if (lowerClean.includes('soap')) sellingPrice = 35;
      else sellingPrice = 50;
    }

    const costPrice = Math.max(1, Math.round(sellingPrice * 0.8));
    
    // Determine category
    const lowerClean = cleanName.toLowerCase();
    let category = 'Groceries';
    if (lowerClean.includes('milk') || lowerClean.includes('curd') || lowerClean.includes('paneer') || lowerClean.includes('butter') || lowerClean.includes('cheese') || lowerClean.includes('ghee')) {
      category = 'Dairy';
    } else if (lowerClean.includes('atta') || lowerClean.includes('rice') || lowerClean.includes('dal') || lowerClean.includes('salt') || lowerClean.includes('sugar') || lowerClean.includes('oil')) {
      category = 'Staples';
    } else if (lowerClean.includes('biscuit') || lowerClean.includes('chips') || lowerClean.includes('namkeen') || lowerClean.includes('noodle') || lowerClean.includes('maggi')) {
      category = 'Snacks';
    } else if (lowerClean.includes('tea') || lowerClean.includes('coffee') || lowerClean.includes('juice')) {
      category = 'Beverages';
    } else if (lowerClean.includes('soap') || lowerClean.includes('shampoo') || lowerClean.includes('paste') || lowerClean.includes('detergent')) {
      category = 'Personal Care';
    }

    return {
      intent: 'ADD_PRODUCT',
      confidence: 0.92,
      speechResponse: `Added ${cleanName} (${quantity} ${unit}) at ${currency}${sellingPrice} to your ${category} inventory.`,
      productData: {
        name: cleanName,
        category,
        costPrice,
        sellingPrice,
        stockQuantity: quantity,
        minStockThreshold: Math.max(1, Math.min(5, Math.floor(quantity * 0.2) || 2)),
        unit,
        barcode: '',
      },
    };
  }

  // 4. Default query / conversational
  return {
    intent: 'QUERY_INFO',
    confidence: 0.75,
    speechResponse: `Hello! I am Dukan AI. You can say: "Sold 2 milk cash", "Add 10 Atta at 250 rupees", or "Show low stock items".`,
    queryAnswer: `Dukan AI is ready. Try speaking or typing:\n• "Sold 2 Amul Milk and 1 Bread cash"\n• "Ramesh took 5 kg Atta on Udhaar"\n• "Which items are running low on stock?"`,
  };
}

async function startServer() {
  const app = express();
  
  // In AI Studio, the dev server must run on port 3000 (port 8080 is reserved for Nginx proxy)
  let PORT = 3000;
  const portArgIndex = process.argv.indexOf('--port');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    PORT = parseInt(process.argv[portArgIndex + 1]);
  } else if (process.env.PORT && process.env.PORT !== '8080') {
    PORT = parseInt(process.env.PORT);
  }

  app.use(express.json({ limit: '10mb' }));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasApiKey: !!process.env.GEMINI_API_KEY,
      time: new Date().toISOString(),
    });
  });

  // Gemini Shopkeeper Voice & Text Command endpoint
  app.post('/api/gemini/command', async (req, res) => {
    const { command, inventoryContext, shopContext } = req.body;

    if (!command || typeof command !== 'string' || !command.trim()) {
      res.status(400).json({ error: 'Command text is required' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    console.log('Gemini API Key status in request:', apiKey ? `Present (length ${apiKey.length}, starts with ${apiKey.slice(0, 6)})` : 'NOT SET');

    // Fallback if no valid key
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      const fallbackResult = parseCommandRuleBased(
        command,
        inventoryContext || [],
        shopContext?.shopName || 'Apna Dukan',
        shopContext?.currency || '₹'
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
You are DUKAN AI, an intelligent, bilingual retail assistant for local shopkeepers and retail merchants.
The shopkeeper has spoken or typed a command: "${command}".

Current shop context:
Shop name: "${shopContext?.shopName || 'My Dukan'}"
Currency: "${shopContext?.currency || '₹'}"

Current shop inventory list (use this to match item names accurately):
${JSON.stringify(inventoryContext || [], null, 2)}

Analyze the shopkeeper's command and map it to one of these intents:
1. "RECORD_SALE": The shopkeeper is recording a sale to a customer. E.g.: "Sold 2 milk and 1 bread cash", "Ramesh took 5kg atta on udhar/credit", "2 packets chips upi se becha".
2. "ADD_PRODUCT": The shopkeeper wants to add a new product to inventory. E.g.: "Add 50 kg basmati rice selling at 90 rupees cost 75", "Naya item add karo Parle-G 20 packets price 10".
3. "UPDATE_PRODUCT": The shopkeeper wants to update stock or price of an existing product. E.g.: "Update sugar stock to 40", "Rice price changed to 95", "Add 10 more packets of maggi".
4. "DELETE_PRODUCT": The shopkeeper wants to remove a product. E.g.: "Delete expired biscuit", "Remove item XYZ".
5. "QUERY_INFO": The shopkeeper is asking a question about stock, sales, low stock, restocking, or shop performance. E.g.: "Show me products that need restocking", "Which items are low stock?", "How much did we sell today?", "Do we have milk left?".
6. "CONVERSATIONAL": General greeting, thank you, or non-actionable chat.

Rules:
- If the user asks "Show me products that need restocking" or asks about low stock/out of stock items, set intent to "QUERY_INFO", check the inventoryContext for items where stockQuantity <= minStockThreshold, and provide clear details in speechResponse and queryAnswer with current stock vs minimum threshold and suggested reorder quantities.
- If recording a sale, match each mentioned item to the closest product in the inventory.
- If adding a product (e.g. "Add 2 kg Tata Salt to my inventory"):
  - name: clean product name ONLY (e.g. "Tata Salt", NOT "2 kg Tata Salt to my inventory").
  - stockQuantity: the exact quantity mentioned (e.g. 2). Default to 10 if not mentioned.
  - unit: the unit mentioned (e.g. "kg", "pkt", "pcs", "litre", "bottle", "box"). Default to "pcs".
  - sellingPrice: price mentioned or realistic retail price in India (e.g. 28 for Tata Salt).
  - costPrice: cost price mentioned or ~80% of sellingPrice.
  - category: appropriate retail category (e.g. "Staples", "Dairy", "Snacks", "Beverages", "Personal Care", "Groceries").
- For sale paymentMode, default to "cash" if not specified. Allowed values: "cash", "upi", "credit_khata", "card".
- For sale paymentStatus: if mode is "credit_khata" or user said "udhaar" / "khata" / "pay later", set "pending_credit", otherwise "paid".
- In speechResponse, give a concise, respectful, shopkeeper-friendly confirmation in simple English or Hinglish that can be spoken via Text-To-Speech.
`;

      const geminiCall = ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              intent: {
                type: Type.STRING,
                description: 'Must be exactly one of: RECORD_SALE, ADD_PRODUCT, UPDATE_PRODUCT, DELETE_PRODUCT, QUERY_INFO, CONVERSATIONAL',
              },
              confidence: {
                type: Type.NUMBER,
                description: 'Confidence score between 0 and 1',
              },
              speechResponse: {
                type: Type.STRING,
                description: 'Friendly spoken response confirmation for shopkeeper',
              },
              saleData: {
                type: Type.OBJECT,
                description: 'Data if intent is RECORD_SALE',
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
                description: 'Data if intent is ADD_PRODUCT',
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
                description: 'Data if intent is UPDATE_PRODUCT',
                properties: {
                  matchedProductId: { type: Type.STRING },
                  productName: { type: Type.STRING },
                  stockAdjustmentType: { type: Type.STRING, description: 'set, add, or subtract' },
                  stockQuantity: { type: Type.NUMBER },
                  newSellingPrice: { type: Type.NUMBER },
                  newCostPrice: { type: Type.NUMBER },
                },
              },
              deleteData: {
                type: Type.OBJECT,
                description: 'Data if intent is DELETE_PRODUCT',
                properties: {
                  matchedProductId: { type: Type.STRING },
                  productName: { type: Type.STRING },
                },
              },
              queryAnswer: {
                type: Type.STRING,
                description: 'Detailed answer if intent is QUERY_INFO',
              },
            },
            required: ['intent', 'speechResponse'],
          },
        },
      });

      // 10-second timeout before graceful fallback
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Gemini API timeout')), 10000)
      );

      const response: any = await Promise.race([geminiCall, timeout]);
      const parsedData = JSON.parse(response.text || '{}');

      // Normalize intent string
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

      // Ensure price defaults if needed
      if (parsedData.intent === 'ADD_PRODUCT' && parsedData.productData) {
        if (!parsedData.productData.sellingPrice || parsedData.productData.sellingPrice <= 0) {
          const lowerName = (parsedData.productData.name || '').toLowerCase();
          if (lowerName.includes('salt')) parsedData.productData.sellingPrice = 28;
          else if (lowerName.includes('atta')) parsedData.productData.sellingPrice = 240;
          else if (lowerName.includes('milk')) parsedData.productData.sellingPrice = 30;
          else parsedData.productData.sellingPrice = 50;
        }
        if (!parsedData.productData.costPrice || parsedData.productData.costPrice <= 0) {
          parsedData.productData.costPrice = Math.max(1, Math.round(parsedData.productData.sellingPrice * 0.8));
        }
      }

      res.json({
        success: true,
        data: parsedData,
        mode: 'gemini_3.1_flash_lite',
      });
    } catch (error: any) {
      console.warn('Gemini error/timeout, using smart fallback parser:', error.message);
      const fallbackResult = parseCommandRuleBased(
        command,
        inventoryContext || [],
        shopContext?.shopName || 'Apna Dukan',
        shopContext?.currency || '₹'
      );
      res.json({
        success: true,
        data: fallbackResult,
        mode: 'smart_fallback',
      });
    }
  });

  // Serve static assets in production or Vite middleware in development
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
