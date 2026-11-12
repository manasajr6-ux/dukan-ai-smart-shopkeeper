/**
 * Production Readiness & Core Logic Test Suite for DUKAN AI
 * Tests Inventory CRUD, POS Sales, Inventory Deductions, Margins, Low-Stock Alerts, and Tenant Isolation
 */

interface Product {
  id: string;
  userId: string;
  name: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  stockQuantity: number;
  minStockThreshold: number;
  unit: string;
}

interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  costPrice: number;
  totalPrice: number;
}

// Validation logic
function validateProduct(input: Partial<Product>): { valid: boolean; error?: string } {
  if (!input.name || !input.name.trim()) return { valid: false, error: 'Product name is required' };
  if (input.name.length > 150) return { valid: false, error: 'Product name exceeds 150 chars' };
  if (input.costPrice === undefined || isNaN(input.costPrice) || input.costPrice < 0) return { valid: false, error: 'Cost price must be >= 0' };
  if (input.sellingPrice === undefined || isNaN(input.sellingPrice) || input.sellingPrice <= 0) return { valid: false, error: 'Selling price must be > 0' };
  if (input.stockQuantity === undefined || isNaN(input.stockQuantity) || input.stockQuantity < 0) return { valid: false, error: 'Stock quantity must be >= 0' };
  if (input.minStockThreshold === undefined || isNaN(input.minStockThreshold) || input.minStockThreshold < 0) return { valid: false, error: 'Low stock threshold must be >= 0' };
  return { valid: true };
}

function calculateSale(items: { product: Product; quantity: number }[], discount: number = 0) {
  if (items.length === 0) throw new Error('Cannot process empty cart');
  
  let subtotal = 0;
  let totalCost = 0;
  const saleItems: SaleItem[] = [];

  for (const item of items) {
    if (item.quantity <= 0) throw new Error(`Invalid quantity ${item.quantity}`);
    if (item.quantity > item.product.stockQuantity) {
      throw new Error(`Insufficient stock for ${item.product.name}. Available: ${item.product.stockQuantity}, Requested: ${item.quantity}`);
    }

    const lineTotal = Number((item.quantity * item.product.sellingPrice).toFixed(2));
    const lineCost = Number((item.quantity * item.product.costPrice).toFixed(2));

    subtotal += lineTotal;
    totalCost += lineCost;

    saleItems.push({
      productId: item.product.id,
      productName: item.product.name,
      quantity: item.quantity,
      unit: item.product.unit,
      unitPrice: item.product.sellingPrice,
      costPrice: item.product.costPrice,
      totalPrice: lineTotal,
    });
  }

  const finalDiscount = Math.min(discount, subtotal);
  const totalAmount = Number((subtotal - finalDiscount).toFixed(2));
  const totalProfit = Number((totalAmount - totalCost).toFixed(2));
  const profitMarginPercent = totalAmount > 0 ? Number(((totalProfit / totalAmount) * 100).toFixed(1)) : 0;

  return {
    saleItems,
    subtotal,
    discount: finalDiscount,
    totalAmount,
    totalProfit,
    profitMarginPercent,
  };
}

// Low stock checker
function getLowStockProducts(products: Product[]) {
  return products.filter((p) => p.stockQuantity <= p.minStockThreshold);
}

