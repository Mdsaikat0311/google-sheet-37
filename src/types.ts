export type OrderStatus = 
  | 'Delivered'
  | 'Complete'
  | 'Processing'
  | 'Procecing'
  | 'Pending'
  | 'Hold'
  | 'Cancelled'
  | 'Cancel'
  | 'In Review'
  | 'in_review'
  | 'Partial Delivered'
  | 'partial_delivered'
  | 'Partial'
  | 'Select Action'
  | (string & {});

export type CourierStatus = 
  | 'delivered'
  | 'pending'
  | 'partial_delivered'
  | 'cancelled'
  | 'in_review'
  | 'processing';

export interface Order {
  id: string; // Invoice ID / Order # (e.g. INV-1001, #1025)
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  product: string; // Column E: e.g. "Golden Watch Combo"
  columnG?: string; // Sheet2 Column G: e.g. "R", "PB"
  variant?: string; // Column H: e.g. "No Sellect", "Rose 599tk", "Doll and toys"
  source: string; // Column I: e.g. "Website", "Whatsapp", "Call Direct"
  amount: number; // Column D: Total COD amount in BDT
  total: number; // Alias for amount
  quantity: number;
  status: OrderStatus;
  trackingCode?: string; // e.g. 290917655
  courierStatus?: CourierStatus | string;
  steadfastStatus?: string; // 'send to steadfast' or 'Sent (ID: 8821)'
  date: string;
  rawDate?: string; // Exact Column A text from Google Sheet (e.g. "9/9/2026 19:50:48")
  notes?: string;
  image?: string; // Optional custom or sheet-specified product image URL
  rowIndex?: number; // 1-based row in Google Sheet
  totalSpend?: number;
  items?: OrderItem[];
  returnApproved?: boolean;
  returnRestocked?: boolean;
  returnApprovedDate?: string;
}

export interface Sheet3ProductEntry {
  id: string;
  rowIndex: number;
  date: string;
  productName: string;
  source: string;
  stockIn: number | '';
  stockOut: number | '';
  currentStock: number;
  currentPrice: number | '';
}

export interface StockMovementLog {
  id: string;
  productId: string;
  productName: string;
  change: number; // e.g. +1, -1, +10
  newStock: number;
  reason: 'return_approved' | 'order_placed' | 'manual_update' | 'restock' | 'damage';
  orderId?: string;
  date: string;
  timestamp: number;
}

export interface CustomerSummary {
  name: string;
  phone: string;
  address: string;
  totalOrders: number;
  avgOrderValue: number;
  lastOrder: string;
  status: 'Active' | 'Inactive';
}

export interface DailyTrendItem {
  day: string; // 'শনি', 'রবি', 'সোম', etc.
  orders: number;
  delivered: number;
}

export interface SalesSourceItem {
  source: string;
  percentage: number;
  count: number;
  color: string;
}

export interface Product {
  id: string; // SKU or row id
  name: string;
  category: string;
  regularPrice: number;
  salePrice?: number;
  stock: number;
  status: 'publish' | 'draft' | 'out_of_stock';
  description: string;
  image: string;
  featured?: boolean;
  rowIndex: number; // 1-based index in the sheet for pinpoint updates
}

export interface OrderItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  subtotal: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface ProductReportSource {
  source: string; // e.g. "Website (50.0%)", "Messenger (12.5%)"
  sourceName: string; // e.g. "Website", "Messenger"
  sharePercent: string; // e.g. "50.0%"
  lead: number;
  confirm: number;
  confirmRate: string;
  delivery: number;
  deliveryRate: string;
  pending: number;
  pendingRate: string;
  partial: number;
  partialRate: string;
  quantity: number;
  cancel: number;
  cancelRate: string;
}

export interface Sheet1ProductReport {
  id: string;
  productName: string; // e.g. "Rose 599tk", "Watch 599tk", "Doll and toys"
  rawHeader: string;
  overall: {
    lead: number;
    confirm: number;
    confirmRate: string;
    delivery: number;
    deliveryRate: string;
    pending: number;
    pendingRate: string;
    partial: number;
    partialRate: string;
    quantity: number;
    cancel: number;
    cancelRate: string;
  };
  sources: ProductReportSource[];
}

export interface SheetMeta {
  spreadsheetId: string;
  title: string;
  productsSheetTitle: string;
  ordersSheetTitle: string;
}

export interface Sheet4ProfitRow {
  id: string;
  rowIndex: number;
  date: string; // e.g. "2026-09-24"
  product: string; // Col B
  source: string; // Col C

  // Status metrics
  inReview: string; // Col D
  pending: string; // Col E
  partialDelivery: string; // Col F
  delivery: string; // Col G
  cancel: string; // Col H
  cancelDeliveryCharge: string; // Col I

  // Part 1: Live Profit & Costs (Cols J, K, L, M, N, O, P, Q, R, S, T)
  cod: string; // Col J
  deliveryCharge: string; // Col K
  wCod: number; // Col L
  cod1Percent: number; // Col M
  adsCostUSD: string | number; // Col N
  dollarRate: string | number; // Col O
  deliveryComplete: string; // Col P
  adsCostTK: number; // Col Q
  cpr: number; // Col R
  quantity: number; // Col S
  liveProfit: string; // Col T (e.g. "1188 (100.0%)")
  liveProfitAmount: number; // Extracted numeric value
  liveProfitRate: string; // Extracted percentage string

  // Part 2: Idea / Demo Profit & Calculation (Cols V, W, X, Y, Z, AA, AB, AC)
  cancelPercent: string; // Col V (e.g. "20%")
  cancelPercentValue: number; // e.g. 0.2
  ideaDeliveryCharge: number; // Col W
  ideaDAmount: number; // Col X
  wDeliveryAmount: number; // Col Y
  ideaCod1Percent: number; // Col Z
  perCharge: string | number; // Col AA
  ideaProfit: string; // Col AB
  ideaProfitAmount: number; // Extracted numeric value
  productCosting: string | number; // Col AC
}
