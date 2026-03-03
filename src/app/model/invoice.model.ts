export type InvoiceType = 'VENTA' | 'COMPRA' | 'NOTA_CREDITO' | 'NOTA_DEBITO';

export type InvoiceStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'PAID'
  | 'CANCELLED'
  | 'REJECTED';

export interface Invoice {
  id: string;
  companyId: string;
  customerId: string;

  invoiceNumber: string;
  prefix: string; // default 'FV'

  type: InvoiceType; // default 'VENTA'
  status: InvoiceStatus; // default 'DRAFT'

  issueDate: string; // timestamp
  dueDate?: string | null;

  subtotal: number;
  taxAmount: number;
  discountAmount: number; // default 0
  total: number;

  notes?: string | null;

  dianCufe?: string | null;
  dianQrCode?: string | null;
  dianStatus?: string | null;

  dianSentAt?: string | null;
  dianResponseAt?: string | null;

  pdfUrl?: string | null;
  xmlUrl?: string | null;

  currency: string; // default 'COP'
  exchangeRate: number; // default 1

  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}