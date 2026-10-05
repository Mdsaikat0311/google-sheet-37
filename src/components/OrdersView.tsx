import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  Check,
  RefreshCw,
  Package,
  Truck,
  Copy,
  Plus,
  Minus,
  Edit3,
  X,
  Phone,
  MapPin,
  Tag,
  Globe,
  Layers,
  Send,
  Loader2,
  Trash2,
  Calendar,
  User,
} from 'lucide-react';
import { Order, OrderStatus, Product, Sheet3ProductEntry } from '../types';
import { updateOrderCardViaAppsScript, buildOrderCardPayload, getStoredListProductNames, getStoredSheetSources } from '../services/sheets';
import { groupItemsByDate } from '../utils/dateGrouping';

/**
 * Matches an order's product or variant against the selected product filter
 * Strictly for the 6 canonical products in Column H + All Products + No Sellect
 */
export const matchesProductFilter = (order: Order, filter: string): boolean => {
  if (!filter || filter === 'ALL') return true;

  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const vRaw = (order.variant || '').trim();
  const vNorm = normalize(vRaw);

  const isNoSellect =
    !vRaw ||
    vRaw === 'No Sellect' ||
    vNorm === 'nosellect' ||
    vNorm === 'noselect' ||
    vRaw.toLowerCase().includes('no sellect');

  if (filter === 'NO_SELLECT') {
    return isNoSellect;
  }

  if (isNoSellect) {
    return false;
  }

  const pNorm = normalize(filter);
  const oNorm = normalize(order.product || '');

  // Helper function to check if a normalized string belongs to the product filter category
  const matchesCategory = (targetNorm: string): boolean => {
    if (!targetNorm) return false;

    if (targetNorm === pNorm) return true;
    if (targetNorm.includes(pNorm) || pNorm.includes(targetNorm)) return true;

    const is599Rose = pNorm.includes('599') && pNorm.includes('rose');
    const is599Watch = pNorm.includes('599') && pNorm.includes('watch');
    const is990 = pNorm.includes('990');
    const is1350 = pNorm.includes('1350');
    const isDoll = pNorm.includes('doll') || pNorm.includes('toy');
    const isCut = pNorm.includes('cutt') || pNorm.includes('disp');

    if (is599Rose) {
      return targetNorm.includes('rose') && !targetNorm.includes('990') && !targetNorm.includes('1350');
    }
    if (is599Watch) {
      return targetNorm.includes('watch') || targetNorm.includes('golden');
    }
    if (is990) {
      return targetNorm.includes('990');
    }
    if (is1350) {
      return targetNorm.includes('1350');
    }
    if (isDoll) {
      return targetNorm.includes('doll') || targetNorm.includes('toy');
    }
    if (isCut) {
      return targetNorm.includes('cutt') || targetNorm.includes('disp');
    }

    // Token-based matching: check if significant words in filter match target
    const filterTokens = filter.toLowerCase().split(/\s+/).map(normalize).filter((t) => t.length >= 3 && t !== 'tk');
    if (filterTokens.length > 0 && filterTokens.every((token) => targetNorm.includes(token))) {
      return true;
    }

    return false;
  };

  // If variant (Column H) is explicitly set and not No Sellect, it is authoritative
  if (vNorm && vNorm !== 'nosellect' && vNorm !== 'noselect') {
    return matchesCategory(vNorm);
  }

  // Fallback to order.product (Column E)
  return matchesCategory(oNorm);
};

export interface OrdersViewProps {
  orders: Order[];
  products?: Product[];
  sheet3Entries?: Sheet3ProductEntry[];
  onOpenNewOrder: () => void;
  onSyncSheet: () => void;
  isSyncing: boolean;
  onSelectOrder: (order: Order) => void;
  onUpdateOrderStatus: (order: Order, newStatus: OrderStatus) => void;
  onUpdateVariant?: (order: Order, newVariant: string) => void;
  onUpdateSource?: (order: Order, newSource: string) => void;
  onUpdateQuantity?: (order: Order, newQuantity: number) => void;
  onUpdateCourierStatus?: (order: Order, newCourierStatus: string) => void;
  onToggleSteadfast: (order: Order, action?: 'No Sellect' | 'send to steadfast') => Promise<boolean> | void;
  onUpdateCustomerDetails?: (
    order: Order,
    details: {
      customerName: string;
      customerPhone: string;
      customerAddress: string;
      amount?: number;
      price?: number;
    }
  ) => Promise<boolean> | void;
  onUpdateFullOrder?: (
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
  ) => Promise<boolean | void> | void;
  onDeleteOrder?: (order: Order) => void;
  listProductNames?: string[];
  sheetSources?: string[];
}

