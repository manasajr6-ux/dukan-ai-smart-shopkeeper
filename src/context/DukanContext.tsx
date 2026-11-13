import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  writeBatch,
  increment,
} from 'firebase/firestore';
import {
  auth,
  db,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  googleProvider,
  handleFirestoreError,
  OperationType,
  User,
} from '../firebase/config';
import { Product, Sale, SaleItem, UserProfile, AICommandResponse, PaymentMode, RestockRecommendation, AssistantLanguage } from '../types';
import { INITIAL_PRODUCTS, INITIAL_DEMO_PRODUCTS, INITIAL_DEMO_SALES } from '../data/seedData';
import { computePeriodSummaries } from '../utils/analytics';

interface DukanContextType {
  user: User | { uid: string; displayName: string; email?: string; isAnonymous?: boolean } | null;
  profile: UserProfile | null;
  loading: boolean;
  authError: string | null;
  isDemoMode: boolean;
  isFirestoreConnected: boolean;
  products: Product[];
  sales: Sale[];
  lowStockProducts: Product[];
  outOfStockProducts: Product[];
  restockRecommendations: RestockRecommendation[];
  getRestockRecommendation: (product: Product) => RestockRecommendation;
  updateMinStockThreshold: (id: string, newThreshold: number) => Promise<void>;
  restockProduct: (id: string, quantityToAdd: number) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginAsDemo: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  addProduct: (product: Omit<Product, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateProduct: (id: string, updates: Partial<Omit<Product, 'id' | 'userId' | 'createdAt'>>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  quickAdjustStock: (id: string, delta: number) => Promise<void>;
  recordSale: (saleInput: {
    customerName?: string;
    customerPhone?: string;
    items: { productId: string; quantity: number; unitPrice?: number }[];
    discount?: number;
    paymentMode: PaymentMode;
    paymentStatus?: 'paid' | 'pending_credit';
    notes?: string;
  }) => Promise<Sale>;
  processAICommand: (commandText: string) => Promise<AICommandResponse>;
  interpretAICommand: (commandText: string, lang?: AssistantLanguage) => Promise<AICommandResponse>;
  executeAICommandResult: (result: AICommandResponse) => Promise<{ executed: boolean; summary?: string }>;
  assistantLanguage: AssistantLanguage;
  setAssistantLanguage: (lang: AssistantLanguage) => void;
  speechEnabled: boolean;
  setSpeechEnabled: (enabled: boolean) => void;
  speakText: (text: string, lang?: AssistantLanguage) => void;
  seedInitialData: () => Promise<void>;
  resetToDemoData: () => void;
}

const DukanContext = createContext<DukanContextType | undefined>(undefined);

const DEMO_USER = {
  uid: 'demo-shopkeeper-uid',
  displayName: 'Ramesh Sharma',
  email: 'demo@apnadukan.in',
  isAnonymous: true,
};

const DEFAULT_DEMO_PROFILE: UserProfile = {
  userId: 'demo-shopkeeper-uid',
  shopName: 'Sharma Kirana Store',
  ownerName: 'Ramesh Sharma',
  phone: '+91 98765 43210',
  currency: '₹',
  lowStockThresholdDefault: 5,
  createdAt: new Date().toISOString(),
};

export const DukanProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | typeof DEMO_USER | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [isFirestoreConnected, setIsFirestoreConnected] = useState<boolean>(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [speechEnabled, setSpeechEnabled] = useState<boolean>(true);
  const [assistantLanguage, setAssistantLanguageState] = useState<AssistantLanguage>(() => {
    try {
      const saved = localStorage.getItem('dukan_assistant_lang');
      if (saved === 'kn' || saved === 'hi' || saved === 'en') return saved;
    } catch {
      // ignore
    }
    return 'en';
  });

  const setAssistantLanguage = (lang: AssistantLanguage) => {
    setAssistantLanguageState(lang);
    try {
      localStorage.setItem('dukan_assistant_lang', lang);
    } catch {
      // ignore
    }
  };

  // Helper to sync local demo data to localStorage
  const saveDemoState = (newProducts: Product[], newSales: Sale[]) => {
    try {
      localStorage.setItem('dukan_demo_products', JSON.stringify(newProducts));
      localStorage.setItem('dukan_demo_sales', JSON.stringify(newSales));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  };

  // Multilingual Text-To-Speech helper (kn-IN, hi-IN, en-IN)
  const speakText = (text: string, langOverride?: AssistantLanguage) => {
    if (!speechEnabled || typeof window === 'undefined' || !('speechSynthesis' in window) || !text?.trim()) return;
    try {
      window.speechSynthesis.cancel();
      const targetLang = langOverride || assistantLanguage;
      const localeMap: Record<AssistantLanguage, string> = {
        kn: 'kn-IN',
        hi: 'hi-IN',
        en: 'en-IN',
      };
      const locale = localeMap[targetLang] || 'en-IN';
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.lang = locale;

      const voices = window.speechSynthesis.getVoices ? window.speechSynthesis.getVoices() : [];
      if (voices.length > 0) {
        const exactVoice = voices.find((v) => v.lang.toLowerCase() === locale.toLowerCase());
        const prefixVoice = voices.find((v) => v.lang.toLowerCase().startsWith(targetLang));
        if (exactVoice) utterance.voice = exactVoice;
        else if (prefixVoice) utterance.voice = prefixVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis failed:', e);
    }
  };

  // Initialize Demo Mode
  const activateDemoMode = () => {
    setIsDemoMode(true);
    setUser(DEMO_USER);
    setProfile(DEFAULT_DEMO_PROFILE);

    // Retrieve from localStorage or fallback to initial seed
    let initialProds: Product[] = INITIAL_DEMO_PRODUCTS;
    let initialSales: Sale[] = INITIAL_DEMO_SALES;

    try {
      const storedProds = localStorage.getItem('dukan_demo_products');
      if (storedProds) {
        initialProds = JSON.parse(storedProds);
      } else {
        localStorage.setItem('dukan_demo_products', JSON.stringify(initialProds));
      }

      const storedSales = localStorage.getItem('dukan_demo_sales');
      if (storedSales) {
        initialSales = JSON.parse(storedSales);
      } else {
        localStorage.setItem('dukan_demo_sales', JSON.stringify(initialSales));
      }
    } catch (e) {
      console.warn('Failed reading localStorage demo data:', e);
    }

    setProducts(initialProds);
    setSales(initialSales);
    setLoading(false);
  };

  // Reset to default demo data
  const resetToDemoData = () => {
    setProducts(INITIAL_DEMO_PRODUCTS);
    setSales(INITIAL_DEMO_SALES);
    saveDemoState(INITIAL_DEMO_PRODUCTS, INITIAL_DEMO_SALES);
    setProfile(DEFAULT_DEMO_PROFILE);
  };

  // Auth Initialization with safety timeout
  useEffect(() => {
    let resolved = false;

    // Safety timeout: If Firebase auth does not report within 1200ms, unblock loading
    const safetyTimer = setTimeout(() => {
      if (!resolved) {
        console.warn('Firebase initialization timed out. Unblocking UI.');
        resolved = true;
        // Check if user previously had demo session
        const hadDemo = localStorage.getItem('dukan_active_session') === 'demo';
        if (hadDemo) {
          activateDemoMode();
        } else {
          setLoading(false);
        }
      }
    }, 1200);

    let unsubscribeAuth: (() => void) | null = null;

    try {
      unsubscribeAuth = onAuthStateChanged(
        auth,
        async (currentUser) => {
          resolved = true;
          clearTimeout(safetyTimer);

          if (currentUser) {
            setIsDemoMode(false);
            setUser(currentUser);
            setAuthError(null);
            setIsFirestoreConnected(true);

            // Subscribe to Firestore Profile
            try {
              const profileDocRef = doc(db, 'users', currentUser.uid);
              onSnapshot(
                profileDocRef,
                (snap) => {
                  if (snap.exists()) {
                    setProfile(snap.data() as UserProfile);
                  } else {
                    const defaultProfile: UserProfile = {
                      userId: currentUser.uid,
                      shopName: currentUser.displayName
                        ? `${currentUser.displayName}'s Kirana Store`
                        : 'Apna Dukan - Smart Store',
                      ownerName: currentUser.displayName || 'Shopkeeper',
                      phone: currentUser.phoneNumber || '',
                      currency: '₹',
                      lowStockThresholdDefault: 5,
                      createdAt: new Date().toISOString(),
                    };
                    setDoc(profileDocRef, defaultProfile).catch((e) =>
                      console.warn('Failed writing default profile to Firestore:', e)
                    );
                    setProfile(defaultProfile);
                  }
                },
                (err) => {
                  console.warn('Firestore user profile listener failed, falling back to local:', err.message);
                  setProfile({
                    userId: currentUser.uid,
                    shopName: currentUser.displayName
                      ? `${currentUser.displayName}'s Store`
                      : 'Apna Dukan',
                    ownerName: currentUser.displayName || 'Shopkeeper',
                    currency: '₹',
                    lowStockThresholdDefault: 5,
                    createdAt: new Date().toISOString(),
                  });
                }
              );
            } catch (err) {
              console.warn('Profile init catch:', err);
            }
          } else {
            // Check if user had local demo mode active
            const hadDemo = localStorage.getItem('dukan_active_session') === 'demo';
            if (hadDemo) {
              activateDemoMode();
            } else {
              setUser(null);
              setProfile(null);
              setProducts([]);
              setSales([]);
            }
          }
          setLoading(false);
        },
        (error) => {
          console.warn('onAuthStateChanged error:', error);
          resolved = true;
          clearTimeout(safetyTimer);
          setLoading(false);
        }
      );
    } catch (err) {
      console.warn('Firebase Auth could not be initialized:', err);
      resolved = true;
      clearTimeout(safetyTimer);
      setLoading(false);
    }

    return () => {
      clearTimeout(safetyTimer);
      if (unsubscribeAuth) unsubscribeAuth();
    };
  }, []);

  // Products Listener (Firestore when connected and not in demo mode)
  useEffect(() => {
    if (isDemoMode || !user || !('email' in user && !user.isAnonymous)) {
      return;
    }

    try {
      const q = query(collection(db, 'products'), where('userId', '==', user.uid));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          setIsFirestoreConnected(true);
          const loaded: Product[] = [];
          snapshot.forEach((d) => {
            loaded.push({ id: d.id, ...(d.data() as Omit<Product, 'id'>) });
          });
          loaded.sort((a, b) => a.name.localeCompare(b.name));
          setProducts(loaded);

          // Auto-seed Firestore if user has 0 products
          if (loaded.length === 0 && !snapshot.metadata.hasPendingWrites) {
            seedInitialData();
          }
        },
        (error) => {
          console.warn('Firestore Products query error. Falling back to local catalog:', error.message);
          setIsFirestoreConnected(false);
          if (products.length === 0) {
            setProducts(INITIAL_DEMO_PRODUCTS);
          }
        }
      );
      return () => unsubscribe();
    } catch (err) {
      console.warn('Products query exception:', err);
    }
  }, [user, isDemoMode]);

  // Sales Listener (Firestore when connected and not in demo mode)
  useEffect(() => {
    if (isDemoMode || !user || !('email' in user && !user.isAnonymous)) {
      return;
    }

    try {
      const q = query(collection(db, 'sales'), where('userId', '==', user.uid));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          setIsFirestoreConnected(true);
          const loaded: Sale[] = [];
          snapshot.forEach((d) => {
            loaded.push({ id: d.id, ...(d.data() as Omit<Sale, 'id'>) });
          });
          loaded.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setSales(loaded);
        },
        (error) => {
          console.warn('Firestore Sales query error. Falling back to local history:', error.message);
          setIsFirestoreConnected(false);
          if (sales.length === 0) {
            setSales(INITIAL_DEMO_SALES);
          }
        }
      );
      return () => unsubscribe();
    } catch (err) {
      console.warn('Sales query exception:', err);
    }
  }, [user, isDemoMode]);

