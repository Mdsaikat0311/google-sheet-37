import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Filter,
  Layers,
  X,
  Clock,
  LayoutGrid,
  ListFilter,
} from 'lucide-react';
import { Order } from '../types';
import { getStoredListProductNames } from '../services/sheets';
import { parseAnyDateToTimestamp } from '../utils/dateGrouping';

/**
 * Checks if an order's status (Sheet2 Column J) is "Complete"
 * Matches: 'Complete', 'complete', 'Completed', 'কমপ্লিট', etc.
 */
export const isSheet2ColumnJComplete = (status?: string): boolean => {
  if (!status) return false;
  const s = String(status).trim().toLowerCase();
  if (s.includes('incomplete') || s.includes('not complete')) return false;
  return s.includes('complete') || s.includes('comp') || s.includes('কমপ্লিট');
};

interface OrderCalendarProps {
  orders: Order[];
  onSelectDate?: (dateStr: string) => void;
  onSelectOrder?: (order: Order) => void;
  listProductNames?: string[];
}

export const OrderCalendar: React.FC<OrderCalendarProps> = ({
  orders,
  onSelectDate,
  onSelectOrder,
  listProductNames,
}) => {
  // Calendar month/year navigation state
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [productFilter, setProductFilter] = useState<string>('ALL');
  // View mode toggle for mobile: 'grid' (Calendar Grid) or 'agenda' (Compact Date List)
  const [viewMode, setViewMode] = useState<'grid' | 'agenda'>('grid');

  // Month navigation
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };
  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    const dayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
      today.getDate()
    ).padStart(2, '0')}`;
    setSelectedDayKey(dayKey);
  };

  // Strictly the 6 products from List sheet Column B (no extra random names from orders)
  const availableProducts = useMemo(() => {
    if (listProductNames && listProductNames.length >= 6) {
      return listProductNames.slice(0, 6);
    }
    return getStoredListProductNames();
  }, [listProductNames]);

  // Map any order variant or product string to the canonical 6 List product names or No Sellect
  const getMappedProductName = (rawVariant?: string, rawProduct?: string): string => {
    const vRaw = (rawVariant || '').trim();
    const pRaw = (rawProduct || '').trim();
    const vNorm = vRaw.toLowerCase().replace(/[^a-z0-9]/g, '');
    const pNorm = pRaw.toLowerCase().replace(/[^a-z0-9]/g, '');

    const isNoSellect =
      !vRaw ||
      vRaw === 'No Sellect' ||
      vNorm === 'nosellect' ||
      vNorm === 'noselect' ||
      vRaw.toLowerCase().includes('no sellect');

    if (isNoSellect) return 'No Sellect';

    // Direct match against 6 current names
    for (const name of availableProducts) {
      const nNorm = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (vNorm === nNorm || pNorm === nNorm) return name;
    }

    // Map by canonical index (0 to 5)
    if ((vNorm.includes('599') && vNorm.includes('rose')) || (pNorm.includes('599') && pNorm.includes('rose'))) {
      if (!vNorm.includes('990') && !vNorm.includes('1350') && !pNorm.includes('990') && !pNorm.includes('1350')) {
        return availableProducts[0] || vRaw || pRaw;
      }
    }
    if ((vNorm.includes('599') && vNorm.includes('watch')) || vNorm.includes('golden') || (pNorm.includes('599') && pNorm.includes('watch')) || pNorm.includes('golden')) {
      return availableProducts[1] || vRaw || pRaw;
    }
    if (vNorm.includes('doll') || vNorm.includes('toy') || pNorm.includes('doll') || pNorm.includes('toy')) {
      return availableProducts[2] || vRaw || pRaw;
    }
    if (vNorm.includes('disp') || vNorm.includes('cutt') || pNorm.includes('disp') || pNorm.includes('cutt')) {
      return availableProducts[3] || vRaw || pRaw;
    }
    if (vNorm.includes('990') || pNorm.includes('990')) {
      return availableProducts[4] || vRaw || pRaw;
    }
    if (vNorm.includes('1350') || pNorm.includes('1350')) {
      return availableProducts[5] || vRaw || pRaw;
    }

    return vRaw || pRaw || 'No Sellect';
  };

  // Map orders by YYYY-MM-DD (Strictly Sheet2 Column J Complete orders only)
  const { dateOrderMap, totalOrdersCount, totalQuantityCount, activeDateList } = useMemo(() => {
    const map = new Map<
      string,
      {
        count: number;
        totalQuantity: number;
        totalAmount: number;
        orders: Order[];
        productBreakdown: Record<string, number>;
        productQuantityBreakdown: Record<string, number>;
        dateObj: Date;
      }
    >();
    let totalCount = 0;
    let totalQty = 0;

    orders.forEach((order) => {
      // 1. Sheet2 Column J check: Only count if status is 'Complete'
      const statusValue = order.status || (order as any).order_status || '';
      if (!isSheet2ColumnJComplete(statusValue)) {
        return;
      }

      // Check product filter strictly against 6 List products or NO_SELLECT
      const vRaw = (order.variant || '').trim();
      const pRaw = (order.product || '').trim();
      const vNorm = vRaw.toLowerCase().replace(/[^a-z0-9]/g, '');
      const pNorm = pRaw.toLowerCase().replace(/[^a-z0-9]/g, '');
      const isNoSellect =
        !vRaw ||
        vRaw === 'No Sellect' ||
        vRaw.toLowerCase().includes('no sellect') ||
        vNorm === 'nosellect' ||
        vNorm === 'noselect';

      if (productFilter !== 'ALL') {
        if (productFilter === 'NO_SELLECT') {
          if (!isNoSellect) return;
        } else {
          if (isNoSellect) return;

          const filterNorm = productFilter.toLowerCase().replace(/[^a-z0-9]/g, '');

          // Check direct matches
          let matched =
            vNorm === filterNorm ||
            pNorm === filterNorm ||
            vNorm.includes(filterNorm) ||
            filterNorm.includes(vNorm) ||
            pNorm.includes(filterNorm) ||
            filterNorm.includes(pNorm);

          // Smart category match
          if (!matched) {
            const is599Rose = filterNorm.includes('599') && filterNorm.includes('rose');
            const is599Watch = filterNorm.includes('599') && filterNorm.includes('watch');
            const is990 = filterNorm.includes('990');
            const is1350 = filterNorm.includes('1350');
            const isDoll = filterNorm.includes('doll') || filterNorm.includes('toy');
            const isCut = filterNorm.includes('cutt') || filterNorm.includes('disp');

            if (is599Rose && (vNorm.includes('rose') || pNorm.includes('rose')) && !vNorm.includes('990') && !vNorm.includes('1350') && !pNorm.includes('990') && !pNorm.includes('1350')) matched = true;
            else if (is599Watch && (vNorm.includes('watch') || pNorm.includes('watch') || vNorm.includes('golden') || pNorm.includes('golden'))) matched = true;
            else if (is990 && (vNorm.includes('990') || pNorm.includes('990'))) matched = true;
            else if (is1350 && (vNorm.includes('1350') || pNorm.includes('1350'))) matched = true;
            else if (isDoll && (vNorm.includes('doll') || vNorm.includes('toy') || pNorm.includes('doll') || pNorm.includes('toy'))) matched = true;
            else if (isCut && (vNorm.includes('disp') || vNorm.includes('cutt') || pNorm.includes('disp') || pNorm.includes('cutt'))) matched = true;
          }

          if (!matched) return;
        }
      }

      const raw = order.rawDate || order.date;
      const { dateObj } = parseAnyDateToTimestamp(raw);
      if (!dateObj || isNaN(dateObj.getTime())) return;

      const y = dateObj.getFullYear();
      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
      const d = String(dateObj.getDate()).padStart(2, '0');
      const key = `${y}-${m}-${d}`;

      let orderQty = Number(order.quantity);
      if (isNaN(orderQty) || orderQty <= 0) {
        if (order.items && order.items.length > 0) {
          orderQty = order.items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
        } else {
          orderQty = 1;
        }
      }

      totalCount++;
      totalQty += orderQty;

      const existing = map.get(key) || {
        count: 0,
        totalQuantity: 0,
        totalAmount: 0,
        orders: [],
        productBreakdown: {},
        productQuantityBreakdown: {},
        dateObj,
      };

      existing.count += 1;
      existing.totalQuantity += orderQty;
      existing.totalAmount += Number(order.amount || order.total || 0);
      existing.orders.push(order);

      const pKey = getMappedProductName(order.variant, order.product);
      existing.productBreakdown[pKey] = (existing.productBreakdown[pKey] || 0) + 1;
      existing.productQuantityBreakdown[pKey] = (existing.productQuantityBreakdown[pKey] || 0) + orderQty;

      map.set(key, existing);
    });

    // Sorted active date list for agenda view
    const sortedList = Array.from(map.entries()).sort((a, b) => {
      return b[1].dateObj.getTime() - a[1].dateObj.getTime();
    });

    return {
      dateOrderMap: map,
      totalOrdersCount: totalCount,
      totalQuantityCount: totalQty,
      activeDateList: sortedList,
    };
  }, [orders, productFilter, availableProducts]);

  // Calendar grid math
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0 - 11

  const monthNamesBn = [
    'জানুয়ারি',
    'ফেব্রুয়ারি',
    'মার্চ',
    'এপ্রিল',
    'মে',
    'জুন',
    'জুলাই',
    'আগস্ট',
    'সেপ্টেম্বর',
    'অক্টোবর',
    'নভেম্বর',
    'ডিসেম্বর',
  ];

  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sun, 1 = Mon ...
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // English weekday headers (Sun, Mon, Tue, Wed, Thu, Fri, Sat)
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekDaysShort = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  // Current today key
  const todayObj = new Date();
  const todayKey = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(
    todayObj.getDate()
  ).padStart(2, '0')}`;

  // Currently selected date details
  const selectedDetails = selectedDayKey ? dateOrderMap.get(selectedDayKey) : null;

  // Month-wise min and max order statistics for dynamic color grading & peak order display
  const monthStats = useMemo(() => {
    let minCount = Infinity;
    let maxCount = 0;
    let hasOrders = false;
    let peakDays: number[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = String(day).padStart(2, '0');
      const monthStr = String(month + 1).padStart(2, '0');
      const key = `${year}-${monthStr}-${dayStr}`;
      const dayData = dateOrderMap.get(key);
      const qty = dayData?.totalQuantity || dayData?.count || 0;
      if (qty > 0) {
        hasOrders = true;
        if (qty < minCount) minCount = qty;
        if (qty > maxCount) {
          maxCount = qty;
          peakDays = [day];
        } else if (qty === maxCount) {
          peakDays.push(day);
        }
      }
    }

    return {
      minCount: hasOrders ? minCount : 0,
      maxCount: hasOrders ? maxCount : 0,
      hasOrders,
      peakDays,
    };
  }, [dateOrderMap, daysInMonth, month, year]);

  // Entire calendar-wide highest single day statistics across all dates
  const overallCalendarStats = useMemo(() => {
    let maxQty = 0;
    let maxAmount = 0;
    let peakDateKey = '';
    let peakDateFormatted = '';
    let hasOrders = false;

    dateOrderMap.forEach((dayData, key) => {
      const qty = dayData.totalQuantity || dayData.count || 0;
      const amt = dayData.totalAmount || 0;
      if (qty > 0 || amt > 0) {
        hasOrders = true;
        if (qty > maxQty) {
          maxQty = qty;
          maxAmount = amt;
          peakDateKey = key;
        } else if (qty === maxQty && amt > maxAmount) {
          maxAmount = amt;
          peakDateKey = key;
        }
      }
    });

    if (peakDateKey) {
      const parts = peakDateKey.split('-');
      if (parts.length === 3) {
        const y = parts[0];
        const mIdx = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        const mName = monthNamesBn[mIdx] || parts[1];
        peakDateFormatted = `${d} ${mName} ${y}`;
      } else {
        peakDateFormatted = peakDateKey;
      }
    }

    return {
      maxQty,
      maxAmount,
      peakDateKey,
      peakDateFormatted,
      hasOrders,
    };
  }, [dateOrderMap]);

  // Color grading helper: red (lowest sell) -> coral -> orange -> amber -> lime -> green -> deep green (highest sell)
  const getMonthColorGrade = (count: number) => {
    if (count <= 0) {
      return {
        badgeClass: 'text-gray-600',
        cellClass: 'bg-[#0d1017]/70 border-[#1a1f2e]/60',
        label: 'কোনো অর্ডার নেই',
      };
    }

    if (!monthStats.hasOrders || monthStats.maxCount <= monthStats.minCount) {
      return {
        badgeClass: 'bg-emerald-600/25 text-emerald-200 border border-emerald-500/50 shadow-xs',
        cellClass: 'bg-[#101a15] hover:bg-[#14221b] border-emerald-500/30 hover:border-emerald-500/50',
        label: 'অর্ডার যুক্ত দিন',
      };
    }

    // Relative ratio from 0.0 (lowest in month) to 1.0 (highest in month)
    const ratio = (count - monthStats.minCount) / (monthStats.maxCount - monthStats.minCount);

    if (ratio <= 0.05) {
      // 0: সর্বনিম্ন সেল (Red)
      return {
        badgeClass: 'bg-red-500/25 text-red-200 border border-red-500/50 shadow-xs shadow-red-950/40',
        cellClass: 'bg-[#1a1013] hover:bg-[#201418] border-red-500/35 hover:border-red-400',
        label: 'সর্বনিম্ন সেল (লাল)',
      };
    } else if (ratio <= 0.22) {
      // 1: লো-সেল (Rose / Red-Orange)
      return {
        badgeClass: 'bg-rose-500/25 text-rose-200 border border-rose-500/45',
        cellClass: 'bg-[#1a1218] hover:bg-[#20161f] border-rose-500/30 hover:border-rose-400',
        label: 'কম সেল',
      };
    } else if (ratio <= 0.42) {
      // 2: মিডল-লো সেল (Orange)
      return {
        badgeClass: 'bg-orange-500/25 text-orange-200 border border-orange-500/45',
        cellClass: 'bg-[#1b1510] hover:bg-[#211a14] border-orange-500/30 hover:border-orange-400',
        label: 'মাঝারি কম সেল',
      };
    } else if (ratio <= 0.62) {
      // 3: মিডল সেল (Amber / Yellow)
      return {
        badgeClass: 'bg-amber-500/25 text-amber-200 border border-amber-500/45',
        cellClass: 'bg-[#191710] hover:bg-[#201d14] border-amber-500/30 hover:border-amber-400',
        label: 'মাঝারি সেল',
      };
    } else if (ratio <= 0.82) {
      // 4: মিডল-হাই সেল (Lime / Light Green)
      return {
        badgeClass: 'bg-lime-500/25 text-lime-200 border border-lime-500/50',
        cellClass: 'bg-[#131a12] hover:bg-[#182117] border-lime-500/30 hover:border-lime-400',
        label: 'ভালো সেল',
      };
    } else if (ratio < 0.98) {
      // 5: হাই সেল (Emerald)
      return {
        badgeClass: 'bg-emerald-500/30 text-emerald-200 border border-emerald-500/50 shadow-xs',
        cellClass: 'bg-[#101b15] hover:bg-[#14231b] border-emerald-500/35 hover:border-emerald-400',
        label: 'অনেক ভালো সেল',
      };
    } else {
      // 6: সর্বোচ্চ সেল (Deep Green / গাঢ় সবুজ)
      return {
        badgeClass: 'bg-gradient-to-r from-emerald-600 to-green-600 text-white font-black border border-emerald-400/70 shadow-sm shadow-emerald-500/40',
        cellClass: 'bg-[#0e2117] hover:bg-[#12281c] border-emerald-500/50 hover:border-emerald-300 ring-1 ring-emerald-500/30',
        label: 'সর্বোচ্চ সেল (গাঢ় সবুজ)',
      };
    }
  };

  return (
    <div className="w-full bg-[#12151f] border border-[#1e2436] rounded-2xl p-2.5 sm:p-5 shadow-lg space-y-3 sm:space-y-4">
      {/* Calendar Header: Optimized for Mobile Screen */}
      <div className="flex flex-col gap-2 sm:gap-3 pb-2.5 sm:pb-3 border-b border-[#1c2232]">
        {/* Row 1: Title + View Switcher */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-tr from-pink-600/30 to-purple-600/30 border border-pink-500/40 flex items-center justify-center text-pink-400 shrink-0">
              <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-base font-bold text-white tracking-tight flex items-center gap-2 flex-wrap">
                <span>অর্ডার ক্যালেন্ডার</span>
                <span className="text-[10px] sm:text-[11px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-1.5 sm:px-2 py-0.5 rounded-md font-semibold">
                  কমপ্লিট অর্ডার
                </span>
                {overallCalendarStats.hasOrders ? (
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gradient-to-r from-emerald-600/30 via-emerald-500/20 to-teal-500/25 border border-emerald-400/60 text-emerald-200 shadow-md shadow-emerald-950/60 cursor-pointer hover:border-emerald-300 transition-all"
                    onClick={() => {
                      if (overallCalendarStats.peakDateKey) {
                        const [y, m] = overallCalendarStats.peakDateKey.split('-');
                        setCurrentDate(new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1));
                        setSelectedDayKey(overallCalendarStats.peakDateKey);
                        if (onSelectDate) onSelectDate(overallCalendarStats.peakDateKey);
                      }
                    }}
                    title={`পুরো ক্যালেন্ডারের সর্বোচ্চ সেল: ${overallCalendarStats.maxQty} Qty (${overallCalendarStats.peakDateFormatted || 'ক্যালেন্ডার'}) - ক্লিক করে ওই তারিখে যান`}
                  >
                    <span className="text-[10px] sm:text-xs font-semibold text-emerald-400">সর্বোচ্চ সেল:</span>
                    <span className="text-sm sm:text-lg md:text-xl font-black text-white font-mono bg-emerald-700/60 px-2.5 py-0.5 rounded-lg border border-emerald-400/60 leading-none shadow-xs">
                      {overallCalendarStats.maxQty} Qty
                    </span>
                  </span>
                ) : (
                  <span className="text-[11px] sm:text-xs bg-[#161a27] text-gray-400 border border-[#262f47] px-2 py-0.5 rounded-lg font-medium">
                    কমপ্লিট অর্ডার নেই
                  </span>
                )}
              </h3>
              <p className="text-[10px] sm:text-xs text-gray-400 hidden xs:block truncate">
                তারিখ অনুযায়ী কমপ্লিট অর্ডারের মোট কোয়ান্টিটি (Sheet2 Column J: Complete)
              </p>
            </div>
          </div>

          {/* View Mode Toggle (Grid vs List for Mobile) */}
          <div className="flex items-center bg-[#0c0e15] border border-[#232b3e] rounded-lg p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-2 py-1 rounded text-[10px] sm:text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                viewMode === 'grid'
                  ? 'bg-pink-600 text-white shadow-xs'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="ক্যালেন্ডার গ্রিড"
            >
              <LayoutGrid className="w-3 h-3" />
              <span className="hidden xs:inline">গ্রিড</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('agenda')}
              className={`px-2 py-1 rounded text-[10px] sm:text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                viewMode === 'agenda'
                  ? 'bg-pink-600 text-white shadow-xs'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="তারিখ তালিকা ভিউ"
            >
              <ListFilter className="w-3 h-3" />
              <span className="hidden xs:inline">তালিকা</span>
            </button>
          </div>
        </div>

        {/* Row 2: Controls Toolbar (Product Filter + Month Navigator + Today Button) - strictly 1 line on mobile */}
        <div className="flex items-center justify-between gap-1 sm:gap-2 flex-nowrap w-full overflow-hidden">
          {/* Product Filter Selector */}
          <div className="flex items-center gap-1 bg-[#0c0e15] border border-[#232b3e] hover:border-pink-500/40 rounded-lg px-1.5 sm:px-2 py-1 text-[11px] sm:text-xs flex-1 min-w-0">
            <Filter className="w-3 h-3 text-pink-400 shrink-0" />
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="bg-transparent text-[10px] sm:text-xs text-white font-semibold focus:outline-hidden cursor-pointer w-full truncate"
              title="প্রোডাক্ট ফিল্টার"
            >
              <option value="ALL" className="bg-[#12151f] text-gray-200">
                সকল প্রোডাক্ট (All Products)
              </option>
              {availableProducts.map((p) => (
                <option key={p} value={p} className="bg-[#12151f] text-white">
                  {p}
                </option>
              ))}
              <option value="NO_SELLECT" className="bg-[#12151f] text-yellow-300">
                No Sellect
              </option>
            </select>
          </div>

          {/* Month Navigator + Today */}
          <div className="flex items-center gap-1 shrink-0">
            <div className="flex items-center gap-0.5 bg-[#0c0e15] border border-[#232b3e] rounded-lg p-0.5">
              <button
                onClick={prevMonth}
                className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/5 cursor-pointer"
                title="আগের মাস"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <span className="text-[10px] sm:text-xs font-bold text-white px-1 sm:px-1.5 min-w-[72px] sm:min-w-[95px] text-center font-mono truncate">
                {monthNamesBn[month]} {year}
              </span>

              <button
                onClick={nextMonth}
                className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/5 cursor-pointer"
                title="পরের মাস"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={goToToday}
              className="px-1.5 sm:px-2 py-1 rounded-lg bg-[#181d2a] hover:bg-[#222a3d] text-pink-400 border border-pink-500/20 text-[10px] sm:text-[11px] font-bold cursor-pointer transition-colors shrink-0"
              title="আজকের দিনে যান"
            >
              আজ
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: Mobile-Optimized Responsive Calendar Grid */}
      {viewMode === 'grid' && (
        <div className="space-y-1">
          {/* Weekday Labels (English: Sun, Mon, Tue, Wed, Thu, Fri, Sat) */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center">
            {weekDays.map((day, i) => (
              <div
                key={day}
                className={`py-1 text-[11px] sm:text-xs font-bold rounded-md uppercase tracking-wider ${
                  i === 5 ? 'text-rose-400 bg-rose-500/10' : i === 0 ? 'text-amber-400 bg-amber-500/5' : 'text-gray-300 bg-[#0e1017]'
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid: Fluid height for mobile, clean badge styling */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {/* Empty cells before month begins */}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="h-12 sm:h-16 bg-[#0c0e14]/40 rounded-lg sm:rounded-xl border border-transparent opacity-20"
              />
            ))}

            {/* Days of Month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dayStr = String(dayNum).padStart(2, '0');
              const monthStr = String(month + 1).padStart(2, '0');
              const key = `${year}-${monthStr}-${dayStr}`;

              const dayData = dateOrderMap.get(key);
              const totalQuantity = dayData?.totalQuantity || dayData?.count || 0;
              const count = dayData?.count || 0;
              const hasOrders = totalQuantity > 0;
              const isToday = key === todayKey;
              const isSelected = key === selectedDayKey;
              const grading = getMonthColorGrade(totalQuantity);

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setSelectedDayKey(isSelected ? null : key);
                    if (onSelectDate) onSelectDate(key);
                  }}
                  className={`h-12 sm:h-16 p-1 sm:p-1.5 rounded-lg sm:rounded-xl border flex flex-col justify-between transition-all cursor-pointer text-left relative overflow-hidden active:scale-95 ${
                    isSelected
                      ? 'bg-pink-600/25 border-pink-500 shadow-md shadow-pink-600/30 ring-2 ring-pink-500/50'
                      : isToday
                      ? 'bg-[#181d2c] border-pink-500/70 shadow-xs ring-1 ring-pink-500/40'
                      : hasOrders
                      ? `${grading.cellClass}`
                      : 'bg-[#0d1017]/70 border-[#1a1f2e]/60'
                  }`}
                >
                  {/* Top: Day Number + Today Indicator */}
                  <div className="flex items-center justify-between w-full leading-none">
                    <span
                      className={`text-[11px] sm:text-xs font-bold font-mono ${
                        isToday
                          ? 'text-pink-400 font-extrabold'
                          : hasOrders
                          ? 'text-white'
                          : 'text-gray-500'
                      }`}
                    >
                      {dayNum}
                    </span>

                    {isToday && (
                      <span className="w-1.5 h-1.5 rounded-full bg-pink-500 shrink-0" />
                    )}
                  </div>

                  {/* Bottom: Order Indicator / Total Quantity Badge with Month-wise Color Grading */}
                  <div className="w-full mt-auto">
                    {hasOrders ? (
                      <div
                        className={`w-full text-center py-0.5 px-0.5 rounded text-[9px] sm:text-[10px] font-bold leading-tight truncate transition-colors ${grading.badgeClass}`}
                        title={`${dayNum} তারিখে মোট কোয়ান্টিটি: ${totalQuantity} (${count} টি কমপ্লিট অর্ডার) (${grading.label})`}
                      >
                        <span className="xs:hidden">{totalQuantity}</span>
                        <span className="hidden xs:inline">{totalQuantity} Qty</span>
                      </div>
                    ) : (
                      <div className="w-full text-center text-gray-700 text-[9px] sm:text-[10px] leading-none py-0.5">
                        •
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: Mobile Agenda List View (তারিখ অনুযায়ী সিরিয়াল লিস্ট) */}
      {viewMode === 'agenda' && (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {activeDateList.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-xs bg-[#0c0e15] rounded-xl border border-[#1e2436]">
              কোনো অর্ডারের তারিখ পাওয়া যায়নি
            </div>
          ) : (
            activeDateList.map(([dateKey, dayData]) => {
              const isSelected = selectedDayKey === dateKey;
              const isToday = dateKey === todayKey;
              const totalQty = dayData.totalQuantity || dayData.count;
              const grading = getMonthColorGrade(totalQty);

              return (
                <div
                  key={dateKey}
                  onClick={() => setSelectedDayKey(isSelected ? null : dateKey)}
                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-pink-600/20 border-pink-500'
                      : isToday
                      ? 'bg-[#181d2a] border-pink-500/50'
                      : 'bg-[#121622] hover:bg-[#181d2a] border-[#222a3d]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 flex flex-col items-center justify-center font-mono shrink-0">
                      <span className="text-xs font-bold text-pink-400 leading-none">
                        {dateKey.split('-')[2]}
                      </span>
                      <span className="text-[8px] text-gray-400 uppercase leading-none mt-0.5">
                        {dateKey.split('-')[1]}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white font-mono">{dateKey}</span>
                        {isToday && (
                          <span className="text-[9px] bg-pink-500 text-white font-bold px-1 rounded">
                            আজ
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400 block truncate">
                        {dayData.count} টি কমপ্লিট অর্ডার
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-1 rounded-md text-[11px] font-bold font-mono border transition-colors ${grading.badgeClass}`}>
                      {totalQty} Qty
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Selected Date Details Drawer / Bottom Sheet */}
      {selectedDayKey && (
        <div className="bg-[#0b0d14] border border-pink-500/30 rounded-xl p-3 sm:p-4 space-y-2.5 animate-fadeIn">
          {/* Header of Drawer */}
          <div className="flex items-center justify-between border-b border-[#1c2232] pb-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-md bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 shrink-0">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 flex-wrap truncate">
                  <span>{selectedDayKey}</span>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    মোট {selectedDetails?.totalQuantity || selectedDetails?.count || 0} Qty ({selectedDetails?.count || 0} টি কমপ্লিট অর্ডার)
                  </span>
                </h4>
              </div>
            </div>

            <button
              onClick={() => setSelectedDayKey(null)}
              className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 cursor-pointer shrink-0"
              title="বন্ধ করুন"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Product Breakdown on this Date */}
          {selectedDetails && (
            <div className="space-y-2">
              <span className="text-[10px] sm:text-[11px] font-semibold text-gray-400 flex items-center gap-1">
                <Layers className="w-3 h-3 text-pink-400" />
                <span>কমপ্লিট প্রোডাক্ট ভিত্তিক মোট কোয়ান্টিটি:</span>
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {Object.entries(selectedDetails.productBreakdown).map(([pName, pCount]) => {
                  const pQty = selectedDetails.productQuantityBreakdown?.[pName] ?? pCount;
                  return (
                    <div
                      key={pName}
                      className="bg-[#141824] border border-[#232b3e] rounded-lg p-1.5 sm:p-2 flex items-center justify-between gap-1 text-[11px] sm:text-xs"
                    >
                      <span className="text-gray-300 truncate font-medium" title={pName}>
                        {pName}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-pink-400 font-bold font-mono bg-pink-500/10 px-1.5 py-0.2 rounded text-[10px]">
                          {pQty} Qty
                        </span>
                        {pQty !== pCount && (
                          <span className="text-gray-400 text-[9px] font-mono">
                            ({pCount}টি)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
