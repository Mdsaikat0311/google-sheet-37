import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  DollarSign,
  Calendar,
  CalendarRange,
  CalendarDays,
  Filter,
  RefreshCw,
  Search,
  Truck,
  Package,
  Layers,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Percent,
  CheckCircle2,
  Clock,
  Ban,
  LayoutGrid,
  ListFilter,
  Coins,
  Eye,
  EyeOff,
  Minimize2,
  Maximize2,
  X,
} from 'lucide-react';
import { Sheet4ProfitRow } from '../types';

// Helper to check if a critical Sheet4 column (N, O, AA, AC) is filled
export const isFieldFilled = (val: any): boolean => {
  if (val === undefined || val === null) return false;
  const s = String(val).replace(/[$৳,\s]/g, '').trim();
  if (s === '' || s === '-' || s === '0' || s === '0.0' || s === '0.00' || s === 'N/A' || s === 'null') {
    return false;
  }
  const n = parseFloat(s);
  if (!isNaN(n)) {
    return n > 0;
  }
  return s.length > 0;
};

interface Sheet4ProfitViewProps {
  rows: Sheet4ProfitRow[];
  isLoading: boolean;
  onRefresh: () => void;
  lastUpdated?: Date | null;
  spreadsheetId: string;
  listProductNames?: string[];
}

