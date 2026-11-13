import { AssistantLanguage } from '../types';

export interface SalesContextSummary {
  todayRevenue?: number;
  todayGrossProfit?: number;
  todayBillsCount?: number;
  todayItemsCount?: number;
  weekRevenue?: number;
  monthRevenue?: number;
}

const KANNADA_NUMBER_WORDS: Record<string, number> = {
  'ಒಂದು': 1, 'ಒಂದ': 1,
  'ಎರಡು': 2, 'ಎರಡ': 2,
  'ಮೂರು': 3, 'ಮೂರ': 3,
  'ನಾಲ್ಕು': 4, 'ನಾಲ್ಕ': 4,
  'ಐದು': 5, 'ಐದ': 5,
  'ಆರು': 6, 'ಏಳು': 7, 'ಎಂಟು': 8, 'ಒಂಬತ್ತು': 9, 'ಹತ್ತು': 10,
  'ಇಪ್ಪತ್ತು': 20, 'ಮೂವತ್ತು': 30, 'ಐವತ್ತು': 50, 'ನೂರು': 100,
  'ಅರ್ಧ': 0.5,
};

const HINDI_NUMBER_WORDS: Record<string, number> = {
  'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5, 'पाँच': 5,
  'छह': 6, 'सात': 7, 'आठ': 8, 'नौ': 9, 'दस': 10,
  'बीस': 20, 'तीस': 30, 'चालीस': 40, 'पचास': 50, 'सौ': 100,
  'आधा': 0.5, 'ek': 1, 'do': 2, 'teen': 3, 'char': 4, 'paanch': 5, 'das': 10,
};

// Map regional product words to English retail search terms & canonical product names
const REGIONAL_PRODUCT_MAP: { terms: string[]; englishKey: string; displayName: string; defaultPrice: number; category: string }[] = [
  { terms: ['ಅಕ್ಕಿ', 'ಅಕ್ಕಿಯ', 'चावल', 'chawal', 'rice', 'basmati'], englishKey: 'rice', displayName: 'Rice', defaultPrice: 75, category: 'Staples & Grains' },
  { terms: ['ಉಪ್ಪು', 'ಉಪ್ಪಿನ', 'ನಮಕ್', 'नमक', 'namak', 'salt', 'tata salt'], englishKey: 'salt', displayName: 'Salt', defaultPrice: 28, category: 'Staples & Grains' },
  { terms: ['ಹಾಲು', 'ಹಾಲಿನ', 'ಹಾಲಿ', 'दूध', 'doodh', 'milk', 'amul'], englishKey: 'milk', displayName: 'Milk', defaultPrice: 28, category: 'Dairy' },
  { terms: ['ಹಿಟ್ಟು', 'ಹಿಟ್ಟಿನ', 'आटा', 'aata', 'atta', 'aashirvaad'], englishKey: 'atta', displayName: 'Atta', defaultPrice: 245, category: 'Staples & Grains' },
  { terms: ['ಸಕ್ಕರೆ', 'ಸಕ್ಕರೆಯ', 'ಚೀನಿ', 'चीनी', 'शक्कर', 'cheeni', 'sugar'], englishKey: 'sugar', displayName: 'Sugar', defaultPrice: 45, category: 'Staples & Grains' },
  { terms: ['ಎಣ್ಣೆ', 'ಎಣ್ಣೆಯ', 'तेल', 'tel', 'oil', 'sunflower'], englishKey: 'oil', displayName: 'Oil', defaultPrice: 145, category: 'Oils & Ghee' },
  { terms: ['ಬೆಣ್ಣೆ', 'ಬೆಣ್ಣೆಯ', 'मक्खन', 'makkhan', 'butter'], englishKey: 'butter', displayName: 'Butter', defaultPrice: 58, category: 'Dairy' },
  { terms: ['ಬಿಸ್ಕತ್ತು', 'ಬಿಸ್ಕೆಟ್', 'बिस्कुट', 'biscuit', 'parle'], englishKey: 'biscuit', displayName: 'Biscuits', defaultPrice: 10, category: 'Bakery & Biscuits' },
  { terms: ['ಮ್ಯಾಗಿ', 'नूडल्स', 'मैगी', 'maggi', 'noodles'], englishKey: 'maggi', displayName: 'Maggi Noodles', defaultPrice: 14, category: 'Snacks & Instant Food' },
  { terms: ['ಸಾಬೂನು', 'ಸೋಪ್', 'साबुन', 'soap', 'dettol'], englishKey: 'soap', displayName: 'Soap', defaultPrice: 115, category: 'Personal Care' },
  { terms: ['ಸರ್ಫ್', 'ಡಿಟರ್ಜೆಂಟ್', 'सर्फ', 'डिटर्जेंट', 'surf', 'detergent'], englishKey: 'detergent', displayName: 'Detergent', defaultPrice: 76, category: 'Household & Cleaning' },
  { terms: ['ಬ್ರೆಡ್', 'ब्रेड', 'bread'], englishKey: 'bread', displayName: 'Bread', defaultPrice: 35, category: 'Bakery & Biscuits' },
  { terms: ['ಚಹಾ', 'ಟೀ', 'चाय', 'tea', 'chai'], englishKey: 'tea', displayName: 'Tea', defaultPrice: 120, category: 'Beverages' },
];