  // Computed Low Stock & Out of Stock
  const lowStockProducts = useMemo(() => {
    return products.filter((p) => p.stockQuantity > 0 && p.stockQuantity <= p.minStockThreshold);
  }, [products]);

  const outOfStockProducts = useMemo(() => {
    return products.filter((p) => p.stockQuantity <= 0);
  }, [products]);

  // Calculate restock recommendation based on recent sales velocity
  const calculateRestockRecommendation = (product: Product, allSales: Sale[]): RestockRecommendation => {
    const isOutOfStock = product.stockQuantity <= 0;
    const status: 'out_of_stock' | 'low_stock' = isOutOfStock ? 'out_of_stock' : 'low_stock';

    let totalSold = 0;
    let firstSaleTime = Date.now();
    let hasSales = false;

    allSales.forEach((s) => {
      s.items?.forEach((it) => {
        if (it.productId === product.id || it.productName.toLowerCase() === product.name.toLowerCase()) {
          totalSold += Number(it.quantity) || 0;
          hasSales = true;
          const t = new Date(s.createdAt).getTime();
          if (!isNaN(t) && t < firstSaleTime) firstSaleTime = t;
        }
      });
    });

    const now = Date.now();
    const daysDiff = Math.max(1, Math.ceil((now - firstSaleTime) / (1000 * 60 * 60 * 24)));
    const avgDaily = hasSales && totalSold > 0 ? totalSold / daysDiff : 0;

    let suggestedQty = 0;
    let reason = '';

    if (hasSales && totalSold > 0) {
      // 7-day safety buffer based on sales velocity
      const targetBuffer = Math.ceil(avgDaily * 7);
      const deficit = Math.max(0, product.minStockThreshold - product.stockQuantity);
      suggestedQty = Math.max(targetBuffer + deficit, (product.minStockThreshold * 2) - product.stockQuantity, 5);
      reason = `Based on sales velocity: ${totalSold} ${product.unit} sold (~${avgDaily.toFixed(1)}/day for 7-day cover)`;
    } else {
      // Standard recommended buffer: 2x minimum threshold minus current stock, minimum 5
      suggestedQty = Math.max((product.minStockThreshold * 2) - product.stockQuantity, product.minStockThreshold || 5, 10);
      reason = `Standard safety buffer (2x minimum threshold of ${product.minStockThreshold} ${product.unit})`;
    }

    return {
      productId: product.id,
      productName: product.name,
      category: product.category,
      currentStock: product.stockQuantity,
      minThreshold: product.minStockThreshold,
      unit: product.unit,
      status,
      suggestedReorderQuantity: Math.ceil(suggestedQty),
      salesVelocityReason: reason,
      recentSalesCount: totalSold,
      averageDailySales: Number(avgDaily.toFixed(1)),
    };
  };

