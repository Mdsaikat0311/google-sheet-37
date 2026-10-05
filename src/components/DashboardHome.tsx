import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Package,
  RefreshCw,
  Boxes,
} from 'lucide-react';
import { Order, OrderStatus, Product, StockMovementLog, Sheet3ProductEntry } from '../types';
import {
  fetchListSheetProductNames,
  fetchSheet3DirectStockCells,
  Sheet3DirectStockBox,
  Sheet3StockItem,
} from '../services/sheets';
import { StockManagerHome } from './StockManagerHome';
import { OrderCalendar } from './OrderCalendar';

interface DashboardHomeProps {
  orders: Order[];
  onNavigateToOrders: () => void;
  onOpenNewOrder: () => void;
  onSyncSheet: () => void;
  isSyncing: boolean;
  onSelectOrder: (order: Order) => void;
  onUpdateOrderStatus: (order: Order, newStatus: OrderStatus) => void;
  // Stock management & Cancel Return Approval
  products: Product[];
  onUpdateProductStock: (productId: string, newStock: number, reason?: StockMovementLog['reason'], orderId?: string) => void;
  onApproveCancelReturn: (order: Order, restock: boolean) => void;
  stockLogs: StockMovementLog[];
  onAddProduct?: (newProduct: Omit<Product, 'rowIndex'>) => void;
  sheet3Entries?: Sheet3ProductEntry[];
  sheet3StockItems?: Sheet3StockItem[];
  onUpdateSheet3Entry?: (entry: Sheet3ProductEntry) => Promise<void> | void;
  onAddSheet3Entry?: (entry: Omit<Sheet3ProductEntry, 'rowIndex' | 'id'>) => Promise<void> | void;
  onRefreshSheet3?: () => void;
  isRefreshingSheet3?: boolean;
  // Dynamic Realtime Product Names from List Sheet Column B
  spreadsheetId?: string;
  accessToken?: string | null;
  listProductNames?: string[];
}

