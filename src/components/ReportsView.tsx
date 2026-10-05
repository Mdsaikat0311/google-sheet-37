// Helper to ensure clean rate percentage format e.g. 100.0% or 0.0%
const cleanRate = (rate?: string) => {
  if (!rate || rate.trim() === '' || rate === '0') return '0.0%';
  const trimmed = rate.trim();
  return trimmed.endsWith('%') ? trimmed : `${trimmed}%`;
};

// Helper for consistent source colors across charts
const getSourceColor = (sourceName: string, index = 0): string => {
  const norm = sourceName.toLowerCase().trim();
  if (norm.includes('web')) return '#3b82f6';
  if (norm.includes('mess') || norm.includes('face') || norm.includes('fb')) return '#8b5cf6';
  if (norm.includes('what') || norm.includes('wa')) return '#10b981';
  if (norm.includes('tik')) return '#ec4899';
  if (norm.includes('call') || norm.includes('phone') || norm.includes('direct')) return '#f59e0b';
  if (norm.includes('you') || norm.includes('yt')) return '#dc2626';
  if (norm.includes('incom')) return '#ef4444';
  if (norm.includes('land') || norm.includes('funnel')) return '#06b6d4';
  if (norm.includes('insta') || norm.includes('ig')) return '#f43f5e';

  const palette = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#f97316', '#a855f7'];
  return palette[index % palette.length];
};

import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  RotateCcw,
  Hourglass,
  Ban,
  Calendar,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  RefreshCw,
  Layers,
  ShoppingBag,
  ExternalLink,
  Search,
  CheckCircle2,
  Phone,
  Globe,
  MessageCircle,
  Video,
  Share2,
  Package,
  Clock,
  Filter,
  ArrowUpRight,
  ArrowLeft,
  Sparkles,
  PieChart,
  Instagram,
} from 'lucide-react';
import { Order, Sheet1ProductReport, ProductReportSource } from '../types';
import { fetchSheet1Reports, DEFAULT_SPREADSHEET_ID } from '../services/sheets';
import { parseAnyDateToTimestamp } from '../utils/dateGrouping';

/**
 * Accurately categorizes an order based on Sheet2 Column L (Courier Status) & Column J (Status)
 * Canonical statuses strictly matching user requirements:
 * Only updates for:
 * 1. 'delivery': 'delivered' / 'delivery' / 'ডেলিভার্ড' (never 'complete')
 * 2. 'cancel': 'cancelled' / 'cancel' / 'বাতিল' / 'ক্যান্সেল'
 * 3. 'partial': 'partial_delivered' / 'partial' / 'আংশিক'
 * 4. 'pending': 'pending' / 'পেন্ডিং'
 *
 * Orders with empty status, missing status, or any other status return 'none',
 * ensuring they are NEVER counted into any of the 4 boxes (Delivery, Pending, Partial, Cancel).
 */
export const getColumnLCourierStatus = (
  courierStatus?: string | null,
  orderStatus?: string | null
): 'delivery' | 'pending' | 'partial' | 'cancel' | 'none' => {
  const c = String(courierStatus || '').toLowerCase().trim();
  const cNorm = c.replace(/[\s\-_]/g, '');
  const s = String(orderStatus || '').toLowerCase().trim();
  const sNorm = s.replace(/[\s\-_]/g, '');

  // 1. Cancel: Strictly and ONLY when Column L (courierStatus) has 'cancelled'
  if (cNorm === 'cancelled') {
    return 'cancel';
  }

  // 2. Partial Delivery: 'partial_delivered', 'partial', 'আংশিক'
  if (
    cNorm.includes('partial') ||
    c.includes('partial_delivered') ||
    c.includes('আংশিক') ||
    (!cNorm && (sNorm.includes('partial') || s.includes('partial_delivered') || s.includes('আংশিক')))
  ) {
    return 'partial';
  }

  // 3. Delivered: ONLY explicit 'delivered' / 'delivery' / 'ডেলিভার্ড' (NEVER 'complete')
  const isDelivC = (cNorm.includes('deliver') && !cNorm.includes('partial')) || c === 'delivered' || c.includes('ডেলিভার্ড');
  const isDelivS = (sNorm.includes('deliver') && !sNorm.includes('partial')) || s === 'delivered' || s.includes('ডেলিভার্ড');
  if (isDelivC || (!cNorm && isDelivS)) {
    return 'delivery';
  }

  // 4. Pending: ONLY explicit 'pending' / 'পেন্ডিং'
  const isPendingC = cNorm === 'pending' || c.includes('pending') || c.includes('পেন্ডিং');
  const isPendingS = sNorm === 'pending' || s.includes('pending') || s.includes('পেন্ডিং');
  if (isPendingC || (!cNorm && isPendingS)) {
    return 'pending';
  }

  // 5. Default: If empty, missing, in_review, or any other status -> 'none' (never show in any of the 4 boxes!)
  return 'none';
};

