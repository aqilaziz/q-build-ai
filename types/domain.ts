export type ProductSearchResult = {
  id: string;
  name: string;
  category: string;
  brand: string | null;
  description: string;
  unit: string;
  price: number;
  stock_status: string;
  coverage_note: string | null;
  similarity: number | null;
  reason: string;
};

export type QuotationItemInput = {
  productId?: string | null;
  name: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  reason?: string | null;
};

export type SaveQuotationInput = {
  title: string;
  summary: string;
  category?: string | null;
  areaM2?: number | null;
  projectId?: string | null;
  subtotal: number;
  installmentMonths?: number | null;
  installmentAmount?: number | null;
  items: QuotationItemInput[];
};

export type SavedQuotation = {
  id: string;
  title: string;
  summary: string;
  subtotal: number;
  installment_months: number | null;
  installment_amount: number | null;
  created_at: string;
};