type DropdownType = 'variant' | 'source' | 'status';

export const OrdersView: React.FC<OrdersViewProps> = ({
  orders,
  products,
  sheet3Entries,
  onOpenNewOrder,
  onSyncSheet,
  isSyncing,
  onSelectOrder,
  onUpdateOrderStatus,
  onUpdateVariant,
  onUpdateSource,
  onUpdateQuantity,
  onToggleSteadfast,
  onUpdateCustomerDetails,
  onUpdateFullOrder,
  onDeleteOrder,
  listProductNames,
  sheetSources,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'All' | 'Processing' | 'Completed' | 'On hold' | 'Cancelled' | 'Pending'>('All');
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>('ALL');
  const [isProductMenuOpen, setIsProductMenuOpen] = useState(false);
  const productMenuRef = useRef<HTMLDivElement>(null);

  // Isolated dropdown state: only ONE dropdown on ONE card can be open at a time
  const [activeDropdown, setActiveDropdown] = useState<{
    orderKey: string;
    type: DropdownType;
  } | null>(null);

  const [copiedTracking, setCopiedTracking] = useState<string | null>(null);

  // Quick Edit Modal State
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPrice, setEditPrice] = useState<number>(599);
  const [editQuantity, setEditQuantity] = useState<number>(1);
  const [editVariant, setEditVariant] = useState('No Sellect');
  const [editSource, setEditSource] = useState('Website');
  const [editStatus, setEditStatus] = useState<OrderStatus>('Pending');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      setActiveDropdown(null);
      if (productMenuRef.current && !productMenuRef.current.contains(e.target as Node)) {
        setIsProductMenuOpen(false);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // Open Edit Modal for order
  const openEditModal = (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    setEditingOrder(order);
    setEditName(order.customerName || '');
    setEditPhone(order.customerPhone || '');
    setEditAddress(order.customerAddress || '');
    setEditPrice(order.total || order.amount || 599);
    setEditQuantity(order.quantity || 1);
    setEditVariant(order.variant || 'No Sellect');
    setEditSource(order.source || 'Website');
    setEditStatus(order.status || 'Pending');
  };

  // Save all edited fields directly to Google Sheet (Sends 1 time only)
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;
    setIsSavingEdit(true);

    try {
      const order = editingOrder;
      const colM = String(order.steadfastStatus || 'No Select').trim();

      if (onUpdateFullOrder) {
        await onUpdateFullOrder(order, {
          customerName: editName.trim(),
          customerPhone: editPhone.trim(),
          customerAddress: editAddress.trim(),
          amount: Number(editPrice) || 0,
          price: Number(editPrice) || 0,
          quantity: editQuantity,
          variant: editVariant,
          source: editSource,
          status: editStatus,
          columnMValue: colM,
        });
      } else {
        // Fallback: send 1 time via updateOrderCardViaAppsScript
        await updateOrderCardViaAppsScript(
          buildOrderCardPayload(order, {
            address: editAddress.trim(),
            number: editPhone.trim(),
            price: Number(editPrice) || 0,
            name: editName.trim(),
            productSelect: editVariant,
            orderSource: editSource,
            orderStatus: editStatus,
            columnMValue: colM,
            quantity: editQuantity,
            orderQuantity: editQuantity,
          })
        );
      }
      setEditingOrder(null);
    } catch (err) {
      console.error('Error saving order edits:', err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Generate unique order key so actions NEVER collide
  const getOrderKey = (order: Order, index: number): string => {
    if (order.rowIndex !== undefined && order.rowIndex !== null) {
      return `row-${order.rowIndex}`;
    }
    return `order-${order.id}-${index}`;
  };

  // Toggle 1: Variant (Column H) Styles
  const getVariantStyle = (variant?: string) => {
    const v = (variant || '').toLowerCase();
    if (v.includes('rose 1350') || v.includes('1350')) {
      return 'bg-[#4a1d24] text-[#fca5a5] border-[#882d36]';
    }
    if (v.includes('rose 990') || v.includes('990')) {
      return 'bg-[#3b1828] text-[#f472b6] border-[#6b2345]';
    }
    if (v.includes('rose')) {
      return 'bg-[#40171a] text-[#fca5a5] border-[#742329]';
    }
    if (v.includes('doll') || v.includes('toy')) {
      return 'bg-[#3b2712] text-[#fde047] border-[#664319]';
    }
    if (v.includes('watch 599') || v.includes('watch')) {
      return 'bg-[#3b2d10] text-[#fef08a] border-[#664d17]';
    }
    if (v.includes('cutting') || v.includes('dispancer')) {
      return 'bg-[#153434] text-[#5eead4] border-[#1d5b5b]';
    }
    if (v.includes('golden') || v.includes('combo')) {
      return 'bg-[#221c38] text-[#d8b4fe] border-[#44366e]';
    }
    return 'bg-[#181922] text-gray-400 border-[#2b2d3d]';
  };

  // Toggle 2: Source (Column I) Styles
  const getSourceStyle = (source?: string) => {
    const s = (source || '').toLowerCase();
    if (s.includes('what') || s.includes('হোয়াটসঅ্যাপ')) {
      return 'bg-[#064e3b] text-[#6ee7b7] border-[#047857]';
    }
    if (s.includes('call') || s.includes('phone') || s.includes('ডিরেক্ট')) {
      return 'bg-[#3d2410] text-[#fdba74] border-[#683c16]';
    }
    if (s.includes('mess') || s.includes('মেসেঞ্জার')) {
      return 'bg-[#132d4a] text-[#7dd3fc] border-[#0369a1]';
    }
    if (s.includes('tik') || s.includes('টিকটক')) {
      return 'bg-[#3b1227] text-[#fb7185] border-[#9f1239]';
    }
    if (s.includes('you') || s.includes('ইউটিউব')) {
      return 'bg-[#450a0a] text-[#fca5a5] border-[#991b1b]';
    }
    if (s.includes('incom') || s.includes('ইনকমপ্লিট')) {
      return 'bg-[#3a2211] text-[#fcd34d] border-[#78350f]';
    }
    if (s.includes('fb') || s.includes('facebook')) {
      return 'bg-[#3b172a] text-[#f472b6] border-[#662447]';
    }
    if (s.includes('pend') || s.includes('পেন্ডিং')) {
      return 'bg-[#1e293b] text-[#cbd5e1] border-[#334155]';
    }
    if (s.includes('insta') || s.includes('ইনস্টাগ্রাম')) {
      return 'bg-[#431407] text-[#fdba74] border-[#ea580c]';
    }
    return 'bg-[#152544] text-[#93c5fd] border-[#1e3d70]';
  };

  // Toggle 3: Status (Column J) Styles matching Google Sheet colors
  const getStatusBadgeStyle = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('comp') || s.includes('deliv') || s.includes('ডেলিভার্ড')) {
      return {
        label: status || 'Complete',
        badge: 'bg-[#1e3a8a] text-[#bfdbfe] border-[#2563eb]',
        dot: 'bg-[#60a5fa]',
      };
    }
    if (s.includes('proc') || s.includes('প্রসেসিং')) {
      return {
        label: status || 'Procecing',
        badge: 'bg-[#064e3b] text-[#34d399] border-[#059669]',
        dot: 'bg-[#34d399]',
      };
    }
    if (s.includes('hold') || s.includes('হোল্ড')) {
      return {
        label: status || 'Hold',
        badge: 'bg-[#3f2911] text-[#fbbf24] border-[#6b471d]',
        dot: 'bg-[#fbbf24]',
      };
    }
    if (s.includes('cancel') || s.includes('বাতিল') || s.includes('ক্যান্সেল')) {
      return {
        label: status || 'Cancel',
        badge: 'bg-[#451014] text-[#f87171] border-[#782329]',
        dot: 'bg-[#f87171]',
      };
    }
    if (s.includes('review') || s.includes('রিভিউ')) {
      return {
        label: status || 'In Review',
        badge: 'bg-[#1e1b4b] text-[#c7d2fe] border-[#4338ca]',
        dot: 'bg-[#818cf8]',
      };
    }
    if (s.includes('part') || s.includes('আংশিক')) {
      return {
        label: status || 'Partial',
        badge: 'bg-[#134e4a] text-[#5eead4] border-[#0f766e]',
        dot: 'bg-[#2dd4bf]',
      };
    }
    return {
      label: status || 'Pending',
      badge: 'bg-[#35270f] text-[#fde047] border-[#594215]',
      dot: 'bg-[#fde047]',
    };
  };

  // Strictly the 6 products from List Sheet Column B + All Products + No Sellect
  const productFilterTabs = useMemo(() => {
    const list =
      listProductNames && listProductNames.length >= 6
        ? listProductNames.slice(0, 6)
        : getStoredListProductNames();

    return [
      { id: 'ALL', label: 'All Products' },
      ...list.map((name) => ({ id: name, label: name })),
      { id: 'NO_SELLECT', label: 'No Sellect' },
    ];
  }, [listProductNames]);

  // Order counts per product
  const productCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: orders.length,
      NO_SELLECT: 0,
    };
    productFilterTabs.forEach((tab) => {
      counts[tab.id] = 0;
    });

    orders.forEach((order) => {
      if (matchesProductFilter(order, 'NO_SELLECT')) {
        counts.NO_SELLECT = (counts.NO_SELLECT || 0) + 1;
      }
      productFilterTabs.forEach((tab) => {
        if (tab.id !== 'ALL' && tab.id !== 'NO_SELLECT') {
          if (matchesProductFilter(order, tab.id)) {
            counts[tab.id] = (counts[tab.id] || 0) + 1;
          }
        }
      });
    });

    return counts;
  }, [orders, productFilterTabs]);

  // Status counts for tabs (scoped to selected product filter)
  const filterCounts = useMemo(() => {
    const scopedOrders =
      selectedProductFilter === 'ALL'
        ? orders
        : orders.filter((o) => matchesProductFilter(o, selectedProductFilter));

    const counts: Record<string, number> = {
      All: scopedOrders.length,
      Processing: 0,
      Completed: 0,
      'On hold': 0,
      Cancelled: 0,
      Pending: 0,
    };
    scopedOrders.forEach((o) => {
      const s = (o.status || '').toLowerCase();
      if (s.includes('proc') || s.includes('প্রসেসিং')) counts.Processing++;
      else if (s.includes('comp') || s.includes('deliv') || s.includes('ডেলিভার্ড')) counts.Completed++;
      else if (s.includes('hold') || s.includes('হোল্ড')) counts['On hold']++;
      else if (s.includes('cancel') || s.includes('বাতিল') || s.includes('ক্যান্সেল')) counts.Cancelled++;
      else if (s.includes('pend') || s.includes('পেন্ডিং')) counts.Pending++;
    });
    return counts;
  }, [orders, selectedProductFilter]);

  // Filter orders by selected product, search query, and order status
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // 1. Product Filter
      if (selectedProductFilter !== 'ALL') {
        if (!matchesProductFilter(order, selectedProductFilter)) {
          return false;
        }
      }

      // 2. Search Query
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchName = (order.customerName || '').toLowerCase().includes(q);
        const matchPhone = (order.customerPhone || '').toLowerCase().includes(q);
        const matchId = (order.id || '').toLowerCase().includes(q);
        const matchProd = (order.product || '').toLowerCase().includes(q);
        const matchVariant = (order.variant || '').toLowerCase().includes(q);
        const matchAddr = (order.customerAddress || '').toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchId && !matchProd && !matchVariant && !matchAddr) {
          return false;
        }
      }

      // 3. Status Filter
      const s = (order.status || '').toLowerCase();
      if (activeFilter === 'Processing') {
        return s.includes('proc');
      }
      if (activeFilter === 'Completed') {
        return s.includes('comp') || s.includes('deliv');
      }
      if (activeFilter === 'On hold') {
        return s.includes('hold');
      }
      if (activeFilter === 'Cancelled') {
        return s.includes('cancel');
      }
      if (activeFilter === 'Pending') {
        return s.includes('pend');
      }
      return true;
    });
  }, [orders, selectedProductFilter, searchQuery, activeFilter]);

  // Column H (Variant) options - strictly List Sheet Column B 6 products + No Sellect
  const availableVariants = useMemo(() => {
    const list =
      listProductNames && listProductNames.length >= 6
        ? listProductNames.slice(0, 6)
        : getStoredListProductNames();

    return ['No Sellect', ...list];
  }, [listProductNames]);

  // Column I (Source) options - 8 sources strictly read from Google Sheet
  const availableSources = useMemo(() => {
    return sheetSources && sheetSources.length >= 8 ? sheetSources.slice(0, 8) : getStoredSheetSources();
  }, [sheetSources]);

  // Column J (Status) options - verified from Google Sheet
  const availableStatuses: OrderStatus[] = [
    'Procecing',
    'Hold',
    'Complete',
    'Cancel',
    'Pending',
    'In Review',
    'Partial',
  ];

  const handleCopyTracking = (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedTracking(code);
    setTimeout(() => setCopiedTracking(null), 2000);
  };

  const toggleDropdown = (e: React.MouseEvent, orderKey: string, type: DropdownType) => {
    e.stopPropagation();
    if (activeDropdown?.orderKey === orderKey && activeDropdown?.type === type) {
      setActiveDropdown(null);
    } else {
      setActiveDropdown({ orderKey, type });
    }
  };

  return (
    <div className="space-y-3 sm:space-y-3.5 animate-fadeIn pb-28 sm:pb-20 max-w-4xl mx-auto font-sans">
      {/* Top Header - Mobile Optimized */}
      <div className="bg-[#141419] border-b border-[#24242c] -mx-3 sm:-mx-6 -mt-3 sm:-mt-6 px-3.5 sm:px-6 py-2.5 sm:py-3.5 sticky top-0 z-20 shadow-md">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-2xl font-bold text-white tracking-tight">
              Orders
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#1e202d] text-gray-400 font-mono border border-[#2b2d3d]">
              {filteredOrders.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="p-2 sm:p-1.5 rounded-lg bg-[#1a1b24] sm:bg-transparent text-gray-300 hover:text-white transition-colors cursor-pointer active:scale-95"
              title="Search orders"
            >
              <Search className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button
              onClick={onSyncSheet}
              disabled={isSyncing}
              className="p-2 sm:p-1.5 rounded-lg bg-[#1a1b24] sm:bg-transparent text-gray-300 hover:text-white transition-colors cursor-pointer active:scale-95 disabled:opacity-50"
              title="Sync Google Sheet"
            >
              {isSyncing ? (
                <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
            </button>
            <button
              onClick={onOpenNewOrder}
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg bg-gradient-to-r from-pink-600 via-rose-600 to-pink-500 hover:from-pink-500 hover:to-rose-500 text-white text-xs sm:text-sm font-semibold shadow-md shadow-pink-600/30 transition-all active:scale-95 cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">+ New Order</span>
              <span className="xs:hidden">+ New</span>
            </button>
          </div>
        </div>

        {/* Collapsible Search Bar */}
        {isSearchOpen && (
          <div className="mt-2.5 relative animate-fadeIn">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by #order, name, phone, product..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="w-full bg-[#1b1b22] border border-[#2f2f3a] rounded-lg pl-9 pr-8 py-2 text-base sm:text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-xs text-gray-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* Sub Header: Filter Label + Reset */}
        <div className="mt-2 flex items-center justify-between">
          <div className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
            <span>{activeFilter === 'All' ? 'All orders' : activeFilter}</span>
            {selectedProductFilter !== 'ALL' && (
              <span className="text-purple-400 font-medium">
                • {productFilterTabs.find((t) => t.id === selectedProductFilter)?.label || selectedProductFilter}
              </span>
            )}
            <span className="text-gray-500 font-mono">({filteredOrders.length})</span>
          </div>

          {(activeFilter !== 'All' || selectedProductFilter !== 'ALL') && (
            <button
              onClick={() => {
                setActiveFilter('All');
                setSelectedProductFilter('ALL');
              }}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#202028] hover:bg-[#282834] text-[11px] font-medium text-gray-300 border border-[#323240] transition-colors cursor-pointer active:scale-95"
            >
              <SlidersHorizontal className="w-3 h-3 text-gray-400" />
              <span>Reset all filters</span>
            </button>
          )}
        </div>

        {/* Product Filter Selector Bar - Only dropdown button populated strictly from sheet */}
        <div className="mt-2 relative" ref={productMenuRef}>
          <div className="flex items-center gap-2">
            {/* Dropdown Toggle Button - Only this remains */}
            <button
              type="button"
              id="product-filter-toggle-btn"
              onClick={() => setIsProductMenuOpen(!isProductMenuOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1a1b26] hover:bg-[#222436] border border-[#2d2f44] text-xs text-gray-200 transition-colors cursor-pointer active:scale-95 shadow-sm"
              title="শিটের প্রোডাক্ট তালিকা"
            >
              <Package className="w-4 h-4 text-purple-400 shrink-0" />
              <span className="font-semibold text-white truncate max-w-[200px] sm:max-w-xs">
                {productFilterTabs.find((t) => t.id === selectedProductFilter)?.label ||
                  (selectedProductFilter === 'ALL' ? 'All Products' : selectedProductFilter)}
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#27293d] text-purple-300 font-mono font-bold shrink-0">
                {productCounts[selectedProductFilter] ?? orders.length}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 shrink-0 ${
                  isProductMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Reset link if a product is selected */}
            {selectedProductFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => setSelectedProductFilter('ALL')}
                className="flex items-center gap-1 text-[11px] font-semibold text-purple-400 hover:text-purple-300 px-2 py-1 rounded-lg bg-purple-950/40 hover:bg-purple-950/70 border border-purple-800/50 cursor-pointer active:scale-95"
                title="সকল প্রোডাক্টে ফিরে যান"
              >
                <span>সব প্রোডাক্ট</span>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Expandable Product Dropdown Menu */}
          {isProductMenuOpen && (
            <div className="absolute left-0 top-full mt-1.5 z-40 w-72 sm:w-80 bg-[#171722] border border-[#2e3046] rounded-xl p-2 shadow-2xl animate-fadeIn">
              <div className="text-[11px] text-gray-400 font-medium px-2 py-1 mb-1 flex items-center justify-between border-b border-[#252738]">
                <span>শিটের প্রোডাক্ট তালিকা:</span>
                <button
                  type="button"
                  onClick={() => setIsProductMenuOpen(false)}
                  className="text-gray-400 hover:text-white p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                {productFilterTabs.map((tab) => {
                  const isSelected = selectedProductFilter === tab.id;
                  const count = productCounts[tab.id] ?? 0;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setSelectedProductFilter(tab.id);
                        setIsProductMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-medium text-left transition-all cursor-pointer active:scale-98 ${
                        isSelected
                          ? 'bg-purple-900/60 text-white border border-purple-500 shadow-sm font-semibold'
                          : 'bg-[#1e1f2c] text-gray-300 hover:bg-[#27283a] hover:text-white border border-transparent'
                      }`}
                    >
                      <span className="truncate">{tab.label}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono shrink-0 ${
                          isSelected ? 'bg-purple-700 text-white font-bold' : 'bg-[#2b2c3d] text-gray-400'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Top Status Tabs with Counter Badges - Swipeable on mobile */}
        <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
          {(['All', 'Processing', 'On hold', 'Completed', 'Cancelled', 'Pending'] as const).map((filter) => {
            const isActive = activeFilter === filter;
            const count = filterCounts[filter] || 0;
            const showCount = filter !== 'All' && filter !== 'Completed';

            return (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-2.5 py-1 sm:px-3 sm:py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95 ${
                  isActive
                    ? 'bg-[#152e35] text-[#7de3e0] border border-[#235863] shadow-sm font-semibold'
                    : 'bg-[#1c1c24] text-gray-400 hover:text-gray-200 border border-[#272733]'
                }`}
              >
                <span>{filter}</span>
                {showCount && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isActive ? 'bg-[#235863]/60 text-[#7de3e0] font-bold' : 'bg-[#252533] text-gray-400'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Orders List: Divided by Date (Today, Yesterday, Date) */}
      <div className="space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="py-12 sm:py-16 px-4 text-center bg-[#141418] rounded-xl border border-[#23242c]">
            <Package className="w-10 h-10 text-gray-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-300">কোনো অর্ডার পাওয়া যায়নি</p>
            <p className="text-xs text-gray-500 mt-1">
              {selectedProductFilter !== 'ALL'
                ? `"${productFilterTabs.find((t) => t.id === selectedProductFilter)?.label || selectedProductFilter}" এর কোনো অর্ডার নেই`
                : searchQuery
                ? 'ভিন্ন শব্দ দিয়ে খুঁজুন'
                : 'নতুন অর্ডার তৈরি করতে উপরে চাপুন'}
            </p>
            {selectedProductFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => setSelectedProductFilter('ALL')}
                className="mt-3 px-3 py-1.5 rounded-lg bg-purple-900/40 hover:bg-purple-900/60 border border-purple-700/50 text-purple-200 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Package className="w-3.5 h-3.5" />
                <span>সকল প্রোডাক্টের অর্ডার দেখুন</span>
              </button>
            )}
          </div>
        ) : (
          groupItemsByDate(filteredOrders, (o) => o.date || (o as any).createdAt).map((group) => (
            <div key={group.key} className="space-y-2 sm:space-y-2.5 pt-1.5 first:pt-0">
              {/* Date Header Divider */}
              <div className="flex items-center gap-2 px-1 py-1">
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${
                    group.isToday
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                      : group.isYesterday
                      ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                      : 'bg-[#181a24] border-[#252838] text-gray-300'
                  }`}
                >
                  <Calendar
                    className={`w-3.5 h-3.5 shrink-0 ${
                      group.isToday
                        ? 'text-emerald-400'
                        : group.isYesterday
                        ? 'text-amber-400'
                        : 'text-purple-400'
                    }`}
                  />
                  <span>{group.title}</span>
                  {group.subtitle && group.subtitle !== group.title && (
                    <span className="text-[10px] opacity-75 font-mono">• {group.subtitle}</span>
                  )}
                </div>
                <div className="flex-1 h-px bg-[#232636]" />
                <span className="text-[10px] text-gray-400 font-mono shrink-0 bg-[#161722] px-2 py-0.5 rounded border border-[#232636]">
                  {group.items.length} টি অর্ডার
                </span>
              </div>

              {/* Order Cards for this Date Group */}
              <div className="space-y-2 sm:space-y-2.5">
                {group.items.map((order, index) => {
                  const orderKey = getOrderKey(order, index);
                  const statusStyle = getStatusBadgeStyle(order.status);
                  const displayAmount = order.total || order.amount || 599;

                  return (
                    <div
                      key={orderKey}
                      onClick={() => onSelectOrder(order)}
                      className={`bg-[#141419] hover:bg-[#181822] active:bg-[#1c1c28] border border-[#232430] hover:border-[#383a4c] rounded-xl p-3 sm:px-4 sm:py-3 shadow-xs transition-all cursor-pointer select-none relative ${
                        activeDropdown?.orderKey === orderKey ? 'z-30' : 'z-0'
                      }`}
                    >
                      {/* Line 1: Name & Date (Left) | Edit Pen & Order Status Change Dropdown (Right) */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          {order.date && (
                            <span className="text-[10px] text-gray-500/70 font-mono block leading-none mb-0.5 select-none">
                              {order.date}
                            </span>
                          )}
                          <span className="font-bold text-gray-100 text-sm sm:text-base truncate block">
                            {order.customerName || 'নামবিহীন'}
                            {order.columnG && (
                              <span className="text-purple-300 font-mono ml-1.5 font-semibold">
                                ({order.columnG})
                              </span>
                            )}
                          </span>
                        </div>

                        {/* Actions on Right: Quick Edit Pen + Order Status Change Dropdown */}
                        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {/* Quick Edit Pen Button */}
                          <button
                            type="button"
                            onClick={(e) => openEditModal(e, order)}
                            className="p-1.5 rounded-lg bg-[#1e2230] hover:bg-[#282e42] active:scale-95 text-pink-400 hover:text-pink-300 border border-[#2b334a] transition-all flex items-center justify-center cursor-pointer"
                            title="অর্ডার এডিট করুন"
                          >
                            <Edit3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </button>

                          {/* Order Status Change Dropdown */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => toggleDropdown(e, orderKey, 'status')}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer active:scale-95 ${statusStyle.badge}`}
                              title="অর্ডার স্ট্যাটাস পরিবর্তন করুন"
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                              <span className="truncate max-w-[85px] sm:max-w-none">{statusStyle.label}</span>
                              <ChevronDown className="w-3 h-3 opacity-70 shrink-0" />
                            </button>

                            {/* Dropdown Menu for Status */}
                            {activeDropdown?.orderKey === orderKey && activeDropdown?.type === 'status' && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-full mt-1 w-44 max-h-56 overflow-y-auto bg-[#181822] border border-[#2f2f40] rounded-xl shadow-2xl py-1 z-50 animate-fadeIn"
                              >
                                <div className="px-3 py-1 text-[11px] text-gray-400 font-semibold border-b border-[#252535] sticky top-0 bg-[#181822] z-10">
                                  স্ট্যাটাস পরিবর্তন করুন
                                </div>
                                {availableStatuses.map((st) => (
                                  <button
                                    key={st}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onUpdateOrderStatus(order, st);
                                      setActiveDropdown(null);
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs text-gray-200 hover:bg-[#252535] flex items-center justify-between cursor-pointer"
                                  >
                                    <span>{st}</span>
                                    {order.status === st && (
                                      <Check className="w-3.5 h-3.5 text-[#7de3e0]" />
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Line 2: Column E Product Name (Left) | Price (Right) */}
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <div className="text-gray-300 text-xs sm:text-sm font-medium truncate flex-1 min-w-0 pr-2">
                          <span className="truncate block">
                            {order.product || 'প্রোডাক্ট নেই'}
                          </span>
                        </div>

                        <div className="shrink-0 flex items-center gap-1 font-mono font-bold text-emerald-400 text-sm sm:text-base tracking-tight">
                          <span>{displayAmount}.00 BDT</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Quick Edit Modal for Order Details (Columns F, C, B, D, N, H, I, J, M) */}
      {editingOrder && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={() => setEditingOrder(null)}
        >
          <div
            className="bg-[#14151e] border border-[#2c3044] rounded-2xl w-full max-w-lg shadow-2xl p-4 sm:p-6 space-y-4 my-auto max-h-[92vh] overflow-y-auto animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#232636] sticky -top-4 bg-[#14151e] z-10 -mt-1 pt-1">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <Edit3 className="w-4 h-4 sm:w-5 sm:h-5 text-pink-400" />
                  অর্ডার এডিট করুন (শিটে সেভ হবে)
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  অর্ডার #{editingOrder.id} • Row #{editingOrder.rowIndex || 2}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#202434] transition-colors cursor-pointer active:scale-95"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              {/* Customer Name (Col F) */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  গ্রাহকের নাম (Column F):
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="গ্রাহকের নাম লিখুন"
                  required
                  className="w-full bg-[#1b1e2c] border border-[#2f354e] rounded-lg px-3 py-2 text-base sm:text-sm text-white focus:outline-none focus:border-pink-500"
                />
              </div>

              {/* Customer Phone (Col C) */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  ফোন নম্বর (Column C):
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  required
                  className="w-full bg-[#1b1e2c] border border-[#2f354e] rounded-lg px-3 py-2 text-base sm:text-sm text-white focus:outline-none focus:border-pink-500 font-mono"
                />
              </div>

              {/* Customer Address (Col B) */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  ডেলিভারি ঠিকানা (Column B):
                </label>
                <textarea
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  placeholder="সম্পূর্ণ ডেলিভারি ঠিকানা..."
                  rows={2}
                  required
                  className="w-full bg-[#1b1e2c] border border-[#2f354e] rounded-lg px-3 py-2 text-base sm:text-sm text-white focus:outline-none focus:border-pink-500 resize-none"
                />
              </div>

              {/* Grid: Price (Col D) & Quantity (Col N) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    মোট মূল্য / COD (Col D):
                  </label>
                  <input
                    type="number"
                    value={editPrice}
                    onChange={(e) => setEditPrice(Number(e.target.value))}
                    min={0}
                    className="w-full bg-[#1b1e2c] border border-[#2f354e] rounded-lg px-3 py-2 text-base sm:text-sm text-white focus:outline-none focus:border-pink-500 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    অর্ডার পরিমাণ (Col N):
                  </label>
                  <input
                    type="number"
                    value={editQuantity}
                    onChange={(e) => setEditQuantity(Math.max(1, Number(e.target.value)))}
                    min={1}
                    className="w-full bg-[#1b1e2c] border border-[#2f354e] rounded-lg px-3 py-2 text-base sm:text-sm text-white focus:outline-none focus:border-pink-500 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Grid: Variant (Col H) & Source (Col I) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    ভ্যারিয়েন্ট (Column H):
                  </label>
                  <select
                    value={editVariant}
                    onChange={(e) => setEditVariant(e.target.value)}
                    className="w-full bg-[#1b1e2c] border border-[#2f354e] rounded-lg px-3 py-2 text-base sm:text-sm text-white focus:outline-none focus:border-pink-500"
                  >
                    {availableVariants.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    অর্ডার সোর্স (Column I):
                  </label>
                  <select
                    value={editSource}
                    onChange={(e) => setEditSource(e.target.value)}
                    className="w-full bg-[#1b1e2c] border border-[#2f354e] rounded-lg px-3 py-2 text-base sm:text-sm text-white focus:outline-none focus:border-pink-500"
                  >
                    {availableSources.map((src) => (
                      <option key={src} value={src}>
                        {src}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status (Col J) */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  অর্ডার স্ট্যাটাস (Column J):
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as OrderStatus)}
                  className="w-full bg-[#1b1e2c] border border-[#2f354e] rounded-lg px-3 py-2 text-base sm:text-sm text-white focus:outline-none focus:border-pink-500 font-semibold"
                >
                  {availableStatuses.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-between gap-2 pt-3 border-t border-[#232636]">
                {onDeleteOrder && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('আপনি কি এই অর্ডারটি ডিলিট করতে চান?')) {
                        onDeleteOrder(editingOrder);
                        setEditingOrder(null);
                      }
                    }}
                    className="px-2.5 sm:px-3 py-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden xs:inline">ডিলিট</span>
                  </button>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setEditingOrder(null)}
                    className="px-3.5 sm:px-4 py-2 rounded-lg bg-[#202434] hover:bg-[#2a3044] text-gray-300 text-xs font-semibold transition-colors cursor-pointer active:scale-95"
                  >
                    বাতিল
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    className="px-4 sm:px-5 py-2 rounded-lg bg-gradient-to-r from-pink-600 via-rose-600 to-pink-500 hover:from-pink-500 hover:to-rose-500 text-white text-xs font-bold shadow-lg shadow-pink-600/30 flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
                  >
                    {isSavingEdit ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>সেভ হচ্ছে...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>শিটে সেভ করুন</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
