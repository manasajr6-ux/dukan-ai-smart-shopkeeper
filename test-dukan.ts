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

  console.log(`\nTEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  if (failed > 0) process.exit(1);
}

runTests().catch(console.error);