interface ReportsViewProps {
  spreadsheetId?: string;
  orders?: Order[];
  listProductNames?: string[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  spreadsheetId = DEFAULT_SPREADSHEET_ID,
  orders = [],
  listProductNames,
}) => {
  const [sheetProducts, setSheetProducts] = useState<Sheet1ProductReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Selected product ID for full dedicated source detail page (when card is clicked)
  const [selectedDetailProductId, setSelectedDetailProductId] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'products' | 'sources'>('products');
  
  // Date Filtering State: defaults to 'today' as requested ("ata jeno auto sob somoy today sellect hoye thake")
  const [dateFilter, setDateFilter] = useState<string>('today');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);
  const [dateMenuTab, setDateMenuTab] = useState<'presets' | 'calendar'>('presets');
  const [calViewYear, setCalViewYear] = useState<number>(() => new Date().getFullYear());
  const [calViewMonth, setCalViewMonth] = useState<number>(() => new Date().getMonth());

  // Load Sheet 1 Report Data (supports background real-time sync)
  const loadSheet1Data = async (isManual: boolean = false, isBackground: boolean = false) => {
    if (isManual) setRefreshing(true);
    else if (!isBackground) setLoading(true);

    try {
      const result = await fetchSheet1Reports(spreadsheetId);
      if (result.products && result.products.length > 0) {
        setSheetProducts(result.products);
        setLastUpdated(
          new Date().toLocaleTimeString('bn-BD', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        );
      }
    } catch (err) {
      console.error('Failed to load Sheet 1 reports:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadSheet1Data();
    // Real-time automatic polling every 15 seconds to sync Google Sheet 1
    const interval = setInterval(() => {
      loadSheet1Data(false, true);
    }, 15000);
    return () => clearInterval(interval);
  }, [spreadsheetId]);

  // Extract all distinct dates from orders (using parseAnyDateToTimestamp for clean formatting)
  const availableDates = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => {
      const raw = o.rawDate || o.date;
      if (raw && raw.trim()) {
        const { cleanDateStr } = parseAnyDateToTimestamp(raw);
        if (cleanDateStr) {
          set.add(cleanDateStr);
        } else {
          set.add(raw.trim());
        }
      }
    });
    return Array.from(set).sort((a, b) => {
      const { dateObj: da } = parseAnyDateToTimestamp(a);
      const { dateObj: db } = parseAnyDateToTimestamp(b);
      return (db?.getTime() || 0) - (da?.getTime() || 0);
    });
  }, [orders]);

  // Helper to parse dates from sheet using robust multi-format parser
  const parseSheetDate = (str?: string): Date | null => {
    if (!str) return null;
    const { dateObj } = parseAnyDateToTimestamp(str);
    return dateObj;
  };

  // Normalize and match date filter (supports All Time, Today, Yesterday, Last 7 Days, Last 30 Days, Last Month, Custom Date Range, and specific Sheet dates)
  const matchesDate = (orderDateStr?: string, orderRawDate?: string): boolean => {
    if (dateFilter === 'all') return true;
    const raw = orderRawDate || orderDateStr;
    if (!raw) return false;
    const cleanDate = raw.trim();

    const { dateObj: orderDate, cleanDateStr } = parseAnyDateToTimestamp(cleanDate);

    // Direct match with specific sheet date string (e.g. '08/09/2026' or '08/09/26')
    if (cleanDate === dateFilter || cleanDateStr === dateFilter) return true;

    if (!orderDate || isNaN(orderDate.getTime())) {
      if (dateFilter === 'custom') {
        if (customStartDate && cleanDate.includes(customStartDate)) return true;
        if (customEndDate && cleanDate.includes(customEndDate)) return true;
      }
      return false;
    }

    const now = new Date();
    const bdNow = new Date(now.getTime() + (6 * 60 + now.getTimezoneOffset()) * 60000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const bdTodayStart = new Date(bdNow.getFullYear(), bdNow.getMonth(), bdNow.getDate(), 0, 0, 0, 0);
    const bdTodayEnd = new Date(bdNow.getFullYear(), bdNow.getMonth(), bdNow.getDate(), 23, 59, 59, 999);

    if (dateFilter === 'today') {
      return (
        (orderDate >= todayStart && orderDate <= todayEnd) ||
        (orderDate >= bdTodayStart && orderDate <= bdTodayEnd)
      );
    }

    if (dateFilter === 'yesterday') {
      const yestStart = new Date(todayStart);
      yestStart.setDate(yestStart.getDate() - 1);
      const yestEnd = new Date(todayEnd);
      yestEnd.setDate(yestEnd.getDate() - 1);
      return orderDate >= yestStart && orderDate <= yestEnd;
    }

    if (dateFilter === 'last7days') {
      const start = new Date(todayStart);
      start.setDate(start.getDate() - 6);
      return orderDate >= start && orderDate <= todayEnd;
    }

    if (dateFilter === 'last30days') {
      const start = new Date(todayStart);
      start.setDate(start.getDate() - 29);
      return orderDate >= start && orderDate <= todayEnd;
    }

    if (dateFilter === 'lastmonth') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return orderDate >= start && orderDate <= end;
    }

    if (dateFilter === 'custom') {
      const cStart = customStartDate ? parseSheetDate(customStartDate) : null;
      const cEnd = customEndDate ? parseSheetDate(customEndDate) : null;

      if (cStart && cEnd) {
        const start = new Date(cStart.getFullYear(), cStart.getMonth(), cStart.getDate(), 0, 0, 0, 0);
        const end = new Date(cEnd.getFullYear(), cEnd.getMonth(), cEnd.getDate(), 23, 59, 59, 999);
        return orderDate >= start && orderDate <= end;
      } else if (cStart) {
        const start = new Date(cStart.getFullYear(), cStart.getMonth(), cStart.getDate(), 0, 0, 0, 0);
        return orderDate >= start;
      } else if (cEnd) {
        const end = new Date(cEnd.getFullYear(), cEnd.getMonth(), cEnd.getDate(), 23, 59, 59, 999);
        return orderDate <= end;
      }
      return true;
    }

    // Direct match with specific sheet date string
    if (cleanDateStr === dateFilter || cleanDate === dateFilter) return true;

    // Calendar selected date matching (e.g. YYYY-MM-DD or standard Date match)
    const { dateObj: filterDateObj } = parseAnyDateToTimestamp(dateFilter);
    if (filterDateObj && !isNaN(filterDateObj.getTime()) && orderDate) {
      if (
        orderDate.getFullYear() === filterDateObj.getFullYear() &&
        orderDate.getMonth() === filterDateObj.getMonth() &&
        orderDate.getDate() === filterDateObj.getDate()
      ) {
        return true;
      }
    }

    return false;
  };

  // Filtered orders matching selected date
  const dateFilteredOrders = useMemo(() => {
    if (dateFilter === 'all') return orders;
    return orders.filter((o) => matchesDate(o.date, o.rawDate));
  }, [orders, dateFilter, customStartDate, customEndDate, availableDates]);

  // Order status helper functions strictly powered by Column L & Column J
  const isConfirmed = (_status?: string, courierStatus?: string) => {
    const s = String(_status || '').toLowerCase().trim();
    const isJComplete = s.includes('complete') || s.includes('comp') || s.includes('কমপ্লিট');
    // If Column J is Complete, it ALWAYS stays in Confirm regardless of courier status changes
    if (isJComplete) return true;

    const colL = getColumnLCourierStatus(courierStatus, _status);
    return colL === 'delivery' || colL === 'pending' || colL === 'partial';
  };

  // Helper strictly checking if Sheet2 Column J is 'Complete'
  const isColJComplete = (_status?: string) => {
    const s = String(_status || '').toLowerCase().trim();
    return s === 'complete' || s === 'completed' || s.includes('complete') || s.includes('comp') || s.includes('কমপ্লিট');
  };

  const isDelivered = (_status?: string, courierStatus?: string) => {
    return getColumnLCourierStatus(courierStatus, _status) === 'delivery';
  };

  const isPending = (_status?: string, courierStatus?: string) => {
    return getColumnLCourierStatus(courierStatus, _status) === 'pending';
  };

  const isCancelled = (_status?: string, courierStatus?: string) => {
    return getColumnLCourierStatus(courierStatus, _status) === 'cancel';
  };

  const isPartial = (_status?: string, courierStatus?: string) => {
    return getColumnLCourierStatus(courierStatus, _status) === 'partial';
  };

  // The 6 canonical products from List sheet Column B, Sheet2 Column H toggle button & Sheet 1
  const canonicalProducts = useMemo(() => {
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
      'Rose 599',
      'Watch 599',
      'Doll and toys tk',
      'Cutting Dispancer tk',
      'Porbash Rose 990',
      'Porbash Rose 1350',
    ];
  }, [listProductNames]);

  // Helper to match an order to a product name
  const matchesProductName = (order: Order, prodName: string): boolean => {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const pNorm = normalize(prodName);
    const vNorm = normalize(order.variant || '');

    // Priority 1: Match with Column H (variant toggle button) from Sheet 2
    if (vNorm && vNorm !== 'nosellect') {
      if (vNorm === pNorm) return true;
      if (pNorm.includes('599') && !vNorm.includes('599')) return false;
      if (pNorm.includes('990') && !vNorm.includes('990')) return false;
      if (pNorm.includes('1350') && !vNorm.includes('1350')) return false;
      return vNorm.includes(pNorm) || pNorm.includes(vNorm);
    }

    // Priority 2: Fallback to order.product only if Column H was not selected
    const oNorm = normalize(order.product || '');
    if (oNorm && oNorm !== 'nosellect') {
      if (oNorm === pNorm) return true;
      if (pNorm.includes('599') && !oNorm.includes('599')) return false;
      if (pNorm.includes('990') && !oNorm.includes('990')) return false;
      if (pNorm.includes('1350') && !oNorm.includes('1350')) return false;
      if (pNorm.includes('doll') && oNorm.includes('doll')) return true;
      if (pNorm.includes('dispancer') && oNorm.includes('dispancer')) return true;
    }
    return false;
  };

  // Master unified products list: STRICTLY AND ONLY the 6 products from List Sheet / Sheet 2 Column H & Sheet 1
  const unifiedProducts = useMemo(() => {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    return canonicalProducts.map((prodName, idx) => {
      const pNorm = normalize(prodName);
      // Find matching real-time report from Sheet 1
      const sheetReport = sheetProducts.find((sp) => {
        const spNorm = normalize(sp.productName);
        return (
          spNorm === pNorm ||
          (pNorm.includes('599') && spNorm.includes('599') && pNorm.slice(0, 4) === spNorm.slice(0, 4)) ||
          (pNorm.includes('990') && spNorm.includes('990')) ||
          (pNorm.includes('1350') && spNorm.includes('1350')) ||
          (pNorm.includes('doll') && spNorm.includes('doll')) ||
          (pNorm.includes('dispancer') && spNorm.includes('dispancer'))
        );
      });

      return {
        id: sheetReport ? sheetReport.id : `SHEET2-PROD-${idx + 1}`,
        productName: prodName,
        rawHeader: sheetReport ? sheetReport.rawHeader : prodName,
        sheetReport,
      };
    });
  }, [sheetProducts]);

  // Aggregate stats strictly from Sheet 2 orders Column L (for Total or Selected Date)
  // Ensures Delivery, Pending, Partial, and Cancel counts have 0 mistake and accurately reflect Column L
  const aggregatedStats = useMemo(() => {
    let sourceOrders = dateFilter === 'all' ? orders : dateFilteredOrders;
    if (selectedProduct !== 'all') {
      sourceOrders = sourceOrders.filter((o) => matchesProductName(o, selectedProduct));
    }

    const totalLead = sourceOrders.length;
    let totalConfirm = 0;
    let totalDelivery = 0;
    let totalPending = 0;
    let totalPartial = 0;
    let totalCancel = 0;
    let totalCompleted = 0;
    let totalQuantity = 0;
    let totalAmount = 0;

    sourceOrders.forEach((o) => {
      const confirmed = isConfirmed(o.status, o.courierStatus);
      if (confirmed) {
        totalConfirm++;
      }

      const colL = getColumnLCourierStatus(o.courierStatus, o.status);
      if (colL === 'delivery') totalDelivery++;
      else if (colL === 'pending') totalPending++;
      else if (colL === 'partial') totalPartial++;
      else if (colL === 'cancel') totalCancel++;

      // User criteria: delivered, partial_delivered, cancelled are complete
      // pending & in_review are not complete
      const isCompletedStatus = colL === 'delivery' || colL === 'partial' || colL === 'cancel';
      if (confirmed && isCompletedStatus) {
        totalCompleted++;
      }

      // User requirement: Sheet 2 Column J তে 'Complete' সিলেক্ট করা অর্ডারের Column N (Quantity) শুধু কাউন্ট হবে
      if (isColJComplete(o.status)) {
        totalQuantity += Number(o.quantity) || 1;
      }
      totalAmount += o.amount || o.total || 0;
    });

    const completeRate = totalConfirm > 0 ? `${((totalCompleted / totalConfirm) * 100).toFixed(1)}%` : '0.0%';

    return {
      totalLead,
      totalConfirm,
      confirmRate: totalLead > 0 ? `${((totalConfirm / totalLead) * 100).toFixed(1)}%` : '0.0%',
      totalCompleted,
      completeRate,
      totalDelivery,
      deliveryRate: totalConfirm > 0 ? `${((totalDelivery / totalConfirm) * 100).toFixed(1)}%` : '0.0%',
      totalPending,
      pendingRate: totalLead > 0 ? `${((totalPending / totalLead) * 100).toFixed(1)}%` : '0.0%',
      totalPartial,
      partialRate: totalLead > 0 ? `${((totalPartial / totalLead) * 100).toFixed(1)}%` : '0.0%',
      totalQuantity,
      totalCancel,
      cancelRate: totalLead > 0 ? `${((totalCancel / totalLead) * 100).toFixed(1)}%` : '0.0%',
      totalAmount,
    };
  }, [orders, dateFilteredOrders, dateFilter, selectedProduct]);

  // Filtered products list based on search and pill filter
  const filteredProducts = useMemo(() => {
    return unifiedProducts.filter((p) => {
      const matchesSearch =
        p.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.sheetReport &&
          p.sheetReport.sources.some((s) => s.source.toLowerCase().includes(searchTerm.toLowerCase())));
      const matchesFilter = selectedProduct === 'all' || p.productName === selectedProduct;
      return matchesSearch && matchesFilter;
    });
  }, [unifiedProducts, searchTerm, selectedProduct]);

  // Aggregate sources across all products for Sources tab
  const sourceAnalytics = useMemo(() => {
    const colors: { [key: string]: string } = {
      Website: '#3b82f6',
      Messenger: '#8b5cf6',
      Whatsapp: '#10b981',
      Tiktok: '#ec4899',
      'Call Direct': '#f59e0b',
      INCOMPLETE: '#ef4444',
      Youtube: '#dc2626',
    };

    if (dateFilter !== 'all') {
      const sourceMap: {
        [key: string]: {
          name: string;
          lead: number;
          confirm: number;
          delivery: number;
          partial: number;
          pending: number;
          quantity: number;
          cancel: number;
        };
      } = {};

      dateFilteredOrders.forEach((o) => {
        const cleanName = o.source && o.source.trim() ? o.source.trim() : 'Website';
        if (!sourceMap[cleanName]) {
          sourceMap[cleanName] = {
            name: cleanName,
            lead: 0,
            confirm: 0,
            delivery: 0,
            partial: 0,
            pending: 0,
            quantity: 0,
            cancel: 0,
          };
        }
        sourceMap[cleanName].lead += 1;
        if (isConfirmed(o.status, o.courierStatus)) sourceMap[cleanName].confirm += 1;
        if (isDelivered(o.status, o.courierStatus)) sourceMap[cleanName].delivery += 1;
        if (isPartial(o.status, o.courierStatus)) sourceMap[cleanName].partial += 1;
        if (isPending(o.status, o.courierStatus)) sourceMap[cleanName].pending += 1;
        if (isColJComplete(o.status)) {
          sourceMap[cleanName].quantity += Number(o.quantity) || 1;
        }
        if (isCancelled(o.status, o.courierStatus)) sourceMap[cleanName].cancel += 1;
      });

      const list = Object.values(sourceMap);
      const totalLead = list.reduce((sum, item) => sum + item.lead, 0);

      return list.map((item) => ({
        ...item,
        percentage: totalLead > 0 ? Math.round((item.lead / totalLead) * 100) : 0,
        color: colors[item.name] || '#6b7280',
      }));
    }

    const allSourceOrders = dateFilter === 'all' ? orders : dateFilteredOrders;
    const sourceMap: {
      [key: string]: {
        name: string;
        lead: number;
        confirm: number;
        delivery: number;
        partial: number;
        pending: number;
        quantity: number;
        cancel: number;
      };
    } = {};

    allSourceOrders.forEach((o) => {
      const cleanName = o.source && o.source.trim() ? o.source.trim() : 'Website';
      if (!sourceMap[cleanName]) {
        sourceMap[cleanName] = {
          name: cleanName,
          lead: 0,
          confirm: 0,
          delivery: 0,
          partial: 0,
          pending: 0,
          quantity: 0,
          cancel: 0,
        };
      }
      sourceMap[cleanName].lead += 1;
      if (isConfirmed(o.status, o.courierStatus)) sourceMap[cleanName].confirm += 1;
      if (isDelivered(o.status, o.courierStatus)) sourceMap[cleanName].delivery += 1;
      if (isPartial(o.status, o.courierStatus)) sourceMap[cleanName].partial += 1;
      if (isPending(o.status, o.courierStatus)) sourceMap[cleanName].pending += 1;
      if (isColJComplete(o.status)) {
        sourceMap[cleanName].quantity += Number(o.quantity) || 1;
      }
      if (isCancelled(o.status, o.courierStatus)) sourceMap[cleanName].cancel += 1;
    });

    const list = Object.values(sourceMap);
    const totalLead = list.reduce((sum, item) => sum + item.lead, 0);

    return list.map((item) => ({
      ...item,
      percentage: totalLead > 0 ? Math.round((item.lead / totalLead) * 100) : 0,
      color: colors[item.name] || '#6b7280',
    }));
  }, [sheetProducts, dateFilter, dateFilteredOrders, orders]);

  // Source Icon Helper
  const getSourceIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('website')) return <Globe className="w-4 h-4 text-blue-400 shrink-0" />;
    if (n.includes('messenger')) return <MessageCircle className="w-4 h-4 text-purple-400 shrink-0" />;
    if (n.includes('whatsapp') || n.includes('what')) return <Phone className="w-4 h-4 text-emerald-400 shrink-0" />;
    if (n.includes('tiktok')) return <Video className="w-4 h-4 text-pink-400 shrink-0" />;
    if (n.includes('call') || n.includes('phone')) return <Phone className="w-4 h-4 text-amber-400 shrink-0" />;
    if (n.includes('youtube') || n.includes('you')) return <Video className="w-4 h-4 text-rose-400 shrink-0" />;
    if (n.includes('instagram') || n.includes('insta')) return <Instagram className="w-4 h-4 text-pink-400 shrink-0" />;
    return <Share2 className="w-4 h-4 text-gray-400 shrink-0" />;
  };

  // Selected product detail object
  const selectedProductDetail = useMemo(() => {
    if (!selectedDetailProductId) return null;
    return unifiedProducts.find((p) => p.id === selectedDetailProductId) || null;
  }, [selectedDetailProductId, unifiedProducts]);

  // Compute analytics for a given product
  const getProductAnalytics = (prod: {
    id: string;
    productName: string;
    rawHeader: string;
    sheetReport?: Sheet1ProductReport;
  }) => {
    // Orders matching this product under the selected date filter
    const relatedDateOrders = dateFilteredOrders.filter((o) =>
      matchesProductName(o, prod.productName)
    );

    // Orders matching this product across all dates
    const allRelatedOrders = orders.filter((o) =>
      matchesProductName(o, prod.productName)
    );

    // Compute stats
    let prodStats = {
      lead: 0,
      confirm: 0,
      confirmRate: '0.0%',
      completeRate: '0.0%',
      delivery: 0,
      deliveryRate: '0.0%',
      pending: 0,
      pendingRate: '0.0%',
      partial: 0,
      partialRate: '0.0%',
      quantity: 0,
      cancel: 0,
      cancelRate: '0.0%',
      amount: 0,
    };

    const targetOrders = dateFilter !== 'all' ? relatedDateOrders : allRelatedOrders;
    const lead = targetOrders.length;
    let confirm = 0;
    let delivery = 0;
    let pending = 0;
    let partial = 0;
    let cancel = 0;
    let completed = 0;
    let quantity = 0;
    let amount = 0;

    targetOrders.forEach((o) => {
      const confirmed = isConfirmed(o.status, o.courierStatus);
      if (confirmed) {
        confirm++;
      }

      const colL = getColumnLCourierStatus(o.courierStatus, o.status);
      if (colL === 'delivery') delivery++;
      else if (colL === 'pending') pending++;
      else if (colL === 'partial') partial++;
      else if (colL === 'cancel') cancel++;

      const isCompletedStatus = colL === 'delivery' || colL === 'partial' || colL === 'cancel';
      if (confirmed && isCompletedStatus) {
        completed++;
      }

      if (isColJComplete(o.status)) {
        quantity += Number(o.quantity) || 1;
      }
      amount += o.amount || o.total || 0;
    });

    const completeRate = confirm > 0 ? `${((completed / confirm) * 100).toFixed(1)}%` : '0.0%';

    prodStats = {
      lead,
      confirm,
      confirmRate: lead > 0 ? `${((confirm / lead) * 100).toFixed(1)}%` : '0.0%',
      completeRate,
      delivery,
      deliveryRate: confirm > 0 ? `${((delivery / confirm) * 100).toFixed(1)}%` : '0.0%',
      pending,
      pendingRate: lead > 0 ? `${((pending / lead) * 100).toFixed(1)}%` : '0.0%',
      partial,
      partialRate: lead > 0 ? `${((partial / lead) * 100).toFixed(1)}%` : '0.0%',
      quantity,
      cancel,
      cancelRate: lead > 0 ? `${((cancel / lead) * 100).toFixed(1)}%` : '0.0%',
      amount,
    };

    // Per-source stats
    const sourcesList: {
      name: string;
      lead: number;
      confirm: number;
      confirmRate: string;
      delivery: number;
      deliveryRate: string;
      cancel: number;
      cancelRate: string;
      pending: number;
      pendingRate: string;
      partial: number;
      partialRate: string;
      quantity: number;
      amount: number;
      sharePercent: string;
    }[] = [];

    if (dateFilter !== 'all' || !prod.sheetReport) {
      const activeOrders = dateFilter !== 'all' ? relatedDateOrders : allRelatedOrders;
      const map: Record<string, Order[]> = {};
      activeOrders.forEach((o) => {
        const src = (o.source && o.source.trim()) ? o.source.trim() : 'Website';
        if (!map[src]) map[src] = [];
        map[src].push(o);
      });

      if (prod.sheetReport) {
        prod.sheetReport.sources.forEach((s) => {
          if (!map[s.sourceName]) map[s.sourceName] = [];
        });
      }

      const totalSourceLeads = activeOrders.length || 1;

      Object.entries(map).forEach(([srcName, ords]) => {
        const sLead = ords.length;
        const sConfirm = ords.filter((o) => isConfirmed(o.status, o.courierStatus)).length;
        const sDel = ords.filter((o) => isDelivered(o.status, o.courierStatus)).length;
        const sCan = ords.filter((o) => isCancelled(o.status, o.courierStatus)).length;
        const sPen = ords.filter((o) => isPending(o.status, o.courierStatus)).length;
        const sPart = ords.filter((o) => isPartial(o.status, o.courierStatus)).length;
        const sQty = ords.reduce((sum, o) => sum + (o.quantity || 1), 0);
        const sAmt = ords.reduce((sum, o) => sum + (o.amount || o.total || 0), 0);

        sourcesList.push({
          name: srcName,
          lead: sLead,
          confirm: sConfirm,
          confirmRate: sLead > 0 ? `${((sConfirm / sLead) * 100).toFixed(1)}%` : '0.0%',
          delivery: sDel,
          deliveryRate: sConfirm > 0 ? `${((sDel / sConfirm) * 100).toFixed(1)}%` : '0.0%',
          cancel: sCan,
          cancelRate: sLead > 0 ? `${((sCan / sLead) * 100).toFixed(1)}%` : '0.0%',
          pending: sPen,
          pendingRate: sLead > 0 ? `${((sPen / sLead) * 100).toFixed(1)}%` : '0.0%',
          partial: sPart,
          partialRate: sLead > 0 ? `${((sPart / sLead) * 100).toFixed(1)}%` : '0.0%',
          quantity: sQty,
          amount: sAmt,
          sharePercent: `${Math.round((sLead / totalSourceLeads) * 100)}%`,
        });
      });
    } else {
      prod.sheetReport.sources.forEach((s) => {
        const sOrders = allRelatedOrders.filter(
          (o) => (o.source || '').toLowerCase().trim() === s.sourceName.toLowerCase().trim()
        );
        const sAmt = sOrders.reduce((sum, o) => sum + (o.amount || o.total || 0), 0);
        const sCan = sOrders.filter((o) => isCancelled(o.status, o.courierStatus)).length;

        sourcesList.push({
          name: s.sourceName,
          lead: s.lead,
          confirm: s.confirm,
          confirmRate: s.confirmRate || (s.lead > 0 ? `${((s.confirm / s.lead) * 100).toFixed(1)}%` : '0.0%'),
          delivery: s.delivery,
          deliveryRate: s.deliveryRate || (s.confirm > 0 ? `${((s.delivery / s.confirm) * 100).toFixed(1)}%` : '0.0%'),
          cancel: sCan,
          cancelRate: s.lead > 0 ? `${((sCan / s.lead) * 100).toFixed(1)}%` : '0.0%',
          pending: s.pending,
          pendingRate: s.pendingRate || (s.lead > 0 ? `${((s.pending / s.lead) * 100).toFixed(1)}%` : '0.0%'),
          partial: s.partial,
          partialRate: s.partialRate || (s.lead > 0 ? `${((s.partial / s.lead) * 100).toFixed(1)}%` : '0.0%'),
          quantity: s.quantity,
          amount: sAmt,
          sharePercent: s.sharePercent,
        });
      });
    }

    sourcesList.sort((a, b) => b.lead - a.lead);

    return {
      relatedDateOrders,
      allRelatedOrders,
      prodStats,
      sourcesList,
    };
  };

  // Real-time calculation of total orders and order distribution per product from sheet
  // User requirement: Sheet 2 এর Column J তে 'Complete' সিলেক্ট করা অর্ডারগুলোই শুধু এখানে মোট অর্ডার ও প্রোডাক্ট সংখ্যা হিসেবে কাউন্ট হবে
  const productOrderDistribution = useMemo(() => {
    // Current active orders based on dateFilter
    const activeOrders = dateFilter !== 'all' ? dateFilteredOrders : orders;

    // Strictly filter orders where Sheet 2 Column J is 'Complete'
    const completeOrders = activeOrders.filter((o) => isColJComplete(o.status));

    const items = unifiedProducts.map((prod) => {
      // Complete orders matching this specific product
      const prodCompleteOrders = completeOrders.filter((o) =>
        matchesProductName(o, prod.productName)
      );
      const orderCount = prodCompleteOrders.length;
      const { prodStats } = getProductAnalytics(prod);
      return {
        id: prod.id,
        name: prod.productName,
        orderCount,
        completeRate: cleanRate(prodStats.completeRate || '0.0%'),
      };
    });

    const sumOrders = items.reduce((sum, it) => sum + it.orderCount, 0);

    // Total orders strictly counting Sheet 2 Column J Complete
    const totalOrders = completeOrders.length > 0 ? completeOrders.length : sumOrders;

    const effectiveTotal = totalOrders > 0 ? totalOrders : (sumOrders > 0 ? sumOrders : 1);

    const breakdown = items.map((it) => {
      const pct = effectiveTotal > 0 ? ((it.orderCount / effectiveTotal) * 100).toFixed(1) : '0.0';
      return {
        ...it,
        percentage: `${pct}%`,
        percentNum: effectiveTotal > 0 ? Math.min(100, (it.orderCount / effectiveTotal) * 100) : 0,
      };
    });

    breakdown.sort((a, b) => b.orderCount - a.orderCount);

    return {
      totalOrders,
      breakdown,
    };
  }, [unifiedProducts, dateFilteredOrders, orders, dateFilter, sheetProducts]);

  // Get readable label for current date filter
  const getDateFilterLabel = () => {
    if (dateFilter === 'all') return 'সব সময় (All Time)';
    if (dateFilter === 'today') return 'আজ (Today)';
    if (dateFilter === 'yesterday') return 'গতকাল (Yesterday)';
    if (dateFilter === 'last7days') return 'গত ৭ দিন (Last 7 Days)';
    if (dateFilter === 'last30days') return 'গত ৩০ দিন (Last 30 Days)';
    if (dateFilter === 'lastmonth') return 'গত মাস (Last Month)';
    if (dateFilter === 'custom') {
      if (customStartDate && customEndDate) return `${customStartDate} থেকে ${customEndDate}`;
      if (customStartDate) return `${customStartDate} থেকে`;
      if (customEndDate) return `${customEndDate} পর্যন্ত`;
      return 'কাস্টম তারিখ সীমা';
    }
    const { dateObj: dtObj } = parseAnyDateToTimestamp(dateFilter);
    if (dtObj && !isNaN(dtObj.getTime())) {
      const formatted = `${String(dtObj.getDate()).padStart(2, '0')}/${String(dtObj.getMonth() + 1).padStart(2, '0')}/${dtObj.getFullYear()}`;
      return `তারিখ: ${formatted}`;
    }
    return `তারিখ: ${dateFilter}`;
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-20">
      {/* Top Action Bar: Realtime Refresh & Date Select */}
      <div className="flex items-center justify-between sm:justify-end gap-2.5 bg-[#12151f] border border-[#1e2436] p-3 sm:p-4 rounded-xl shadow-lg">
        {/* Refresh Button */}
        <button
          onClick={() => loadSheet1Data(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1a2030] hover:bg-[#232c42] border border-[#2d3852] text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
          title="শীট ১ থেকে পুনরায় ডেটা রিফ্রেশ করুন"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-pink-400 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'রিফ্রেশ হচ্ছে...' : 'রিয়েলটাইম রিফ্রেশ'}</span>
        </button>

        {/* Date Range & Specific Date Dropdown */}
        <div className="relative">
            <button
              onClick={() => setIsDateMenuOpen(!isDateMenuOpen)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#161a26] hover:bg-[#1f2536] border border-pink-500/30 text-white text-xs font-semibold shadow-sm transition-all"
            >
              <Calendar className="w-3.5 h-3.5 text-pink-400" />
              <span>{getDateFilterLabel()}</span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>

            {isDateMenuOpen && (
              <>
                {/* Backdrop to close when clicking outside */}
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsDateMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-[#161a26] border border-[#273046] rounded-2xl shadow-2xl p-2.5 z-40 animate-fadeIn space-y-2">
                  <div className="px-2 py-1 text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-[#20273a] flex items-center justify-between">
                    <span>তারিখ নির্বাচন করুন (Date Filter)</span>
                    <button
                      type="button"
                      onClick={() => setDateMenuTab(dateMenuTab === 'calendar' ? 'presets' : 'calendar')}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all active:scale-95 shadow-sm ${
                        dateMenuTab === 'calendar'
                          ? 'bg-pink-600 text-white border-pink-500 shadow-pink-600/30'
                          : 'bg-pink-500/15 hover:bg-pink-500/25 border-pink-500/40 text-pink-300 hover:text-white'
                      }`}
                      title={dateMenuTab === 'calendar' ? 'প্রিসেট অপশন দেখুন' : 'ক্যালেন্ডার ভিউ খুলুন'}
                    >
                      <Calendar className="w-3.5 h-3.5 text-pink-400" />
                      <span>{dateMenuTab === 'calendar' ? 'প্রিসেট অপশন' : 'ক্যালেন্ডার'}</span>
                    </button>
                  </div>

                  {/* Tab Selector: Presets vs Visual Calendar */}
                  <div className="flex items-center p-0.5 bg-[#10131c] border border-[#20273a] rounded-xl text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setDateMenuTab('presets')}
                      className={`flex-1 py-1.5 rounded-lg transition-all text-center ${
                        dateMenuTab === 'presets'
                          ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow font-bold'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      প্রিসেট ফিল্টার
                    </button>
                    <button
                      type="button"
                      onClick={() => setDateMenuTab('calendar')}
                      className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all text-center ${
                        dateMenuTab === 'calendar'
                          ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow font-bold'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5 text-pink-400" />
                      ক্যালেন্ডার ভিউ
                    </button>
                  </div>

                  {dateMenuTab === 'calendar' ? (
                    /* Visual Interactive Month Calendar */
                    <div className="space-y-2 pt-1">
                      {/* Month & Year Navigation */}
                      <div className="flex items-center justify-between px-1 bg-[#10131c] p-1.5 rounded-xl border border-[#20273a]">
                        <button
                          type="button"
                          onClick={() => {
                            if (calViewMonth === 0) {
                              setCalViewMonth(11);
                              setCalViewYear((prev) => prev - 1);
                            } else {
                              setCalViewMonth((prev) => prev - 1);
                            }
                          }}
                          className="p-1 rounded-lg bg-[#161a26] hover:bg-[#20273a] text-gray-300 hover:text-white border border-[#273046] transition-colors"
                          title="পূর্ববর্তী মাস"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>

                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-pink-400" />
                          <span>
                            {[
                              'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
                              'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
                            ][calViewMonth]}
                          </span>
                          <span className="text-pink-400 font-mono">{calViewYear}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (calViewMonth === 11) {
                              setCalViewMonth(0);
                              setCalViewYear((prev) => prev + 1);
                            } else {
                              setCalViewMonth((prev) => prev + 1);
                            }
                          }}
                          className="p-1 rounded-lg bg-[#161a26] hover:bg-[#20273a] text-gray-300 hover:text-white border border-[#273046] transition-colors"
                          title="পরবর্তী মাস"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Weekday headers */}
                      <div className="grid grid-cols-7 gap-1 text-center">
                        {['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'].map((d, i) => (
                          <span key={i} className="text-[10px] font-bold text-gray-400 py-0.5">
                            {d}
                          </span>
                        ))}
                      </div>

                      {/* Days grid */}
                      <div className="grid grid-cols-7 gap-1">
                        {/* Blank padding cells */}
                        {Array.from({ length: new Date(calViewYear, calViewMonth, 1).getDay() }).map((_, i) => (
                          <div key={`blank-${i}`} className="h-8" />
                        ))}

                        {/* Day buttons */}
                        {Array.from({ length: new Date(calViewYear, calViewMonth + 1, 0).getDate() }).map((_, i) => {
                          const day = i + 1;
                          const formattedDate = `${calViewYear}-${String(calViewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                          const now = new Date();
                          const isToday =
                            now.getFullYear() === calViewYear &&
                            now.getMonth() === calViewMonth &&
                            now.getDate() === day;
                          const isSelected = dateFilter === formattedDate;

                          // Count orders for this date
                          const dayOrdersCount = orders.filter((o) => {
                            const raw = o.rawDate || o.date;
                            if (!raw) return false;
                            const { dateObj } = parseAnyDateToTimestamp(raw);
                            return (
                              dateObj &&
                              dateObj.getFullYear() === calViewYear &&
                              dateObj.getMonth() === calViewMonth &&
                              dateObj.getDate() === day
                            );
                          }).length;

                          return (
                            <button
                              key={`day-${day}`}
                              type="button"
                              onClick={() => {
                                setDateFilter(formattedDate);
                                setIsDateMenuOpen(false);
                              }}
                              className={`h-8 rounded-lg text-xs font-semibold flex flex-col items-center justify-center transition-all relative group ${
                                isSelected
                                  ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md shadow-pink-500/30 font-bold border border-pink-400'
                                  : isToday
                                  ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40 hover:bg-pink-500/30'
                                  : 'bg-[#141824] text-gray-300 hover:bg-[#20273a] hover:text-white border border-[#20273a]'
                              }`}
                              title={`${day} ${[
                                'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
                                'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
                              ][calViewMonth]} ${calViewYear}${dayOrdersCount > 0 ? ` (${dayOrdersCount} টি অর্ডার)` : ''}`}
                            >
                              <span>{day}</span>
                              {dayOrdersCount > 0 && (
                                <span
                                  className={`w-1.5 h-1.5 rounded-full -mt-0.5 ${
                                    isSelected ? 'bg-white' : 'bg-emerald-400'
                                  }`}
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Footer: Quick today button & Legend */}
                      <div className="pt-2 border-t border-[#20273a] space-y-2">
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => {
                              const today = new Date();
                              const formattedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                              setDateFilter(formattedDate);
                              setIsDateMenuOpen(false);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/30 text-pink-300 text-[11px] font-bold transition-all"
                          >
                            আজকের তারিখ
                          </button>
                          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span>সবুজ ডট = অর্ডার রয়েছে</span>
                          </div>
                        </div>

                        {/* Direct input for manual choice */}
                        <div className="flex items-center gap-2 bg-[#10131c] border border-[#273046] rounded-lg px-2 py-1">
                          <span className="text-[10px] text-gray-400 whitespace-nowrap">ম্যানুয়াল তারিখ:</span>
                          <input
                            type="date"
                            value={dateFilter.match(/^\d{4}-\d{2}-\d{2}$/) ? dateFilter : ''}
                            onChange={(e) => {
                              if (e.target.value) {
                                setDateFilter(e.target.value);
                                setIsDateMenuOpen(false);
                              }
                            }}
                            className="w-full bg-transparent text-white text-[11px] focus:outline-none cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Presets & Custom Range */
                    <div className="space-y-2 pt-1">
                      {/* Preset Options requested: ALL TIME, TODAY, YESTERDAY, LAST 7 DAYS, LAST 30 DAYS, LAST MONTH */}
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          onClick={() => {
                            setDateFilter('all');
                            setIsDateMenuOpen(false);
                          }}
                          className={`text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-all ${
                            dateFilter === 'all'
                              ? 'bg-pink-600/20 text-pink-400 font-bold border border-pink-500/30'
                              : 'text-gray-300 hover:bg-[#20273a]'
                          }`}
                        >
                          <span>সব সময় (All Time)</span>
                          <span className="text-[10px] text-gray-500 font-mono">{orders.length}</span>
                        </button>

                        <button
                          onClick={() => {
                            setDateFilter('today');
                            setIsDateMenuOpen(false);
                          }}
                          className={`text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-all ${
                            dateFilter === 'today'
                              ? 'bg-pink-600/20 text-pink-400 font-bold border border-pink-500/30'
                              : 'text-gray-300 hover:bg-[#20273a]'
                          }`}
                        >
                          <span>আজ (Today)</span>
                          <span className="text-[10px] text-emerald-400 font-mono">●</span>
                        </button>

                        <button
                          onClick={() => {
                            setDateFilter('yesterday');
                            setIsDateMenuOpen(false);
                          }}
                          className={`text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-all ${
                            dateFilter === 'yesterday'
                              ? 'bg-pink-600/20 text-pink-400 font-bold border border-pink-500/30'
                              : 'text-gray-300 hover:bg-[#20273a]'
                          }`}
                        >
                          <span>গতকাল (Yesterday)</span>
                        </button>

                        <button
                          onClick={() => {
                            setDateFilter('last7days');
                            setIsDateMenuOpen(false);
                          }}
                          className={`text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-all ${
                            dateFilter === 'last7days'
                              ? 'bg-pink-600/20 text-pink-400 font-bold border border-pink-500/30'
                              : 'text-gray-300 hover:bg-[#20273a]'
                          }`}
                        >
                          <span>গত ৭ দিন (7 Days)</span>
                        </button>

                        <button
                          onClick={() => {
                            setDateFilter('last30days');
                            setIsDateMenuOpen(false);
                          }}
                          className={`text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-all ${
                            dateFilter === 'last30days'
                              ? 'bg-pink-600/20 text-pink-400 font-bold border border-pink-500/30'
                              : 'text-gray-300 hover:bg-[#20273a]'
                          }`}
                        >
                          <span>গত ৩০ দিন (30 Days)</span>
                        </button>

                        <button
                          onClick={() => {
                            setDateFilter('lastmonth');
                            setIsDateMenuOpen(false);
                          }}
                          className={`text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-all ${
                            dateFilter === 'lastmonth'
                              ? 'bg-pink-600/20 text-pink-400 font-bold border border-pink-500/30'
                              : 'text-gray-300 hover:bg-[#20273a]'
                          }`}
                        >
                          <span>গত মাস (Last Month)</span>
                        </button>
                      </div>

                      {/* Manually Select Date from Date to Date (কাস্টম তারিখ সীমা) */}
                      <div className="px-2 pt-2 border-t border-[#20273a] space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 block uppercase tracking-wider">
                          তারিখ থেকে তারিখ (Date Range):
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[9px] text-gray-400 block mb-0.5">শুরু (From):</span>
                            <input
                              type="date"
                              value={customStartDate}
                              onChange={(e) => setCustomStartDate(e.target.value)}
                              className="w-full bg-[#10131c] border border-[#273046] rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-pink-500 cursor-pointer"
                            />
                          </div>
                          <div>
                            <span className="text-[9px] text-gray-400 block mb-0.5">শেষ (To):</span>
                            <input
                              type="date"
                              value={customEndDate}
                              onChange={(e) => setCustomEndDate(e.target.value)}
                              className="w-full bg-[#10131c] border border-[#273046] rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-pink-500 cursor-pointer"
                            />
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            if (customStartDate || customEndDate) {
                              setDateFilter('custom');
                              setIsDateMenuOpen(false);
                            }
                          }}
                          disabled={!customStartDate && !customEndDate}
                          className="w-full py-1.5 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow"
                        >
                          ফিল্টার প্রয়োগ করুন
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

      {/* 6 Main KPI Cards: Confirm | Delivery | Pending | Partial | Quantity | Cancel */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-300 uppercase tracking-wide">
              📊 পারফরম্যান্স সামারি ডাটা বক্স ({getDateFilterLabel()})
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          {/* 1. Confirm */}
          <div className="bg-[#12151f] border border-[#1e2436] rounded-2xl p-3 sm:p-4 relative overflow-hidden group hover:border-pink-500/40 transition-all shadow-md">
            <div className="flex items-center justify-between text-xs font-medium text-gray-400">
              <span className="flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-pink-500 shrink-0" />
                Confirm
              </span>
              <div className="w-7 h-7 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-black text-pink-400 tracking-tight font-mono">
                {aggregatedStats.totalConfirm} <span className="text-xs font-semibold text-gray-400">টি</span>
              </div>
              <div className="text-[11px] text-gray-400 mt-1 truncate">
                কমপ্লিট রেট: <strong className="text-pink-300">{cleanRate(aggregatedStats.completeRate)}</strong>
              </div>
            </div>
          </div>

          {/* 2. Delivery */}
          <div className="bg-[#12151f] border border-[#1e2436] rounded-2xl p-3 sm:p-4 relative overflow-hidden group hover:border-emerald-500/40 transition-all shadow-md">
            <div className="flex items-center justify-between text-xs font-medium text-gray-400">
              <span className="flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                Delivery
              </span>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <Truck className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-black text-emerald-400 tracking-tight font-mono">
                {aggregatedStats.totalDelivery} <span className="text-xs font-semibold text-gray-400">টি</span>
              </div>
              <div className="text-[11px] text-gray-400 mt-1 truncate">
                সাকসেস: <strong className="text-emerald-300">{cleanRate(aggregatedStats.deliveryRate)}</strong>
              </div>
            </div>
          </div>

          {/* 3. Pending */}
          <div className="bg-[#12151f] border border-[#1e2436] rounded-2xl p-3 sm:p-4 relative overflow-hidden group hover:border-amber-500/40 transition-all shadow-md">
            <div className="flex items-center justify-between text-xs font-medium text-gray-400">
              <span className="flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                Pending
              </span>
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                <Clock className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-black text-amber-400 tracking-tight font-mono">
                {aggregatedStats.totalPending} <span className="text-xs font-semibold text-gray-400">টি</span>
              </div>
              <div className="text-[11px] text-gray-400 mt-1 truncate">
                পেন্ডিং: <strong className="text-amber-300">{cleanRate(aggregatedStats.pendingRate)}</strong>
              </div>
            </div>
          </div>

          {/* 4. Partial */}
          <div className="bg-[#12151f] border border-[#1e2436] rounded-2xl p-3 sm:p-4 relative overflow-hidden group hover:border-orange-500/40 transition-all shadow-md">
            <div className="flex items-center justify-between text-xs font-medium text-gray-400">
              <span className="flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
                Partial
              </span>
              <div className="w-7 h-7 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 shrink-0">
                <Layers className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-black text-orange-400 tracking-tight font-mono">
                {aggregatedStats.totalPartial} <span className="text-xs font-semibold text-gray-400">টি</span>
              </div>
              <div className="text-[11px] text-gray-400 mt-1 truncate">
                পার্শিয়াল: <strong className="text-orange-300">{cleanRate(aggregatedStats.partialRate)}</strong>
              </div>
            </div>
          </div>

          {/* 5. Quantity */}
          <div className="bg-[#12151f] border border-[#1e2436] rounded-2xl p-3 sm:p-4 relative overflow-hidden group hover:border-cyan-500/40 transition-all shadow-md">
            <div className="flex items-center justify-between text-xs font-medium text-gray-400">
              <span className="flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
                Quantity
              </span>
              <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-300 shrink-0">
                <Package className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-black text-cyan-300 tracking-tight font-mono">
                {aggregatedStats.totalQuantity} <span className="text-xs font-semibold text-gray-400">পিস</span>
              </div>
              <div className="text-[11px] text-gray-400 mt-1 truncate">
                কমপ্লিট: <strong className="text-cyan-200">মোট পিস</strong>
              </div>
            </div>
          </div>

          {/* 6. Cancel */}
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-3 sm:p-4 relative overflow-hidden group hover:border-rose-400/50 transition-all shadow-md">
            <div className="flex items-center justify-between text-xs font-medium text-rose-300">
              <span className="flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
                Cancel
              </span>
              <div className="w-7 h-7 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-300 shrink-0">
                <Ban className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-black text-rose-300 tracking-tight font-mono">
                {aggregatedStats.totalCancel} <span className="text-xs font-semibold text-rose-200">টি</span>
              </div>
              <div className="text-[11px] text-gray-300 mt-1 truncate">
                ক্যান্সেল: <strong className="text-rose-200">{cleanRate(aggregatedStats.cancelRate)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Product Filter Pills & Search Bar */}
      <div className="bg-[#12151f] border border-[#1e2436] p-3.5 sm:p-4 rounded-2xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1.5 bg-[#0e1017] p-1 rounded-xl border border-[#1e2436]">
            <button
              onClick={() => setActiveTab('products')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'products'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              প্রোডাক্ট কার্ড বক্স ({filteredProducts.length})
            </button>
            <button
              onClick={() => setActiveTab('sources')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'sources'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              সামগ্রিক সোর্স এনালিটিক্স
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="প্রোডাক্ট বা সোর্স খুঁজুন..."
              className="w-full bg-[#161a26] border border-[#242c40] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>
      </div>

      {/* Main Tab View 1: প্রতিটা প্রোডাক্ট এর জন্য আলাদা কার্ড বক্স ও সোর্স ডাটা পেজ */}
      {activeTab === 'products' && (
        selectedDetailProductId && selectedProductDetail ? (
          /* ========================================================
             NEW PAGE: সোর্স ডাটা পেজ (কার্ডে ক্লিক করলেই এই পেজ ওপেন হবে)
             ======================================================== */
          (() => {
            const { relatedDateOrders, prodStats, sourcesList } = getProductAnalytics(selectedProductDetail);

            return (
              <div className="space-y-4">
                {/* Dedicated Page Header with Back Button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#12151f] border border-[#1e2436] p-3 sm:p-4 rounded-xl shadow-lg">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedDetailProductId(null)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1a2133] hover:bg-pink-600 border border-[#27324c] hover:border-pink-500 text-white text-xs font-bold shadow-sm transition-all group"
                    >
                      <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
                      <span>← সব প্রোডাক্টে ফিরে যান</span>
                    </button>
                    <div className="h-5 w-px bg-[#262f44]" />
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-600/20 via-purple-600/20 to-blue-600/20 border border-pink-500/30 flex items-center justify-center text-pink-400 font-bold text-xs shadow-inner">
                        {selectedProductDetail.productName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                          {selectedProductDetail.productName}
                        </h3>
                        <p className="text-[10px] text-gray-400">
                          সোর্স ডাটা ও সেলস পারফরম্যান্স বিস্তারিত বিবরণ
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] px-2.5 py-1 rounded-lg bg-pink-500/15 text-pink-300 border border-pink-500/30 font-semibold font-mono">
                      {getDateFilterLabel()}
                    </span>
                    <button
                      onClick={() => loadSheet1Data(true)}
                      disabled={refreshing}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1a2030] hover:bg-[#232c42] border border-[#2d3852] text-white text-[11px] font-semibold shadow-sm transition-all disabled:opacity-50"
                      title="শীট ১ থেকে পুনরায় ডেটা রিফ্রেশ করুন"
                    >
                      <RefreshCw className={`w-3 h-3 text-pink-400 ${refreshing ? 'animate-spin' : ''}`} />
                      <span>{refreshing ? 'রিফ্রেশ হচ্ছে...' : 'রিয়েলটাইম রিফ্রেশ'}</span>
                    </button>
                  </div>
                </div>

                {/* Product Overall Summary 7-Box Performance */}
                <div className="bg-[#12151f] border border-[#1e2436] rounded-xl p-3 sm:p-3.5 shadow-md space-y-2">
                  <div className="text-[11px] font-bold text-gray-300 uppercase tracking-wider flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-purple-400" />
                      {selectedProductDetail.productName} এর সামগ্রিক পারফরম্যান্স ({getDateFilterLabel()}):
                    </span>
                    {prodStats.amount > 0 && (
                      <span className="text-emerald-400 font-mono text-[11px] font-semibold">
                        মোট বিক্রয়: ৳{prodStats.amount.toLocaleString()}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 sm:gap-2">
                    {/* 1. Confirm */}
                    <div className="bg-[#141824] border border-[#20283c] rounded-lg py-1 px-1.5 text-center flex flex-col justify-center min-h-[42px]">
                      <span className="text-[10px] text-gray-400 font-medium block truncate">Confirm</span>
                      <span className="text-xs sm:text-[13px] font-bold text-pink-400 mt-0.5 font-mono whitespace-nowrap">
                        {prodStats.confirm} <span className="text-[10px] font-normal text-pink-300/80">({cleanRate(prodStats.completeRate || prodStats.confirmRate)})</span>
                      </span>
                    </div>

                    {/* 2. Delivery */}
                    <div className="bg-[#141824] border border-[#20283c] rounded-lg py-1 px-1.5 text-center flex flex-col justify-center min-h-[42px]">
                      <span className="text-[10px] text-gray-400 font-medium block truncate">Delivery</span>
                      <span className="text-xs sm:text-[13px] font-bold text-emerald-400 mt-0.5 font-mono whitespace-nowrap">
                        {prodStats.delivery} <span className="text-[10px] font-normal text-emerald-300/80">({cleanRate(prodStats.deliveryRate)})</span>
                      </span>
                    </div>

                    {/* 3. Pending */}
                    <div className="bg-[#141824] border border-[#20283c] rounded-lg py-1 px-1.5 text-center flex flex-col justify-center min-h-[42px]">
                      <span className="text-[10px] text-gray-400 font-medium block truncate">Pending</span>
                      <span className="text-xs sm:text-[13px] font-bold text-amber-400 mt-0.5 font-mono whitespace-nowrap">
                        {prodStats.pending} <span className="text-[10px] font-normal text-amber-300/80">({cleanRate(prodStats.pendingRate)})</span>
                      </span>
                    </div>

                    {/* 4. Partial */}
                    <div className="bg-[#141824] border border-[#20283c] rounded-lg py-1 px-1.5 text-center flex flex-col justify-center min-h-[42px]">
                      <span className="text-[10px] text-gray-400 font-medium block truncate">Partial</span>
                      <span className="text-xs sm:text-[13px] font-bold text-orange-400 mt-0.5 font-mono whitespace-nowrap">
                        {prodStats.partial} <span className="text-[10px] font-normal text-orange-300/80">({cleanRate(prodStats.partialRate)})</span>
                      </span>
                    </div>

                    {/* 5. Quantity */}
                    <div className="bg-[#141824] border border-[#20283c] rounded-lg py-1 px-1.5 text-center flex flex-col justify-center min-h-[42px]">
                      <span className="text-[10px] text-gray-400 font-medium block truncate">Quantity</span>
                      <span className="text-xs sm:text-[13px] font-bold text-cyan-300 mt-0.5 font-mono">{prodStats.quantity}</span>
                    </div>

                    {/* 6. Cancel */}
                    <div className="bg-rose-500/20 border border-rose-500/40 rounded-lg py-1 px-1.5 text-center flex flex-col justify-center min-h-[42px]">
                      <span className="text-[10px] text-rose-300 font-medium block truncate">Cancel</span>
                      <span className="text-xs sm:text-[13px] font-bold text-rose-300 mt-0.5 font-mono whitespace-nowrap">
                        {prodStats.cancel} <span className="text-[10px] font-normal text-rose-200">({cleanRate(prodStats.cancelRate)})</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* INDIVIDUAL SOURCE DATA BOXES (প্রত্যেকটা সোর্সের জন্য আলাদা আলাদা চিকন ডাটা বক্স) */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-1 border-b border-[#1e2436]">
                    <div className="flex items-center gap-1.5">
                      <Share2 className="w-3.5 h-3.5 text-pink-400" />
                      <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight">
                        সোর্স ভিত্তিক আলাদা আলাদা ডাটা ({selectedProductDetail.productName}):
                      </h4>
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono">
                      মোট {sourcesList.length} টি সোর্স থেকে প্রাপ্ত ডাটা
                    </span>
                  </div>

                  {sourcesList.length === 0 ? (
                    <div className="p-6 text-center text-gray-500 text-xs bg-[#10131d] border border-[#1b2234] rounded-xl">
                      সিলেক্টেড ডেটে এই প্রোডাক্টের কোনো সোর্স ডাটা পাওয়া যায়নি।
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2.5">
                      {sourcesList.map((src, srcIdx) => (
                        <div
                          key={srcIdx}
                          className="bg-[#121622] border border-[#20293d] hover:border-pink-500/40 rounded-xl p-2.5 sm:p-3 transition-all shadow-sm space-y-2"
                        >
                          {/* Source Header */}
                          <div className="flex items-center justify-between pb-1.5 border-b border-[#1a2133]">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-md bg-[#1a2133] border border-[#2a3754] flex items-center justify-center">
                                {getSourceIcon(src.name)}
                              </div>
                              <div className="flex items-center gap-2">
                                <h6 className="text-xs sm:text-sm font-bold text-white">
                                  {src.name}
                                </h6>
                                <span className="text-[10px] text-gray-400 font-mono">
                                  • শেয়ার: {src.sharePercent} {src.amount > 0 && `• ৳${src.amount.toLocaleString()}`}
                                </span>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-500/15 text-pink-300 border border-pink-500/30 font-mono">
                              {src.lead} Leads
                            </span>
                          </div>

                          {/* 6 Sleek Source Metric Boxes */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 sm:gap-2">
                            {/* 1. Confirm */}
                            <div className="bg-[#0b0e16] border border-[#1a2236] rounded-lg py-1 px-1.5 text-center flex flex-col justify-center min-h-[40px]">
                              <span className="text-[10px] text-gray-400 font-medium block truncate">Confirm</span>
                              <span className="text-xs sm:text-[13px] font-bold text-pink-400 mt-0.5 font-mono whitespace-nowrap">
                                {src.confirm} <span className="text-[10px] font-normal text-pink-300/80">({cleanRate(src.confirmRate)})</span>
                              </span>
                            </div>

                            {/* 2. Delivery */}
                            <div className="bg-[#0b0e16] border border-[#1a2236] rounded-lg py-1 px-1.5 text-center flex flex-col justify-center min-h-[40px]">
                              <span className="text-[10px] text-gray-400 font-medium block truncate">Delivery</span>
                              <span className="text-xs sm:text-[13px] font-bold text-emerald-400 mt-0.5 font-mono whitespace-nowrap">
                                {src.delivery} <span className="text-[10px] font-normal text-emerald-300/80">({cleanRate(src.deliveryRate)})</span>
                              </span>
                            </div>

                            {/* 3. Pending */}
                            <div className="bg-[#0b0e16] border border-[#1a2236] rounded-lg py-1 px-1.5 text-center flex flex-col justify-center min-h-[40px]">
                              <span className="text-[10px] text-gray-400 font-medium block truncate">Pending</span>
                              <span className="text-xs sm:text-[13px] font-bold text-amber-400 mt-0.5 font-mono whitespace-nowrap">
                                {src.pending} <span className="text-[10px] font-normal text-amber-300/80">({cleanRate(src.pendingRate)})</span>
                              </span>
                            </div>

                            {/* 4. Partial */}
                            <div className="bg-[#0b0e16] border border-[#1a2236] rounded-lg py-1 px-1.5 text-center flex flex-col justify-center min-h-[40px]">
                              <span className="text-[10px] text-gray-400 font-medium block truncate">Partial</span>
                              <span className="text-xs sm:text-[13px] font-bold text-orange-400 mt-0.5 font-mono whitespace-nowrap">
                                {src.partial} <span className="text-[10px] font-normal text-orange-300/80">({cleanRate(src.partialRate)})</span>
                              </span>
                            </div>

                            {/* 5. Quantity */}
                            <div className="bg-[#0b0e16] border border-[#1a2236] rounded-lg py-1 px-1.5 text-center flex flex-col justify-center min-h-[40px]">
                              <span className="text-[10px] text-gray-400 font-medium block truncate">Quantity</span>
                              <span className="text-xs sm:text-[13px] font-bold text-cyan-300 mt-0.5 font-mono">{src.quantity}</span>
                            </div>

                            {/* 6. Cancel */}
                            <div className="bg-rose-500/20 border border-rose-500/40 rounded-lg py-1 px-1.5 text-center flex flex-col justify-center min-h-[40px]">
                              <span className="text-[10px] text-rose-300 font-medium block truncate">Cancel</span>
                              <span className="text-xs sm:text-[13px] font-bold text-rose-300 mt-0.5 font-mono whitespace-nowrap">
                                {src.cancel} <span className="text-[10px] font-normal text-rose-200">({cleanRate(src.cancelRate)})</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bottom Back Button */}
                <div className="flex justify-center pt-1">
                  <button
                    onClick={() => setSelectedDetailProductId(null)}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#1a2133] hover:bg-pink-600 border border-[#27324c] hover:border-pink-500 text-white text-xs sm:text-sm font-bold shadow-md transition-all group"
                  >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    <span>← সব প্রোডাক্টের তালিকায় ফিরে যান</span>
                  </button>
                </div>
              </div>
            );
          })()
        ) : (
          /* ========================================================
             PRODUCT CARDS LIST (৭টি চিকন বক্স সহ স্লিম ও কমপ্যাক্ট কার্ড)
             ======================================================== */
          <div className="space-y-4">
            {/* Real-time Total Orders & Per-Product Order Share Card */}
            <div className="bg-[#12151f] border border-[#1e2436] rounded-xl p-3.5 sm:p-4 shadow-lg space-y-3">
              {/* Card Top: Total Orders & Date Badge */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-[#1c2233]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight flex items-center gap-2">
                      <span>মোট অর্ডার ও প্রোডাক্ট ভিত্তিক অর্ডার সামারি</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-300 border border-pink-500/20 font-mono">
                        Live Sheet Sync
                      </span>
                    </h3>
                    <p className="text-[10px] text-gray-400">
                      গুগল শিট থেকে রিয়েলটাইমে মোট অর্ডার এবং প্রতিটি প্রোডাক্টের অর্ডার ও শতাংশ
                    </p>
                  </div>
                </div>

                {/* Total Orders Counter Box */}
                <div className="flex items-center gap-2.5 bg-[#151926] border border-[#212a40] px-3.5 py-1.5 rounded-xl self-start sm:self-auto">
                  <span className="text-[11px] text-gray-400 font-medium">মোট অর্ডার:</span>
                  <span className="text-sm sm:text-base font-bold text-pink-400 font-mono">
                    {productOrderDistribution.totalOrders} টি
                  </span>
                  <span className="text-[10px] text-gray-500 font-mono hidden sm:inline">
                    ({getDateFilterLabel()})
                  </span>
                </div>
              </div>

              {/* Product Breakdown Grid: কোন প্রোডাক্ট এ কয়টা অর্ডার এসেছে এবং পার্সেন্টেজ */}
              {productOrderDistribution.breakdown.length === 0 ? (
                <div className="text-center py-3 text-xs text-gray-500">
                  কোনো প্রোডাক্টের অর্ডার ডাটা পাওয়া যায়নি।
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-2.5">
                  {productOrderDistribution.breakdown.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedDetailProductId(item.id)}
                      className="bg-[#141824] hover:bg-[#181d2c] border border-[#20283c] hover:border-pink-500/40 rounded-xl p-2.5 sm:p-3 transition-all cursor-pointer group shadow-sm flex flex-col justify-between space-y-2"
                      title="বিস্তারিত সোর্স ডাটা দেখতে ক্লিক করুন"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-pink-600/20 to-purple-600/20 border border-pink-500/30 flex items-center justify-center text-pink-400 font-bold text-[10px] shrink-0">
                            {item.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex items-center gap-1.5 truncate">
                            <span className="text-xs font-bold text-white group-hover:text-pink-300 transition-colors truncate" title={item.name}>
                              {item.name}
                            </span>
                            <span className="text-[11px] font-bold text-pink-400 font-mono shrink-0" title={`কমপ্লিট রেট: ${item.completeRate}`}>
                              ({item.completeRate})
                            </span>
                          </div>
                        </div>
                        <span className="text-[11px] font-bold text-pink-400 font-mono px-2 py-0.5 rounded-md bg-pink-500/10 border border-pink-500/20 shrink-0">
                          {item.percentage}
                        </span>
                      </div>

                      {/* Orders Count and Progress Bar */}
                      <div>
                        <div className="flex items-center justify-between text-[11px] font-mono text-gray-400 mb-1">
                          <span className="text-gray-400 text-[10px]">অর্ডার সংখ্যা:</span>
                          <span className="font-bold text-white text-xs">
                            {item.orderCount} টি ({item.percentage})
                          </span>
                        </div>
                        <div className="w-full bg-[#1e2536] rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-pink-500 to-purple-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(item.percentNum > 0 ? 4 : 0, item.percentNum)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                <Package className="w-4 h-4 text-purple-400" />
                প্রোডাক্ট ভিত্তিক আলাদা কার্ড বক্স ({filteredProducts.length} টি)
              </h3>
              <span className="text-[11px] text-pink-400 font-medium hidden sm:inline-block">
                💡 যে কোনো কার্ডে ক্লিক করলে সোর্স ডাটা পেজ দেখতে পাবেন
              </span>
            </div>

            {loading ? (
              <div className="bg-[#12151f] border border-[#1e2436] rounded-xl p-10 text-center">
                <RefreshCw className="w-7 h-7 text-purple-400 animate-spin mx-auto mb-2" />
                <p className="text-xs text-gray-300 font-medium">প্রোডাক্ট ও শিট রিপোর্ট ডাটা লোড হচ্ছে...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="bg-[#12151f] border border-[#1e2436] rounded-xl p-6 text-center text-gray-400 text-xs">
                কোনো প্রোডাক্ট পাওয়া যায়নি।
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {filteredProducts.map((prod) => {
                  const { prodStats, sourcesList } = getProductAnalytics(prod);

                  // Extract active sources with orders
                  const activeSources = sourcesList
                    .filter((s) => s.lead > 0)
                    .map((s, sIdx) => ({
                      ...s,
                      color: getSourceColor(s.name, sIdx),
                    }));

                  const totalOrders = prodStats.lead || activeSources.reduce((sum, s) => sum + s.lead, 0);

                  const displaySources = activeSources.length > 0
                    ? activeSources
                    : totalOrders > 0
                    ? [{ name: 'Website', lead: totalOrders, color: '#3b82f6', sharePercent: '100%' }]
                    : [];

                  return (
                    <div
                      key={prod.id}
                      onClick={() => setSelectedDetailProductId(prod.id)}
                      className="bg-[#12151f] border border-[#1e2436] hover:border-pink-500/60 rounded-xl p-2.5 sm:p-3 transition-all shadow-md hover:shadow-xl hover:shadow-pink-500/10 cursor-pointer group space-y-2.5"
                    >
                      {/* কার্ড হেডার: মিনিমাল ও কমপ্যাক্ট, কোনো ছোট বাটন ছাড়া */}
                      <div className="flex items-center justify-between gap-2 border-b border-[#1c2232] pb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-pink-600/20 via-purple-600/20 to-blue-600/20 border border-pink-500/30 flex items-center justify-center text-pink-400 font-bold text-xs shadow-inner flex-shrink-0 group-hover:scale-105 transition-transform">
                            {prod.productName.slice(0, 2).toUpperCase()}
                          </div>
                          <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight group-hover:text-pink-300 transition-colors truncate">
                            {prod.productName}
                          </h4>
                          <span className="text-[10px] text-gray-400 hidden sm:inline-block font-mono">
                            • {getDateFilterLabel()}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-pink-500/10 border border-pink-500/20 text-pink-400 text-[11px] font-semibold group-hover:bg-pink-500 group-hover:text-white transition-all flex-shrink-0">
                          <span>সোর্স ডাটা</span>
                          <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>

                      {/* সোর্স ভিত্তিক অর্ডার রাউন্ড চার্ট ও ব্রেকডাউন (Source Orders Round Chart) */}
                      <div className="bg-[#0b0e17] border border-[#192032] rounded-xl p-2.5 flex flex-col sm:flex-row items-center gap-3">
                        {/* Round Donut Chart */}
                        <div className="relative w-20 h-20 sm:w-22 sm:h-22 shrink-0 flex items-center justify-center">
                          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                            {/* Background Track */}
                            <circle
                              cx="50"
                              cy="50"
                              r="38"
                              stroke="#181f2f"
                              strokeWidth="12"
                              fill="transparent"
                            />
                            {/* Source Slices */}
                            {(() => {
                              if (totalOrders === 0 || displaySources.length === 0) return null;
                              let accumulatedPercent = 0;
                              const circumference = 2 * Math.PI * 38; // ~238.76
                              return displaySources.map((s, idx) => {
                                const percent = (s.lead / totalOrders) * 100;
                                const dashLength = (percent / 100) * circumference;
                                const dashOffset = -((accumulatedPercent / 100) * circumference);
                                accumulatedPercent += percent;
                                return (
                                  <circle
                                    key={idx}
                                    cx="50"
                                    cy="50"
                                    r="38"
                                    stroke={s.color}
                                    strokeWidth="12"
                                    strokeDasharray={`${dashLength} ${circumference}`}
                                    strokeDashoffset={`${dashOffset}`}
                                    fill="transparent"
                                    className="transition-all duration-700"
                                  />
                                );
                              });
                            })()}
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                            <span className="text-xs sm:text-sm font-black text-white font-mono leading-none">
                              {totalOrders}
                            </span>
                            <span className="text-[9px] text-gray-400 font-medium mt-0.5 leading-none">
                              অর্ডার
                            </span>
                          </div>
                        </div>

                        {/* Source breakdown legend & order counts */}
                        <div className="flex-1 w-full min-w-0">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-semibold text-gray-300 flex items-center gap-1.5">
                              <PieChart className="w-3.5 h-3.5 text-pink-400" />
                              <span>সোর্স অনুযায়ী অর্ডার (রাউন্ড চার্ট)</span>
                            </span>
                            <span className="text-[10px] text-pink-400 font-mono font-medium">
                              মোট {totalOrders} টি
                            </span>
                          </div>

                          {displaySources.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                              {displaySources.map((s, idx) => {
                                const percent = totalOrders > 0 ? Math.round((s.lead / totalOrders) * 100) : 0;
                                return (
                                  <div
                                    key={idx}
                                    className="bg-[#121624] border border-[#1d2538] hover:border-pink-500/30 rounded-lg px-2 py-1 flex items-center justify-between gap-1.5 text-[11px] min-w-0 transition-colors"
                                    title={`${s.name}: ${s.lead}টি অর্ডার (${percent}%)`}
                                  >
                                    <div className="flex items-center gap-1.5 min-w-0 truncate">
                                      <span
                                        className="w-2 h-2 rounded-full shrink-0 shadow-xs"
                                        style={{ backgroundColor: s.color }}
                                      />
                                      <span className="text-gray-300 truncate font-medium text-[10.5px]">
                                        {s.name}
                                      </span>
                                    </div>
                                    <span className="font-mono font-bold text-white shrink-0 text-[10.5px]">
                                      {s.lead} <span className="text-[9px] text-gray-400 font-normal">({percent}%)</span>
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-[11px] text-gray-400 italic py-1 bg-[#121624] rounded-lg px-2.5 text-center border border-[#1d2538]">
                              এই প্রোডাক্টে নির্বাচিত সময়ে কোনো সোর্স অর্ডার পাওয়া যায়নি।
                            </div>
                          )}
                        </div>
                      </div>

                      {/* কার্ডের ৬টি চিকন ডাটা বক্স (Confirm | Delivery | Pending | Partial | Quantity | Cancel) */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 sm:gap-2">
                        {/* 1. Confirm */}
                        <div className="bg-[#141824] border border-[#20283c] group-hover:border-pink-500/30 rounded-lg py-1 px-1.5 text-center flex flex-col justify-center transition-all min-h-[42px]">
                          <span className="text-[10px] text-gray-400 font-medium block truncate">Confirm</span>
                          <span className="text-xs sm:text-[13px] font-bold text-pink-400 mt-0.5 font-mono whitespace-nowrap">
                            {prodStats.confirm} <span className="text-[10px] font-normal text-pink-300/80">({cleanRate(prodStats.completeRate || prodStats.confirmRate)})</span>
                          </span>
                        </div>

                        {/* 2. Delivery */}
                        <div className="bg-[#141824] border border-[#20283c] group-hover:border-emerald-500/30 rounded-lg py-1 px-1.5 text-center flex flex-col justify-center transition-all min-h-[42px]">
                          <span className="text-[10px] text-gray-400 font-medium block truncate">Delivery</span>
                          <span className="text-xs sm:text-[13px] font-bold text-emerald-400 mt-0.5 font-mono whitespace-nowrap">
                            {prodStats.delivery} <span className="text-[10px] font-normal text-emerald-300/80">({cleanRate(prodStats.deliveryRate)})</span>
                          </span>
                        </div>

                        {/* 3. Pending */}
                        <div className="bg-[#141824] border border-[#20283c] group-hover:border-amber-500/30 rounded-lg py-1 px-1.5 text-center flex flex-col justify-center transition-all min-h-[42px]">
                          <span className="text-[10px] text-gray-400 font-medium block truncate">Pending</span>
                          <span className="text-xs sm:text-[13px] font-bold text-amber-400 mt-0.5 font-mono whitespace-nowrap">
                            {prodStats.pending} <span className="text-[10px] font-normal text-amber-300/80">({cleanRate(prodStats.pendingRate)})</span>
                          </span>
                        </div>

                        {/* 4. Partial */}
                        <div className="bg-[#141824] border border-[#20283c] group-hover:border-orange-500/30 rounded-lg py-1 px-1.5 text-center flex flex-col justify-center transition-all min-h-[42px]">
                          <span className="text-[10px] text-gray-400 font-medium block truncate">Partial</span>
                          <span className="text-xs sm:text-[13px] font-bold text-orange-400 mt-0.5 font-mono whitespace-nowrap">
                            {prodStats.partial} <span className="text-[10px] font-normal text-orange-300/80">({cleanRate(prodStats.partialRate)})</span>
                          </span>
                        </div>

                        {/* 5. Quantity */}
                        <div className="bg-[#141824] border border-[#20283c] group-hover:border-cyan-500/30 rounded-lg py-1 px-1.5 text-center flex flex-col justify-center transition-all min-h-[42px]">
                          <span className="text-[10px] text-gray-400 font-medium block truncate">Quantity</span>
                          <span className="text-xs sm:text-[13px] font-bold text-cyan-300 mt-0.5 font-mono">
                            {prodStats.quantity}
                          </span>
                        </div>

                        {/* 6. Cancel */}
                        <div className="bg-rose-500/20 border border-rose-500/40 group-hover:border-rose-400/60 rounded-lg py-1 px-1.5 text-center flex flex-col justify-center transition-all min-h-[42px]">
                          <span className="text-[10px] text-rose-300 font-medium block truncate">Cancel</span>
                          <span className="text-xs sm:text-[13px] font-bold text-rose-300 mt-0.5 font-mono whitespace-nowrap">
                            {prodStats.cancel} <span className="text-[10px] font-normal text-rose-200">({cleanRate(prodStats.cancelRate)})</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )
      )}

      {/* Main Tab View 2: Sales Source Analytics & Comparison Chart */}
      {activeTab === 'sources' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Source Matrix */}
          <div className="lg:col-span-7 bg-[#12151f] border border-[#1e2436] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-pink-500" />
                সেলস সোর্স অনুযায়ী সামগ্রিক পারফরম্যান্স
              </h3>
              <span className="text-xs text-gray-400">Sheet 1 থেকে চ্যানেল পরিসংখ্যান</span>
            </div>

            <div className="space-y-3">
              {sourceAnalytics.map((src, i) => (
                <div
                  key={i}
                  className="bg-[#0e1119] border border-[#1e2436] rounded-xl p-3.5 hover:border-[#2d3852] transition-all"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: src.color }}
                      />
                      <span className="text-xs font-bold text-white">{src.name}</span>
                      <span className="text-[10px] px-2 py-0.2 rounded-full bg-[#171c2a] text-pink-300 border border-pink-500/20 font-mono">
                        {src.percentage}% শেয়ার
                      </span>
                    </div>
                    <div className="text-xs font-bold text-gray-200">
                      লিড: <strong className="text-white">{src.lead}</strong> টি
                    </div>
                  </div>

                  {/* Metrics Bar for this source */}
                  <div className="grid grid-cols-4 gap-2 text-[11px] text-gray-400 pt-2 border-t border-[#181d2c]">
                    <div>
                      কনফার্ম:{' '}
                      <span className="text-purple-300 font-bold">{src.confirm}</span>
                    </div>
                    <div>
                      ডেলিভারি:{' '}
                      <span className="text-emerald-400 font-bold">{src.delivery}</span>
                    </div>
                    <div>
                      কোয়ান্টিটি:{' '}
                      <span className="text-blue-300 font-bold">{src.quantity}</span>
                    </div>
                    <div className="bg-rose-500/20 border border-rose-500/30 rounded px-1.5 py-0.5">
                      <span className="text-rose-300">ক্যান্সেল: </span>
                      <span className="text-rose-200 font-bold">{src.cancel}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: SVG Donut Chart for Sources */}
          <div className="lg:col-span-5 bg-[#12151f] border border-[#1e2436] rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                সোর্স শেয়ার পাই-চার্ট (Sheet 1)
              </h3>

              <div className="flex flex-col items-center justify-center py-4">
                <div className="relative w-44 h-44">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      stroke="#1a2030"
                      strokeWidth="14"
                      fill="transparent"
                    />
                    {(() => {
                      let accumulatedPercent = 0;
                      return sourceAnalytics.map((s, idx) => {
                        const dashLength = s.percentage * 2.387;
                        const dashOffset = -(accumulatedPercent * 2.387);
                        accumulatedPercent += s.percentage;
                        return (
                          <circle
                            key={idx}
                            cx="50"
                            cy="50"
                            r="38"
                            stroke={s.color}
                            strokeWidth="14"
                            strokeDasharray={`${dashLength} 300`}
                            strokeDashoffset={`${dashOffset}`}
                            fill="transparent"
                            className="transition-all duration-1000"
                          />
                        );
                      });
                    })()}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-black text-white">
                      {aggregatedStats.totalLead}
                    </span>
                    <span className="text-[10px] text-gray-400 font-medium">মোট লিড</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Donut Legend */}
            <div className="space-y-2 pt-4 border-t border-[#1c2232] text-xs">
              {sourceAnalytics.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-gray-300">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span>{item.name}</span>
                  </div>
                  <span className="font-mono text-gray-400">
                    {item.percentage}% ({item.lead} টি)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