export const Sheet4ProfitView: React.FC<Sheet4ProfitViewProps> = ({
  rows,
  isLoading,
  onRefresh,
  lastUpdated,
  spreadsheetId,
  listProductNames,
}) => {
  // Calendar & Date Filters state
  const [dateMode, setDateMode] = useState<'all' | 'single' | 'range'>('all');
  const [singleDate, setSingleDate] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');

  // Per-card visibility state for Live Profit (Part 1: Cols J-T) and Demo Profit (Part 2: Cols V-AC)
  const [cardExpandedState, setCardExpandedState] = useState<
    Record<string, { showLive: boolean; showDemo: boolean }>
  >({});

  // 6 Core Products for Sheet4 (dynamically synchronized with List sheet Column B if available)
  const SHEET4_CORE_PRODUCTS = useMemo(() => {
    if (listProductNames && listProductNames.length >= 6) {
      return listProductNames;
    }
    try {
      const saved = localStorage.getItem('sheet_list_product_names');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 6) return parsed;
      }
    } catch (e) {}
    return [
      'Watch 599tk',
      'Rose 599tk',
      'Doll and toys',
      'Cutting Dispancer',
      'Porbash Rose 990tk',
      'Porbash Rose 1350tk',
    ];
  }, [listProductNames]);

  // All unique products list (Core 6 products + any dynamic products from rows)
  const uniqueProducts = useMemo(() => {
    const fromRows = Array.from(new Set(rows.map((r) => r.product).filter(Boolean)));
    const merged = Array.from(new Set([...SHEET4_CORE_PRODUCTS, ...fromRows]));
    return merged;
  }, [rows, SHEET4_CORE_PRODUCTS]);

  // Unique sorted dates list
  const uniqueDates = useMemo(() => {
    const dates = Array.from(new Set(rows.map((r) => r.date).filter(Boolean)));
    // Sort descending (latest date first)
    return dates.sort((a, b) => b.localeCompare(a));
  }, [rows]);

  // Unique sources list
  const uniqueSources = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.source).filter(Boolean)));
  }, [rows]);

  // Active Date Description Label for Summary & Header
  const activeDateLabel = useMemo(() => {
    if (dateMode === 'all') return 'সকল তারিখ';
    if (dateMode === 'single') return singleDate ? `তারিখ: ${singleDate}` : 'নির্দিষ্ট তারিখ নির্বাচন করুন';
    if (dateMode === 'range') {
      if (startDate && endDate) {
        const from = startDate <= endDate ? startDate : endDate;
        const to = startDate <= endDate ? endDate : startDate;
        return `${from} থেকে ${to}`;
      }
      if (startDate) return `${startDate} থেকে পরবর্তী`;
      if (endDate) return `${endDate} পর্যন্ত`;
      return 'কাস্টম রেঞ্জ নির্বাচন করুন';
    }
    return 'সকল রেকর্ড';
  }, [dateMode, singleDate, startDate, endDate]);

  // Full Active Filter Label (Date + Product)
  const activeFilterLabel = useMemo(() => {
    const parts = [activeDateLabel];
    if (selectedProduct !== 'all') {
      parts.push(`পণ্য: ${selectedProduct}`);
    }
    return parts.join(' • ');
  }, [activeDateLabel, selectedProduct]);

  // Filtered rows based on calendar date mode (all, single, range), selected product, and source
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      // 1. Single Date Filter
      if (dateMode === 'single') {
        if (singleDate && row.date !== singleDate) {
          return false;
        }
      }
      // 2. Custom Date Range Filter (2 Dates: Start & End)
      else if (dateMode === 'range') {
        if (startDate && endDate) {
          const from = startDate <= endDate ? startDate : endDate;
          const to = startDate <= endDate ? endDate : startDate;
          if (row.date < from || row.date > to) return false;
        } else if (startDate) {
          if (row.date < startDate) return false;
        } else if (endDate) {
          if (row.date > endDate) return false;
        }
      }

      // 3. Product Filter (Selected Date এর Selected Product ফিল্টার)
      if (selectedProduct !== 'all') {
        if (row.product.toLowerCase().trim() !== selectedProduct.toLowerCase().trim()) {
          return false;
        }
      }

      // 4. Source filter
      if (selectedSource !== 'all' && row.source.toLowerCase() !== selectedSource.toLowerCase()) {
        return false;
      }

      return true;
    });
  }, [rows, dateMode, singleDate, startDate, endDate, selectedProduct, selectedSource]);

  // Top 6 Big Summary Metrics
  const summaryMetrics = useMemo(() => {
    let totalLiveProfit = 0;
    let totalIdeaProfit = 0;
    let totalAdsCostTK = 0;
    let totalDeliveryCharge = 0;
    let totalQuantity = 0;
    let totalWCod = 0;
    let totalDeliveredItems = 0;
    let totalPendingCount = 0;
    let totalCancelCount = 0;
    let fullyFilledCount = 0;

    filteredRows.forEach((r) => {
      totalLiveProfit += r.liveProfitAmount || 0;
      totalIdeaProfit += r.ideaProfitAmount || 0;
      totalAdsCostTK += r.adsCostTK || 0;
      totalQuantity += r.quantity || 0;
      totalWCod += r.wCod || 0;

      // Extract delivery charge number from Col K or Col W
      const delK = parseFloat(String(r.deliveryCharge).replace(/[^0-9.-]/g, '')) || 0;
      const delW = r.ideaDeliveryCharge || 0;
      totalDeliveryCharge += delK > 0 ? delK : delW;

      // Extract delivered count from Col P or Col G
      const delMatch = String(r.delivery || '').match(/^(\d+)/);
      if (delMatch) {
        totalDeliveredItems += parseInt(delMatch[1], 10);
      }

      // Extract pending count
      const pMatch = String(r.pending || '').match(/^(\d+)/);
      if (pMatch) {
        totalPendingCount += parseInt(pMatch[1], 10);
      }

      // Extract cancel count
      const cMatch = String(r.cancel || '').match(/^(\d+)/);
      if (cMatch) {
        totalCancelCount += parseInt(cMatch[1], 10);
      }

      // 4 critical columns (N, O, AA, AC)
      const isNFilled = isFieldFilled(r.adsCostUSD);
      const isOFilled = isFieldFilled(r.dollarRate);
      const isAAFilled = isFieldFilled(r.perCharge);
      const isACFilled = isFieldFilled(r.productCosting);
      if (isNFilled && isOFilled && isAAFilled && isACFilled) {
        fullyFilledCount += 1;
      }
    });

    const profitDiff = totalLiveProfit - totalIdeaProfit;

    return {
      totalLiveProfit,
      totalIdeaProfit,
      totalAdsCostTK,
      totalDeliveryCharge,
      totalQuantity,
      totalWCod,
      totalDeliveredItems,
      totalPendingCount,
      totalCancelCount,
      fullyFilledCount,
      profitDiff,
      rowCount: filteredRows.length,
    };
  }, [filteredRows]);

  // Toggle Live Profit (First Part: J, K, L, M, N, O, P, Q, R, S, T)
  const toggleLiveProfit = (rowId: string) => {
    setCardExpandedState((prev) => {
      const current = prev[rowId] || { showLive: false, showDemo: false };
      return {
        ...prev,
        [rowId]: {
          ...current,
          showLive: !current.showLive,
        },
      };
    });
  };

  // Toggle Demo / Idea Profit (Second Part: V, W, X, Y, Z, AA, AB, AC)
  const toggleDemoProfit = (rowId: string) => {
    setCardExpandedState((prev) => {
      const current = prev[rowId] || { showLive: false, showDemo: false };
      return {
        ...prev,
        [rowId]: {
          ...current,
          showDemo: !current.showDemo,
        },
      };
    });
  };

  // Bulk Expand / Collapse actions
  const handleCollapseAll = () => {
    setCardExpandedState({});
  };

  const handleExpandAllLive = () => {
    const next: Record<string, { showLive: boolean; showDemo: boolean }> = {};
    filteredRows.forEach((r) => {
      next[r.id] = { showLive: true, showDemo: false };
    });
    setCardExpandedState(next);
  };

  const handleExpandAllDemo = () => {
    const next: Record<string, { showLive: boolean; showDemo: boolean }> = {};
    filteredRows.forEach((r) => {
      next[r.id] = { showLive: false, showDemo: true };
    });
    setCardExpandedState(next);
  };

  const handleExpandAllBoth = () => {
    const next: Record<string, { showLive: boolean; showDemo: boolean }> = {};
    filteredRows.forEach((r) => {
      next[r.id] = { showLive: true, showDemo: true };
    });
    setCardExpandedState(next);
  };

  // Helper for source badge styling
  const getSourceBadgeColor = (source: string) => {
    const s = source.toLowerCase();
    if (s.includes('web')) return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    if (s.includes('what')) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    if (s.includes('tik')) return 'bg-pink-500/15 text-pink-400 border-pink-500/30';
    if (s.includes('mess')) return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    if (s.includes('you')) return 'bg-red-500/15 text-red-400 border-red-500/30';
    return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* Top Header / Control Banner - Optimized single sleek row for mobile */}
      <div className="flex items-center justify-between gap-3 bg-[#121622] border border-[#1f293d] rounded-xl px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 shrink-0">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
          </div>
          <h1 className="text-sm sm:text-lg font-bold text-white font-siliguri truncate">
            শীট-৪ প্রফিট অ্যানালাইসিস
          </h1>
        </div>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a2030] hover:bg-[#232b40] text-gray-200 border border-[#2a344d] transition-all text-xs font-medium active:scale-95 disabled:opacity-50 shrink-0"
          title="গুগল শিট থেকে ডাটা রিফ্রেশ করুন"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isLoading ? 'animate-spin' : ''}`} />
          <span className="font-siliguri">{isLoading ? 'লোড হচ্ছে...' : 'লাইভ রিফ্রেশ'}</span>
        </button>
      </div>

      {/* Date Filter & Search Controls */}
      <div className="bg-[#121622] border border-[#1f293d] rounded-2xl p-3.5 sm:p-4 space-y-3.5 shadow-md">
        {/* Calendar Mode Switcher & Active Filter Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-[#1a2130]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-200 flex items-center gap-1.5 font-siliguri">
              <Calendar className="w-4 h-4 text-emerald-400" />
              ক্যালেন্ডার ও ফিল্টার:
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              {activeFilterLabel}
            </span>
            {(dateMode !== 'all' || startDate || endDate || singleDate || selectedProduct !== 'all') && (
              <button
                onClick={() => {
                  setDateMode('all');
                  setSingleDate('');
                  setStartDate('');
                  setEndDate('');
                  setSelectedProduct('all');
                }}
                className="text-[11px] text-pink-400 hover:text-pink-300 font-siliguri flex items-center gap-1 transition-colors"
                title="সকল ফিল্টার রিসেট করুন"
              >
                <X className="w-3 h-3" />
                রিসেট
              </button>
            )}
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1 bg-[#0c0f17] p-1 rounded-xl border border-[#1f283d] self-start sm:self-auto overflow-x-auto max-w-full">
            <button
              onClick={() => {
                setDateMode('all');
              }}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-all font-siliguri shrink-0 ${
                dateMode === 'all'
                  ? 'bg-emerald-600 text-white shadow font-semibold'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              সব রেকর্ড
            </button>
            <button
              onClick={() => {
                setDateMode('single');
                if (!singleDate && uniqueDates.length > 0) {
                  setSingleDate(uniqueDates[0]);
                }
              }}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-all font-siliguri shrink-0 flex items-center gap-1 ${
                dateMode === 'single'
                  ? 'bg-emerald-600 text-white shadow font-semibold'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              নির্দিষ্ট তারিখ
            </button>
            <button
              onClick={() => {
                setDateMode('range');
                if (!startDate && !endDate && uniqueDates.length >= 2) {
                  const sorted = [...uniqueDates].sort();
                  setStartDate(sorted[0]);
                  setEndDate(sorted[sorted.length - 1]);
                }
              }}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-all font-siliguri shrink-0 flex items-center gap-1 ${
                dateMode === 'range'
                  ? 'bg-emerald-600 text-white shadow font-semibold'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              কাস্টম রেঞ্জ (২টি ডেট)
            </button>
          </div>
        </div>

        {/* 1. SINGLE DATE PICKER */}
        {dateMode === 'single' && (
          <div className="flex items-center gap-2.5 bg-[#0d1017] p-2.5 sm:p-3 rounded-xl border border-[#1b2336] animate-fadeIn">
            <label className="text-xs text-gray-300 font-siliguri shrink-0 font-medium flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              ক্যালেন্ডারে ক্লিক করুন:
            </label>
            <input
              type="date"
              value={singleDate}
              onChange={(e) => setSingleDate(e.target.value)}
              className="bg-[#161c28] border border-[#273248] text-white text-xs px-3 py-1.5 rounded-lg focus:outline-none focus:border-emerald-500 font-mono cursor-pointer transition-colors shadow-sm"
            />
          </div>
        )}

        {/* 2. CUSTOM DATE RANGE PICKER (২টি ডেট সিলেক্ট করে ফিল্টার) */}
        {dateMode === 'range' && (
          <div className="bg-[#0d1017] p-3.5 rounded-xl border border-emerald-500/20 space-y-3 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 flex-wrap">
                {/* 1st Date: Start Date Picker */}
                <div className="flex items-center gap-2 bg-[#121622] px-3 py-2 rounded-xl border border-[#222c42]">
                  <span className="text-xs text-gray-300 font-siliguri font-medium shrink-0 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                    ১ম ডেট (শুরু):
                  </span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-transparent text-white text-xs font-mono focus:outline-none cursor-pointer"
                  />
                </div>

                <span className="text-emerald-400 font-bold text-sm hidden sm:inline">➜</span>

                {/* 2nd Date: End Date Picker */}
                <div className="flex items-center gap-2 bg-[#121622] px-3 py-2 rounded-xl border border-[#222c42]">
                  <span className="text-xs text-gray-300 font-siliguri font-medium shrink-0 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                    ২য় ডেট (শেষ):
                  </span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-transparent text-white text-xs font-mono focus:outline-none cursor-pointer"
                  />
                </div>
              </div>

              {/* Action buttons inside range picker */}
              <div className="flex items-center gap-2 self-end sm:self-auto">
                {(startDate || endDate) && (
                  <button
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                    }}
                    className="px-2.5 py-1.5 text-xs text-pink-400 hover:text-pink-300 bg-pink-500/10 border border-pink-500/20 rounded-lg font-siliguri transition-all"
                  >
                    ক্লিয়ার
                  </button>
                )}
              </div>
            </div>

            {/* Helper guideline for the user */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-gray-400 font-siliguri pt-2 border-t border-[#172030]">
              <span className="flex items-center gap-1 text-gray-300">
                <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />
                ২টি তারিখ সিলেক্ট করুন — ঐ দুই তারিখ ও এর মধ্যবর্তী সব রো স্বয়ংক্রিয়ভাবে ফিল্টার হবে।
              </span>
              <span className="text-emerald-300 font-mono font-semibold">
                ফিল্টার ফলাফল: {filteredRows.length} টি রো
              </span>
            </div>
          </div>
        )}


        {/* Product Filter Row (Sheet4 এর ৬টি প্রোডাক্ট + সোর্স ফিল্টার) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 border-t border-[#1a2130]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-300 font-semibold font-siliguri flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-emerald-400" />
              প্রোডাক্ট নির্বাচন করুন (Product Filter):
            </span>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="px-3 py-1.5 bg-[#0c0f17] border border-[#222a3d] hover:border-emerald-500/50 rounded-xl text-xs text-gray-200 focus:outline-none focus:border-emerald-500 transition-colors font-siliguri cursor-pointer font-medium"
            >
              <option value="all">সকল প্রোডাক্ট (All Products - {uniqueProducts.length}টি)</option>
              {uniqueProducts.map((prod) => (
                <option key={prod} value={prod}>
                  📦 {prod}
                </option>
              ))}
            </select>

            {selectedProduct !== 'all' && (
              <button
                onClick={() => setSelectedProduct('all')}
                className="text-[11px] text-pink-400 hover:text-pink-300 font-siliguri flex items-center gap-0.5 ml-1"
                title="প্রোডাক্ট ফিল্টার রিসেট করুন"
              >
                <X className="w-3 h-3" />
                ক্লিয়ার
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 6 BIG SUMMARY CARDS FOR SELECTED DATE (অনুরোধকৃত ৬টি বড় কার্ড) */}
      {/* ============================================================ */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-sm font-bold text-gray-200 font-siliguri flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            নির্বাচিত ফিল্টারের মোট সামারি (Total Summary):{' '}
            <span className="text-emerald-400">
              {activeFilterLabel}
            </span>
          </h2>
          <span className="text-xs text-gray-400 font-siliguri">
            মোট {summaryMetrics.rowCount} টি রো পাওয়া গেছে
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {/* Card 1: Total Live Profit (Col T) */}
          <div className="bg-gradient-to-b from-[#13221d] to-[#0f1717] border border-emerald-500/30 rounded-2xl p-4 shadow-lg hover:border-emerald-500/50 transition-all relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all pointer-events-none" />
            <div className="flex items-center justify-between text-emerald-400 mb-2">
              <span className="text-[11px] font-semibold font-siliguri">টোটাল লাইভ প্রফিট</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-white font-mono tracking-tight">
              ৳ {summaryMetrics.totalLiveProfit.toLocaleString()}
            </div>
            <p className="text-[10px] text-emerald-400/80 font-siliguri mt-1">
              Col T (PROFIT) লাইভ যোগফল
            </p>
          </div>

          {/* Card 2: Total Idea Profit (Col AB) */}
          <div className="bg-gradient-to-b from-[#1d162b] to-[#120f1c] border border-purple-500/30 rounded-2xl p-4 shadow-lg hover:border-purple-500/50 transition-all relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/10 rounded-full blur-xl group-hover:bg-purple-500/20 transition-all pointer-events-none" />
            <div className="flex items-center justify-between text-purple-400 mb-2">
              <span className="text-[11px] font-semibold font-siliguri">আইডিয়া / ডেমো প্রফিট</span>
              <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Coins className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-white font-mono tracking-tight">
              ৳ {summaryMetrics.totalIdeaProfit.toLocaleString()}
            </div>
            <p className="text-[10px] text-purple-400/80 font-siliguri mt-1">
              Col AB (IDEA PROFIT) যোগফল
            </p>
          </div>

          {/* Card 3: Total Ads Cost TK (Col Q) */}
          <div className="bg-gradient-to-b from-[#181c2b] to-[#10131f] border border-sky-500/30 rounded-2xl p-4 shadow-lg hover:border-sky-500/50 transition-all relative overflow-hidden group">
            <div className="flex items-center justify-between text-sky-400 mb-2">
              <span className="text-[11px] font-semibold font-siliguri">মোট অ্যাড কস্ট (TK)</span>
              <div className="w-7 h-7 rounded-lg bg-sky-500/20 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-white font-mono tracking-tight">
              ৳ {summaryMetrics.totalAdsCostTK.toLocaleString()}
            </div>
            <p className="text-[10px] text-sky-400/80 font-siliguri mt-1">
              Col Q (ADS COST TK)
            </p>
          </div>

          {/* Card 4: Delivery Charge (Col K & W) */}
          <div className="bg-gradient-to-b from-[#24171e] to-[#170e14] border border-rose-500/30 rounded-2xl p-4 shadow-lg hover:border-rose-500/50 transition-all relative overflow-hidden group">
            <div className="flex items-center justify-between text-rose-400 mb-2">
              <span className="text-[11px] font-semibold font-siliguri">ডেলিভারি চার্জ</span>
              <div className="w-7 h-7 rounded-lg bg-rose-500/20 flex items-center justify-center">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-white font-mono tracking-tight">
              ৳ {summaryMetrics.totalDeliveryCharge.toLocaleString()}
            </div>
            <p className="text-[10px] text-rose-400/80 font-siliguri mt-1">
              Col K & W কুরিয়ার ফি
            </p>
          </div>

          {/* Card 5: Total Quantity (Col S) */}
          <div className="bg-gradient-to-b from-[#1e1c16] to-[#14120e] border border-amber-500/30 rounded-2xl p-4 shadow-lg hover:border-amber-500/50 transition-all relative overflow-hidden group">
            <div className="flex items-center justify-between text-amber-400 mb-2">
              <span className="text-[11px] font-semibold font-siliguri">মোট কোয়ান্টিটি</span>
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-white font-mono tracking-tight">
              {summaryMetrics.totalQuantity}{' '}
              <span className="text-xs font-normal text-gray-400">পিস</span>
            </div>
            <p className="text-[10px] text-amber-400/80 font-siliguri mt-1">
              Col S (QUANTITY)
            </p>
          </div>

          {/* Card 6: Total COD / Complete Orders */}
          <div className="bg-gradient-to-b from-[#181a24] to-[#0f1118] border border-[#2b3347] rounded-2xl p-4 shadow-lg hover:border-[#3d4965] transition-all relative overflow-hidden group">
            <div className="flex items-center justify-between text-gray-300 mb-2">
              <span className="text-[11px] font-semibold font-siliguri">মোট সিওডি এমাউন্ট</span>
              <div className="w-7 h-7 rounded-lg bg-gray-700/30 flex items-center justify-center">
                <Layers className="w-4 h-4 text-gray-300" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-white font-mono tracking-tight">
              ৳ {summaryMetrics.totalWCod.toLocaleString()}
            </div>
            <p className="text-[10px] text-gray-400 font-siliguri mt-1">
              Col L (w cod) / {summaryMetrics.rowCount} রো
            </p>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* SHEET4 ROWS AS SLIM CARDS (চিকন কার্ড + SHOW LIVE / SHOW DEMO) */}
      {/* ============================================================ */}
      <div className="space-y-3">
        {/* Section Header with Quick Global Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-gray-200 font-siliguri">
              রো তালিকা ({filteredRows.length} টি চিকন কার্ড)
            </h3>
            <span className="text-[11px] text-gray-400 font-siliguri hidden sm:inline">
              — বাটনে ট্যাপ করে লাইভ বা ডেমো হিসাব দেখুন
            </span>
          </div>

          {/* Quick Expand / Collapse Buttons */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto">
            <button
              onClick={handleCollapseAll}
              className="px-2.5 py-1 rounded-lg bg-[#161b26] hover:bg-[#1f2636] text-[11px] text-gray-400 hover:text-gray-200 border border-[#222a3d] font-siliguri transition-all flex items-center gap-1"
              title="সকল কার্ড চিকন করুন"
            >
              <Minimize2 className="w-3 h-3 text-gray-400" />
              সব চিকন (Compact)
            </button>
            <button
              onClick={handleExpandAllLive}
              className="px-2.5 py-1 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/50 text-[11px] text-emerald-300 border border-emerald-500/30 font-siliguri transition-all flex items-center gap-1"
              title="সকল লাইভ প্রফিট একসাথে খুলুন"
            >
              <TrendingUp className="w-3 h-3 text-emerald-400" />
              সব লাইভ (J-T)
            </button>
            <button
              onClick={handleExpandAllDemo}
              className="px-2.5 py-1 rounded-lg bg-purple-950/40 hover:bg-purple-900/50 text-[11px] text-purple-300 border border-purple-500/30 font-siliguri transition-all flex items-center gap-1"
              title="সকল ডেমো প্রফিট একসাথে খুলুন"
            >
              <Coins className="w-3 h-3 text-purple-400" />
              সব ডেমো (V-AC)
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* PERMANENT EXTRA MASTER SUMMARY CARD FOR SELECTED DATE & TOTALS */}
        {/* ============================================================ */}
        <div className="bg-gradient-to-br from-[#121929] via-[#0d1322] to-[#141b2c] border-2 border-emerald-500/40 rounded-2xl p-4 sm:p-5 shadow-xl shadow-emerald-950/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header Row: Title + Selected Date + Selected Product + Count */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-[#20293d] relative z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-md shadow-emerald-500/30 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white font-siliguri flex items-center gap-2">
                  নির্বাচিত তারিখের মোট হিসাব (Selected Combined Master Total)
                </h3>
                <p className="text-[11px] text-gray-400 font-siliguri">
                  নির্বাচিত তারিখ ও প্রোডাক্টের সব রো একসাথে গণনা করে সামগ্রিক হিসাব
                </p>
              </div>
            </div>

            {/* Selected Date & Product Badges */}
            <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-bold">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                <span>{activeDateLabel}</span>
              </div>
              {selectedProduct !== 'all' && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-siliguri font-semibold">
                  <Package className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{selectedProduct}</span>
                </div>
              )}
              <div className="px-2.5 py-1.5 rounded-xl bg-[#1a2336] border border-[#2b3954] text-gray-200 text-xs font-mono font-bold">
                {summaryMetrics.rowCount} টি রো সিলেক্টেড
              </div>
            </div>
          </div>

          {/* 6 Combined Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3 pt-3.5 relative z-10">
            {/* 1. Net Live Profit (Col T) */}
            <div className="bg-[#0b0f19]/90 border border-emerald-500/35 hover:border-emerald-500/60 rounded-xl p-3 transition-all shadow-sm">
              <div className="flex items-center justify-between text-emerald-400 mb-1">
                <span className="text-[11px] font-semibold font-siliguri">টোটাল লাইভ প্রফিট</span>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-lg sm:text-xl font-extrabold text-white font-mono tracking-tight">
                ৳ {summaryMetrics.totalLiveProfit.toLocaleString()}
              </div>
              <span className="text-[10px] text-emerald-400/80 font-siliguri">Col T (লাইভ মোট প্রফিট)</span>
            </div>

            {/* 2. Idea Profit (Col AB) */}
            <div className="bg-[#0b0f19]/90 border border-purple-500/35 hover:border-purple-500/60 rounded-xl p-3 transition-all shadow-sm">
              <div className="flex items-center justify-between text-purple-400 mb-1">
                <span className="text-[11px] font-semibold font-siliguri">আইডিয়া প্রফিট</span>
                <Coins className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <div className="text-lg sm:text-xl font-extrabold text-white font-mono tracking-tight">
                ৳ {summaryMetrics.totalIdeaProfit.toLocaleString()}
              </div>
              <span className="text-[10px] text-purple-400/80 font-siliguri">Col AB (ডেমো মোট প্রফিট)</span>
            </div>

            {/* 3. Total COD Amount (Col L) */}
            <div className="bg-[#0b0f19]/90 border border-cyan-500/35 hover:border-cyan-500/60 rounded-xl p-3 transition-all shadow-sm">
              <div className="flex items-center justify-between text-cyan-400 mb-1">
                <span className="text-[11px] font-semibold font-siliguri">মোট সিওডি (w cod)</span>
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <div className="text-lg sm:text-xl font-extrabold text-white font-mono tracking-tight">
                ৳ {summaryMetrics.totalWCod.toLocaleString()}
              </div>
              <span className="text-[10px] text-cyan-400/80 font-siliguri">Col L (মোট সংগৃহীত COD)</span>
            </div>

            {/* 4. Total Ads Cost TK (Col Q) */}
            <div className="bg-[#0b0f19]/90 border border-sky-500/35 hover:border-sky-500/60 rounded-xl p-3 transition-all shadow-sm">
              <div className="flex items-center justify-between text-sky-400 mb-1">
                <span className="text-[11px] font-semibold font-siliguri">মোট অ্যাড খরচ</span>
                <DollarSign className="w-3.5 h-3.5 text-sky-400" />
              </div>
              <div className="text-lg sm:text-xl font-extrabold text-white font-mono tracking-tight">
                ৳ {summaryMetrics.totalAdsCostTK.toLocaleString()}
              </div>
              <span className="text-[10px] text-sky-400/80 font-siliguri">Col Q (অ্যাড খরচ টাকা)</span>
            </div>

            {/* 5. Total Delivery Charge (Col K/W) */}
            <div className="bg-[#0b0f19]/90 border border-rose-500/35 hover:border-rose-500/60 rounded-xl p-3 transition-all shadow-sm">
              <div className="flex items-center justify-between text-rose-400 mb-1">
                <span className="text-[11px] font-semibold font-siliguri">ডেলিভারি চার্জ</span>
                <Truck className="w-3.5 h-3.5 text-rose-400" />
              </div>
              <div className="text-lg sm:text-xl font-extrabold text-white font-mono tracking-tight">
                ৳ {summaryMetrics.totalDeliveryCharge.toLocaleString()}
              </div>
              <span className="text-[10px] text-rose-400/80 font-siliguri">Col K & W (কুরিয়ার খরচ)</span>
            </div>

            {/* 6. Total Quantity (Col S) */}
            <div className="bg-[#0b0f19]/90 border border-amber-500/35 hover:border-amber-500/60 rounded-xl p-3 transition-all shadow-sm">
              <div className="flex items-center justify-between text-amber-400 mb-1">
                <span className="text-[11px] font-semibold font-siliguri">মোট কোয়ান্টিটি</span>
                <Package className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="text-lg sm:text-xl font-extrabold text-white font-mono tracking-tight">
                {summaryMetrics.totalQuantity}{' '}
                <span className="text-xs font-normal text-gray-400">টি</span>
              </div>
              <span className="text-[10px] text-amber-400/80 font-siliguri">Col S (মোট পিস)</span>
            </div>
          </div>

          {/* Bottom Combined Status Bar */}
          <div className="mt-3.5 pt-3 border-t border-[#1d263b] flex flex-wrap items-center justify-between gap-2.5 text-xs font-siliguri relative z-10">
            <div className="flex items-center gap-3 flex-wrap text-gray-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                মোট ডেলিভার্ড:{' '}
                <strong className="text-white font-mono font-bold">{summaryMetrics.totalDeliveredItems}</strong>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                মোট পেন্ডিং:{' '}
                <strong className="text-white font-mono font-bold">{summaryMetrics.totalPendingCount}</strong>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                মোট ক্যান্সেল:{' '}
                <strong className="text-white font-mono font-bold">{summaryMetrics.totalCancelCount}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px]">
              <span className="font-mono px-2.5 py-0.5 rounded-lg bg-[#161f30] border border-[#23314c] text-emerald-300 font-semibold">
                {summaryMetrics.fullyFilledCount}/{summaryMetrics.rowCount} রো সম্পূর্ণ পূরণ (Col N, O, AA, AC)
              </span>
            </div>
          </div>
        </div>

        {filteredRows.length === 0 ? (
          <div className="bg-[#121622] border border-[#1f293d] rounded-2xl p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-800/50 flex items-center justify-center mx-auto mb-3 text-gray-400">
              <Package className="w-7 h-7" />
            </div>
            <h4 className="text-base font-semibold text-gray-200 font-siliguri">
              কোন ডাটা পাওয়া যায়নি
            </h4>
            <p className="text-xs text-gray-400 font-siliguri mt-1">
              নির্বাচিত তারিখ বা ফিল্টারে কোন রো নেই। উপরের 'লাইভ রিফ্রেশ' বাটনে ক্লিক করে পুনরায় চেক করতে পারেন।
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredRows.map((row) => {
              const state = cardExpandedState[row.id] || { showLive: false, showDemo: false };
              const { showLive, showDemo } = state;
              const hasAnyOpen = showLive || showDemo;
              const isLiveProfitPositive = row.liveProfitAmount > 0;
              const hasIdeaProfit = row.ideaProfitAmount > 0;

              // Check if Columns N, O, AA, AC are filled
              const isNFilled = isFieldFilled(row.adsCostUSD);
              const isOFilled = isFieldFilled(row.dollarRate);
              const isAAFilled = isFieldFilled(row.perCharge);
              const isACFilled = isFieldFilled(row.productCosting);
              const filledCount =
                (isNFilled ? 1 : 0) +
                (isOFilled ? 1 : 0) +
                (isAAFilled ? 1 : 0) +
                (isACFilled ? 1 : 0);
              const allFilled = filledCount === 4;

              return (
                <div
                  key={row.id}
                  className={`bg-[#121622] border transition-all duration-200 rounded-xl shadow-md overflow-hidden ${
                    hasAnyOpen
                      ? 'border-[#2f3d59] shadow-xl ring-1 ring-emerald-500/10'
                      : 'border-[#1b2234] hover:border-[#27324c]'
                  }`}
                >
                  {/* ============================================================ */}
                  {/* SLEEK / SLIM ROW (চিকন কার্ড হেডার) */}
                  {/* ============================================================ */}
                  <div className="p-3 sm:p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Left Info: Row Number, Product Name, Date, Source, Quantity */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-500/20 to-indigo-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-mono font-bold text-xs shrink-0">
                        #{row.rowIndex}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm sm:text-base font-bold text-white font-siliguri truncate">
                            {row.product}
                          </h4>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${getSourceBadgeColor(
                              row.source
                            )}`}
                          >
                            {row.source}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#181f2d] text-gray-300 border border-[#232d40]">
                            📅 {row.date}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#211a12] text-amber-300 border border-amber-500/30">
                            Qty: {row.quantity}
                          </span>
                        </div>

                        {/* Subline metrics */}
                        <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5 font-siliguri truncate flex-wrap">
                          <span>Pending: {row.pending}</span>
                          <span>•</span>
                          <span>Delivered: {row.delivery}</span>
                          <span>•</span>
                          <span>Cancel: {row.cancel}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right Info: Live & Demo Profit Pills + Explicit Action Buttons */}
                    <div className="flex items-center gap-2 flex-wrap justify-between md:justify-end shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-[#1a2130]">
                      {/* Compact Quick Profit Readouts & 4-Column (N, O, AA, AC) Status */}
                      <div className="flex items-center gap-2.5 bg-[#0c0f17] px-2.5 py-1.5 rounded-lg border border-[#1b2336]">
                        {/* 4-Column (N, O, AA, AC) Status Badge: Red 4/3, 4/1 ... Green 4/4 */}
                        <div
                          className={`px-2 py-0.5 rounded-md text-xs font-mono font-bold border flex items-center gap-1.5 shrink-0 transition-all ${
                            allFilled
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                              : 'bg-red-500/25 text-red-300 border-red-500/50 shadow-sm shadow-red-500/20'
                          }`}
                          title={`কলাম N, O, AA, AC পূরণ অবস্থা:\n• Col N (Ads Cost USD): ${
                            isNFilled ? 'পূরণ আছে (' + row.adsCostUSD + ') ✅' : 'খালি / শূন্য ❌'
                          }\n• Col O (Dollar Rate): ${
                            isOFilled ? 'পূরণ আছে (' + row.dollarRate + ') ✅' : 'খালি / শূন্য ❌'
                          }\n• Col AA (Per Charge): ${
                            isAAFilled ? 'পূরণ আছে (' + row.perCharge + ') ✅' : 'খালি / শূন্য ❌'
                          }\n• Col AC (Costing): ${
                            isACFilled ? 'পূরণ আছে (' + row.productCosting + ') ✅' : 'খালি / শূন্য ❌'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              allFilled ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'
                            }`}
                          />
                          <span>{allFilled ? '4/4' : `4/${filledCount}`}</span>
                        </div>

                        <div className="h-5 w-px bg-[#222a3d]" />

                        <div className="text-left">
                          <div className="text-[9px] text-emerald-400/90 font-siliguri leading-none">
                            লাইভ (Col T)
                          </div>
                          <div
                            className={`text-xs sm:text-sm font-bold font-mono mt-0.5 ${
                              isLiveProfitPositive ? 'text-emerald-400' : 'text-gray-300'
                            }`}
                          >
                            ৳ {row.liveProfit}
                          </div>
                        </div>

                        <div className="h-5 w-px bg-[#222a3d]" />

                        <div className="text-left">
                          <div className="text-[9px] text-purple-400/90 font-siliguri leading-none">
                            আইডিয়া (Col AB)
                          </div>
                          <div
                            className={`text-xs sm:text-sm font-bold font-mono mt-0.5 ${
                              hasIdeaProfit ? 'text-purple-400' : 'text-gray-300'
                            }`}
                          >
                            ৳ {row.ideaProfit}
                          </div>
                        </div>
                      </div>

                      {/* TWO DEDICATED ACTION BUTTONS AS REQUESTED */}
                      {/* Button 1: SHOW LIVE PROFIT (Part 1: Col J-T) */}
                      <button
                        onClick={() => toggleLiveProfit(row.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-siliguri transition-all flex items-center gap-1.5 active:scale-95 ${
                          showLive
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                            : 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/40 hover:border-emerald-500/70'
                        }`}
                        title="কলাম J, K, L, M, N, O, P, Q, R, S, T দেখুন"
                      >
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>{showLive ? 'Hide Live Profit' : 'Show Live Profit'}</span>
                        {showLive ? (
                          <ChevronUp className="w-3.5 h-3.5 ml-0.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 ml-0.5 opacity-70" />
                        )}
                      </button>

                      {/* Button 2: SHOW DEMO PROFIT (Part 2: Col V-AC) */}
                      <button
                        onClick={() => toggleDemoProfit(row.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-siliguri transition-all flex items-center gap-1.5 active:scale-95 ${
                          showDemo
                            ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                            : 'bg-purple-950/40 hover:bg-purple-900/60 text-purple-300 border border-purple-500/40 hover:border-purple-500/70'
                        }`}
                        title="কলাম V, W, X, Y, Z, AA, AB, AC দেখুন"
                      >
                        <Coins className="w-3.5 h-3.5" />
                        <span>{showDemo ? 'Hide Demo Profit' : 'Show Demo Profit'}</span>
                        {showDemo ? (
                          <ChevronUp className="w-3.5 h-3.5 ml-0.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 ml-0.5 opacity-70" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* ============================================================ */}
                  {/* EXPANDED CONTENT: PART 1 (LIVE) AND/OR PART 2 (DEMO) */}
                  {/* ============================================================ */}
                  {hasAnyOpen && (
                    <div className="border-t border-[#1a2233] bg-[#0c0f17] p-3 sm:p-4 animate-fadeIn">
                      <div
                        className={`grid gap-4 ${
                          showLive && showDemo
                            ? 'grid-cols-1 lg:grid-cols-2'
                            : 'grid-cols-1'
                        }`}
                      >
                        {/* ============================================================ */}
                        {/* FIRST PART: LIVE PROFIT & COSTS (কলাম J, K, L, M, N, O, P, Q, R, S, T) */}
                        {/* ============================================================ */}
                        {showLive && (
                          <div className="bg-[#121622] border border-emerald-500/30 rounded-xl p-3.5 space-y-3">
                            <div className="flex items-center justify-between pb-2 border-b border-[#1b2538]">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                                <h5 className="text-xs sm:text-sm font-bold text-emerald-400 font-siliguri">
                                  ফার্স্ট পার্ট: লাইভ প্রফিট ও খরচ (Columns J - T)
                                </h5>
                              </div>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                                Live Sheet Values
                              </span>
                            </div>

                            {/* Top Highlight Banner */}
                            <div className="bg-gradient-to-r from-emerald-950/60 via-[#10291e] to-emerald-950/40 border border-emerald-500/50 rounded-xl p-3 flex items-center justify-between shadow-inner">
                              <div>
                                <span className="text-[10px] text-emerald-300 font-siliguri font-semibold block">
                                  Col T - লাইভ প্রফিট (Live Profit)
                                </span>
                                <div className="text-xl sm:text-2xl font-black text-emerald-300 font-mono tracking-tight mt-0.5">
                                  ৳ {row.liveProfit}
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] text-gray-400 font-siliguri block">
                                  Col S - কোয়ান্টিটি
                                </span>
                                <div className="text-base font-bold text-white font-mono mt-0.5">
                                  {row.quantity} pcs
                                </div>
                              </div>
                            </div>

                            {/* Live Columns Grid: J, K, L, M, N, O, P, Q, R */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                              {/* Col J: COD */}
                              <div className="bg-[#0b0e15] p-2.5 rounded-lg border border-[#1b2336]">
                                <span className="text-[10px] text-gray-400 font-siliguri block">
                                  Col J: COD
                                </span>
                                <span className="font-semibold text-gray-100 font-mono mt-0.5 block truncate">
                                  {row.cod || '0'}
                                </span>
                              </div>

                              {/* Col K: Delivery Charge */}
                              <div className="bg-[#0b0e15] p-2.5 rounded-lg border border-[#1b2336]">
                                <span className="text-[10px] text-gray-400 font-siliguri block">
                                  Col K: Delivery Charge
                                </span>
                                <span className="font-semibold text-rose-300 font-mono mt-0.5 block truncate">
                                  ৳ {row.deliveryCharge || '0'}
                                </span>
                              </div>

                              {/* Col L: w cod */}
                              <div className="bg-[#0b0e15] p-2.5 rounded-lg border border-[#1b2336]">
                                <span className="text-[10px] text-gray-400 font-siliguri block">
                                  Col L: w cod
                                </span>
                                <span className="font-semibold text-gray-100 font-mono mt-0.5 block truncate">
                                  ৳ {row.wCod}
                                </span>
                              </div>

                              {/* Col M: COD 1% */}
                              <div className="bg-[#0b0e15] p-2.5 rounded-lg border border-[#1b2336]">
                                <span className="text-[10px] text-gray-400 font-siliguri block">
                                  Col M: COD 1%
                                </span>
                                <span className="font-semibold text-gray-100 font-mono mt-0.5 block truncate">
                                  ৳ {row.cod1Percent}
                                </span>
                              </div>

                              {/* Col N: ADS COST $$ */}
                              <div
                                className={`p-2.5 rounded-lg border transition-all ${
                                  isNFilled
                                    ? 'bg-[#0b0e15] border-emerald-500/30'
                                    : 'bg-red-950/20 border-red-500/50'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-gray-400 font-siliguri block">
                                    Col N: Ads Cost ($$)
                                  </span>
                                  <span
                                    className={`text-[9px] px-1 py-0.2 rounded font-mono font-bold ${
                                      isNFilled
                                        ? 'bg-emerald-500/20 text-emerald-400'
                                        : 'bg-red-500/20 text-red-400'
                                    }`}
                                  >
                                    {isNFilled ? 'পূরণ ✓' : 'খালি ✗'}
                                  </span>
                                </div>
                                <span className="font-semibold text-sky-400 font-mono mt-0.5 block truncate">
                                  ${row.adsCostUSD || '0'}
                                </span>
                              </div>

                              {/* Col O: Doller Rate */}
                              <div
                                className={`p-2.5 rounded-lg border transition-all ${
                                  isOFilled
                                    ? 'bg-[#0b0e15] border-emerald-500/30'
                                    : 'bg-red-950/20 border-red-500/50'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-gray-400 font-siliguri block">
                                    Col O: Dollar Rate
                                  </span>
                                  <span
                                    className={`text-[9px] px-1 py-0.2 rounded font-mono font-bold ${
                                      isOFilled
                                        ? 'bg-emerald-500/20 text-emerald-400'
                                        : 'bg-red-500/20 text-red-400'
                                    }`}
                                  >
                                    {isOFilled ? 'পূরণ ✓' : 'খালি ✗'}
                                  </span>
                                </div>
                                <span className="font-semibold text-gray-100 font-mono mt-0.5 block truncate">
                                  {row.dollarRate || '0'}
                                </span>
                              </div>

                              {/* Col P: DELIVERY COMPLETE */}
                              <div className="bg-[#0b0e15] p-2.5 rounded-lg border border-[#1b2336]">
                                <span className="text-[10px] text-gray-400 font-siliguri block">
                                  Col P: Del Complete
                                </span>
                                <span className="font-semibold text-emerald-400 font-mono mt-0.5 block truncate">
                                  {row.deliveryComplete || '0'}
                                </span>
                              </div>

                              {/* Col Q: ADS COST TK */}
                              <div className="bg-[#0b0e15] p-2.5 rounded-lg border border-[#1b2336]">
                                <span className="text-[10px] text-gray-400 font-siliguri block">
                                  Col Q: Ads Cost (TK)
                                </span>
                                <span className="font-semibold text-sky-300 font-mono mt-0.5 block truncate">
                                  ৳ {row.adsCostTK}
                                </span>
                              </div>

                              {/* Col R: CPR */}
                              <div className="bg-[#0b0e15] p-2.5 rounded-lg border border-[#1b2336]">
                                <span className="text-[10px] text-gray-400 font-siliguri block">
                                  Col R: CPR
                                </span>
                                <span className="font-semibold text-gray-100 font-mono mt-0.5 block truncate">
                                  {row.cpr}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* ============================================================ */}
                        {/* SECOND PART: DEMO / IDEA PROFIT (কলাম V, W, X, Y, Z, AA, AB, AC) */}
                        {/* ============================================================ */}
                        {showDemo && (
                          <div className="bg-[#121622] border border-purple-500/30 rounded-xl p-3.5 space-y-3">
                            <div className="flex items-center justify-between pb-2 border-b border-[#241a38]">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                                <h5 className="text-xs sm:text-sm font-bold text-purple-400 font-siliguri">
                                  সেকেন্ড পার্ট: ডেমো ও আইডিয়া প্রফিট (Columns V - AC)
                                </h5>
                              </div>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 font-semibold">
                                Demo / Idea Values
                              </span>
                            </div>

                            {/* Top Highlight Banner */}
                            <div className="bg-gradient-to-r from-purple-950/60 via-[#231738] to-purple-950/40 border border-purple-500/50 rounded-xl p-3 flex items-center justify-between shadow-inner">
                              <div>
                                <span className="text-[10px] text-purple-300 font-siliguri font-semibold block">
                                  Col AB - আইডিয়া প্রফিট (Idea Profit)
                                </span>
                                <div className="text-xl sm:text-2xl font-black text-purple-300 font-mono tracking-tight mt-0.5">
                                  ৳ {row.ideaProfit}
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] text-gray-400 font-siliguri block">
                                  Col V - ক্যানসেল পার্সেন্টেজ
                                </span>
                                <div className="text-base font-bold text-rose-400 font-mono mt-0.5">
                                  {row.cancelPercent}
                                </div>
                              </div>
                            </div>

                            {/* Demo Columns Grid: V, W, X, Y, Z, AA, AC */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                              {/* Col V: Cancel % */}
                              <div className="bg-[#0b0e15] p-2.5 rounded-lg border border-[#1b2336]">
                                <span className="text-[10px] text-gray-400 font-siliguri block">
                                  Col V: Cancel %
                                </span>
                                <span className="font-semibold text-rose-400 font-mono mt-0.5 block truncate">
                                  {row.cancelPercent}
                                </span>
                              </div>

                              {/* Col W: Delivery Charge (Idea) */}
                              <div className="bg-[#0b0e15] p-2.5 rounded-lg border border-[#1b2336]">
                                <span className="text-[10px] text-gray-400 font-siliguri block">
                                  Col W: Del Charge
                                </span>
                                <span className="font-semibold text-gray-100 font-mono mt-0.5 block truncate">
                                  ৳ {row.ideaDeliveryCharge}
                                </span>
                              </div>

                              {/* Col X: IDEA D AMOUNT */}
                              <div className="bg-[#0b0e15] p-2.5 rounded-lg border border-[#1b2336]">
                                <span className="text-[10px] text-gray-400 font-siliguri block">
                                  Col X: Idea D Amount
                                </span>
                                <span className="font-semibold text-gray-100 font-mono mt-0.5 block truncate">
                                  ৳ {row.ideaDAmount}
                                </span>
                              </div>

                              {/* Col Y: W Delivery amount */}
                              <div className="bg-[#0b0e15] p-2.5 rounded-lg border border-[#1b2336]">
                                <span className="text-[10px] text-gray-400 font-siliguri block">
                                  Col Y: W Del Amount
                                </span>
                                <span className="font-semibold text-gray-100 font-mono mt-0.5 block truncate">
                                  ৳ {row.wDeliveryAmount}
                                </span>
                              </div>

                              {/* Col Z: IDEA COD 1% */}
                              <div className="bg-[#0b0e15] p-2.5 rounded-lg border border-[#1b2336]">
                                <span className="text-[10px] text-gray-400 font-siliguri block">
                                  Col Z: Idea COD 1%
                                </span>
                                <span className="font-semibold text-gray-100 font-mono mt-0.5 block truncate">
                                  ৳ {row.ideaCod1Percent}
                                </span>
                              </div>

                              {/* Col AA: Per Charge */}
                              <div
                                className={`p-2.5 rounded-lg border transition-all ${
                                  isAAFilled
                                    ? 'bg-[#0b0e15] border-emerald-500/30'
                                    : 'bg-red-950/20 border-red-500/50'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-gray-400 font-siliguri block">
                                    Col AA: Per Charge
                                  </span>
                                  <span
                                    className={`text-[9px] px-1 py-0.2 rounded font-mono font-bold ${
                                      isAAFilled
                                        ? 'bg-emerald-500/20 text-emerald-400'
                                        : 'bg-red-500/20 text-red-400'
                                    }`}
                                  >
                                    {isAAFilled ? 'পূরণ ✓' : 'খালি ✗'}
                                  </span>
                                </div>
                                <span className="font-semibold text-gray-100 font-mono mt-0.5 block truncate">
                                  {row.perCharge || '0'}
                                </span>
                              </div>

                              {/* Col AC: Product Costing */}
                              <div
                                className={`p-2.5 rounded-lg border col-span-2 sm:col-span-3 transition-all ${
                                  isACFilled
                                    ? 'bg-[#0b0e15] border-emerald-500/30'
                                    : 'bg-red-950/20 border-red-500/50'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-gray-400 font-siliguri block">
                                    Col AC: Product Costing (ক্রয় ও উৎপাদন খরচ)
                                  </span>
                                  <span
                                    className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                                      isACFilled
                                        ? 'bg-emerald-500/20 text-emerald-400'
                                        : 'bg-red-500/20 text-red-400'
                                    }`}
                                  >
                                    {isACFilled ? 'পূরণ ✓' : 'খালি / ইনপুট প্রয়োজন ✗'}
                                  </span>
                                </div>
                                <span className="font-semibold text-amber-400 font-mono mt-0.5 block truncate">
                                  ৳ {row.productCosting || '0'}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
