export interface Customer {
  id: string;

  companyId: string;

  documentType: string;
  documentNumber: string;

  name: string;
  email?: string;
  phone?: string;

  address?: string;
  city?: string;
  department?: string;
  country?: string;

  isActive: boolean;

  creditLimit: number;
  creditDays: number;

  notes?: string;

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}