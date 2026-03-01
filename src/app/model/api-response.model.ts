export interface ApiResponse<T> {
  data: T;
  statusCode: number;
  timestamp: string;
}