export function detectLanguageFromText(text: string, fallback: AssistantLanguage = 'en'): AssistantLanguage {
  if (/[\u0C80-\u0CFF]/.test(text)) return 'kn';
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  return fallback;
}

function normalizeNumerals(text: string): string {
  let out = text;
  // Convert Kannada digits ೦-೯ and Devanagari digits ०-९ to ASCII 0-9
  const knDigits = '೦೧೨೩೪೫೬೭೮೯';
  const hiDigits = '०१२३४५६७८९';
  for (let i = 0; i < 10; i++) {
    out = out.replace(new RegExp(knDigits[i], 'g'), String(i));
    out = out.replace(new RegExp(hiDigits[i], 'g'), String(i));
  }
  return out;
}

function extractQuantityAndUnit(rawText: string): { quantity: number; unit: string } {
  const normalized = normalizeNumerals(rawText);
  const lower = normalized.toLowerCase();

  // Extract unit across English, Kannada, and Hindi
  let unit = 'pcs';
  if (/(?:\bkg\b|ಕೆಜಿ|ಕಿಲೋ|ಕಿಲೊ|किलो|केजी)/i.test(normalized)) unit = 'kg';
  else if (/(?:\bpkt\b|packet|packets|ಪ್ಯಾಕೆಟ್|ಪ್ಯಾಕ್|पैकेट|पैक)/i.test(normalized)) unit = 'pkt';
  else if (/(?:\bltr\b|litre|litres|\bl\b|ಲೀಟರ್|ಲಿಟರ್|लीटर)/i.test(normalized)) unit = 'ltr';
  else if (/(?:\bgm?\b|grams|ಗ್ರಾಂ|ग्राम)/i.test(normalized)) unit = 'gm';
  else if (/(?:bottle|bottles|ಬಾಟಲ್|ಬಾಟಲಿ|बोतल)/i.test(normalized)) unit = 'bottle';
  else if (/(?:box|boxes|ಬಾಕ್ಸ್|ಡಬ್ಬ|डिब्बा|बॉक्स)/i.test(normalized)) unit = 'box';

  // Extract numeric digit first
  const numMatch = lower.match(/(\d+(?:\.\d+)?)/);
  if (numMatch) {
    return { quantity: parseFloat(numMatch[1]), unit };
  }

  // Check Kannada & Hindi number words
  for (const [word, val] of Object.entries(KANNADA_NUMBER_WORDS)) {
    if (normalized.includes(word)) {
      return { quantity: val, unit };
    }
  }
  for (const [word, val] of Object.entries(HINDI_NUMBER_WORDS)) {
    if (normalized.includes(word) || lower.includes(word)) {
      return { quantity: val, unit };
    }
  }

  return { quantity: 1, unit };
}