export const DashboardHome: React.FC<DashboardHomeProps> = ({
  orders,
  onOpenNewOrder,
  onSyncSheet,
  isSyncing,
  onSelectOrder,
  products,
  onUpdateProductStock,
  onApproveCancelReturn,
  stockLogs,
  onAddProduct,
  sheet3Entries,
  sheet3StockItems,
  onUpdateSheet3Entry,
  onAddSheet3Entry,
  onRefreshSheet3,
  isRefreshingSheet3,
  spreadsheetId,
  accessToken,
  listProductNames,
}) => {
  // Real-time 6 Product names loaded from 'List' Sheet Column B
  // Dynamic 6 product names strictly from List sheet Column B
  const [dynamicProductNames, setDynamicProductNames] = useState<string[]>(() => {
    if (listProductNames && listProductNames.length >= 6) return listProductNames;
    try {
      const saved = localStorage.getItem('sheet_list_product_names');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 6) return parsed;
      }
    } catch (e) {}
    return [
      'Rose 599tk',
      'Watch 599tk',
      'Doll and toys',
      'Cutting Dispancer',
      'Porbash Rose 990tk',
      'Porbash Rose 1350tk',
    ];
  });
  const [isLoadingListNames, setIsLoadingListNames] = useState<boolean>(false);

  // Real-time stock strictly read from Sheet 3 cells A3, B3, C3, D3, E3, F3
  const [sheet3StockBoxes, setSheet3StockBoxes] = useState<Sheet3DirectStockBox[]>(() => {
    try {
      const saved = localStorage.getItem('sheet3_direct_stock_boxes');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 6) return parsed;
      }
    } catch (e) {}
    return [
      { colLetter: 'A', cell: 'A3', name: 'Rose 599tk', stock: 179 },
      { colLetter: 'B', cell: 'B3', name: 'Watch 599tk', stock: 54 },
      { colLetter: 'C', cell: 'C3', name: 'Cutting Dispancer', stock: 17 },
      { colLetter: 'D', cell: 'D3', name: 'Porbash Rose 990tk', stock: 142 },
      { colLetter: 'E', cell: 'E3', name: 'Porbash Rose 1350tk', stock: 0 },
      { colLetter: 'F', cell: 'F3', name: 'Doll and toys', stock: 77 },
    ];
  });
  const [isLoadingStockBoxes, setIsLoadingStockBoxes] = useState<boolean>(false);

  // Directly fetch Sheet 3 cells A3..F3 from Google Sheets
  const loadDirectStock = useCallback(async () => {
    setIsLoadingStockBoxes(true);
    try {
      const boxes = await fetchSheet3DirectStockCells(spreadsheetId);
      if (boxes && boxes.length === 6) {
        setSheet3StockBoxes(boxes);
        try {
          localStorage.setItem('sheet3_direct_stock_boxes', JSON.stringify(boxes));
        } catch (e) {}
      }
    } catch (err) {
      console.warn('Failed to load Sheet 3 direct stock cells:', err);
    } finally {
      setIsLoadingStockBoxes(false);
    }
  }, [spreadsheetId]);

  useEffect(() => {
    loadDirectStock();
  }, [loadDirectStock]);

  useEffect(() => {
    if (!isSyncing) {
      loadDirectStock();
    }
  }, [isSyncing, loadDirectStock]);

  // Sync if parent passes updated sheet3StockItems
  useEffect(() => {
    if (sheet3StockItems && sheet3StockItems.length >= 6) {
      const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
      const mapped = letters.map((letter) => {
        const found = sheet3StockItems.find(
          (i) => (i.colLetter || '').toUpperCase() === letter || (i.cell || '').toUpperCase() === `${letter}3`
        );
        return {
          colLetter: letter,
          cell: `${letter}3`,
          name: found?.productName || '',
          stock: found?.quantity !== undefined ? found.quantity : 0,
        };
      });
      if (mapped.every((m) => m.name)) {
        setSheet3StockBoxes(mapped);
        try {
          localStorage.setItem('sheet3_direct_stock_boxes', JSON.stringify(mapped));
        } catch (e) {}
      }
    }
  }, [sheet3StockItems]);

  // Sync state when parent provides updated listProductNames
  useEffect(() => {
    if (listProductNames && listProductNames.length >= 6) {
      setDynamicProductNames(listProductNames);
    }
  }, [listProductNames]);

  // Fetch real-time names directly from 'List' sheet Column B
  const loadListNames = useCallback(async () => {
    setIsLoadingListNames(true);
    try {
      const names = await fetchListSheetProductNames(spreadsheetId, accessToken);
      if (names && names.length > 0) {
        setDynamicProductNames(names);
        try {
          localStorage.setItem('sheet_list_product_names', JSON.stringify(names));
        } catch (e) {}
      }
    } catch (err) {
      console.warn('Failed to load List product names:', err);
    } finally {
      setIsLoadingListNames(false);
    }
  }, [spreadsheetId, accessToken]);

  // Initial load and sync on mount / spreadsheet change
  useEffect(() => {
    loadListNames();
  }, [loadListNames]);

  // When global sync occurs, also refresh the List sheet names
  useEffect(() => {
    if (!isSyncing) {
      loadListNames();
    }
  }, [isSyncing, loadListNames]);

  // Auto-refresh when user switches back to this browser tab (e.g. after editing Google Sheets)
  useEffect(() => {
    const handleFocus = () => {
      loadListNames();
      loadDirectStock();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadListNames, loadDirectStock]);

  // Periodic background refresh every 20 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      loadListNames();
      loadDirectStock();
    }, 20000);
    return () => clearInterval(timer);
  }, [loadListNames, loadDirectStock]);

  // The 6 product cards: Exactly reading names from 'List' sheet Column B, and stock from Sheet 3
  const displayProductCards = useMemo(() => {
    const fallbackNames = [
      'Rose 599tk',
      'Watch 599tk',
      'Doll and toys',
      'Cutting Dispancer',
      'Porbash Rose 990tk',
      'Porbash Rose 1350tk',
    ];

    // Default cell mapping for List sheet Column B Row 1..6:
    // Row 1: Product 1 (Rose 599tk) -> Cell A3
    // Row 2: Product 2 (Watch 599tk) -> Cell B3
    // Row 3: Product 3 (Doll and toys) -> Cell F3
    // Row 4: Product 4 (Cutting Dispancer) -> Cell C3
    // Row 5: Product 5 (Porbash Rose 990tk) -> Cell D3
    // Row 6: Product 6 (Porbash Rose 1350tk) -> Cell E3
    const cellMapByIndex = ['A3', 'B3', 'F3', 'C3', 'D3', 'E3'];

    return [0, 1, 2, 3, 4, 5].map((idx) => {
      // 1. Dynamic product name directly from 'List' sheet Column B (Row idx + 1)
      const name = (dynamicProductNames && dynamicProductNames[idx]) || fallbackNames[idx];
      const norm = name.toLowerCase().trim();

      // 2. Identify the cell letter from Sheet3 (A3..F3)
      let targetCell = cellMapByIndex[idx];

      // Smart keyword match if user rearranges rows in List sheet
      if (norm.includes('cutting') || norm.includes('dispancer')) {
        targetCell = 'C3';
      } else if (norm.includes('doll') || norm.includes('toy')) {
        targetCell = 'F3';
      } else if (norm.includes('1350')) {
        targetCell = 'E3';
      } else if (norm.includes('990')) {
        targetCell = 'D3';
      } else if (norm.includes('watch') || norm.includes('ঘড়ি') || norm.includes('golden')) {
        targetCell = 'B3';
      } else if (norm.includes('rose') || norm.includes('599')) {
        targetCell = 'A3';
      }

      // 3. Get the real-time stock from Sheet 3 (A3..F3)
      const foundBox = sheet3StockBoxes.find(
        (b) => b.cell.toUpperCase() === targetCell.toUpperCase() || b.colLetter.toUpperCase() === targetCell[0].toUpperCase()
      );
      const stock = foundBox ? foundBox.stock : 0;

      return {
        name,
        cell: targetCell,
        stock,
      };
    });
  }, [dynamicProductNames, sheet3StockBoxes]);

  /**
   * Links each product name from List Sheet Column B to corresponding Sheet 3 stock cell (A3..F3)
   */
  const getStockForListName = useCallback(
    (name: string, index: number): { cell: string; stock: number } => {
      if (!name) return { cell: 'A3', stock: 0 };
      const norm = name.toLowerCase().replace(/[^a-z0-9]/g, '');

      // 1. Try keyword matching against Sheet 3 cell labels
      const match = sheet3StockBoxes.find((c) => {
        const cNorm = (c.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!cNorm) return false;
        if (cNorm === norm || cNorm.includes(norm) || norm.includes(cNorm)) return true;
        if (norm.includes('rose') && norm.includes('599') && cNorm.includes('599')) return true;
        if (norm.includes('watch') && cNorm.includes('watch')) return true;
        if ((norm.includes('doll') || norm.includes('toy')) && (cNorm.includes('doll') || cNorm.includes('toy'))) return true;
        if ((norm.includes('cutting') || norm.includes('disp')) && (cNorm.includes('cutt') || cNorm.includes('disp'))) return true;
        if (norm.includes('990') && cNorm.includes('990')) return true;
        if (norm.includes('1350') && cNorm.includes('1350')) return true;
        return false;
      });

      if (match) {
        return { cell: match.cell, stock: match.stock };
      }

      // 2. Default 1-to-1 List Sheet Row mapping to Sheet 3 cells:
      // Row 1 (Product 1) -> A3
      // Row 2 (Product 2) -> B3
      // Row 3 (Product 3) -> F3 (Doll and toys)
      // Row 4 (Product 4) -> C3 (Cutting Dispancer)
      // Row 5 (Product 5) -> D3 (Porbash Rose 990tk)
      // Row 6 (Product 6) -> E3 (Porbash Rose 1350tk)
      const fallbackCellMap = ['A3', 'B3', 'F3', 'C3', 'D3', 'E3'];
      const targetCell = fallbackCellMap[index] || 'A3';
      const byCell = sheet3StockBoxes.find((c) => c.cell === targetCell);
      return {
        cell: targetCell,
        stock: byCell !== undefined ? byCell.stock : 0,
      };
    },
    [sheet3StockBoxes]
  );

  return (
    <div className="space-y-4 sm:space-y-6 animate-fadeIn pb-20 sm:pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-3xl font-bold text-white tracking-tight">
            মাই ব্যবসা ড্যাশবোর্ড
          </h2>
          <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
            আজকের ব্যবসার সামগ্রিক বিক্রয়, পণ্য স্টক ও অর্ডার পরিসংখ্যান
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onSyncSheet}
            disabled={isSyncing}
            className="flex items-center justify-center gap-1.5 sm:gap-2 px-3.5 py-2.5 rounded-xl bg-[#171b26] hover:bg-[#202636] border border-[#262f44] text-gray-200 text-xs sm:text-sm font-medium transition-all shadow-sm cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-pink-400 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'সিঙ্ক হচ্ছে...' : 'Sync Sheet'}</span>
          </button>
        </div>
      </div>

      {/* Top 6 Product Stock Cards Header */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <Boxes className="w-4 h-4 text-pink-400" />
          <span className="text-xs sm:text-sm font-bold text-white">
            পণ্য স্টক কার্ড (List শিট Col B নাম ও Sheet 3 লাইভ স্টক)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              loadDirectStock();
              loadListNames();
            }}
            disabled={isLoadingStockBoxes || isLoadingListNames}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#141824] hover:bg-[#1e2436] border border-[#232b3e] text-[10px] sm:text-[11px] text-gray-300 hover:text-pink-300 transition-colors font-siliguri cursor-pointer active:scale-95"
            title="List শিটের নাম ও Sheet 3 এর লাইভ স্টক রিফ্রেশ করুন"
          >
            <RefreshCw
              className={`w-3 h-3 text-pink-400 ${
                isLoadingStockBoxes || isLoadingListNames ? 'animate-spin' : ''
              }`}
            />
            <span>স্টক ও নাম রিফ্রেশ</span>
          </button>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold font-mono">
              List (Col B) &amp; Sheet 3 Live
            </span>
          </div>
        </div>
      </div>

      {/* Exactly 6 Product Stock Cards - Names strictly from List Sheet Column B */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        {displayProductCards.map((card, idx) => {
          const isLowStock = card.stock > 0 && card.stock <= 5;
          const isOutOfStock = card.stock <= 0;

          return (
            <div
              key={`dash-card-${card.cell}-${idx}-${card.name}`}
              className={`bg-[#12151f] border rounded-2xl p-3 sm:p-3.5 relative overflow-hidden group transition-all flex flex-col justify-between ${
                isOutOfStock
                  ? 'border-rose-500/40 hover:border-rose-500/70'
                  : isLowStock
                  ? 'border-amber-500/40 hover:border-amber-500/70'
                  : 'border-[#1e2436] hover:border-pink-500/40'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-1">
                  <span
                    className="text-xs font-bold text-white tracking-tight line-clamp-1 group-hover:text-pink-300 transition-colors flex-1"
                    title={card.name}
                  >
                    {card.name}
                  </span>
                  <div className="w-6 h-6 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 shrink-0">
                    <Package className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div className="mt-2 text-center sm:text-left">
                  <div className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-baseline justify-center sm:justify-start gap-1">
                    <span
                      className={
                        isOutOfStock
                          ? 'text-rose-400'
                          : isLowStock
                          ? 'text-amber-400'
                          : 'text-pink-500'
                      }
                    >
                      {card.stock}
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-gray-300">পিস</span>
                  </div>

                  <div className="flex items-center justify-center sm:justify-between mt-1 gap-1 flex-wrap sm:flex-nowrap">
                    <p
                      className={`text-[10px] font-semibold flex items-center justify-center gap-1 ${
                        isOutOfStock
                          ? 'text-rose-400'
                          : isLowStock
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      <span>
                        {isOutOfStock
                          ? 'স্টক শেষ'
                          : isLowStock
                          ? 'কম স্টক'
                          : 'মজুদ স্টক'}
                      </span>
                    </p>
                    <span className="text-[9px] font-mono text-pink-400 font-bold bg-pink-500/10 px-1.5 py-0.5 rounded border border-pink-500/20">
                      {card.cell}
                    </span>
                  </div>
                </div>
              </div>

              <div className="absolute -right-6 -bottom-6 w-16 h-16 bg-pink-500/5 rounded-full blur-xl pointer-events-none" />
            </div>
          );
        })}
      </div>

      {/* All Product Order Calendar (তারিখ অনুযায়ী কবে কয়টা অর্ডার) */}
      <OrderCalendar
        orders={orders}
        onSelectOrder={onSelectOrder}
        listProductNames={dynamicProductNames}
      />

      {/* Stock Management & Cancel/Return Approval Section */}
      <div className="pt-2">
        <StockManagerHome
          products={products}
          orders={orders}
          onUpdateProductStock={onUpdateProductStock}
          onApproveCancelReturn={onApproveCancelReturn}
          stockLogs={stockLogs}
          onAddProduct={onAddProduct}
          sheet3Entries={sheet3Entries}
          onUpdateSheet3Entry={onUpdateSheet3Entry}
          onAddSheet3Entry={onAddSheet3Entry}
          onRefreshSheet3={onRefreshSheet3}
          isRefreshingSheet3={isRefreshingSheet3}
          listProductNames={dynamicProductNames}
        />
      </div>
    </div>
  );
};
