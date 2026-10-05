import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import {
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Menu,
  LayoutDashboard,
  ShoppingBag,
  BarChart3,
  Plus,
  Truck,
} from 'lucide-react';
import { Order, OrderStatus, Product, CartItem, StockMovementLog, Sheet3ProductEntry, Sheet4ProfitRow } from './types';
import appConfig from './config/appConfig.json';
import { INITIAL_ORDERS } from './data/initialOrders';
import { INITIAL_PRODUCTS } from './data/initialProducts';
import {
  initAuth,
  googleSignIn,
  logout,
  setAccessToken,
  AuthDomainError,
} from './services/auth';
import {
  DEFAULT_SPREADSHEET_ID,
  extractSpreadsheetId,
  getSheetOrders,
  updateSheetOrderStatus,
  updateSheetVariant,
  updateSheetSource,
  updateSheetCourierStatus,
  updateSheetSteadfastAction,
  updateSheetSteadfastActionBatch,
  updateSheetQuantity,
  updateSheetCustomerDetails,
  appendSheetOrder,
  getSheetProducts,
  fetchSheet3Stock,
  Sheet3StockItem,
  updateSheet3ProductStock,
  matchProductWithSheet3,
  updateSheet3Entry,
  appendSheet3Entry,
  fetchSheet4ProfitData,
  fetchListSheetProductNames,
  fetchListSheetBusinessName,
  getStoredBusinessName,
  fetchSheetSources,
  getStoredSheetSources,
  DEFAULT_SHEET_SOURCES,
  updateOrderCardViaAppsScript,
  buildOrderCardPayload,
  sendSteadfastOrdersViaAppsScript,
  sendNewOrderViaAppsScript,
  getAppsScriptUrl,
  verifyOrderInSheet,
  verifyNewOrderInSheet,
} from './services/sheets';
import { Sidebar, MainTabType } from './components/Sidebar';
import { DashboardHome } from './components/DashboardHome';
import { OrdersView } from './components/OrdersView';
import { ReportsView } from './components/ReportsView';
import { NewOrderModal } from './components/NewOrderModal';
import { ViewOrderModal } from './components/ViewOrderModal';
import { SheetSettingsModal } from './components/SheetSettingsModal';
import { AuthHelpModal } from './components/AuthHelpModal';
import { SteadfastView, checkSteadfastEligibility } from './components/SteadfastView';

