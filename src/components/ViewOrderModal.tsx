import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Printer,
  Copy,
  Check,
  Phone,
  MapPin,
  Calendar,
  Trash2,
  Edit3,
  User,
  Loader2,
  Package,
  Layers,
  Globe,
  Truck,
  Plus,
  Minus,
  ImageIcon,
  AlertCircle,
} from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { getOrderImage } from '../utils/orderImage';
import { getStoredListProductNames, getStoredSheetSources, DEFAULT_SHEET_SOURCES } from '../services/sheets';

interface ViewOrderModalProps {
  order: Order | null;
  onClose: () => void;
  onUpdateStatus: (order: Order, newStatus: OrderStatus) => void;
  onSendToSteadfast?: (order: Order) => void;
  onToggleSteadfast?: (order: Order, action: 'No Sellect' | 'send to steadfast') => Promise<boolean> | void;
  onUpdateVariant?: (order: Order, newVariant: string) => void;
  onUpdateSource?: (order: Order, newSource: string) => void;
  onUpdateQuantity?: (order: Order, newQuantity: number) => void;
  onUpdateImage?: (order: Order, newImage: string) => void;
  onDeleteOrder?: (order: Order) => void;
  onUpdateCustomerDetails?: (
    order: Order,
    details: {
      customerName: string;
      customerPhone: string;
      customerAddress: string;
      amount?: number;
      price?: number;
      quantity?: number;
    }
  ) => Promise<boolean> | void;
  listProductNames?: string[];
  sheetSources?: string[];
}

const AVAILABLE_SOURCES = DEFAULT_SHEET_SOURCES;

const ORDER_STATUS_LIST: OrderStatus[] = [
  'Procecing',
  'Complete',
  'Hold',
  'Cancel',
  'Pending',
  'In Review',
  'Partial',
  'Delivered',
];

