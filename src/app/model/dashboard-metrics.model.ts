import { Customer } from "./customer.model";
import { Product } from "./product.model";

export interface MetricComparison {
  current: number;
  previous?: number;
  change?: number;
}

export interface TaxesMetric {
  current: number;
}

export interface DashboardMetrics {
  invoices: {
    current: number;
    previous: number;
  };
  productCount: number;
  revenue: MetricComparison;
  taxes: TaxesMetric;
  topCustomers: Customer[];
  topProducts: Product[];
  activeCatalog:number;
  activeCustomers:number;
}