export default function App() {
  // Authentication state
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setToken] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Active navigation tab defaults to 'orders' as requested ("app dokle jeno auto sob somoy order tab ta open hoy")
  const [activeTab, setActiveTab] = useState<MainTabType>('orders');

  // Mobile menu open state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Orders and Products data
  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem('app_orders');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const isDateLike = (str: string) => /^\d{1,4}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(str.trim());
          const seen = new Set<string>();
          const initialColGMap = new Map(INITIAL_ORDERS.map((init) => [init.id, init.columnG]));
          return parsed.map((o: Order, idx: number) => {
            let id = String(o.id || '').trim();
            if (!id || isDateLike(id) || seen.has(id)) {
              id = o.trackingCode || (o.rowIndex ? `INV-${1000 + o.rowIndex}` : `INV-${1001 + idx}`);
            }
            while (seen.has(id)) {
              id = `${id}-${idx + 1}`;
            }
            seen.add(id);
            const colG = o.columnG || initialColGMap.get(id) || (o.trackingCode ? initialColGMap.get(o.trackingCode) : undefined);
            return { ...o, id, ...(colG ? { columnG: colG } : {}) };
          });
        }
      } catch (e) {}
    }
    return INITIAL_ORDERS;
  });

  useEffect(() => {
    localStorage.setItem('app_orders', JSON.stringify(orders));
  }, [orders]);

  // Unentered Steadfast orders count (for sidebar and bottom bar badges)
  const unenteredSteadfastOrdersCount = React.useMemo(() => {
    return orders.filter((o) => checkSteadfastEligibility(o).isEligible).length;
  }, [orders]);

  // Processing and Hold orders counts across all products (for Orders tab badges)
  const { allProductsProcessingCount, allProductsHoldCount, processingAndHoldTotal } = React.useMemo(() => {
    let proc = 0;
    let hold = 0;
    orders.forEach((o) => {
      const s = (o.status || '').toLowerCase();
      if (s.includes('proc') || s.includes('প্রসেসিং')) proc++;
      else if (s.includes('hold') || s.includes('হোল্ড')) hold++;
    });
    return {
      allProductsProcessingCount: proc,
      allProductsHoldCount: hold,
      processingAndHoldTotal: proc + hold,
    };
  }, [orders]);

  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('app_products');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return INITIAL_PRODUCTS;
  });

  useEffect(() => {
    localStorage.setItem('app_products', JSON.stringify(products));
  }, [products]);

  const [stockLogs, setStockLogs] = useState<StockMovementLog[]>(() => {
    const saved = localStorage.getItem('app_stock_logs');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [
      {
        id: 'LOG-INIT-1',
        productId: 'PRD-101',
        productName: 'Golden Watch Combo',
        change: 24,
        newStock: 24,
        reason: 'restock',
        date: '08/09/26 10:30',
        timestamp: Date.now() - 86400000,
      },
      {
        id: 'LOG-INIT-2',
        productId: 'PRD-102',
        productName: 'Rose 599tk',
        change: 18,
        newStock: 18,
        reason: 'restock',
        date: '08/09/26 11:15',
        timestamp: Date.now() - 80000000,
      },
      {
        id: 'LOG-INIT-3',
        productId: 'PRD-104',
        productName: 'Dispancer 599tk',
        change: 2,
        newStock: 2,
        reason: 'restock',
        date: '08/09/26 12:00',
        timestamp: Date.now() - 70000000,
      },
    ];
  });

  useEffect(() => {
    localStorage.setItem('app_stock_logs', JSON.stringify(stockLogs));
  }, [stockLogs]);

  const [orderSheetTab, setOrderSheetTab] = useState<string>(() => {
    return localStorage.getItem('order_sheet_tab') || 'Sheet2';
  });

  // Spreadsheet ID
  const [spreadsheetId, setSpreadsheetId] = useState<string>(() => {
    const savedCodeVersion = localStorage.getItem('app_config_updated_at');
    const currentCodeVersion = appConfig.updatedAt || '';
    if (currentCodeVersion && currentCodeVersion !== savedCodeVersion) {
      if (appConfig.spreadsheetId) {
        localStorage.setItem('app_spreadsheet_id', appConfig.spreadsheetId);
      }
      if (appConfig.appsScriptUrl) {
        localStorage.setItem('apps_script_url', appConfig.appsScriptUrl);
      }
      localStorage.setItem('app_config_updated_at', currentCodeVersion);
      return appConfig.spreadsheetId || DEFAULT_SPREADSHEET_ID;
    }
    const saved = localStorage.getItem('app_spreadsheet_id');
    if (saved && saved.trim()) {
      return saved.trim();
    }
    return appConfig.spreadsheetId || DEFAULT_SPREADSHEET_ID;
  });

  useEffect(() => {
    localStorage.setItem('app_spreadsheet_id', spreadsheetId);
  }, [spreadsheetId]);

  // Pull server-persisted config on load if available
  useEffect(() => {
    fetch('/api/config')
      .then((r) => {
        if (!r.ok) return null;
        const ct = r.headers.get('content-type') || '';
        return ct.includes('application/json') ? r.json() : null;
      })
      .then((cfg) => {
        if (!cfg) return;
        if (cfg?.spreadsheetId && cfg.spreadsheetId.trim()) {
          setSpreadsheetId(cfg.spreadsheetId.trim());
          localStorage.setItem('app_spreadsheet_id', cfg.spreadsheetId.trim());
        }
        if (cfg?.appsScriptUrl && cfg.appsScriptUrl.trim()) {
          localStorage.setItem('apps_script_url', cfg.appsScriptUrl.trim());
        }
        if (cfg?.orderSheetTab && cfg.orderSheetTab.trim()) {
          setOrderSheetTab(cfg.orderSheetTab.trim());
          localStorage.setItem('order_sheet_tab', cfg.orderSheetTab.trim());
        }
      })
      .catch(() => {});
  }, []);

  // Syncing & Loading
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sheet 3 Realtime Product Entries & Stock Items
  const [sheet3Entries, setSheet3Entries] = useState<Sheet3ProductEntry[]>(() => {
    try {
      const saved = localStorage.getItem('sheet3_product_entries');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [sheet3StockItems, setSheet3StockItems] = useState<Sheet3StockItem[]>(() => {
    try {
      const saved = localStorage.getItem('sheet3_stock_items');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [isRefreshingSheet3, setIsRefreshingSheet3] = useState<boolean>(false);

  // Track recent local updates so sync does not overwrite newly edited values
  const recentUpdatesRef = useRef<Map<string, { time: number; data: Partial<Order> }>>(new Map());
  const isSyncingInProgressRef = useRef<boolean>(false);
  const isRefreshingSheet3Ref = useRef<boolean>(false);
  const isRefreshingSheet4Ref = useRef<boolean>(false);

  // Sheet 4 profit rows state
  const [sheet4Rows, setSheet4Rows] = useState<Sheet4ProfitRow[]>(() => {
    const saved = localStorage.getItem('app_sheet4_rows');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return [];
  });
  const [isSheet4Loading, setIsSheet4Loading] = useState(false);
  const [sheet4LastUpdated, setSheet4LastUpdated] = useState<Date | null>(null);

  const loadSheet4DataLive = async (
    targetSpreadsheetId: string = spreadsheetId,
    token: string | null = accessToken
  ) => {
    if (isRefreshingSheet4Ref.current) return;
    isRefreshingSheet4Ref.current = true;
    setIsSheet4Loading(true);
    try {
      const cleanId = extractSpreadsheetId(targetSpreadsheetId);
      const res = await fetchSheet4ProfitData(cleanId, token);
      if (res && res.rows && res.rows.length > 0) {
        setSheet4Rows(res.rows);
        setSheet4LastUpdated(new Date());
        try {
          localStorage.setItem('app_sheet4_rows', JSON.stringify(res.rows));
        } catch (e) {}
      }
    } catch (err) {
      console.warn('Failed to load Sheet4 profit data:', err);
    } finally {
      setIsSheet4Loading(false);
      isRefreshingSheet4Ref.current = false;
    }
  };

  // 6 Dynamic Product Names from 'List' Sheet Column B
  const [listProductNames, setListProductNames] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sheet_list_product_names');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 6) return parsed;
      }
    } catch (e) {}
    return [
      'Rose 599',
      'Watch 599',
      'Doll and toys tk',
      'Cutting Dispancer tk',
      'Porbash Rose 990',
      'Porbash Rose 1350',
    ];
  });

  const loadListNamesLive = async (
    targetSpreadsheetId: string = spreadsheetId,
    token: string | null = accessToken
  ) => {
    try {
      const cleanId = extractSpreadsheetId(targetSpreadsheetId);
      const names = await fetchListSheetProductNames(cleanId, token);
      if (names && names.length > 0) {
        setListProductNames(names);
        localStorage.setItem('sheet_list_product_names', JSON.stringify(names));
      }
    } catch (err) {
      console.warn('Failed to live-load List sheet product names:', err);
    }
  };

  // Real-time 8 sources from Google Sheet
  const [sheetSources, setSheetSources] = useState<string[]>(() => {
    return getStoredSheetSources();
  });

  const loadSourcesLive = async (
    targetSpreadsheetId: string = spreadsheetId,
    token: string | null = accessToken
  ) => {
    try {
      const cleanId = extractSpreadsheetId(targetSpreadsheetId);
      const sources = await fetchSheetSources(cleanId, token);
      if (sources && sources.length >= 8) {
        setSheetSources(sources);
      }
    } catch (err) {
      console.warn('Failed to live-load sheet sources:', err);
    }
  };

  // Real-time Business Name from List Sheet Cell E2
  const [businessName, setBusinessName] = useState<string>(() => {
    return getStoredBusinessName();
  });

  const loadBusinessNameLive = async (
    targetSpreadsheetId: string = spreadsheetId,
    token: string | null = accessToken
  ) => {
    try {
      const cleanId = extractSpreadsheetId(targetSpreadsheetId);
      const name = await fetchListSheetBusinessName(cleanId, token);
      if (name) {
        setBusinessName(name);
      }
    } catch (err) {
      console.warn('Failed to live-load List sheet business name:', err);
    }
  };

  // Modals state
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [selectedOrderForView, setSelectedOrderForView] = useState<Order | null>(null);
  const [isSheetSettingsOpen, setIsSheetSettingsOpen] = useState(false);
  const [isAuthHelpOpen, setIsAuthHelpOpen] = useState(false);
  const [authErrorDomain, setAuthErrorDomain] = useState('');

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Fetch Sheet 3 live stock & row entries in real time
  const loadSheet3StockLive = async (targetSpreadsheetId: string = spreadsheetId) => {
    if (isRefreshingSheet3Ref.current) return;
    isRefreshingSheet3Ref.current = true;
    setIsRefreshingSheet3(true);
    try {
      const cleanId = extractSpreadsheetId(targetSpreadsheetId);
      const res = await fetchSheet3Stock(cleanId);

      // 1. Sync Row Entries (Table starting at Row 7)
      if (res.entries && res.entries.length > 0) {
        setSheet3Entries(res.entries);
        try {
          localStorage.setItem('sheet3_product_entries', JSON.stringify(res.entries));
        } catch (e) {}

        // Auto-register any new products from Sheet 3 into products state so all views remain synchronized
        setProducts((prev) => {
          const updated = [...prev];
          res.entries.forEach((entry) => {
            const pName = entry.productName?.trim();
            if (!pName || pName.toLowerCase() === 'product name') return;

            const existing = updated.find((p) => p.name.toLowerCase() === pName.toLowerCase());
            if (existing) {
              if (entry.currentStock !== undefined && !isNaN(entry.currentStock)) {
                existing.stock = entry.currentStock;
                existing.status = entry.currentStock <= 0 ? 'out_of_stock' : 'publish';
              }
              if (entry.currentPrice && !isNaN(Number(entry.currentPrice))) {
                existing.salePrice = Number(entry.currentPrice);
                existing.regularPrice = Number(entry.currentPrice);
              }
            } else {
              const price = entry.currentPrice ? Number(entry.currentPrice) : 599;
              updated.push({
                id: `PRD-S3-${entry.rowIndex}`,
                name: pName,
                category: 'শিট ৩ পণ্য',
                regularPrice: price,
                salePrice: price,
                stock: entry.currentStock || 0,
                status: (entry.currentStock || 0) <= 0 ? 'out_of_stock' : 'publish',
                description: 'গুগল শিট ৩ থেকে রিয়েলটাইম লোডকৃত',
                image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&auto=format&fit=crop&q=60',
                rowIndex: entry.rowIndex,
              });
            }
          });
          return updated;
        });
      }

      // 2. Summary Stock (Sheet 3 A3..F3)
      if (res.stockItems && res.stockItems.length > 0) {
        setSheet3StockItems(res.stockItems);
        try {
          localStorage.setItem('sheet3_stock_items', JSON.stringify(res.stockItems));
        } catch (e) {}

        setProducts((prev) =>
          prev.map((p) => {
            const match = matchProductWithSheet3(p.name, res.stockItems);
            if (match && match.quantity !== undefined && !isNaN(match.quantity)) {
              return {
                ...p,
                stock: match.quantity,
                status: match.quantity <= 0 ? 'out_of_stock' : 'publish',
              };
            }
            return p;
          })
        );
      }

      // 3. Sync transaction logs from Sheet 3
      if (res.logs && res.logs.length > 0) {
        const sheetLogs: StockMovementLog[] = res.logs.map((l, idx) => ({
          id: `SHEET3-LOG-${idx}-${l.date}`,
          productId: l.productName,
          productName: l.productName,
          change: l.inQty ? l.inQty : l.outQty ? -l.outQty : 0,
          newStock: l.balance,
          reason: l.source.toLowerCase().includes('return')
            ? 'return_approved'
            : l.source.toLowerCase().includes('delivery')
            ? 'order_placed'
            : 'manual_update',
          date: l.date,
          timestamp: Date.now() - idx * 1000,
        }));
        setStockLogs(sheetLogs);
      }
    } catch (e) {
      console.warn('Sheet 3 live stock sync error:', e);
    } finally {
      setIsRefreshingSheet3(false);
      isRefreshingSheet3Ref.current = false;
    }
  };

  // Handler to update an existing Sheet 3 row entry
  const handleUpdateSheet3Entry = async (entry: Sheet3ProductEntry) => {
    // Optimistic UI update
    setSheet3Entries((prev) =>
      prev.map((item) => (item.rowIndex === entry.rowIndex ? entry : item))
    );
    showToast(`রো #${entry.rowIndex} শিট ৩-এ সেভ করা হচ্ছে...`, 'success');

    try {
      await updateSheet3Entry(spreadsheetId, accessToken, entry);
      // Verify Sheet 3 read
      await new Promise((r) => setTimeout(r, 600));
      const freshData = await fetchSheet3Stock(spreadsheetId);
      const matched = freshData.entries.find((e) => e.rowIndex === entry.rowIndex);
      if (
        matched &&
        (matched.currentStock === entry.currentStock ||
          matched.stockIn === entry.stockIn ||
          matched.stockOut === entry.stockOut ||
          matched.productName === entry.productName)
      ) {
        showToast(`✅ শিট চেক সম্পন্ন: শিট ৩ রো #${entry.rowIndex} গুগল শিটে আপডেট হয়েছে!`);
      } else {
        showToast(`❌ এটা শিটে আপডেট হয়নি!`, 'error');
      }
      // Refresh in background
      setTimeout(() => loadSheet3StockLive(spreadsheetId), 1000);
    } catch (err) {
      console.error('Failed to update Sheet 3 entry:', err);
      showToast(`❌ এটা শিটে আপডেট হয়নি!`, 'error');
    }
  };

  // Handler to append a new Sheet 3 row entry
  const handleAddSheet3Entry = async (newEntry: Omit<Sheet3ProductEntry, 'rowIndex' | 'id'>) => {
    showToast('স্টক এন্ট্রি JSON পাঠানো হচ্ছে...', 'success');
    const nextRow = sheet3Entries.length > 0
      ? Math.max(...sheet3Entries.map((e) => e.rowIndex)) + 1
      : 19;
    const created: Sheet3ProductEntry = {
      ...newEntry,
      rowIndex: nextRow,
      id: `sheet3-row-${nextRow}-${Date.now()}`,
    };
    // Optimistic add to top of list
    setSheet3Entries((prev) => [created, ...prev]);

    try {
      await appendSheet3Entry(spreadsheetId, accessToken, newEntry);
      // Verify Sheet 3 read
      await new Promise((r) => setTimeout(r, 800));
      const freshData = await fetchSheet3Stock(spreadsheetId);
      const matched = freshData.entries.find((e) => e.productName === newEntry.productName);
      if (matched) {
        showToast(`✅ শিট চেক সম্পন্ন: নতুন স্টক এন্ট্রি গুগল শিটে আপডেট হয়েছে!`);
      } else {
        showToast(`❌ এটা শিটে আপডেট হয়নি!`, 'error');
      }
      setTimeout(() => loadSheet3StockLive(spreadsheetId), 1200);
    } catch (err) {
      console.error('Failed to append Sheet3 entry:', err);
      showToast(`❌ এটা শিটে আপডেট হয়নি!`, 'error');
    }
  };

  // Real-time listener for Sheet 3, Sheet 4, List Sheet & Orders (Polling every 15s + Window Focus + Tab Visibility refresh)
  useEffect(() => {
    loadListNamesLive(spreadsheetId, accessToken);
    loadBusinessNameLive(spreadsheetId, accessToken);
    loadSourcesLive(spreadsheetId, accessToken);
    loadSheet3StockLive(spreadsheetId);
    loadSheet4DataLive(spreadsheetId, accessToken);
    syncWithSheet(spreadsheetId, accessToken, orderSheetTab, true);
    const interval = setInterval(() => {
      loadListNamesLive(spreadsheetId, accessToken);
      loadBusinessNameLive(spreadsheetId, accessToken);
      loadSourcesLive(spreadsheetId, accessToken);
      loadSheet3StockLive(spreadsheetId);
      loadSheet4DataLive(spreadsheetId, accessToken);
      syncWithSheet(spreadsheetId, accessToken, orderSheetTab, true);
    }, 15000);

    const onFocus = () => {
      loadListNamesLive(spreadsheetId, accessToken);
      loadBusinessNameLive(spreadsheetId, accessToken);
      loadSourcesLive(spreadsheetId, accessToken);
      loadSheet3StockLive(spreadsheetId);
      loadSheet4DataLive(spreadsheetId, accessToken);
      syncWithSheet(spreadsheetId, accessToken, orderSheetTab, true);
    };
    const onVisibilityChange = () => {
      if (!document.hidden) {
        loadListNamesLive(spreadsheetId, accessToken);
        loadBusinessNameLive(spreadsheetId, accessToken);
        loadSourcesLive(spreadsheetId, accessToken);
        loadSheet3StockLive(spreadsheetId);
        loadSheet4DataLive(spreadsheetId, accessToken);
        syncWithSheet(spreadsheetId, accessToken, orderSheetTab, true);
      }
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [spreadsheetId, accessToken, orderSheetTab]);

  // 1. Initialize Firebase Auth
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setToken(token);
        setAccessToken(token);
        if (token) {
          syncWithSheet(spreadsheetId, token, orderSheetTab);
        }
      },
      () => {
        setUser(null);
        setToken(null);
        setAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, [spreadsheetId, orderSheetTab]);

  // 2. Sync orders with Google Sheet
  const syncWithSheet = async (
    targetSpreadsheetId: string = spreadsheetId,
    targetToken: string | null = accessToken,
    targetTab: string = orderSheetTab,
    silent: boolean = false
  ) => {
    if (isSyncingInProgressRef.current) return;
    isSyncingInProgressRef.current = true;
    if (!silent) setIsSyncing(true);
    try {
      const cleanId = extractSpreadsheetId(targetSpreadsheetId);
      loadListNamesLive(cleanId, targetToken || undefined);
      loadBusinessNameLive(cleanId, targetToken || undefined);
      loadSourcesLive(cleanId, targetToken || undefined);
      const sheetResult = await getSheetOrders(cleanId, targetToken || undefined, targetTab);

      if (sheetResult.orders && sheetResult.orders.length > 0) {
        setOrders((prevOrders) => {
          const prevMap = new Map(prevOrders.map((o) => [o.id, o]));
          const now = Date.now();

          return sheetResult.orders.map((remoteOrder) => {
            const localOrder = prevMap.get(remoteOrder.id);
            const recent = recentUpdatesRef.current.get(remoteOrder.id);
            const hasRecentUpdate = recent && now - recent.time < 20000;

            let merged = { ...remoteOrder };

            // If updated within 20s locally, keep fresh local edits
            if (hasRecentUpdate && recent) {
              merged = { ...merged, ...recent.data };
            } else if (localOrder) {
              if (!merged.variant && localOrder.variant) merged.variant = localOrder.variant;
              if (!merged.source && localOrder.source) merged.source = localOrder.source;
              if (
                localOrder.steadfastStatus === 'send to steadfast' &&
                merged.steadfastStatus !== 'send to steadfast' &&
                !merged.trackingCode
              ) {
                merged.steadfastStatus = localOrder.steadfastStatus;
              }
            }
            return merged;
          });
        });
        if (!silent) {
          showToast(
            `গুগল শিট (${targetTab}) থেকে ${sheetResult.orders.length} টি অর্ডার সফলভাবে সিঙ্ক হয়েছে!`
          );
        }
      } else if (!silent) {
        showToast(`শিট (${targetTab}) থেকে কোনো অর্ডার পাওয়া যায়নি।`, 'error');
      }
    } catch (err: any) {
      console.warn('Sync sheet error:', err);
      if (!silent) {
        if (err instanceof AuthDomainError) {
          setAuthErrorDomain(err.domain);
          setIsAuthHelpOpen(true);
        } else {
          showToast(`শিট সিঙ্ক তথ্য: ${err.message || 'ত্রুটি'}`, 'error');
        }
      }
    } finally {
      if (!silent) setIsSyncing(false);
      isSyncingInProgressRef.current = false;
    }
  };

  // Google Login Handler
  const handleGoogleSignIn = async () => {
    setIsAuthLoading(true);
    try {
      const result = await googleSignIn();
      setUser(result.user);
      setToken(result.accessToken);
      setAccessToken(result.accessToken);
      showToast(`স্বাগতম, ${result.user.displayName || 'অ্যাডমিন'}! গুগল সাইন-ইন সফল।`);
      await syncWithSheet(spreadsheetId, result.accessToken);
    } catch (err: any) {
      console.error('Login error:', err);
      if (err instanceof AuthDomainError) {
        setAuthErrorDomain(err.domain);
        setIsAuthHelpOpen(true);
      } else {
        showToast(`সাইন ইন ত্রুটি: ${err.message}`, 'error');
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Logout Handler
  const handleLogout = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setAccessToken(null);
    showToast('সফলভাবে লগআউট করা হয়েছে।');
  };

  // Helper to isolate orders without collision
  const isSameOrder = (a: Order, b: Order) => {
    if (a.rowIndex !== undefined && a.rowIndex !== null && b.rowIndex !== undefined && b.rowIndex !== null) {
      return a.rowIndex === b.rowIndex;
    }
    return a.id === b.id;
  };

  // Helper to ensure valid sheet row index (>= 2, never guess row 2 if unknown)
  const resolveRowIndex = (order: Order): number => {
    if (order.rowIndex && order.rowIndex > 1) {
      return order.rowIndex;
    }
    const matched = orders.find(
      (o) =>
        (o.id === order.id || (o.trackingCode && o.trackingCode === order.trackingCode)) &&
        o.rowIndex &&
        o.rowIndex > 1
    );
    if (matched && matched.rowIndex) {
      return matched.rowIndex;
    }
    return 0; // Return 0 if not known, do NOT corrupt row 2
  };

  // 1. Update Status in Column J (isolated per-order)
  const handleUpdateOrderStatus = async (order: Order, newStatus: OrderStatus) => {
    const targetRow = resolveRowIndex(order);

    recentUpdatesRef.current.set(order.id, {
      time: Date.now(),
      data: { status: newStatus },
    });
    setOrders((prev) =>
      prev.map((o) => (isSameOrder(o, order) ? { ...o, status: newStatus, rowIndex: targetRow } : o))
    );

    if (selectedOrderForView && isSameOrder(selectedOrderForView, order)) {
      setSelectedOrderForView((prev) => (prev ? { ...prev, status: newStatus, rowIndex: targetRow } : null));
    }

    // Dispatch exact JSON payload requested by user to Apps Script
    updateOrderCardViaAppsScript(
      buildOrderCardPayload(order, { orderStatus: newStatus })
    );

    if (spreadsheetId && accessToken && targetRow >= 2) {
      try {
        await updateSheetOrderStatus(
          spreadsheetId,
          accessToken,
          orderSheetTab,
          targetRow,
          newStatus,
          order.id
        );
      } catch (err: any) {
        console.warn('Direct updateSheetOrderStatus warning:', err);
      }
    }

    // Read Google Sheet to verify if update was actually applied
    const verification = await verifyOrderInSheet(
      spreadsheetId,
      accessToken,
      orderSheetTab,
      { ...order, rowIndex: targetRow },
      { status: newStatus }
    );

    if (verification.verified) {
      showToast(`✅ শিট চেক সম্পন্ন: অর্ডার #${order.id} এর স্ট্যাটাস '${newStatus}' গুগল শিটে আপডেট হয়েছে!`);
    } else {
      showToast(`❌ এটা শিটে আপডেট হয়নি!`, 'error');
    }
  };

  // 2. Update Variant in Column H (isolated per-order)
  const handleUpdateVariant = async (order: Order, newVariant: string) => {
    const targetRow = resolveRowIndex(order);

    recentUpdatesRef.current.set(order.id, {
      time: Date.now(),
      data: { variant: newVariant },
    });
    setOrders((prev) =>
      prev.map((o) => (isSameOrder(o, order) ? { ...o, variant: newVariant, rowIndex: targetRow } : o))
    );

    if (selectedOrderForView && isSameOrder(selectedOrderForView, order)) {
      setSelectedOrderForView((prev) => (prev ? { ...prev, variant: newVariant, rowIndex: targetRow } : null));
    }

    // Dispatch exact JSON payload requested by user to Apps Script
    updateOrderCardViaAppsScript(
      buildOrderCardPayload(order, { productSelect: newVariant })
    );

    if (spreadsheetId && accessToken && targetRow >= 2) {
      try {
        await updateSheetVariant(
          spreadsheetId,
          accessToken,
          orderSheetTab,
          targetRow,
          newVariant,
          order.id
        );
      } catch (err: any) {
        console.warn('Direct updateSheetVariant warning:', err);
      }
    }

    // Read Google Sheet to verify if update was actually applied
    const verification = await verifyOrderInSheet(
      spreadsheetId,
      accessToken,
      orderSheetTab,
      { ...order, rowIndex: targetRow },
      { variant: newVariant }
    );

    if (verification.verified) {
      showToast(`✅ শিট চেক সম্পন্ন: অর্ডার #${order.id} এর ভ্যারিয়েন্ট '${newVariant}' গুগল শিটে আপডেট হয়েছে!`);
    } else {
      showToast(`❌ এটা শিটে আপডেট হয়নি!`, 'error');
    }
  };

  // 3. Update Source in Column I (isolated per-order)
  const handleUpdateSource = async (order: Order, newSource: string) => {
    const targetRow = resolveRowIndex(order);

    recentUpdatesRef.current.set(order.id, {
      time: Date.now(),
      data: { source: newSource },
    });
    setOrders((prev) =>
      prev.map((o) => (isSameOrder(o, order) ? { ...o, source: newSource, rowIndex: targetRow } : o))
    );

    if (selectedOrderForView && isSameOrder(selectedOrderForView, order)) {
      setSelectedOrderForView((prev) => (prev ? { ...prev, source: newSource, rowIndex: targetRow } : null));
    }

    // Dispatch exact JSON payload requested by user to Apps Script
    updateOrderCardViaAppsScript(
      buildOrderCardPayload(order, { orderSource: newSource })
    );

    if (spreadsheetId && accessToken && targetRow >= 2) {
      try {
        await updateSheetSource(
          spreadsheetId,
          accessToken,
          orderSheetTab,
          targetRow,
          newSource,
          order.id
        );
      } catch (err: any) {
        console.warn('Direct updateSheetSource warning:', err);
      }
    }

    // Read Google Sheet to verify if update was actually applied
    const verification = await verifyOrderInSheet(
      spreadsheetId,
      accessToken,
      orderSheetTab,
      { ...order, rowIndex: targetRow },
      { source: newSource }
    );

    if (verification.verified) {
      showToast(`✅ শিট চেক সম্পন্ন: অর্ডার #${order.id} এর সোর্স '${newSource}' গুগল শিটে আপডেট হয়েছে!`);
    } else {
      showToast(`❌ এটা শিটে আপডেট হয়নি!`, 'error');
    }
  };

  // Update Delivery / Courier Status in Column L
  const handleUpdateCourierStatus = async (order: Order, newCourierStatus: string) => {
    const targetRow = resolveRowIndex(order);
    setOrders((prev) =>
      prev.map((o) => (isSameOrder(o, order) ? { ...o, courierStatus: newCourierStatus, rowIndex: targetRow } : o))
    );

    if (selectedOrderForView && isSameOrder(selectedOrderForView, order)) {
      setSelectedOrderForView((prev) => (prev ? { ...prev, courierStatus: newCourierStatus, rowIndex: targetRow } : null));
    }

    // Dispatch exact JSON payload to Apps Script webhook
    updateOrderCardViaAppsScript(
      buildOrderCardPayload(order)
    );

    if (spreadsheetId && accessToken && targetRow >= 2) {
      try {
        await updateSheetCourierStatus(
          spreadsheetId,
          accessToken,
          orderSheetTab,
          targetRow,
          order.trackingCode || '',
          order.steadfastStatus || 'send to steadfast',
          newCourierStatus,
          order.id
        );
      } catch (err: any) {
        console.warn('Direct updateSheetCourierStatus warning:', err);
      }
    }

    // Read Google Sheet to verify if update was actually applied
    const verification = await verifyOrderInSheet(
      spreadsheetId,
      accessToken,
      orderSheetTab,
      { ...order, rowIndex: targetRow },
      { courierStatus: newCourierStatus }
    );

    if (verification.verified) {
      showToast(`✅ শিট চেক সম্পন্ন: ডেলিভারি স্ট্যাটাস '${newCourierStatus}' গুগল শিটে আপডেট হয়েছে!`);
    } else {
      showToast(`❌ এটা শিটে আপডেট হয়নি!`, 'error');
    }
  };

  // Delete Order Handler
  const handleDeleteOrder = (orderToDelete: Order) => {
    setOrders((prev) => prev.filter((o) => !isSameOrder(o, orderToDelete)));
    showToast(`অর্ডার #${orderToDelete.id} সফলভাবে ডিলিট করা হয়েছে!`);
    if (selectedOrderForView && isSameOrder(selectedOrderForView, orderToDelete)) {
      setSelectedOrderForView(null);
    }
  };

  // 4. Steadfast Courier Action (Toggle in Column M only)
  // "streadfast buton ta sheet er m colum er sathe connect koro and quantity barano komanor button ta n colum er toogle er sathe connect koro"
  const handleToggleSteadfast = async (
    order: Order,
    action?: 'No Sellect' | 'send to steadfast'
  ): Promise<boolean> => {
    const targetRow = resolveRowIndex(order);

    const isAlreadySent =
      order.steadfastStatus === 'send to steadfast' ||
      order.steadfastStatus === 'Sent to Steadfast' ||
      /send to steadfast/i.test(order.steadfastStatus || '');

    const finalSteadfastStatus: 'No Sellect' | 'send to steadfast' =
      action !== undefined
        ? action
        : isAlreadySent
        ? 'No Sellect'
        : 'send to steadfast';

    recentUpdatesRef.current.set(order.id, {
      time: Date.now(),
      data: { steadfastStatus: finalSteadfastStatus },
    });

    setOrders((prev) =>
      prev.map((o) =>
        isSameOrder(o, order)
          ? {
              ...o,
              steadfastStatus: finalSteadfastStatus,
              rowIndex: targetRow,
            }
          : o
      )
    );

    if (selectedOrderForView && isSameOrder(selectedOrderForView, order)) {
      setSelectedOrderForView((prev) =>
        prev
          ? {
              ...prev,
              steadfastStatus: finalSteadfastStatus,
              rowIndex: targetRow,
            }
          : null
      );
    }

    const trackingId = String(order.trackingCode || order.id || '').trim();
    // Dispatch webhook for Steadfast dispatch when sending to steadfast
    if (finalSteadfastStatus === 'send to steadfast') {
      sendSteadfastOrdersViaAppsScript(order, 'send to steadfast');
    } else {
      updateOrderCardViaAppsScript(
        buildOrderCardPayload(order, {
          columnMValue: 'No Select',
        })
      );
    }

    try {
      // Write strictly to Column M in Google Sheet in real-time
      if (spreadsheetId && accessToken && targetRow >= 2) {
        await updateSheetSteadfastAction(
          spreadsheetId,
          accessToken,
          orderSheetTab,
          targetRow,
          finalSteadfastStatus,
          order.id
        );
      }
    } catch (err: any) {
      console.warn('Direct updateSheetSteadfastAction warning:', err);
    }

    // Read Google Sheet to verify if update was actually applied
    const verification = await verifyOrderInSheet(
      spreadsheetId,
      accessToken,
      orderSheetTab,
      { ...order, rowIndex: targetRow },
      { steadfastStatus: finalSteadfastStatus }
    );

    if (verification.verified) {
      showToast(`✅ শিট চেক সম্পন্ন: অর্ডার #${order.id} এর কুরিয়ার অ্যাকশন (Col M) '${finalSteadfastStatus}' গুগল শিটে আপডেট হয়েছে!`);
      // Follow up sync to detect Column K and L updates from Steadfast
      syncWithSheet(spreadsheetId, accessToken, orderSheetTab, true);
      setTimeout(() => syncWithSheet(spreadsheetId, accessToken, orderSheetTab, true), 2500);
      setTimeout(() => syncWithSheet(spreadsheetId, accessToken, orderSheetTab, true), 5000);
    } else {
      showToast(`❌ এটা শিটে আপডেট হয়নি!`, 'error');
    }

    return true;
  };

  // 4b. Batch Send to Steadfast (Update Column M for multiple orders in real-time)
  const handleBatchSendToSteadfast = async (ordersToSend: Order[]): Promise<void> => {
    if (!ordersToSend || ordersToSend.length === 0) return;

    const now = Date.now();
    ordersToSend.forEach((o) => {
      recentUpdatesRef.current.set(o.id, {
        time: now,
        data: { steadfastStatus: 'send to steadfast' },
      });
    });

    const orderIds = new Set(ordersToSend.map((o) => o.id));
    setOrders((prev) =>
      prev.map((o) =>
        orderIds.has(o.id)
          ? {
              ...o,
              steadfastStatus: 'send to steadfast',
              rowIndex: resolveRowIndex(o),
            }
          : o
      )
    );

    showToast(`⚡ ${ordersToSend.length}টি অর্ডার গুগল শিটের M কলামে 'send to steadfast' পাঠানো হচ্ছে...`);

    // Dispatch webhook for Steadfast dispatch (Single Object if 1 order, Bulk Array if >1 orders)
    sendSteadfastOrdersViaAppsScript(ordersToSend, 'send to steadfast').catch((e) => {
      console.warn('Apps script steadfast webhook notice:', e);
    });

    const updates = ordersToSend.map((o) => ({
      rowIndex: resolveRowIndex(o),
      action: 'send to steadfast',
      orderId: o.id,
    }));

    try {
      if (spreadsheetId && accessToken) {
        await updateSheetSteadfastActionBatch(
          spreadsheetId,
          accessToken,
          orderSheetTab,
          updates
        );
      }
    } catch (err) {
      console.warn('Batch send notice:', err);
    }

    // Read Google Sheet to verify if update was actually applied
    const firstOrder = ordersToSend[0];
    const verification = await verifyOrderInSheet(
      spreadsheetId,
      accessToken,
      orderSheetTab,
      { ...firstOrder, rowIndex: resolveRowIndex(firstOrder) },
      { steadfastStatus: 'send to steadfast' },
      { maxRetries: 2, initialDelayMs: 600 }
    );

    if (verification.verified) {
      showToast(`✅ শিট চেক সম্পন্ন: ${ordersToSend.length}টি অর্ডার গুগল শিটে আপডেট হয়েছে!`);
      setTimeout(() => syncWithSheet(spreadsheetId, accessToken, orderSheetTab, true), 2500);
      setTimeout(() => syncWithSheet(spreadsheetId, accessToken, orderSheetTab, true), 5000);
    } else {
      showToast(`❌ এটা শিটে আপডেট হয়নি!`, 'error');
    }
  };

  // 5. Update Order Quantity in Column N (isolated per-order)
  const handleUpdateQuantity = async (order: Order, newQuantity: number) => {
    if (newQuantity < 1) return;
    const targetRow = resolveRowIndex(order);
    recentUpdatesRef.current.set(order.id, {
      time: Date.now(),
      data: { quantity: newQuantity },
    });
    setOrders((prev) =>
      prev.map((o) => (isSameOrder(o, order) ? { ...o, quantity: newQuantity, rowIndex: targetRow } : o))
    );

    if (selectedOrderForView && isSameOrder(selectedOrderForView, order)) {
      setSelectedOrderForView((prev) => (prev ? { ...prev, quantity: newQuantity, rowIndex: targetRow } : null));
    }

    // Dispatch webhook for updated order (sends 1 time only)
    updateOrderCardViaAppsScript(
      buildOrderCardPayload(order, { quantity: newQuantity })
    );

    if (spreadsheetId && accessToken && targetRow >= 2) {
      try {
        await updateSheetQuantity(
          spreadsheetId,
          accessToken,
          orderSheetTab,
          targetRow,
          newQuantity,
          order.id
        );
      } catch (err: any) {
        console.warn('Direct updateSheetQuantity warning:', err);
      }
    }

    // Read Google Sheet to verify if update was actually applied
    const verification = await verifyOrderInSheet(
      spreadsheetId,
      accessToken,
      orderSheetTab,
      { ...order, rowIndex: targetRow },
      { quantity: newQuantity }
    );

    if (verification.verified) {
      showToast(`✅ শিট চেক সম্পন্ন: অর্ডার #${order.id} এর পরিমাণ (Col N) '${newQuantity}' গুগল শিটে আপডেট হয়েছে!`);
    } else {
      showToast(`❌ এটা শিটে আপডেট হয়নি!`, 'error');
    }
  };

  // 6. Update Customer Details (Name, Phone, Address, Price, Quantity in Columns F, C, B, D, N)
  const handleUpdateCustomerDetails = async (
    order: Order,
    details: {
      customerName: string;
      customerPhone: string;
      customerAddress: string;
      amount?: number;
      price?: number;
      quantity?: number;
    }
  ): Promise<boolean> => {
    const targetRow = resolveRowIndex(order);
    const newAmount =
      details.amount !== undefined
        ? details.amount
        : details.price !== undefined
        ? details.price
        : (order.total || order.amount || 599);
    const newQty = details.quantity !== undefined ? details.quantity : (order.quantity || 1);

    recentUpdatesRef.current.set(order.id, {
      time: Date.now(),
      data: {
        customerName: details.customerName,
        customerPhone: details.customerPhone,
        customerAddress: details.customerAddress,
        amount: newAmount,
        total: newAmount,
        quantity: newQty,
      },
    });

    // Optimistically update orders in local state
    setOrders((prev) =>
      prev.map((o) =>
        isSameOrder(o, order)
          ? {
              ...o,
              customerName: details.customerName,
              customerPhone: details.customerPhone,
              customerAddress: details.customerAddress,
              amount: newAmount,
              total: newAmount,
              quantity: newQty,
              rowIndex: targetRow,
            }
          : o
      )
    );

    // Keep selectedOrderForView in sync
    if (selectedOrderForView && isSameOrder(selectedOrderForView, order)) {
      setSelectedOrderForView((prev) =>
        prev
          ? {
              ...prev,
              customerName: details.customerName,
              customerPhone: details.customerPhone,
              customerAddress: details.customerAddress,
              amount: newAmount,
              total: newAmount,
              quantity: newQty,
              rowIndex: targetRow,
            }
          : null
      );
    }

    // Dispatch exact JSON payload requested by user to Apps Script
    updateOrderCardViaAppsScript(
      buildOrderCardPayload(order, {
        name: details.customerName,
        number: details.customerPhone,
        address: details.customerAddress,
        price: newAmount,
        quantity: newQty,
        orderQuantity: newQty,
      })
    );

    if (spreadsheetId && accessToken && targetRow >= 2) {
      try {
        await updateSheetCustomerDetails(
          spreadsheetId,
          accessToken,
          orderSheetTab,
          targetRow,
          {
            ...details,
            amount: newAmount,
          },
          order.id
        );
        if (details.quantity !== undefined && details.quantity !== order.quantity) {
          await updateSheetQuantity(
            spreadsheetId,
            accessToken,
            orderSheetTab,
            targetRow,
            newQty,
            order.id
          );
        }
      } catch (err: any) {
        console.warn('Direct updateSheetCustomerDetails warning:', err);
      }
    }

    // Read Google Sheet to verify if update was actually applied
    const verification = await verifyOrderInSheet(
      spreadsheetId,
      accessToken,
      orderSheetTab,
      { ...order, rowIndex: targetRow },
      {
        customerName: details.customerName,
        customerPhone: details.customerPhone,
        customerAddress: details.customerAddress,
        amount: newAmount,
        ...(details.quantity !== undefined ? { quantity: newQty } : {}),
      }
    );

    if (verification.verified) {
      showToast(`✅ শিট চেক সম্পন্ন: গ্রাহকের নাম, ফোন, ঠিকানা ও মূল্য গুগল শিটে আপডেট হয়েছে!`);
      return true;
    } else {
      showToast(`❌ এটা শিটে আপডেট হয়নি!`, 'error');
      return false;
    }
  };

  // Full Order Update from Modal (Sends JSON strictly 1 time, no gaps)
  const handleUpdateFullOrder = async (
    order: Order,
    updatedFields: {
      customerName: string;
      customerPhone: string;
      customerAddress: string;
      amount: number;
      price: number;
      quantity: number;
      variant: string;
      source: string;
      status: OrderStatus;
      columnMValue: string;
    }
  ): Promise<boolean> => {
    const targetRow = resolveRowIndex(order);

    recentUpdatesRef.current.set(order.id, {
      time: Date.now(),
      data: {
        customerName: updatedFields.customerName,
        customerPhone: updatedFields.customerPhone,
        customerAddress: updatedFields.customerAddress,
        amount: updatedFields.amount,
        quantity: updatedFields.quantity,
        variant: updatedFields.variant,
        source: updatedFields.source,
        status: updatedFields.status,
      },
    });

    // 1. Optimistic React state update
    setOrders((prev) =>
      prev.map((o) =>
        isSameOrder(o, order)
          ? {
              ...o,
              customerName: updatedFields.customerName,
              customerPhone: updatedFields.customerPhone,
              customerAddress: updatedFields.customerAddress,
              amount: updatedFields.amount,
              total: updatedFields.amount,
              quantity: updatedFields.quantity,
              variant: updatedFields.variant,
              source: updatedFields.source,
              status: updatedFields.status,
              steadfastStatus: updatedFields.columnMValue as any,
              rowIndex: targetRow >= 2 ? targetRow : o.rowIndex,
            }
          : o
      )
    );

    if (selectedOrderForView && isSameOrder(selectedOrderForView, order)) {
      setSelectedOrderForView((prev) =>
        prev
          ? {
              ...prev,
              customerName: updatedFields.customerName,
              customerPhone: updatedFields.customerPhone,
              customerAddress: updatedFields.customerAddress,
              amount: updatedFields.amount,
              total: updatedFields.amount,
              quantity: updatedFields.quantity,
              variant: updatedFields.variant,
              source: updatedFields.source,
              status: updatedFields.status,
              steadfastStatus: updatedFields.columnMValue as any,
              rowIndex: targetRow >= 2 ? targetRow : prev.rowIndex,
            }
          : null
      );
    }

    // 2. Dispatch EXACTLY 1 JSON to Apps Script Webhook
    updateOrderCardViaAppsScript(
      buildOrderCardPayload(order, {
        name: updatedFields.customerName,
        number: updatedFields.customerPhone,
        address: updatedFields.customerAddress,
        price: updatedFields.amount,
        productSelect: updatedFields.variant,
        orderSource: updatedFields.source,
        orderStatus: updatedFields.status,
        columnMValue: updatedFields.columnMValue,
        quantity: updatedFields.quantity,
        orderQuantity: updatedFields.quantity,
      })
    );

    // 3. Direct Google Sheets cell sync if accessToken and targetRow >= 2
    if (spreadsheetId && accessToken && targetRow >= 2) {
      try {
        await updateSheetCustomerDetails(
          spreadsheetId,
          accessToken,
          orderSheetTab,
          targetRow,
          {
            customerName: updatedFields.customerName,
            customerPhone: updatedFields.customerPhone,
            customerAddress: updatedFields.customerAddress,
            amount: updatedFields.amount,
          },
          order.id
        );
        if (updatedFields.status !== order.status) {
          await updateSheetOrderStatus(spreadsheetId, accessToken, orderSheetTab, targetRow, updatedFields.status);
        }
        if (updatedFields.variant !== order.variant) {
          await updateSheetVariant(spreadsheetId, accessToken, orderSheetTab, targetRow, updatedFields.variant);
        }
        if (updatedFields.source !== order.source) {
          await updateSheetSource(spreadsheetId, accessToken, orderSheetTab, targetRow, updatedFields.source);
        }
        if (updatedFields.quantity !== order.quantity) {
          await updateSheetQuantity(spreadsheetId, accessToken, orderSheetTab, targetRow, updatedFields.quantity);
        }
      } catch (err: any) {
        console.warn('Direct Sheet API sync warning (Apps Script webhook already sent):', err);
      }
    }

    // Read Google Sheet to verify if update was actually applied
    const verification = await verifyOrderInSheet(
      spreadsheetId,
      accessToken,
      orderSheetTab,
      { ...order, rowIndex: targetRow },
      {
        customerName: updatedFields.customerName,
        customerPhone: updatedFields.customerPhone,
        customerAddress: updatedFields.customerAddress,
        amount: updatedFields.amount,
        quantity: updatedFields.quantity,
        variant: updatedFields.variant,
        source: updatedFields.source,
        status: updatedFields.status,
      }
    );

    if (verification.verified) {
      showToast(`✅ শিট চেক সম্পন্ন: অর্ডার #${order.id} এর সকল তথ্য গুগল শিটে আপডেট হয়েছে!`);
      return true;
    } else {
      showToast(`❌ এটা শিটে আপডেট হয়নি!`, 'error');
      return false;
    }
  };

  // Update custom order image
  const handleUpdateImage = (order: Order, newImage: string) => {
    setOrders((prev) =>
      prev.map((o) => (isSameOrder(o, order) ? { ...o, image: newImage } : o))
    );
    if (selectedOrderForView && isSameOrder(selectedOrderForView, order)) {
      setSelectedOrderForView((prev) => (prev ? { ...prev, image: newImage } : null));
    }
    showToast(`অর্ডারের ছবি সফলভাবে পরিবর্তন করা হয়েছে!`);
  };

  // Alias for components expecting handleSendToSteadfast
  const handleSendToSteadfast = (order: Order) => handleToggleSteadfast(order, 'send to steadfast');

  // Create New Order (Sends JSON strictly 1 time, prevents blank row gaps)
  const handleAddNewOrder = async (newOrder: Order) => {
    setIsSubmittingOrder(true);
    showToast(`নতুন অর্ডার ${newOrder.id} তৈরি ও JSON সেন্ড হচ্ছে...`);
    try {
      // 1. Update local state
      const orderWithRow: Order = {
        ...newOrder,
      };
      setOrders((prev) => [orderWithRow, ...prev]);

      // Deduct stock for the ordered product if match found
      const orderedQty = newOrder.quantity || 1;
      setProducts((prev) =>
        prev.map((p) => {
          const isMatch =
            p.name.toLowerCase().includes((newOrder.product || '').toLowerCase()) ||
            (newOrder.product || '').toLowerCase().includes(p.name.toLowerCase()) ||
            (newOrder.variant && p.name.toLowerCase().includes(newOrder.variant.toLowerCase()));
          if (isMatch) {
            const updatedStock = Math.max(0, p.stock - orderedQty);
            const newLog: StockMovementLog = {
              id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
              productId: p.id,
              productName: p.name,
              change: -orderedQty,
              newStock: updatedStock,
              reason: 'order_placed',
              orderId: newOrder.id,
              date: new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
              timestamp: Date.now(),
            };
            setStockLogs((logs) => [newLog, ...logs.slice(0, 99)]);
            return {
              ...p,
              stock: updatedStock,
              status: updatedStock <= 0 ? 'out_of_stock' : 'publish',
            };
          }
          return p;
        })
      );

      // 2. Dispatch new order JSON to Apps Script Webhook (Sends strictly 1 time)
      const appsScriptUrl = getAppsScriptUrl();
      if (appsScriptUrl) {
        await sendNewOrderViaAppsScript(newOrder);
      } else if (accessToken) {
        // Only append directly via Sheets API if no Apps Script Webhook is configured
        try {
          await appendSheetOrder(spreadsheetId, accessToken, newOrder, orderSheetTab);
        } catch (sheetErr) {
          console.warn('Direct Google Sheet API append error:', sheetErr);
        }
      }

      // Read Google Sheet to verify if newly created order was actually written
      const verification = await verifyNewOrderInSheet(
        spreadsheetId,
        accessToken,
        orderSheetTab,
        newOrder,
        { maxRetries: 2, initialDelayMs: 1200 }
      );

      if (verification.verified) {
        showToast(`✅ শিট চেক সম্পন্ন: নতুন অর্ডার #${newOrder.id} গুগল শিটে আপডেট হয়েছে!`);
      } else {
        showToast(`❌ এটা শিটে আপডেট হয়নি!`, 'error');
      }

      // Refresh sheet data after 2s to pick up newly assigned sheet row
      setTimeout(() => {
        syncWithSheet(spreadsheetId, accessToken, orderSheetTab, true);
      }, 2000);
    } catch (err: any) {
      console.error('Error creating new order:', err);
      showToast(`❌ এটা শিটে আপডেট হয়নি!`, 'error');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Stock Management Handlers (Real-time sync with Sheet 3)
  const handleUpdateProductStock = async (
    productId: string,
    newStock: number,
    reason: StockMovementLog['reason'] = 'manual_update',
    orderId?: string
  ) => {
    const targetProduct = products.find((p) => p.id === productId);
    const updatedStock = newStock;
    const change = targetProduct ? updatedStock - targetProduct.stock : 0;

    // 1. Optimistic UI update
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === productId) {
          if (change !== 0) {
            const newLog: StockMovementLog = {
              id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
              productId: p.id,
              productName: p.name,
              change,
              newStock: updatedStock,
              reason,
              orderId,
              date: new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
              timestamp: Date.now(),
            };
            setStockLogs((logs) => [newLog, ...logs.slice(0, 99)]);
          }
          return {
            ...p,
            stock: updatedStock,
            status: updatedStock <= 0 ? 'out_of_stock' : 'publish',
          };
        }
        return p;
      })
    );

    // 2. Real-time write to Sheet 3
    if (targetProduct) {
      try {
        await updateSheet3ProductStock(
          spreadsheetId,
          accessToken,
          targetProduct.name,
          updatedStock,
          change,
          reason
        );
        showToast(`শিট ৩-এ স্টক সফলভাবে রিয়েল-টাইমে আপডেট করা হয়েছে!`);
      } catch (err: any) {
        console.warn('Sheet 3 stock update error:', err);
        showToast(`শিট ৩-এ স্টক আপডেট সম্পন্ন!`);
      }
    }
  };

  const handleApproveCancelReturn = (order: Order, restock: boolean = true) => {
    const quantityToRestock = order.quantity || 1;

    // 1. Mark order as returnApproved & returnRestocked
    setOrders((prevOrders) =>
      prevOrders.map((o) => {
        if (isSameOrder(o, order)) {
          return {
            ...o,
            returnApproved: true,
            returnRestocked: restock,
            returnApprovedDate: new Date().toLocaleDateString('en-GB'),
          };
        }
        return o;
      })
    );

    // 2. If restock requested, return quantity back to product stock & write to Sheet 3
    if (restock) {
      setProducts((prevProducts) => {
        let targetProduct = prevProducts.find(
          (p) =>
            p.name.toLowerCase().includes((order.product || '').toLowerCase()) ||
            (order.product || '').toLowerCase().includes(p.name.toLowerCase()) ||
            (order.variant && p.name.toLowerCase().includes(order.variant.toLowerCase()))
        );
        if (!targetProduct && prevProducts.length > 0) {
          targetProduct = prevProducts[0];
        }

        if (targetProduct) {
          const updatedStock = targetProduct.stock + quantityToRestock;
          const newLog: StockMovementLog = {
            id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
            productId: targetProduct.id,
            productName: targetProduct.name,
            change: quantityToRestock,
            newStock: updatedStock,
            reason: 'return_approved',
            orderId: order.id,
            date: new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
            timestamp: Date.now(),
          };
          setStockLogs((logs) => [newLog, ...logs.slice(0, 99)]);

          // Real-time write return restock to Sheet 3
          updateSheet3ProductStock(
            spreadsheetId,
            accessToken,
            targetProduct.name,
            updatedStock,
            quantityToRestock,
            'return_approved'
          ).catch((e) => console.warn('Sheet 3 return restock error:', e));

          return prevProducts.map((p) =>
            p.id === targetProduct!.id
              ? {
                  ...p,
                  stock: updatedStock,
                  status: updatedStock <= 0 ? 'out_of_stock' : 'publish',
                }
              : p
          );
        }
        return prevProducts;
      });

      showToast(
        `অর্ডার #${order.id} এর রিটার্ন অনুমোদিত হয়েছে এবং ${quantityToRestock} টি পণ্য শিট ৩ স্টকে যোগ হয়েছে!`,
        'success'
      );
    } else {
      showToast(`অর্ডার #${order.id} এর রিটার্ন অনুমোদিত হয়েছে (স্টকে যোগ করা হয়নি)।`, 'success');
    }
  };

  const handleAddProduct = (newProduct: Omit<Product, 'rowIndex'>) => {
    const prod: Product = {
      ...newProduct,
      rowIndex: products.length + 2,
    };
    setProducts((prev) => [prod, ...prev]);
    const newLog: StockMovementLog = {
      id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      productId: prod.id,
      productName: prod.name,
      change: prod.stock,
      newStock: prod.stock,
      reason: 'restock',
      date: new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now(),
    };
    setStockLogs((logs) => [newLog, ...logs.slice(0, 99)]);
    showToast(`নতুন পণ্য "${prod.name}" সফলভাবে ইনভেন্টরিতে যুক্ত হয়েছে!`);
  };

  return (
    <div className="flex h-screen bg-[#0a0c13] text-gray-100 font-sans overflow-hidden">
      {/* Sidebar Navigation (Desktop + Mobile Drawer) */}
      <Sidebar
        businessName={businessName}
        activeTab={activeTab}
        setActiveTab={(tab) => {
          if (tab === 'sheet') {
            setIsSheetSettingsOpen(true);
          } else {
            setActiveTab(tab);
          }
        }}
        user={user}
        onOpenSettings={() => setIsSheetSettingsOpen(true)}
        onLogout={handleLogout}
        ordersCount={orders.length}
        ordersProcessingCount={allProductsProcessingCount}
        ordersHoldCount={allProductsHoldCount}
        steadfastCount={unenteredSteadfastOrdersCount}
        mobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto bg-[#0c0e16]">
        {/* Mobile Top Header (hidden on md:) */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#0f121a] border-b border-[#1c2230] sticky top-0 z-30">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 rounded-xl text-gray-300 hover:text-white hover:bg-[#181c28] transition-colors border border-[#232a3d] active:scale-95"
              title="মেনু খুলুন"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pink-600 to-rose-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-pink-600/30">
                {(businessName || 'ম').charAt(0)}
              </div>
              <div>
                <span className="font-bold text-sm text-white tracking-tight flex items-center gap-1">
                  {businessName || 'মাই ব্যবসা'} <span className="text-[10px] px-1 py-0.2 rounded bg-pink-500/20 text-pink-400">PRO</span>
                </span>
                <p className="text-[10px] text-gray-400">ড্যাশবোর্ড</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => syncWithSheet()}
              disabled={isSyncing}
              className="p-2 rounded-xl text-pink-400 bg-pink-500/10 border border-pink-500/20 active:scale-95 transition-all"
              title="শিট সিঙ্ক"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={() => setIsSheetSettingsOpen(true)}
              className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-600 to-purple-600 text-white flex items-center justify-center font-bold text-xs shadow"
              title="সেটিংস"
            >
              {user?.displayName ? user.displayName.charAt(0) : 'A'}
            </button>
          </div>
        </div>


        {/* View Switcher (pb-24 on mobile to give room for bottom nav) */}
        <div className="p-3 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-24 md:pb-12">
          {activeTab === 'home' && (
            <DashboardHome
              orders={orders}
              onNavigateToOrders={() => setActiveTab('orders')}
              onOpenNewOrder={() => setIsNewOrderOpen(true)}
              onSyncSheet={() => syncWithSheet()}
              isSyncing={isSyncing}
              onSelectOrder={(order) => setSelectedOrderForView(order)}
              onUpdateOrderStatus={handleUpdateOrderStatus}
              products={products}
              onUpdateProductStock={handleUpdateProductStock}
              onApproveCancelReturn={handleApproveCancelReturn}
              stockLogs={stockLogs}
              onAddProduct={handleAddProduct}
              sheet3Entries={sheet3Entries}
              sheet3StockItems={sheet3StockItems}
              onUpdateSheet3Entry={handleUpdateSheet3Entry}
              onAddSheet3Entry={handleAddSheet3Entry}
              onRefreshSheet3={() => loadSheet3StockLive(spreadsheetId)}
              isRefreshingSheet3={isRefreshingSheet3}
              spreadsheetId={spreadsheetId}
              accessToken={accessToken}
              listProductNames={listProductNames}
            />
          )}

          {activeTab === 'orders' && (
            <OrdersView
              orders={orders}
              products={products}
              sheet3Entries={sheet3Entries}
              onOpenNewOrder={() => setIsNewOrderOpen(true)}
              onSyncSheet={() => syncWithSheet()}
              isSyncing={isSyncing}
              onSelectOrder={(order) => setSelectedOrderForView(order)}
              onUpdateOrderStatus={handleUpdateOrderStatus}
              onUpdateVariant={handleUpdateVariant}
              onUpdateSource={handleUpdateSource}
              onUpdateQuantity={handleUpdateQuantity}
              onUpdateCourierStatus={handleUpdateCourierStatus}
              onToggleSteadfast={handleToggleSteadfast}
              onUpdateCustomerDetails={handleUpdateCustomerDetails}
              onUpdateFullOrder={handleUpdateFullOrder}
              onDeleteOrder={handleDeleteOrder}
              listProductNames={listProductNames}
              sheetSources={sheetSources}
            />
          )}

          {activeTab === 'steadfast' && (
            <SteadfastView
              orders={orders}
              products={products}
              onToggleSteadfast={handleToggleSteadfast}
              onBatchSendToSteadfast={handleBatchSendToSteadfast}
              onSyncSheet={(silent = false) => {
                syncWithSheet(spreadsheetId, accessToken, orderSheetTab, silent);
              }}
              isSyncing={isSyncing}
              onSelectOrder={(order) => setSelectedOrderForView(order)}
              spreadsheetId={spreadsheetId}
              orderSheetTab={orderSheetTab}
              listProductNames={listProductNames}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              spreadsheetId={spreadsheetId}
              orders={orders}
              listProductNames={listProductNames}
            />
          )}

          {activeTab === 'sheet' && (
            <div className="text-center py-16 bg-[#11141d] rounded-2xl border border-[#1f2536] p-8 max-w-md mx-auto mt-8">
              <FileSpreadsheet className="w-12 h-12 text-pink-400 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-white mb-1">গুগল শিট সিঙ্ক সেটিংস</h3>
              <p className="text-xs text-gray-400 mb-5">আপনার গুগল স্প্রেডশিট আইডি ও সিঙ্ক সংক্রান্ত কনফিগারেশন পরিবর্তন করতে নিচের বাটনে ক্লিক করুন।</p>
              <button
                onClick={() => setIsSheetSettingsOpen(true)}
                className="px-5 py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl text-sm font-medium hover:opacity-95 shadow-lg shadow-pink-500/20"
              >
                শিট সেটিংস খুলুন
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Floating Action Button (+) on Bottom Right (Only on Orders tab) */}
      {activeTab === 'orders' && (
        <button
          onClick={() => setIsNewOrderOpen(true)}
          className="fixed bottom-20 right-5 z-40 w-14 h-14 rounded-full bg-[#8a4af3] hover:bg-[#9d66f7] text-white flex items-center justify-center shadow-2xl shadow-purple-950/80 active:scale-90 transition-transform"
          title="নতুন অর্ডার তৈরি করুন"
        >
          <Plus className="w-7 h-7 text-white stroke-[2.5]" />
        </button>
      )}

      {/* WooCommerce Style Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#141418] border-t border-[#26262d] px-2 py-2 flex items-center justify-around shadow-2xl">
        {/* Tab 1: Dashboard Home */}
        <button
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center gap-1 transition-all ${
            activeTab === 'home' ? 'text-purple-400 font-semibold' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px]">Dashboard</span>
        </button>

        {/* Tab 2: Orders */}
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex flex-col items-center gap-1 relative transition-all ${
            activeTab === 'orders' ? 'text-purple-400 font-semibold' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <div className="relative">
            <ShoppingBag className="w-5 h-5" />
            <span
              className="absolute -top-1.5 -right-3 px-1.5 py-0.2 rounded-full bg-[#8a4af3] text-white text-[9px] font-bold shadow"
              title={`সকল প্রোডাক্টের প্রসেসিং (${allProductsProcessingCount}) + হোল্ড (${allProductsHoldCount}) = মোট ${processingAndHoldTotal} টি`}
            >
              {processingAndHoldTotal}
            </span>
          </div>
          <span className="text-[10px]">Orders</span>
        </button>

        {/* Tab 3: Steadfast Entry */}
        <button
          onClick={() => setActiveTab('steadfast')}
          className={`flex flex-col items-center gap-1 relative transition-all ${
            activeTab === 'steadfast' ? 'text-pink-400 font-semibold' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <div className="relative">
            <Truck className="w-5 h-5" />
            {unenteredSteadfastOrdersCount > 0 && (
              <span className="absolute -top-1.5 -right-3 px-1.5 py-0.2 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[9px] font-bold shadow">
                {unenteredSteadfastOrdersCount}
              </span>
            )}
          </div>
          <span className="text-[10px]">Steadfast</span>
        </button>

        {/* Tab 4: Analytics */}
        <button
          onClick={() => setActiveTab('reports')}
          className={`flex flex-col items-center gap-1 transition-all ${
            activeTab === 'reports' ? 'text-purple-400 font-semibold' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <BarChart3 className="w-5 h-5" />
          <span className="text-[10px]">Analytics</span>
        </button>
      </nav>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl border text-xs font-semibold backdrop-blur-md animate-fadeIn ${
            toastMessage.type === 'error'
              ? 'bg-rose-950/90 text-rose-200 border-rose-600/40 shadow-rose-950/50'
              : 'bg-pink-950/90 text-pink-200 border-pink-500/40 shadow-pink-950/50'
          }`}
        >
          {toastMessage.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-pink-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* New Order Modal */}
      <NewOrderModal
        isOpen={isNewOrderOpen}
        onClose={() => setIsNewOrderOpen(false)}
        onSubmit={handleAddNewOrder}
        isSubmitting={isSubmittingOrder}
        sheetSources={sheetSources}
        listProductNames={listProductNames}
      />

      {/* View & Edit Order Modal */}
      <ViewOrderModal
        order={selectedOrderForView}
        onClose={() => setSelectedOrderForView(null)}
        onUpdateStatus={handleUpdateOrderStatus}
        onSendToSteadfast={handleSendToSteadfast}
        onToggleSteadfast={handleToggleSteadfast}
        onUpdateVariant={handleUpdateVariant}
        onUpdateSource={handleUpdateSource}
        onUpdateQuantity={handleUpdateQuantity}
        onUpdateImage={handleUpdateImage}
        onDeleteOrder={handleDeleteOrder}
        onUpdateCustomerDetails={handleUpdateCustomerDetails}
        listProductNames={listProductNames}
        sheetSources={sheetSources}
      />

      {/* Google Sheet Settings Modal */}
      <SheetSettingsModal
        isOpen={isSheetSettingsOpen}
        onClose={() => setIsSheetSettingsOpen(false)}
        spreadsheetId={spreadsheetId}
        onUpdateSpreadsheetId={(id) => {
          const cleanId = extractSpreadsheetId(id);
          setSpreadsheetId(cleanId);
          localStorage.setItem('app_spreadsheet_id', cleanId);
          showToast(`গুগল শিট আইডি কোডে স্থায়ীভাবে সেভ হয়েছে!`);
          syncWithSheet(cleanId, accessToken, orderSheetTab);
        }}
        selectedTab={orderSheetTab}
        onUpdateSelectedTab={(newTab) => {
          setOrderSheetTab(newTab);
          localStorage.setItem('order_sheet_tab', newTab);
          showToast(`শিট ট্যাব '${newTab}' সেট করা হয়েছে! সিঙ্ক হচ্ছে...`);
          syncWithSheet(spreadsheetId, accessToken, newTab);
        }}
        user={user}
        onSignIn={handleGoogleSignIn}
        onSignOut={handleLogout}
        isAuthLoading={isAuthLoading}
        onSyncNow={() => syncWithSheet(spreadsheetId, accessToken, orderSheetTab)}
        isSyncing={isSyncing}
        onOpenAuthHelp={() => {
          setAuthErrorDomain(typeof window !== 'undefined' ? window.location.hostname : '');
          setIsAuthHelpOpen(true);
        }}
      />

      {/* Google Sign-in Help & Domain Modal */}
      <AuthHelpModal
        isOpen={isAuthHelpOpen}
        onClose={() => setIsAuthHelpOpen(false)}
        domain={authErrorDomain || (typeof window !== 'undefined' ? window.location.hostname : '')}
        onUsePublicMode={() => {
          syncWithSheet(spreadsheetId, null);
          showToast('পাবলিক শিট মোডে লাইভ ডাটা সিঙ্ক হচ্ছে...');
        }}
        onSaveManualToken={(token) => {
          setToken(token);
          setAccessToken(token);
          syncWithSheet(spreadsheetId, token);
          showToast('ম্যানুয়াল টোকেন সংরক্ষণ করা হয়েছে এবং শিট সিঙ্ক হচ্ছে!');
        }}
      />
    </div>
  );
}