export const ViewOrderModal: React.FC<ViewOrderModalProps> = ({
  order,
  onClose,
  onUpdateStatus,
  onSendToSteadfast,
  onToggleSteadfast,
  onUpdateVariant,
  onUpdateSource,
  onUpdateQuantity,
  onUpdateImage,
  onDeleteOrder,
  onUpdateCustomerDetails,
  listProductNames,
  sheetSources,
}) => {
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // 8 sources strictly read from Google Sheet
  const availableSources = useMemo(() => {
    return sheetSources && sheetSources.length >= 8 ? sheetSources.slice(0, 8) : getStoredSheetSources();
  }, [sheetSources]);

  // Strictly the 6 products from List Sheet Column B + No Sellect
  const availableVariants = useMemo(() => {
    const list =
      listProductNames && listProductNames.length >= 6
        ? listProductNames.slice(0, 6)
        : getStoredListProductNames();

    return ['No Sellect', ...list];
  }, [listProductNames]);

  // Check if a variant button is currently active
  const isVariantActive = (currentVariant: string | undefined, variantOption: string) => {
    if (variantOption === 'No Sellect') {
      const v = (currentVariant || '').trim().toLowerCase();
      return !v || v === 'no sellect' || v === 'nosellect' || v === 'noselect';
    }
    const curNorm = (currentVariant || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const optNorm = variantOption.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (curNorm === optNorm) return true;
    if (curNorm.includes(optNorm) || optNorm.includes(curNorm)) return true;

    if (optNorm.includes('599') && optNorm.includes('rose') && curNorm.includes('rose') && !curNorm.includes('990') && !curNorm.includes('1350')) return true;
    if (optNorm.includes('599') && optNorm.includes('watch') && (curNorm.includes('watch') || curNorm.includes('golden'))) return true;
    if (optNorm.includes('990') && curNorm.includes('990')) return true;
    if (optNorm.includes('1350') && curNorm.includes('1350')) return true;
    if ((optNorm.includes('doll') || optNorm.includes('toy')) && (curNorm.includes('doll') || curNorm.includes('toy'))) return true;
    if ((optNorm.includes('disp') || optNorm.includes('cutt')) && (curNorm.includes('disp') || curNorm.includes('cutt'))) return true;

    return false;
  };

  // Customer & Price Editing State
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [name, setName] = useState(order?.customerName || '');
  const [phone, setPhone] = useState(order?.customerPhone || '');
  const [address, setAddress] = useState(order?.customerAddress || '');
  const [price, setPrice] = useState<number | string>(order?.total || order?.amount || 599);
  const [editQuantity, setEditQuantity] = useState<number>(order?.quantity || 1);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [customerValidationError, setCustomerValidationError] = useState<string | null>(null);

  // Image editing state
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [customImageUrl, setCustomImageUrl] = useState(order?.image || '');

  useEffect(() => {
    if (order) {
      setName(order.customerName || '');
      setPhone(order.customerPhone || '');
      setAddress(order.customerAddress || '');
      setPrice(order.total || order.amount || 599);
      setEditQuantity(order.quantity || 1);
      setCustomImageUrl(order.image || '');
      setCustomerValidationError(null);
      setIsEditingCustomer(false);
      setIsEditingImage(false);
    }
  }, [order?.id, order?.customerName, order?.customerPhone, order?.customerAddress, order?.total, order?.amount, order?.quantity, order?.image]);

  if (!order) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDelete = () => {
    if (onDeleteOrder) {
      onDeleteOrder(order);
      onClose();
    }
  };

  const handleCancelCustomerEdit = () => {
    setName(order.customerName || '');
    setPhone(order.customerPhone || '');
    setAddress(order.customerAddress || '');
    setPrice(order.total || order.amount || 599);
    setEditQuantity(order.quantity || 1);
    setCustomerValidationError(null);
    setIsEditingCustomer(false);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setCustomerValidationError('গ্রাহকের নাম লিখুন');
      return;
    }
    if (!phone.trim()) {
      setCustomerValidationError('ফোন নম্বর লিখুন');
      return;
    }
    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 0) {
      setCustomerValidationError('সঠিক অর্ডারের মূল্য (Price) লিখুন');
      return;
    }
    setCustomerValidationError(null);
    const numQty = Math.max(1, Number(editQuantity) || 1);

    setIsSavingCustomer(true);
    try {
      if (onUpdateCustomerDetails) {
        await onUpdateCustomerDetails(order, {
          customerName: name.trim(),
          customerPhone: phone.trim(),
          customerAddress: address.trim(),
          amount: numPrice,
          price: numPrice,
          quantity: numQty,
        });
      }
      setIsEditingCustomer(false);
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const handleSaveImage = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateImage && customImageUrl.trim()) {
      onUpdateImage(order, customImageUrl.trim());
    }
    setIsEditingImage(false);
  };

  const isSteadfastSent =
    /send to steadfast/i.test(order.steadfastStatus || '') ||
    order.steadfastStatus === 'Sent to Steadfast';

  const orderImage = getOrderImage(order);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-[#121520] border border-[#22293d] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#1c2232] flex items-center justify-between bg-[#0e111a]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-pink-500" />
            <h3 className="text-sm sm:text-base font-bold text-white font-mono">
              ইনভয়েস {order.id.startsWith('#') ? order.id : `#${order.id}`}
            </h3>
            {order.rowIndex && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1c2232] text-gray-400 font-mono border border-[#293247]">
                Row #{order.rowIndex}
              </span>
            )}
            <span className="text-[11px] px-2 py-0.5 rounded bg-pink-500/15 text-pink-400 border border-pink-500/30">
              {order.source || 'Website'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              title="প্রিন্ট ইনভয়েস"
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#1c2232] transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#1c2232] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5">
          {/* Product Picture & Info Card */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[#161a26] border border-[#232b3e]">
            <div className="flex items-start gap-3.5">
              {/* Product Picture */}
              <div className="relative group shrink-0">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border border-[#2d374f] bg-[#0c0e15] shadow-md">
                  <img
                    src={orderImage}
                    alt={order.product || 'Product'}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&auto=format&fit=crop&q=80';
                    }}
                  />
                </div>
                {onUpdateImage && (
                  <button
                    type="button"
                    onClick={() => setIsEditingImage(!isEditingImage)}
                    className="absolute -bottom-1.5 -right-1.5 p-1 rounded-full bg-[#1e2536] hover:bg-pink-600 text-gray-300 hover:text-white border border-[#303a52] text-[10px] shadow-sm transition-colors cursor-pointer"
                    title="ছবি পরিবর্তন করুন"
                  >
                    <ImageIcon className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Product details & Price */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-pink-400">পণ্য বিবরণ (Col E)</span>
                    <h4 className="text-sm sm:text-base font-bold text-white tracking-tight leading-snug">
                      {order.product || 'Golden Watch Combo'}
                    </h4>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-gray-400 font-medium block">মোট মূল্য (Col D)</span>
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="font-mono font-bold text-base sm:text-lg text-emerald-400">
                        ৳{order.total || order.amount || 599}
                      </span>
                      {!isEditingCustomer && (
                        <button
                          type="button"
                          onClick={() => setIsEditingCustomer(true)}
                          className="p-1 rounded text-gray-400 hover:text-pink-400 hover:bg-[#1f2536] transition-colors cursor-pointer"
                          title="মূল্য ও তথ্য এডিট করুন"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stepper for Quantity (Col N) inside modal */}
                <div className="mt-3 pt-2.5 border-t border-[#202738] flex items-center justify-between">
                  <span className="text-xs text-gray-300 font-semibold flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-pink-400" />
                    অর্ডার পরিমাণ (Column N):
                  </span>
                  <div className="flex items-center gap-2 bg-[#0e111a] border border-[#273046] rounded-lg px-2 py-1">
                    <button
                      type="button"
                      onClick={() => {
                        const current = order.quantity || 1;
                        if (current > 1 && onUpdateQuantity) {
                          onUpdateQuantity(order, current - 1);
                        }
                      }}
                      disabled={(order.quantity || 1) <= 1}
                      className="w-5 h-5 rounded flex items-center justify-center bg-[#1d2334] hover:bg-[#2b354d] text-gray-200 disabled:opacity-30 text-xs font-bold transition-colors cursor-pointer"
                      title="পরিমাণ কমান"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-mono font-bold text-xs text-emerald-300 min-w-[28px] text-center">
                      {order.quantity || 1} টি
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const current = order.quantity || 1;
                        if (onUpdateQuantity) {
                          onUpdateQuantity(order, current + 1);
                        }
                      }}
                      className="w-5 h-5 rounded flex items-center justify-center bg-[#1d2334] hover:bg-[#2b354d] text-gray-200 text-xs font-bold transition-colors cursor-pointer"
                      title="পরিমাণ বাড়ান"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Image URL editor accordion */}
            {isEditingImage && (
              <form onSubmit={handleSaveImage} className="mt-3 pt-3 border-t border-[#222a3d] flex gap-2">
                <input
                  type="url"
                  value={customImageUrl}
                  onChange={(e) => setCustomImageUrl(e.target.value)}
                  placeholder="https://... ছবির সরাসরি URL দিন"
                  className="flex-1 bg-[#0c0e15] border border-[#2a3449] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:border-pink-500"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-pink-600 hover:bg-pink-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  সেভ
                </button>
              </form>
            )}
          </div>

          {/* TRANSFERRED CONTROL 1: Variant Selector (Column H) */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[#161a26] border border-[#232b3e] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-pink-400" />
                ভ্যারিয়েন্ট নির্বাচন (Column H):
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#1e2536] text-pink-300 border border-pink-500/30">
                {order.variant || 'No Sellect'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
              {availableVariants.map((v) => {
                const isSelected = isVariantActive(order.variant, v);
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      if (onUpdateVariant) {
                        onUpdateVariant(order, v);
                      }
                    }}
                    className={`px-2 py-1.5 rounded-lg text-[11px] font-medium border text-left truncate transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-pink-600/20 text-pink-300 border-pink-500/60 shadow-xs font-bold'
                        : 'bg-[#0f121b] text-gray-400 border-[#232a3d] hover:bg-[#1a1f30] hover:text-gray-200'
                    }`}
                    title={v}
                  >
                    <span className="truncate">{v}</span>
                    {isSelected && <Check className="w-3 h-3 text-pink-400 shrink-0 ml-1" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* TRANSFERRED CONTROL 2: Source Selector (Column I) */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[#161a26] border border-[#232b3e] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-blue-400" />
                অর্ডার সোর্স নির্বাচন (Column I):
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#1e2536] text-blue-300 border border-blue-500/30">
                {order.source || 'Website'}
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 pt-1">
              {availableSources.map((src) => {
                const isSelected = (order.source || 'Website') === src;
                return (
                  <button
                    key={src}
                    type="button"
                    onClick={() => {
                      if (onUpdateSource) {
                        onUpdateSource(order, src);
                      }
                    }}
                    className={`px-2 py-1.5 rounded-lg text-[11px] font-medium border text-center truncate transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600/20 text-blue-300 border-blue-500/60 shadow-xs'
                        : 'bg-[#0f121b] text-gray-400 border-[#232a3d] hover:bg-[#1a1f30] hover:text-gray-200'
                    }`}
                    title={src}
                  >
                    {src}
                  </button>
                );
              })}
            </div>
          </div>

          {/* TRANSFERRED CONTROL 3: Steadfast Action & Courier Tracking (Columns M, K, L) */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-purple-950/20 border border-purple-800/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-purple-400" />
                Steadfast কুরিয়ার ও ট্র্যাকিং (Columns M, K, L)
              </span>
              <span className="text-[11px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-mono border border-purple-500/30">
                L: {order.courierStatus || (isSteadfastSent ? 'in_review' : 'pending')}
              </span>
            </div>

            {/* Steadfast Status (Column M) - Entry only via Steadfast tab selection */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="text-xs text-gray-300">
                <span className="text-gray-400">কলাম M: </span>
                <strong className={isSteadfastSent ? 'text-emerald-400' : 'text-gray-400'}>
                  {order.steadfastStatus || 'No Select'}
                </strong>
              </div>
              <span className="text-[11px] text-gray-400 font-medium">
                {isSteadfastSent ? '✅ স্টেডফাস্টে প্রেরিত' : 'Steadfast ট্যাব থেকে পাঠান'}
              </span>
            </div>

            {/* Tracking Code (Column K) */}
            {order.trackingCode ? (
              <div className="flex items-center justify-between bg-[#111420] p-2.5 rounded-lg border border-purple-800/30">
                <span className="text-xs font-mono text-gray-200">
                  K: ট্র্যাকিং কোড: <strong className="text-cyan-300">{order.trackingCode}</strong>
                </span>
                <button
                  onClick={() => handleCopy(order.trackingCode!)}
                  className="p-1 text-gray-400 hover:text-white cursor-pointer"
                  title="কপি করুন"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            ) : isSteadfastSent ? (
              <div className="p-2 rounded-lg bg-[#111420] text-cyan-300 text-xs font-mono flex items-center gap-2 border border-cyan-900/30">
                <Truck className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                <span>K: গুগল শিট থেকে অটো-ট্র্যাকিং কোড আসার অপেক্ষায়...</span>
              </div>
            ) : (
              <div className="text-[11px] text-gray-500 italic">
                K: কোনো ট্র্যাকিং কোড নেই (Steadfast ট্যাব থেকে পাঠালে অটোমেটিক আসবে)
              </div>
            )}
          </div>

          {/* Customer Card: View & Edit Customer Name, Phone, Address, Price */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[#161a26] border border-[#232b3e] space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-[#202738]/60">
              <span className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-pink-400" />
                গ্রাহকের তথ্য ও মূল্য (Columns F, C, B, D)
              </span>
              {!isEditingCustomer ? (
                <button
                  type="button"
                  onClick={() => setIsEditingCustomer(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 text-xs font-semibold border border-pink-500/30 transition-all cursor-pointer"
                  title="নাম, ফোন, ঠিকানা ও মূল্য এডিট করুন"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>এডিট করুন</span>
                </button>
              ) : (
                <span className="text-[11px] text-pink-400 font-medium">তথ্য ও মূল্য সংশোধন মুড</span>
              )}
            </div>

            {isEditingCustomer ? (
              /* Customer & Price Edit Form */
              <form onSubmit={handleSaveCustomer} className="space-y-3 pt-1">
                {customerValidationError && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs animate-shake">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{customerValidationError}</span>
                  </div>
                )}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                    গ্রাহকের নাম (Column F):
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="গ্রাহকের নাম লিখুন"
                      className="w-full bg-[#0d1017] border border-[#263147] focus:border-pink-500 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 outline-none transition-colors"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                    মোবাইল নম্বর (Column C):
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-2.5" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="01XXXXXXXXX"
                      className="w-full bg-[#0d1017] border border-[#263147] focus:border-pink-500 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 outline-none font-mono transition-colors"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                    ঠিকানা (Column B):
                  </label>
                  <div className="relative">
                    <MapPin className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-2.5" />
                    <textarea
                      rows={2}
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="সম্পূর্ণ ঠিকানা লিখুন"
                      className="w-full bg-[#0d1017] border border-[#263147] focus:border-pink-500 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 outline-none resize-none transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                      মূল্য / COD (Col D):
                    </label>
                    <div className="relative">
                      <span className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-2 font-bold text-xs">৳</span>
                      <input
                        type="number"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="599"
                        min="0"
                        step="any"
                        className="w-full bg-[#0d1017] border border-[#263147] focus:border-pink-500 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 outline-none font-mono transition-colors"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                      পরিমাণ (Col N):
                    </label>
                    <div className="relative">
                      <Package className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-2" />
                      <input
                        type="number"
                        value={editQuantity}
                        onChange={(e) => setEditQuantity(Math.max(1, Number(e.target.value)))}
                        placeholder="1"
                        min="1"
                        className="w-full bg-[#0d1017] border border-[#263147] focus:border-pink-500 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 outline-none font-mono font-bold transition-colors"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={isSavingCustomer}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold shadow-md shadow-pink-900/50 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSavingCustomer ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>{isSavingCustomer ? 'আপডেট হচ্ছে...' : 'আপডেট করুন'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelCustomerEdit}
                    disabled={isSavingCustomer}
                    className="py-1.5 px-3 rounded-lg bg-[#1e2536] hover:bg-[#28324a] text-gray-300 text-xs font-medium transition-colors cursor-pointer"
                  >
                    বাতিল
                  </button>
                </div>
              </form>
            ) : (
              /* Normal Customer View */
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-gray-100 text-sm">{order.customerName || 'গ্রাহকের নাম নেই'}</h4>
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                      <span>{order.customerAddress || 'ঢাকা'}</span>
                    </p>
                  </div>

                  <a
                    href={`tel:${order.customerPhone}`}
                    className="flex items-center gap-1.5 text-xs text-pink-400 hover:underline font-mono bg-pink-500/10 px-2.5 py-1.5 rounded-lg border border-pink-500/20 shrink-0 active:scale-95"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>{order.customerPhone || 'ফোন নম্বর নেই'}</span>
                  </a>
                </div>

                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="text-gray-400 font-medium">অর্ডারের মূল্য (Col D):</span>
                  <span className="font-mono font-bold text-emerald-400">
                    ৳{order.total || order.amount || 599}.00 BDT
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-[#202738] text-[11px] text-gray-400">
              <span className="flex items-center gap-1 font-mono">
                <Calendar className="w-3 h-3 text-gray-500" />
                তারিখ: {order.date || '08/09/26'}
              </span>
              {order.rowIndex && (
                <span className="text-gray-500 font-mono">
                  গুগল শিট সারি: #{order.rowIndex}
                </span>
              )}
            </div>
          </div>

          {/* TRANSFERRED CONTROL 4: Order Status Changer (Column J) */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[#161a26] border border-[#232b3e] space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-gray-300">
                J: অর্ডার স্ট্যাটাস আপডেট করুন:
              </label>
              <span className="text-[11px] font-bold text-pink-400">
                বর্তমান: {order.status}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {ORDER_STATUS_LIST.map((st) => {
                const isActive = order.status.toLowerCase() === st.toLowerCase();
                return (
                  <button
                    key={st}
                    onClick={() => onUpdateStatus(order, st)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center justify-between ${
                      isActive
                        ? 'bg-pink-600 text-white border-pink-500 shadow-lg shadow-pink-600/30'
                        : 'bg-[#0f121b] text-gray-400 border-[#262f44] hover:bg-[#1c2234] hover:text-gray-200'
                    }`}
                  >
                    <span>{st}</span>
                    {isActive && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                );
              })}
            </div>
          </div>

          {order.notes && (
            <div className="p-3 bg-[#161a26] border border-[#232b3e] rounded-xl text-xs text-gray-300">
              <span className="text-gray-500 font-semibold block mb-1">নোট:</span>
              {order.notes}
            </div>
          )}
        </div>

        {/* Footer with Delete and Close */}
        <div className="p-3.5 sm:p-4 border-t border-[#1c2232] bg-[#0e111a] flex items-center justify-between gap-3">
          {onDeleteOrder && (
            <div>
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-rose-400 font-semibold hidden sm:inline">নিশ্চিত?</span>
                  <button
                    onClick={handleDelete}
                    className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all cursor-pointer"
                  >
                    হ্যাঁ, ডিলিট করুন
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="px-2.5 py-1.5 rounded-xl bg-[#1d2334] text-gray-300 text-xs font-medium cursor-pointer"
                  >
                    না
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 border border-rose-900/40 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>ডিলিট</span>
                </button>
              )}
            </div>
          )}

          <button
            onClick={onClose}
            className="ml-auto px-4 py-2 rounded-xl bg-[#1d2334] text-gray-200 text-xs font-semibold hover:bg-[#283149] transition-colors cursor-pointer"
          >
            বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
};
