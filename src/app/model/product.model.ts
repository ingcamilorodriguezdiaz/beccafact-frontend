export type TaxType = 'IVA' | 'EXEMPT' | 'EXCLUDED' | 'CONSUMPTION';

export type ProductStatus = 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';

export interface Product {
  id: string;
  companyId: string;
  categoryId?: string | null; // YES

  sku: string;
  name: string;
  description?: string | null; // YES

  price: number;
  cost: number; // default 0

  stock: number; // default 0
  minStock: number; // default 0

  unit: string; // default 'UND'

  taxRate: number; // default 19
  taxType: TaxType; // default 'IVA'

  status: ProductStatus; // default 'ACTIVE'

  imageUrl?: string | null; // YES
  barcode?: string | null;  // YES

  createdAt: string; // CURRENT_TIMESTAMP
  updatedAt: string;
  deletedAt?: string | null; // YES
}