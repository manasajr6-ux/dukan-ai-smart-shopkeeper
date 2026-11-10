import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

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

  // 2. Check for low stock query
  if (lower.includes('low stock') || lower.includes('kam stock') || lower.includes('khatam') || lower.includes('out of stock')) {
    const lowItems = inventory.filter((i) => i.stockQuantity <= (i.minStockThreshold || 5));
    const names = lowItems.map((i) => `${i.name} (${i.stockQuantity} left)`).join(', ');
    return {
      intent: 'QUERY_INFO',
      confidence: 0.95,
      speechResponse: lowItems.length > 0
        ? `You have ${lowItems.length} items running low: ${names}. Check Inventory tab to restock.`
        : 'All items currently have healthy stock levels above minimum thresholds!',
      queryAnswer: lowItems.length > 0
        ? `Items requiring restock:\n${lowItems.map((i) => `• ${i.name}: ${i.stockQuantity} ${i.unit} remaining (Threshold: ${i.minStockThreshold})`).join('\n')}`
        : 'No low stock items currently.',
    };
  }

  // 3. Check for add product
  if (lower.startsWith('add') || lower.includes('naya item') || lower.includes('nayi item')) {
    const priceMatch = command.match(/(?:at|for|selling|price|rs|₹)\s*(\d+)/i);
    const sellingPrice = priceMatch ? parseFloat(priceMatch[1]) : 50;
    const nameMatch = command.replace(/^(add|naya item|nayi item)\s+/i, '').replace(/(at|for|selling|price|rs|₹).*$/i, '').trim();
    const name = nameMatch || 'New Product';

    return {
      intent: 'ADD_PRODUCT',
      confidence: 0.85,
      speechResponse: `Added new product ${name} with selling price ${currency}${sellingPrice} to your catalog.`,
      productData: {
        name,
        category: 'General',
        costPrice: Math.round(sellingPrice * 0.8),
        sellingPrice,
        stockQuantity: 20,
        minStockThreshold: 5,
        unit: 'pcs',
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
5. "QUERY_INFO": The shopkeeper is asking a question about stock, sales, low stock, or shop performance. E.g.: "Which items are low stock?", "How much did we sell today?", "Do we have milk left?".
6. "CONVERSATIONAL": General greeting, thank you, or non-actionable chat.

Rules:
- If recording a sale, match each mentioned item to the closest product in the inventory.
- For sale paymentMode, default to "cash" if not specified. Allowed values: "cash", "upi", "credit_khata", "card".
- For sale paymentStatus: if mode is "credit_khata" or user said "udhaar" / "khata" / "pay later", set "pending_credit", otherwise "paid".
- In speechResponse, give a concise, respectful, shopkeeper-friendly confirmation in simple English or Hinglish that can be spoken via Text-To-Speech.
`;

      const geminiCall = ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              intent: {
                type: Type.STRING,
                description: 'RECORD_SALE, ADD_PRODUCT, UPDATE_PRODUCT, DELETE_PRODUCT, QUERY_INFO, or CONVERSATIONAL',
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

      // 6-second timeout before graceful fallback
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Gemini API timeout')), 6000)
      );

      const response: any = await Promise.race([geminiCall, timeout]);
      const parsedData = JSON.parse(response.text || '{}');

      res.json({
        success: true,
        data: parsedData,
        mode: 'gemini_3.8_flash',
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