  const getRestockRecommendation = (product: Product): RestockRecommendation => {
    return calculateRestockRecommendation(product, sales);
  };

  const restockRecommendations = useMemo(() => {
    const critical = products.filter((p) => p.stockQuantity <= p.minStockThreshold);
    return critical.map((p) => calculateRestockRecommendation(p, sales));
  }, [products, sales]);

  const updateMinStockThreshold = async (id: string, newThreshold: number) => {
    const parsed = Number(newThreshold);
    if (isNaN(parsed) || parsed < 0) {
      throw new Error('Minimum threshold must be a non-negative number');
    }
    await updateProduct(id, { minStockThreshold: parsed });
  };

  const restockProduct = async (id: string, quantityToAdd: number) => {
    const parsedQty = Number(quantityToAdd);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      throw new Error('Restock quantity must be greater than 0');
    }
    const target = products.find((p) => p.id === id);
    if (!target) throw new Error('Product not found in inventory');
    await updateProduct(id, { stockQuantity: target.stockQuantity + parsedQty });
  };

  // Authentication Handlers
  const loginWithGoogle = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      localStorage.removeItem('dukan_active_session');
    } catch (err: any) {
      console.warn('Google Sign In failed:', err);
      // Give clear actionable feedback
      setAuthError('Google popup blocked or unavailable in this window. Switched to Demo Mode so you can use the app immediately.');
      activateDemoMode();
      localStorage.setItem('dukan_active_session', 'demo');
    } finally {
      setLoading(false);
    }
  };

  const loginAsDemo = async () => {
    setLoading(true);
    setAuthError(null);
    localStorage.setItem('dukan_active_session', 'demo');
    activateDemoMode();
  };

  const logout = async () => {
    try {
      localStorage.removeItem('dukan_active_session');
      setIsDemoMode(false);
      await signOut(auth).catch(() => {});
      setUser(null);
      setProfile(null);
      setProducts([]);
      setSales([]);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!profile) return;
    const newProfile = { ...profile, ...updates };
    setProfile(newProfile);

    if (isDemoMode) return;

    if (user && 'uid' in user) {
      try {
        const docRef = doc(db, 'users', user.uid);
        await setDoc(docRef, newProfile, { merge: true });
      } catch (err) {
        console.warn('Update profile Firestore error:', err);
      }
    }
  };

  // Seed Initial Inventory into Firestore
  const seedInitialData = async () => {
    if (isDemoMode) {
      resetToDemoData();
      return;
    }

    if (!user) return;
    try {
      const batch = writeBatch(db);
      const now = new Date().toISOString();

      INITIAL_PRODUCTS.forEach((prod) => {
        const productDocRef = doc(collection(db, 'products'));
        const newProduct: Omit<Product, 'id'> = {
          ...prod,
          userId: user.uid,
          createdAt: now,
          updatedAt: now,
        };
        batch.set(productDocRef, newProduct);
      });

      await batch.commit();
      console.log('Starter inventory successfully seeded into Firestore.');
    } catch (err) {
      console.warn('Failed to seed inventory into Firestore, using local catalog:', err);
      setProducts(INITIAL_DEMO_PRODUCTS);
    }
  };

  // Add Product with strict validation
  const addProduct = async (
    productInput: Omit<Product, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ): Promise<string> => {
    const name = productInput.name?.trim();
    if (!name || name.length > 150) {
      throw new Error('Product name is required (max 150 characters)');
    }
    const costPrice = Number(productInput.costPrice);
    const sellingPrice = Number(productInput.sellingPrice);
    const stockQuantity = Number(productInput.stockQuantity);
    const minStockThreshold = Number(productInput.minStockThreshold);

    if (isNaN(costPrice) || costPrice < 0) throw new Error('Cost price must be >= 0');
    if (isNaN(sellingPrice) || sellingPrice < 0) throw new Error('Selling price must be >= 0');
    if (isNaN(stockQuantity) || stockQuantity < 0) throw new Error('Stock quantity must be >= 0');
    if (isNaN(minStockThreshold) || minStockThreshold < 0) throw new Error('Threshold must be >= 0');

    const now = new Date().toISOString();
    const id = `prod-${Date.now()}`;
    const newProduct: Product = {
      id,
      userId: user?.uid || 'demo-shopkeeper-uid',
      name,
      category: productInput.category || 'General',
      barcode: productInput.barcode?.trim() || '',
      costPrice,
      sellingPrice,
      stockQuantity,
      minStockThreshold,
      unit: productInput.unit || 'pcs',
      createdAt: now,
      updatedAt: now,
    };

    const updated = [newProduct, ...products];
    setProducts(updated);

    if (isDemoMode || !isFirestoreConnected) {
      saveDemoState(updated, sales);
      return id;
    }

    try {
      const docRef = doc(collection(db, 'products'));
      await setDoc(docRef, { ...newProduct, id: docRef.id });
      return docRef.id;
    } catch (err) {
      console.warn('Firestore write failed, saved locally:', err);
      saveDemoState(updated, sales);
      return id;
    }
  };

  // Update Product with validation
  const updateProduct = async (
    id: string,
    updates: Partial<Omit<Product, 'id' | 'userId' | 'createdAt'>>
  ) => {
    const existing = products.find((p) => p.id === id);
    if (!existing) throw new Error('Product not found');

    const updatedProd: Product = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const newProducts = products.map((p) => (p.id === id ? updatedProd : p));
    setProducts(newProducts);

    if (isDemoMode || !isFirestoreConnected) {
      saveDemoState(newProducts, sales);
      return;
    }

    try {
      const productRef = doc(db, 'products', id);
      await updateDoc(productRef, {
        ...updates,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Firestore update failed, kept locally:', err);
      saveDemoState(newProducts, sales);
    }
  };

  // Delete Product
  const deleteProduct = async (id: string) => {
    const newProducts = products.filter((p) => p.id !== id);
    setProducts(newProducts);

    if (isDemoMode || !isFirestoreConnected) {
      saveDemoState(newProducts, sales);
      return;
    }

    try {
      const productRef = doc(db, 'products', id);
      await deleteDoc(productRef);
    } catch (err) {
      console.warn('Firestore delete failed, removed locally:', err);
      saveDemoState(newProducts, sales);
    }
  };

  // Quick Stock Adjust
  const quickAdjustStock = async (id: string, delta: number) => {
    const prod = products.find((p) => p.id === id);
    if (!prod) return;
    const newQty = Math.max(0, prod.stockQuantity + delta);
    await updateProduct(id, { stockQuantity: newQty });
  };

  // Record Sale and automatically deduct inventory
  const recordSale = async (saleInput: {
    customerName?: string;
    customerPhone?: string;
    items: { productId: string; quantity: number; unitPrice?: number }[];
    discount?: number;
    paymentMode: PaymentMode;
    paymentStatus?: 'paid' | 'pending_credit';
    notes?: string;
  }): Promise<Sale> => {
    if (!saleInput.items || saleInput.items.length === 0) {
      throw new Error('Cannot save sale with zero items');
    }

    const saleItems: SaleItem[] = [];
    let subtotal = 0;
    let totalCost = 0;

    // Local clone for inventory deduction
    const updatedProducts = [...products];

    for (const itemInput of saleInput.items) {
      const prodIndex = updatedProducts.findIndex((p) => p.id === itemInput.productId);
      if (prodIndex === -1) {
        throw new Error(`Product not found`);
      }
      const product = updatedProducts[prodIndex];
      const qty = Number(itemInput.quantity);
      if (isNaN(qty) || qty <= 0) {
        throw new Error(`Invalid quantity ${qty} for item ${product.name}`);
      }

      const unitPrice = itemInput.unitPrice !== undefined ? Number(itemInput.unitPrice) : product.sellingPrice;
      const lineTotal = Number((qty * unitPrice).toFixed(2));
      const lineCost = Number((qty * product.costPrice).toFixed(2));

      subtotal += lineTotal;
      totalCost += lineCost;

      saleItems.push({
        productId: product.id,
        productName: product.name,
        quantity: qty,
        unit: product.unit,
        unitPrice,
        costPrice: product.costPrice,
        totalPrice: lineTotal,
      });

      // Deduct inventory
      updatedProducts[prodIndex] = {
        ...product,
        stockQuantity: Math.max(0, product.stockQuantity - qty),
        updatedAt: new Date().toISOString(),
      };
    }

    const discount = Number(saleInput.discount || 0);
    const totalAmount = Math.max(0, Number((subtotal - discount).toFixed(2)));
    const totalProfit = Number((totalAmount - totalCost).toFixed(2));

    const billNumber = `INV-${Date.now().toString().slice(-6)}`;
    const saleId = `sale-${Date.now()}`;
    const now = new Date().toISOString();

    const createdSale: Sale = {
      id: saleId,
      userId: user?.uid || 'demo-shopkeeper-uid',
      billNumber,
      customerName: saleInput.customerName?.trim() || 'Walk-in Customer',
      customerPhone: saleInput.customerPhone?.trim() || '',
      items: saleItems,
      subtotal,
      discount,
      totalAmount,
      totalProfit,
      paymentMode: saleInput.paymentMode || 'cash',
      paymentStatus:
        saleInput.paymentStatus || (saleInput.paymentMode === 'credit_khata' ? 'pending_credit' : 'paid'),
      notes: saleInput.notes?.trim() || '',
      createdAt: now,
    };

    // Update local state immediately
    const updatedSales = [createdSale, ...sales];
    setProducts(updatedProducts);
    setSales(updatedSales);

    if (isDemoMode || !isFirestoreConnected) {
      saveDemoState(updatedProducts, updatedSales);
      return createdSale;
    }

    // Attempt Firebase atomic batch write
    try {
      const batch = writeBatch(db);
      const saleDocRef = doc(collection(db, 'sales'));
      batch.set(saleDocRef, { ...createdSale, id: saleDocRef.id });

      for (const item of saleItems) {
        const prodRef = doc(db, 'products', item.productId);
        batch.update(prodRef, {
          stockQuantity: increment(-item.quantity),
          updatedAt: now,
        });
      }
      await batch.commit();
      return { ...createdSale, id: saleDocRef.id };
    } catch (err) {
      console.warn('Firestore sale sync failed, saved locally:', err);
      saveDemoState(updatedProducts, updatedSales);
      return createdSale;
    }
  };

  // Interpret Natural Language & Multilingual Command via Gemini (without immediate mutation)
  const interpretAICommand = async (
    commandText: string,
    lang?: AssistantLanguage
  ): Promise<AICommandResponse> => {
    if (!commandText.trim()) throw new Error('Command text is empty');
    const selectedLang = lang || assistantLanguage;

    const inventoryContext = products.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      sellingPrice: p.sellingPrice,
      costPrice: p.costPrice,
      stockQuantity: p.stockQuantity,
      minStockThreshold: p.minStockThreshold,
      unit: p.unit,
    }));

    const periods = computePeriodSummaries(sales, products);
    const salesContext = {
      todayRevenue: periods.today.revenue,
      todayGrossProfit: periods.today.grossProfit,
      todayBillsCount: periods.today.billsCount,
      todayItemsCount: periods.today.itemsCount,
      weekRevenue: periods.week.revenue,
      monthRevenue: periods.month.revenue,
    };

    const response = await fetch('/api/gemini/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command: commandText,
        language: selectedLang,
        inventoryContext,
        salesContext,
        shopContext: {
          shopName: profile?.shopName || 'My Dukan',
          currency: profile?.currency || '₹',
        },
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'AI assistant request failed');
    }

    const json = await response.json();
    const result: AICommandResponse = {
      ...json.data,
      language: json.data?.language || selectedLang,
    };
    return result;
  };

  // Execute a confirmed AI Command result (Sale, Add Product, Update Product, Delete Product)
  const executeAICommandResult = async (
    result: AICommandResponse
  ): Promise<{ executed: boolean; summary?: string }> => {
    const lang = result.language || assistantLanguage;

    if (result.intent === 'RECORD_SALE' && result.saleData?.items?.length) {
      const itemsToRecord: { productId: string; quantity: number; unitPrice?: number }[] = [];

      for (const item of result.saleData.items) {
        let matched = products.find((p) => p.id === item.matchedProductId);
        if (!matched && item.productName) {
          const lowerName = item.productName.toLowerCase();
          matched = products.find(
            (p) =>
              p.name.toLowerCase().includes(lowerName) ||
              lowerName.includes(p.name.toLowerCase())
          );
        }

        if (matched) {
          itemsToRecord.push({
            productId: matched.id,
            quantity: Number(item.quantity) || 1,
            unitPrice: item.unitPrice || matched.sellingPrice,
          });
        }
      }

      if (itemsToRecord.length === 0) {
        throw new Error('Could not find matching inventory items to record this sale.');
      }

      const recorded = await recordSale({
        customerName: result.saleData.customerName,
        customerPhone: result.saleData.customerPhone,
        items: itemsToRecord,
        paymentMode: result.saleData.paymentMode || 'cash',
        paymentStatus: result.saleData.paymentStatus,
        notes: result.saleData.notes,
      });

      const confirmSpeech =
        lang === 'kn'
          ? `ಮಾರಾಟ ಯಶಸ್ವಿಯಾಗಿ ದಾಖಲಾಗಿದೆ. ಬಿಲ್ ಮೊತ್ತ ₹${recorded.totalAmount}.`
          : lang === 'hi'
          ? `बिक्री सफलतापूर्वक दर्ज हो गई है। बिल राशि ₹${recorded.totalAmount}।`
          : `Sale recorded successfully! Bill ${recorded.billNumber} for ₹${recorded.totalAmount}.`;
      speakText(confirmSpeech, lang);

      return { executed: true, summary: confirmSpeech };
    } else if (result.intent === 'ADD_PRODUCT' && result.productData) {
      const prodName = (result.productData.name || 'New Item').trim();
      const lowerName = prodName.toLowerCase();
      const existing = products.find(
        (p) => p.name.toLowerCase() === lowerName || p.name.toLowerCase().includes(lowerName)
      );
      if (existing) {
        const addedQty = Number(result.productData.stockQuantity) || 1;
        await updateProduct(existing.id, {
          stockQuantity: existing.stockQuantity + addedQty,
          sellingPrice: result.productData.sellingPrice || existing.sellingPrice,
        });
      } else {
        await addProduct({
          name: prodName,
          category: result.productData.category || 'General',
          costPrice:
            Number(result.productData.costPrice) ||
            Math.max(1, Math.round((Number(result.productData.sellingPrice) || 30) * 0.8)),
          sellingPrice: Number(result.productData.sellingPrice) || 30,
          stockQuantity: Number(result.productData.stockQuantity) || 1,
          minStockThreshold: Number(result.productData.minStockThreshold) || 2,
          unit: result.productData.unit || 'pcs',
          barcode: result.productData.barcode || '',
        });
      }

      const confirmSpeech =
        lang === 'kn'
          ? `${prodName} ಸ್ಟಾಕ್ಗೆ ಯಶಸ್ವಿಯಾಗಿ ಸೇರಿಸಲಾಗಿದೆ.`
          : lang === 'hi'
          ? `${prodName} सफलतापूर्वक स्टॉक में जोड़ दिया गया है।`
          : `${prodName} added to inventory successfully!`;
      speakText(confirmSpeech, lang);

      return { executed: true, summary: confirmSpeech };
    } else if (result.intent === 'UPDATE_PRODUCT' && result.updateData) {
      let targetProd = products.find((p) => p.id === result.updateData?.matchedProductId);
      if (!targetProd && result.updateData.productName) {
        const lowerName = result.updateData.productName.toLowerCase();
        targetProd = products.find((p) => p.name.toLowerCase().includes(lowerName));
      }
      if (!targetProd) {
        throw new Error('Could not find target product to update.');
      }
      const updates: any = {};
      if (result.updateData.newSellingPrice !== undefined) updates.sellingPrice = result.updateData.newSellingPrice;
      if (result.updateData.newCostPrice !== undefined) updates.costPrice = result.updateData.newCostPrice;
      if (result.updateData.stockQuantity !== undefined) {
        if (result.updateData.stockAdjustmentType === 'add') {
          updates.stockQuantity = targetProd.stockQuantity + result.updateData.stockQuantity;
        } else if (result.updateData.stockAdjustmentType === 'subtract') {
          updates.stockQuantity = Math.max(0, targetProd.stockQuantity - result.updateData.stockQuantity);
        } else {
          updates.stockQuantity = result.updateData.stockQuantity;
        }
      }
      await updateProduct(targetProd.id, updates);
      const confirmSpeech =
        lang === 'kn'
          ? `${targetProd.name} ಮಾಹಿತಿ ನವೀಕರಿಸಲಾಗಿದೆ.`
          : lang === 'hi'
          ? `${targetProd.name} की जानकारी अपडेट हो गई है।`
          : `Updated ${targetProd.name} successfully!`;
      speakText(confirmSpeech, lang);
      return { executed: true, summary: confirmSpeech };
    } else if (result.intent === 'DELETE_PRODUCT' && result.deleteData) {
      let targetProd = products.find((p) => p.id === result.deleteData?.matchedProductId);
      if (!targetProd && result.deleteData.productName) {
        const lowerName = result.deleteData.productName.toLowerCase();
        targetProd = products.find((p) => p.name.toLowerCase().includes(lowerName));
      }
      if (!targetProd) {
        throw new Error('Could not find target product to delete.');
      }
      await deleteProduct(targetProd.id);
      const confirmSpeech =
        lang === 'kn'
          ? `${targetProd.name} ಸ್ಟಾಕ್‌ನಿಂದ ತೆಗೆದುಹಾಕಲಾಗಿದೆ.`
          : lang === 'hi'
          ? `${targetProd.name} को स्टॉक से हटा दिया गया है।`
          : `Removed ${targetProd.name} from inventory.`;
      speakText(confirmSpeech, lang);
      return { executed: true, summary: confirmSpeech };
    }

    return { executed: false };
  };

  // Legacy unified call (interprets and immediately executes)
  const processAICommand = async (commandText: string): Promise<AICommandResponse> => {
    const result = await interpretAICommand(commandText, assistantLanguage);
    if (
      result.intent === 'RECORD_SALE' ||
      result.intent === 'ADD_PRODUCT' ||
      result.intent === 'UPDATE_PRODUCT' ||
      result.intent === 'DELETE_PRODUCT'
    ) {
      await executeAICommandResult(result);
    } else if (result.speechResponse) {
      speakText(result.speechResponse, result.language || assistantLanguage);
    }
    return result;
  };

  return (
    <DukanContext.Provider
      value={{
        user,
        profile,
        loading,
        authError,
        isDemoMode,
        isFirestoreConnected,
        products,
        sales,
        lowStockProducts,
        outOfStockProducts,
        restockRecommendations,
        getRestockRecommendation,
        updateMinStockThreshold,
        restockProduct,
        loginWithGoogle,
        loginAsDemo,
        logout,
        updateProfile,
        addProduct,
        updateProduct,
        deleteProduct,
        quickAdjustStock,
        recordSale,
        processAICommand,
        interpretAICommand,
        executeAICommandResult,
        assistantLanguage,
        setAssistantLanguage,
        speechEnabled,
        setSpeechEnabled,
        speakText,
        seedInitialData,
        resetToDemoData,
      }}
    >
      {children}
    </DukanContext.Provider>
  );
};

export const useDukan = () => {
  const context = useContext(DukanContext);
  if (!context) {
    throw new Error('useDukan must be used within a DukanProvider');
  }
  return context;
};
