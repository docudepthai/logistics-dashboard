// src/types/paytr.types.ts
export interface PaymentInitRequest {
  jobId: string;
  bidId: string; // ADDED: bid ID is required for accepting bid
  carrierId: string;
  amount: number;
  carrierName: string;
  carrierIban: string;
  commissionRate: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress?: string;
}

export interface PayTRTokenResponse {
  status: 'success' | 'failed';
  token?: string;
  reason?: string;
}

export interface PayTRWebhookPayload {
  merchant_oid: string;
  status: 'success' | 'failed';
  total_amount: string;
  hash: string;
  payment_type?: string;
  failed_reason_code?: string;
  failed_reason_msg?: string;
  test_mode?: string;
  installment_count?: string;
  currency?: string;
}

export interface TransferRequest {
  paymentId: string;
  jobId: string;
}

export interface PaymentDocument {
  userId: string;
  jobId: string;
  bidId?: string; // OPTIONAL: bid ID for auto-accepting bid after payment (web only)
  carrierId: string;
  carrierName: string;
  carrierIban: string;
  amount: number;
  commissionRate: number;
  status: 'pending' | 'success' | 'failed';
  merchant_oid: string;
  created_at: FirebaseFirestore.Timestamp;
  test_mode: boolean;
  payment_status?: string;
  transfer_status?: 'pending' | 'completed' | 'failed';
  trans_id?: string;
  carrier_amount?: number;
  marketplace_commission?: number;
  transferred_at?: FirebaseFirestore.Timestamp;
  paid_at?: FirebaseFirestore.Timestamp;
  total_amount?: number;
  payment_type?: string;
  failed_reason_code?: string;
  failed_reason_msg?: string;
}