function findMatchingInventoryProduct(command: string, inventory: any[]) {
  const lower = command.toLowerCase();

  // 1. Direct English/script token match against inventory product names
  let bestMatch: any = null;
  let bestScore = 0;

  for (const item of inventory) {
    const words = String(item.name || '')
      .toLowerCase()
      .split(/[\s,()\-]+/)
      .filter((w) => w.length > 2);

    let score = 0;
    for (const w of words) {
      if (lower.includes(w)) score += w.length;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }

  if (bestMatch) {
    return { product: bestMatch, matchedTerm: bestMatch.name, isRegionalMatch: false };
  }

  // 2. Match via regional Kannada / Hindi product synonym map
  for (const entry of REGIONAL_PRODUCT_MAP) {
    const hit = entry.terms.find((t) => command.includes(t) || lower.includes(t));
    if (hit) {
      const invProd = inventory.find((p) =>
        String(p.name || '').toLowerCase().includes(entry.englishKey)
      );
      if (invProd) {
        return { product: invProd, matchedTerm: entry.displayName, isRegionalMatch: true };
      }
      return {
        product: null,
        matchedTerm: entry.displayName,
        defaultPrice: entry.defaultPrice,
        category: entry.category,
        isRegionalMatch: true,
      };
    }
  }

  return null;
}

export function parseCommandMultilingual(
  command: string,
  inventory: any[],
  shopName: string,
  currency: string,
  preferredLanguage: AssistantLanguage = 'en',
  salesContext?: SalesContextSummary
) {
  const normalized = normalizeNumerals(command).trim();
  const lower = normalized.toLowerCase();
  const lang: AssistantLanguage = preferredLanguage || detectLanguageFromText(command, 'en');

  // Helper to localize text
  const msg = (kn: string, hi: string, en: string) =>
    lang === 'kn' ? kn : lang === 'hi' ? hi : en;

  // 1. DAILY SALES QUERY ("ಇವತ್ತು ಎಷ್ಟು ಸೇಲ್ ಆಗಿದೆ?", "आज कितनी बिक्री हुई?", "Show today's sales")
  const isDailySalesQuery =
    lower.includes("today's sales") ||
    lower.includes('today sales') ||
    lower.includes('daily sales') ||
    lower.includes('sold today') ||
    lower.includes('how much did we sell') ||
    normalized.includes('ಇವತ್ತು ಎಷ್ಟು ಸೇಲ್') ||
    normalized.includes('ಇಂದಿನ ಮಾರಾಟ') ||
    normalized.includes('ಇವತ್ತಿನ ಸೇಲ್') ||
    normalized.includes('आज कितनी बिक्री') ||
    normalized.includes('आज की बिक्री') ||
    normalized.includes('आज का सेल') ||
    lower.includes('aaj ki bikri') ||
    lower.includes('kitni bikri');

  if (isDailySalesQuery) {
    const todayRev = salesContext?.todayRevenue ?? 0;
    const todayProfit = salesContext?.todayGrossProfit ?? 0;
    const todayBills = salesContext?.todayBillsCount ?? 0;
    const todayItems = salesContext?.todayItemsCount ?? 0;

    return {
      intent: 'QUERY_INFO' as const,
      confidence: 0.96,
      language: lang,
      interpretedCommand: `Check today's sales summary`,
      speechResponse: msg(
        `ಇವತ್ತು ಒಟ್ಟು ${todayBills} ಬಿಲ್‌ಗಳಲ್ಲಿ ${currency}${todayRev} ಮಾರಾಟವಾಗಿದೆ (${todayItems} ವಸ್ತುಗಳು). ಒಟ್ಟು ಲಾಭ ${currency}${todayProfit}.`,
        `आज कुल ${todayBills} बिलों में ${currency}${todayRev} की बिक्री हुई है (${todayItems} सामान)। आज का कुल ग्रॉस मुनाफ़ा ${currency}${todayProfit} है।`,
        `Today's total sales revenue is ${currency}${todayRev} across ${todayBills} bills (${todayItems} items sold), with a gross profit of ${currency}${todayProfit}.`
      ),
      queryAnswer: msg(
        `ಇಂದಿನ ವಹಿವಾಟು ವಿವರ:\n• ಒಟ್ಟು ಮಾರಾಟ (Revenue): ${currency}${todayRev}\n• ಒಟ್ಟು ಬಿಲ್‌ಗಳು: ${todayBills}\n• ಮಾರಾಟವಾದ ವಸ್ತುಗಳು: ${todayItems}\n• ಒಟ್ಟು ಲಾಭ (Gross Profit): ${currency}${todayProfit}`,
        `आज की बिक्री रिपोर्ट:\n• कुल बिक्री (Revenue): ${currency}${todayRev}\n• कुल बिल: ${todayBills}\n• बेचे गए आइटम: ${todayItems}\n• ग्रॉस मुनाफ़ा (Gross Profit): ${currency}${todayProfit}`,
        `Today's Sales Summary:\n• Total Revenue: ${currency}${todayRev}\n• Total Bills: ${todayBills}\n• Items Sold: ${todayItems}\n• Gross Profit: ${currency}${todayProfit}`
      ),
    };
  }

  // 2. LOW-STOCK QUERY ("ಯಾವ ವಸ್ತುಗಳ ಸ್ಟಾಕ್ ಕಡಿಮೆ ಇದೆ?", "कौन से सामान का स्टॉक कम है?", "Which products are low in stock?")
  const isLowStockQuery =
    lower.includes('low stock') ||
    lower.includes('low in stock') ||
    lower.includes('kam stock') ||
    lower.includes('khatam') ||
    lower.includes('out of stock') ||
    lower.includes('restock') ||
    lower.includes('reorder') ||
    normalized.includes('ಸ್ಟಾಕ್ ಕಡಿಮೆ') ||
    normalized.includes('ಕಡಿಮೆ ಇದೆ') ||
    normalized.includes('ಖಾಲಿ') ||
    normalized.includes('स्टॉक कम') ||
    normalized.includes('कम है') ||
    normalized.includes('खत्म');

  if (isLowStockQuery) {
    const criticalItems = inventory.filter((i) => i.stockQuantity <= (i.minStockThreshold ?? 5));
    const listPreviewKn = criticalItems
      .slice(0, 4)
      .map((i) => `${i.name} (${i.stockQuantity} ${i.unit || 'pcs'})`)
      .join(', ');

    return {
      intent: 'QUERY_INFO' as const,
      confidence: 0.96,
      language: lang,
      interpretedCommand: 'Show low-stock and out-of-stock products',
      speechResponse:
        criticalItems.length > 0
          ? msg(
              `ಪ್ರಸ್ತುತ ${criticalItems.length} ವಸ್ತುಗಳ ಸ್ಟಾಕ್ ಕಡಿಮೆ ಇದೆ: ${listPreviewKn}. ದಯವಿಟ್ಟು ರೀಸ್ಟಾಕ್ ಮಾಡಿ.`,
              `अभी ${criticalItems.length} सामान का स्टॉक कम है: ${listPreviewKn}। कृपया इन्हें रीस्टॉक करें।`,
              `You have ${criticalItems.length} low-stock products: ${listPreviewKn}. Please consider restocking them.`
            )
          : msg(
              'ನಿಮ್ಮ ಅಂಗಡಿಯ ಎಲ್ಲಾ ವಸ್ತುಗಳ ಸ್ಟಾಕ್ ಉತ್ತಮವಾಗಿದೆ.',
              'आपकी दुकान के सभी सामान का स्टॉक पर्याप्त है।',
              'All products in your inventory currently have healthy stock levels.'
            ),
      queryAnswer:
        criticalItems.length > 0
          ? criticalItems
              .map((i) => {
                const status = i.stockQuantity <= 0 ? 'OUT OF STOCK' : 'LOW STOCK';
                const reorder = Math.max((i.minStockThreshold || 5) * 2 - i.stockQuantity, i.minStockThreshold || 5, 10);
                return `• [${status}] ${i.name}: ${i.stockQuantity} ${i.unit || 'pcs'} (Min: ${i.minStockThreshold}) → Reorder +${reorder}`;
              })
              .join('\n')
          : msg(
              'ಯಾವುದೇ ವಸ್ತುಗಳು ಕಡಿಮೆ ಸ್ಟಾಕ್‌ನಲ್ಲಿಲ್ಲ.',
              'कोई भी सामान कम स्टॉक में नहीं है।',
              'No products are below minimum threshold.'
            ),
    };
  }

  // 3. CHECK AVAILABLE STOCK OR PRICE QUERY
  const isPriceQuery =
    lower.includes('price') ||
    lower.includes('rate') ||
    lower.includes('cost') ||
    lower.includes('how much is') ||
    normalized.includes('ಬೆಲೆ') ||
    normalized.includes('ದರ') ||
    normalized.includes('ರೇಟ್') ||
    normalized.includes('कीमत') ||
    normalized.includes('दाम') ||
    normalized.includes('भाव') ||
    normalized.includes('रेट');

  const isStockCheckQuery =
    lower.includes('check stock') ||
    lower.includes('available stock') ||
    lower.includes('how much') ||
    lower.includes('how many') ||
    lower.includes('left') ||
    normalized.includes('ಎಷ್ಟು ಸ್ಟಾಕ್') ||
    normalized.includes('ಸ್ಟಾಕ್ ಎಷ್ಟಿದೆ') ||
    normalized.includes('ಸ್ಟಾಕ್ ಇದೆಯಾ') ||
    normalized.includes('कितना स्टॉक') ||
    normalized.includes('स्टॉक बचा') ||
    normalized.includes('स्टॉक है');

  if (isPriceQuery || isStockCheckQuery) {
    const matchInfo = findMatchingInventoryProduct(normalized, inventory);
    if (matchInfo?.product) {
      const p = matchInfo.product;
      if (isPriceQuery) {
        return {
          intent: 'QUERY_INFO' as const,
          confidence: 0.94,
          language: lang,
          interpretedCommand: `Check price of ${p.name}`,
          speechResponse: msg(
            `${p.name} ಬೆಲೆ ${currency}${p.sellingPrice} प्रति ${p.unit} ಆಗಿದೆ. ಲಭ್ಯವಿರುವ ಸ್ಟಾಕ್: ${p.stockQuantity} ${p.unit}.`.replace('प्रति', 'ಪ್ರತಿ'),
            `${p.name} की कीमत ${currency}${p.sellingPrice} प्रति ${p.unit} है। उपलब्ध स्टॉक: ${p.stockQuantity} ${p.unit}।`,
            `The selling price of ${p.name} is ${currency}${p.sellingPrice} per ${p.unit}. Available stock: ${p.stockQuantity} ${p.unit}.`
          ),
          queryAnswer: `${p.name}\n• Selling Price: ${currency}${p.sellingPrice} / ${p.unit}\n• Cost Price: ${currency}${p.costPrice}\n• Available Stock: ${p.stockQuantity} ${p.unit}`,
        };
      } else {
        return {
          intent: 'QUERY_INFO' as const,
          confidence: 0.94,
          language: lang,
          interpretedCommand: `Check available stock of ${p.name}`,
          speechResponse: msg(
            `${p.name} ಪ್ರಸ್ತುತ ${p.stockQuantity} ${p.unit} ಸ್ಟಾಕ್ ಲಭ್ಯವಿದೆ (ಕನಿಷ್ಠ ಮಿತಿ: ${p.minStockThreshold} ${p.unit}).`,
            `${p.name} का अभी ${p.stockQuantity} ${p.unit} स्टॉक उपलब्ध है (न्यूनतम सीमा: ${p.minStockThreshold} ${p.unit})।`,
            `You currently have ${p.stockQuantity} ${p.unit} of ${p.name} in stock (Min threshold: ${p.minStockThreshold} ${p.unit}).`
          ),
          queryAnswer: `${p.name}: ${p.stockQuantity} ${p.unit} available (Min threshold: ${p.minStockThreshold} ${p.unit})`,
        };
      }
    }
  }

  // 4. RECORD SALE ("ಎರಡು ಪ್ಯಾಕೆಟ್ ಉಪ್ಪು ಮಾರಾಟ ಆಯಿತು", "दो पैकेट नमक बेच दिया", "Sold 2 packets of salt")
  const isSaleIntent =
    lower.includes('sold') ||
    lower.includes('sell') ||
    lower.includes('sale') ||
    lower.includes('becha') ||
    lower.includes('bik gaya') ||
    lower.includes('bill') ||
    lower.includes('udhar') ||
    lower.includes('khata') ||
    normalized.includes('ಮಾರಾಟ') ||
    normalized.includes('ಮಾರಿದೆ') ||
    normalized.includes('ಸೇಲ್ ಆಯಿತು') ||
    normalized.includes('ಬಿಕರಿ') ||
    normalized.includes('बेच') ||
    normalized.includes('बेचा') ||
    normalized.includes('बिक गया');

  if (isSaleIntent) {
    let paymentMode: 'cash' | 'upi' | 'credit_khata' | 'card' = 'cash';
    if (lower.includes('upi') || lower.includes('qr') || lower.includes('gpay') || lower.includes('phonepe') || normalized.includes('ಯುಪಿಐ')) {
      paymentMode = 'upi';
    } else if (lower.includes('udhar') || lower.includes('khata') || lower.includes('credit') || normalized.includes('ಉದ್ರಿ') || normalized.includes('उधार')) {
      paymentMode = 'credit_khata';
    } else if (lower.includes('card') || normalized.includes('ಕಾರ್ಡ್')) {
      paymentMode = 'card';
    }

    const { quantity, unit } = extractQuantityAndUnit(normalized);
    const matchInfo = findMatchingInventoryProduct(normalized, inventory);

    if (!matchInfo || !matchInfo.product) {
      // Ambiguous product match -> return isAmbiguous so UI ALWAYS asks confirmation/selection!
      const fallbackProd = inventory[0];
      return {
        intent: 'RECORD_SALE' as const,
        confidence: 0.55,
        language: lang,
        isAmbiguous: true,
        ambiguityReason: msg(
          'ವಸ್ತುವಿನ ಹೆಸರು ಸ್ಪಷ್ಟವಾಗಿಲ್ಲ. ದಯವಿಟ್ಟು ಕೆಳಗೆ ಸರಿಯಾದ ವಸ್ತುವನ್ನು ಆಯ್ಕೆ ಮಾಡಿ ಖಚಿತಪಡಿಸಿ.',
          'सामान का नाम स्पष्ट नहीं है। कृपया नीचे सही सामान चुनकर पुष्टि करें।',
          'Could not confidently match the exact product in your inventory. Please select or confirm the item before saving.'
        ),
        interpretedCommand: `Sell ${quantity} ${unit} (${matchInfo?.matchedTerm || 'Select product'})`,
        speechResponse: msg(
          'ದಯವಿಟ್ಟು ವಸ್ತುವನ್ನು ಖಚಿತಪಡಿಸಿ, ನಂತರ ಮಾರಾಟ ದಾಖಲಿಸಲಾಗುವುದು.',
          'कृपया सामान की पुष्टि करें, फिर बिक्री दर्ज की जाएगी।',
          'Please confirm or select the exact product before recording this sale.'
        ),
        saleData: {
          customerName: 'Walk-in Customer',
          paymentMode,
          paymentStatus: paymentMode === 'credit_khata' ? 'pending_credit' : 'paid',
          items: fallbackProd
            ? [
                {
                  matchedProductId: fallbackProd.id,
                  productName: fallbackProd.name,
                  quantity,
                  unit: fallbackProd.unit || unit,
                  unitPrice: fallbackProd.sellingPrice,
                },
              ]
            : [],
        },
      };
    }

    const matchedProd = matchInfo.product;
    const total = Number((quantity * matchedProd.sellingPrice).toFixed(2));
    return {
      intent: 'RECORD_SALE' as const,
      confidence: 0.93,
      language: lang,
      isAmbiguous: quantity > matchedProd.stockQuantity,
      ambiguityReason:
        quantity > matchedProd.stockQuantity
          ? msg(
              `ಗಮನಿಸಿ: ಸ್ಟಾಕ್‌ನಲ್ಲಿ ಕೇವಲ ${matchedProd.stockQuantity} ${matchedProd.unit} ಮಾತ್ರ ಇದೆ!`,
              `ध्यान दें: स्टॉक में केवल ${matchedProd.stockQuantity} ${matchedProd.unit} उपलब्ध है!`,
              `Warning: Requested ${quantity}, but only ${matchedProd.stockQuantity} ${matchedProd.unit} in stock.`
            )
          : undefined,
      interpretedCommand: `Sell ${quantity} ${matchedProd.unit || unit} of ${matchedProd.name} (${currency}${total}, ${paymentMode})`,
      speechResponse: msg(
        `${quantity} ${matchedProd.unit || unit} ${matchedProd.name} ಮಾರಾಟ (${currency}${total}) ದಾಖಲಿಸಲು ಸಿದ್ಧವಾಗಿದೆ.`,
        `${quantity} ${matchedProd.unit || unit} ${matchedProd.name} की बिक्री (${currency}${total}) दर्ज करने के लिए तैयार है।`,
        `Ready to record sale of ${quantity} ${matchedProd.unit || unit} ${matchedProd.name} for ${currency}${total} via ${paymentMode.replace('_', ' ')}.`
      ),
      saleData: {
        customerName: 'Walk-in Customer',
        paymentMode,
        paymentStatus: paymentMode === 'credit_khata' ? 'pending_credit' : 'paid',
        items: [
          {
            matchedProductId: matchedProd.id,
            productName: matchedProd.name,
            quantity,
            unit: matchedProd.unit || unit,
            unitPrice: matchedProd.sellingPrice,
          },
        ],
      },
    };
  }

  // 5. ADD PRODUCT TO INVENTORY ("ಎರಡು ಕೆಜಿ ಅಕ್ಕಿ ಸ್ಟಾಕ್ಗೆ ಸೇರಿಸು", "दो किलो चावल स्टॉक में जोड़ो", "Add 2 kg rice to inventory")
  const isAddIntent =
    lower.startsWith('add') ||
    lower.includes('naya item') ||
    lower.includes('nayi item') ||
    lower.includes('add karo') ||
    lower.includes('to inventory') ||
    lower.includes('to stock') ||
    normalized.includes('ಸೇರಿಸು') ||
    normalized.includes('ಸೇರಿಸಿ') ||
    normalized.includes('ಸ್ಟಾಕ್ಗೆ') ||
    normalized.includes('ಸ್ಟಾಕ್‌ಗೆ') ||
    normalized.includes('जोड़ो') ||
    normalized.includes('जोड़ें') ||
    normalized.includes('स्टॉक में');

  if (isAddIntent) {
    const priceMatch = normalized.match(/\b(?:at|for|selling\s+price|price|rate|cost|rs\.?|inr|₹)\s*(\d+(?:\.\d+)?)/i);
    let sellingPrice = priceMatch ? parseFloat(priceMatch[1]) : 0;
    const { quantity, unit } = extractQuantityAndUnit(normalized);
    const matchInfo = findMatchingInventoryProduct(normalized, inventory);

    let productName = matchInfo?.product?.name || matchInfo?.matchedTerm || '';
    let category = matchInfo?.product?.category || matchInfo?.category || 'Groceries';
    if (!sellingPrice) {
      sellingPrice = matchInfo?.product?.sellingPrice || matchInfo?.defaultPrice || 50;
    }

    if (!productName) {
      // Fallback English cleaning
      const qtyUnitRegex = /\b(\d+(?:\.\d+)?)\s*(kg|g|gm|grams|pkt|packet|packets|pcs|piece|pieces|bottle|bottles|box|boxes|litre|litres|ltr|l|can|cans|pouch|pouches)\b/i;
      productName = normalized
        .replace(/^(?:add|naya item|nayi item|add karo)\s+/i, '')
        .replace(qtyUnitRegex, '')
        .replace(/\b(?:to\s+(?:my\s+)?(?:inventory|stock|dukan|store|catalog)|in\s+(?:my\s+)?(?:inventory|stock))\b/gi, '')
        .replace(/\b(?:at|for|selling\s+price|price|rate|cost|rs\.?|inr|₹)\s*\d+(?:\.\d+)?/gi, '')
        .replace(/^\s*(?:of|a|an)\s+/i, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!productName || productName.length < 2) productName = 'New Item';
    }

    const costPrice = matchInfo?.product?.costPrice || Math.max(1, Math.round(sellingPrice * 0.8));

    return {
      intent: 'ADD_PRODUCT' as const,
      confidence: 0.92,
      language: lang,
      interpretedCommand: `Add ${quantity} ${unit} of ${productName} to inventory (${currency}${sellingPrice}/${unit})`,
      speechResponse: msg(
        `${quantity} ${unit} ${productName} ಸ್ಟಾಕ್ಗೆ ಸೇರಿಸಲು ಸಿದ್ಧವಾಗಿದೆ.`,
        `${quantity} ${unit} ${productName} स्टॉक में जोड़ने के लिए तैयार है।`,
        `Ready to add ${quantity} ${unit} of ${productName} at ${currency}${sellingPrice} to your inventory.`
      ),
      productData: {
        name: productName,
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

  // 6. Default helpful response in selected language
  return {
    intent: 'QUERY_INFO' as const,
    confidence: 0.75,
    language: lang,
    interpretedCommand: command,
    speechResponse: msg(
      `ನಮಸ್ಕಾರ! ನಾನು ${shopName} ಸಹಾಯಕ. "ಎರಡು ಕೆಜಿ ಅಕ್ಕಿ ಸ್ಟಾಕ್ಗೆ ಸೇರಿಸು" ಅಥವಾ "ಇವತ್ತು ಎಷ್ಟು ಸೇಲ್ ಆಗಿದೆ?" ಎಂದು ಕೇಳಿ.`,
      `नमस्ते! मैं ${shopName} का असिस्टेंट हूँ। आप पूछ सकते हैं: "दो किलो चावल स्टॉक में जोड़ो" या "आज कितनी बिक्री हुई?"।`,
      `Hello! I am your ${shopName} assistant. Try: "Add 2 kg rice to inventory", "Sold 2 packets of salt", or "Show today's sales".`
    ),
    queryAnswer: msg(
      'ಕನ್ನಡ, ಹಿಂದಿ ಅಥವಾ ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿ ಆಜ್ಞೆಗಳನ್ನು ನೀಡಿ:\n• "ಎರಡು ಕೆಜಿ ಅಕ್ಕಿ ಸ್ಟಾಕ್ಗೆ ಸೇರಿಸು"\n• "ಎರಡು ಪ್ಯಾಕೆಟ್ ಉಪ್ಪು ಮಾರಾಟ ಆಯಿತು"\n• "ಇವತ್ತು ಎಷ್ಟು ಸೇಲ್ ಆಗಿದೆ?"\n• "ಯಾವ ವಸ್ತುಗಳ ಸ್ಟಾಕ್ ಕಡಿಮೆ ಇದೆ?"',
      'हिंदी, कन्नड़ या अंग्रेज़ी में बोलें या लिखें:\n• "दो किलो चावल स्टॉक में जोड़ो"\n• "दो पैकेट नमक बेच दिया"\n• "आज कितनी बिक्री हुई?"\n• "कौन से सामान का स्टॉक कम है?"',
      'Speak or type in English, Hindi, or Kannada:\n• "Add 2 kg rice to inventory"\n• "Sold 2 packets of salt"\n• "Show today\'s sales"\n• "Which products are low in stock?"'
    ),
  };
}