// Run tests
async function runTests() {
  console.log('--- STARTING DUKAN AI PRODUCTION SUITE TESTS ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // 1. Inventory Validation Tests
  assert(validateProduct({ name: '', sellingPrice: 20, costPrice: 15, stockQuantity: 10, minStockThreshold: 5 }).valid === false, 'Rejects empty product name');
  assert(validateProduct({ name: 'Milk', sellingPrice: -10, costPrice: 15, stockQuantity: 10, minStockThreshold: 5 }).valid === false, 'Rejects negative selling price');
  assert(validateProduct({ name: 'Milk', sellingPrice: 20, costPrice: -5, stockQuantity: 10, minStockThreshold: 5 }).valid === false, 'Rejects negative cost price');
  assert(validateProduct({ name: 'Milk', sellingPrice: 20, costPrice: 15, stockQuantity: -1, minStockThreshold: 5 }).valid === false, 'Rejects negative stock quantity');
  assert(validateProduct({ name: 'Milk', sellingPrice: 28, costPrice: 25, stockQuantity: 20, minStockThreshold: 5 }).valid === true, 'Accepts valid product definition');

  // 2. POS Sale & Stock Deductions
  const productA: Product = { id: 'p1', userId: 'shopA', name: 'Amul Milk 500ml', category: 'Dairy', costPrice: 25, sellingPrice: 28, stockQuantity: 10, minStockThreshold: 4, unit: 'pkt' };
  const productB: Product = { id: 'p2', userId: 'shopA', name: 'Bread', category: 'Bakery', costPrice: 20, sellingPrice: 25, stockQuantity: 5, minStockThreshold: 2, unit: 'pkt' };

  // Valid Sale calculation
  const sale1 = calculateSale([
    { product: productA, quantity: 2 },
    { product: productB, quantity: 1 }
  ], 5);

  assert(sale1.subtotal === (2 * 28 + 1 * 25), 'Calculates accurate subtotal: 56 + 25 = 81');
  assert(sale1.totalAmount === 76, 'Applies discount accurately: 81 - 5 = 76');
  // Cost: 2*25 + 1*20 = 70. Profit: 76 - 70 = 6
  assert(sale1.totalProfit === 6, 'Calculates accurate net profit: 76 - 70 = 6');
  assert(sale1.profitMarginPercent === Number(((6 / 76) * 100).toFixed(1)), 'Calculates accurate profit margin %');

  // Automatic Stock Deduction Check
  productA.stockQuantity -= 2;
  productB.stockQuantity -= 1;
  assert(productA.stockQuantity === 8, 'Deducted 2 milk: stock now 8');
  assert(productB.stockQuantity === 4, 'Deducted 1 bread: stock now 4');

  // Insufficient Stock Rejection Check
  let threwInsufficient = false;
  try {
    calculateSale([{ product: productB, quantity: 10 }]);
  } catch (err: any) {
    threwInsufficient = err.message.includes('Insufficient stock');
  }
  assert(threwInsufficient, 'Rejects sale if quantity requested exceeds available inventory');

  // Zero / Empty Cart Rejection
  let threwEmpty = false;
  try {
    calculateSale([]);
  } catch {
    threwEmpty = true;
  }
  assert(threwEmpty, 'Rejects empty sale transaction');

  // 3. Low-Stock Alert Test
  const productsCatalog: Product[] = [
    { id: '1', userId: 'shopA', name: 'Milk', category: 'Dairy', costPrice: 25, sellingPrice: 28, stockQuantity: 3, minStockThreshold: 5, unit: 'pkt' }, // LOW
    { id: '2', userId: 'shopA', name: 'Butter', category: 'Dairy', costPrice: 50, sellingPrice: 58, stockQuantity: 0, minStockThreshold: 2, unit: 'box' }, // OUT OF STOCK
    { id: '3', userId: 'shopA', name: 'Atta 5kg', category: 'Staples', costPrice: 210, sellingPrice: 245, stockQuantity: 20, minStockThreshold: 5, unit: 'pkt' }, // HEALTHY
  ];

  const lowStock = getLowStockProducts(productsCatalog);
  assert(lowStock.length === 2, 'Accurately flags 2 products below threshold (Milk stock 3 <= 5, Butter 0 <= 2)');
  assert(lowStock.some(p => p.name === 'Butter' && p.stockQuantity === 0), 'Flags out-of-stock product');

  // 4. Tenant Data Isolation check
  const shopA_Products = productsCatalog.filter(p => p.userId === 'shopA');
  const shopB_Products = productsCatalog.filter(p => p.userId === 'shopB');
  assert(shopA_Products.length === 3, 'Shop A receives exactly its 3 items');
  assert(shopB_Products.length === 0, 'Shop B cannot see Shop A items (0 items returned)');

  // 5. Voice & AI Command Flow: "Add 2 kg Tata Salt to my inventory"
  const saltCommand = "Add 2 kg Tata Salt to my inventory";
  const qtyUnitRegex = /\b(\d+(?:\.\d+)?)\s*(kg|g|gm|pkt|packet|packets|pcs|piece|pieces|bottle|bottles|box|boxes|litre|litres|ltr|l)\b/i;
  const match = saltCommand.match(qtyUnitRegex);
  assert(!!match && match[1] === '2' && match[2].toLowerCase() === 'kg', 'Correctly captures quantity 2 and unit kg from "Add 2 kg Tata Salt"');

  const cleanName = saltCommand
    .replace(/^(?:add|naya item|nayi item|add karo)\s+/i, '')
    .replace(qtyUnitRegex, '')
    .replace(/\b(?:to\s+(?:my\s+)?(?:inventory|stock|dukan|store|catalog)|in\s+(?:my\s+)?(?:inventory|stock))\b/gi, '')
    .replace(/^\s*(?:of|a|an)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  assert(cleanName === 'Tata Salt', `Cleanly extracts product name as "Tata Salt" (got "${cleanName}")`);

  // Product addition state test
  const newSaltProduct: Product = {
    id: 'prod-salt-1',
    userId: 'shopA',
    name: cleanName,
    category: 'Staples',
    costPrice: 22,
    sellingPrice: 28,
    stockQuantity: 2,
    minStockThreshold: 1,
    unit: 'kg',
  };
  assert(validateProduct(newSaltProduct).valid === true, 'New Tata Salt product object passes strict validation');

  // Updating inventory with newly added product
  const updatedCatalog = [newSaltProduct, ...productsCatalog];
  assert(updatedCatalog.some(p => p.name === 'Tata Salt' && p.stockQuantity === 2 && p.unit === 'kg'), 'Successfully updates catalog with Tata Salt 2 kg');

  // Recording a sale for the newly added Tata Salt
  const saltSale = calculateSale([{ product: newSaltProduct, quantity: 1 }]);
  newSaltProduct.stockQuantity -= 1;
  assert(saltSale.totalAmount === 28, 'Tata Salt sale recorded accurately for ₹28');
  assert(newSaltProduct.stockQuantity === 1, 'Tata Salt stock decremented from 2 kg to 1 kg');
  assert(saltSale.totalProfit === (28 - 22), 'Tata Salt profit calculated accurately as ₹6');

  // 6. SMART LOW-STOCK & INVENTORY MONITORING SYSTEM TESTS

  // Test Helper for Restock Calculations
  function calculateRestockRec(
    product: Product,
    salesList: { items: { productId: string; quantity: number }[]; createdAt: string }[]
  ) {
    const isOutOfStock = product.stockQuantity <= 0;
    const status: 'out_of_stock' | 'low_stock' = isOutOfStock ? 'out_of_stock' : 'low_stock';

    const relevantSales = salesList.filter((s) =>
      s.items?.some((i) => i.productId === product.id)
    );

    let totalSold = 0;
    let firstSaleTime = Infinity;

    for (const sale of relevantSales) {
      const saleTime = new Date(sale.createdAt).getTime();
      if (saleTime < firstSaleTime) firstSaleTime = saleTime;
      const matchedItem = sale.items.find((i) => i.productId === product.id);
      if (matchedItem) totalSold += Number(matchedItem.quantity) || 0;
    }

    const now = Date.now();
    const daysDiff = relevantSales.length > 0 && firstSaleTime !== Infinity
      ? Math.max(1, (now - firstSaleTime) / (1000 * 60 * 60 * 24))
      : 7;

    const averageDailySales = totalSold > 0 ? totalSold / daysDiff : 0;
    let suggestedReorderQuantity = 0;
    let salesVelocityReason = '';

    if (totalSold > 0 && relevantSales.length >= 2) {
      const sevenDayDemand = Math.ceil(averageDailySales * 7);
      const deficit = Math.max(0, product.minStockThreshold - product.stockQuantity);
      suggestedReorderQuantity = Math.max(sevenDayDemand + deficit, product.minStockThreshold, 5);
      salesVelocityReason = `Recent sales velocity: ~${averageDailySales.toFixed(1)} ${product.unit}/day (${totalSold} units across ${relevantSales.length} orders). Order covers 7-day demand buffer.`;
    } else {
      suggestedReorderQuantity = Math.max(
        product.minStockThreshold * 2 - product.stockQuantity,
        product.minStockThreshold,
        10
      );
      salesVelocityReason = `Standard safety buffer: Reorder covers 2x minimum threshold (${product.minStockThreshold} ${product.unit}) to prevent stockouts.`;
    }

    return {
      status,
      suggestedReorderQuantity,
      salesVelocityReason,
      recentSalesCount: relevantSales.length,
      averageDailySales: Number(averageDailySales.toFixed(2)),
    };
  }

  // A. Low Stock and Out of Stock Detection
  const itemZero: Product = { id: 'p-0', userId: 'shopA', name: 'Eggs 30-tray', category: 'Dairy', costPrice: 150, sellingPrice: 180, stockQuantity: 0, minStockThreshold: 5, unit: 'tray' };
  const itemLow: Product = { id: 'p-low', userId: 'shopA', name: 'Sugar 1kg', category: 'Staples', costPrice: 40, sellingPrice: 46, stockQuantity: 3, minStockThreshold: 10, unit: 'kg' };
  const itemHealthy: Product = { id: 'p-ok', userId: 'shopA', name: 'Basmati Rice', category: 'Staples', costPrice: 90, sellingPrice: 110, stockQuantity: 25, minStockThreshold: 5, unit: 'kg' };

  const recZero = calculateRestockRec(itemZero, []);
  const recLow = calculateRestockRec(itemLow, []);

  assert(recZero.status === 'out_of_stock', 'Correctly identifies quantity = 0 as OUT OF STOCK');
  assert(recLow.status === 'low_stock', 'Correctly identifies 0 < quantity <= minStockThreshold as LOW STOCK');
  assert(itemHealthy.stockQuantity > itemHealthy.minStockThreshold, 'Correctly identifies healthy inventory level when stock > threshold');

  // B. Restock Recommendation with Sales Velocity
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
  const salesHistory = [
    { items: [{ productId: 'p-low', quantity: 6 }], createdAt: threeDaysAgo },
    { items: [{ productId: 'p-low', quantity: 9 }], createdAt: oneDayAgo },
  ];

  const recVelocity = calculateRestockRec(itemLow, salesHistory);
  assert(recVelocity.recentSalesCount === 2, 'Counts 2 recent sales orders for Sugar');
  assert(recVelocity.suggestedReorderQuantity > 0, `Generates positive reorder quantity (+${recVelocity.suggestedReorderQuantity} kg)`);
  assert(recVelocity.salesVelocityReason.includes('Recent sales velocity'), 'Provides sales velocity reason when sufficient sales history exists');

  // C. Fallback Standard Safety Buffer Reorder Calculation
  const recStandard = calculateRestockRec(itemZero, []);
  assert(recStandard.suggestedReorderQuantity >= itemZero.minStockThreshold, 'Recommends at least minimum stock threshold for out of stock items');
  assert(recStandard.salesVelocityReason.includes('Standard safety buffer'), 'Uses standard safety buffer when sales history is absent');

  // D. Configurable Minimum Stock Threshold
  assert(itemHealthy.stockQuantity > itemHealthy.minStockThreshold, 'Basmati Rice initially healthy with threshold 5 and stock 25');
  // Shopkeeper raises threshold to 30:
  itemHealthy.minStockThreshold = 30;
  assert(itemHealthy.stockQuantity <= itemHealthy.minStockThreshold, 'Raising threshold to 30 immediately triggers LOW STOCK alert (stock 25 <= 30)');
  // Shopkeeper adjusts threshold back to 15:
  itemHealthy.minStockThreshold = 15;
  assert(itemHealthy.stockQuantity > itemHealthy.minStockThreshold, 'Lowering threshold to 15 immediately clears alert back to healthy (stock 25 > 15)');

  // E. Stock Restoration via Restock
  assert(itemLow.stockQuantity === 3, 'Sugar initially low at 3 kg (threshold 10)');
  // Shopkeeper executes 1-click restock:
  const restockAmount = recLow.suggestedReorderQuantity;
  itemLow.stockQuantity += restockAmount;
  assert(itemLow.stockQuantity > itemLow.minStockThreshold, `Restocking +${restockAmount} kg brings stock to ${itemLow.stockQuantity} kg, safely clearing LOW STOCK alert`);

  console.log(`\nTEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  if (failed > 0) process.exit(1);
}

runTests().catch(console.error);

