import { ObjectId } from 'mongodb';

// ==================== USER / AUTH ====================
export interface User {
  _id?: ObjectId;
  id?: string;
  email: string;
  name: string;
  emailVerified: boolean;
  image?: string;
  role: 'ADMIN' | 'CLIENT' | 'ACCOUNTANT' | 'STAFF';
  businessId?: string;
  isActive: boolean;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== BUSINESS ====================
export interface Business {
  _id?: ObjectId;
  name: string;
  email: string;
  phone?: string;
  logo?: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    country: string;
    pincode: string;
  };
  gstin?: string;
  pan?: string;
  currency: string;
  ownerId: string;
  settings: BusinessSettings;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BusinessSettings {
  invoicePrefix: string;
  invoiceCounter: number;
  quotationPrefix: string;
  quotationCounter: number;
  defaultPaymentTerms: number; // days
  defaultTaxRate: number; // percentage
  defaultCgstRate: number;
  defaultSgstRate: number;
  defaultIgstRate: number;
  taxEnabled: boolean;
  gstEnabled: boolean;
  invoiceFooter?: string;
  termsAndConditions?: string;
  reminderDaysBefore: number[];
  reminderDaysAfter: number[];
  emailNotifications: boolean;
  autoSendInvoice: boolean;
}

// ==================== CLIENT ====================
export interface Client {
  _id?: ObjectId;
  businessId: string;
  userId?: string; // if client has portal access
  name: string;
  email: string;
  phone?: string;
  company?: string;
  gstin?: string;
  pan?: string;
  billingAddress: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    country: string;
    pincode: string;
  };
  shippingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    country: string;
    pincode: string;
  };
  notes?: string;
  isActive: boolean;
  totalInvoiced: number; // in paise
  totalPaid: number; // in paise
  createdAt: Date;
  updatedAt: Date;
}

// ==================== INVOICE ITEM ====================
export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number; // in units (can be decimal)
  unitPrice: number; // in paise
  discount: number; // percentage 0-100
  taxRate: number; // percentage
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  subtotal: number; // quantity * unitPrice in paise
  discountAmount: number; // in paise
  taxableAmount: number; // after discount in paise
  cgstAmount: number; // in paise
  sgstAmount: number; // in paise
  igstAmount: number; // in paise
  taxAmount: number; // total tax in paise
  total: number; // taxable + tax in paise
  unit?: string;
}

// ==================== QUOTATION ====================
export type QuotationStatus = 'DRAFT' | 'SENT' | 'VIEWED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CONVERTED';

export interface Quotation {
  _id?: ObjectId;
  businessId: string;
  clientId: string;
  quotationNumber: string;
  status: QuotationStatus;
  quotationDate: Date;
  expiryDate: Date;
  currency: string;
  items: InvoiceItem[];
  subtotal: number; // in paise
  discountAmount: number; // in paise
  taxableAmount: number; // in paise
  cgstAmount: number; // in paise
  sgstAmount: number; // in paise
  igstAmount: number; // in paise
  totalTax: number; // in paise
  total: number; // in paise
  notes?: string;
  termsAndConditions?: string;
  convertedToInvoiceId?: string;
  viewedAt?: Date;
  acceptedAt?: Date;
  rejectedAt?: Date;
  sentAt?: Date;
  publicToken?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== INVOICE ====================
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'VIEWED' | 'PENDING' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export interface Invoice {
  _id?: ObjectId;
  businessId: string;
  clientId: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  invoiceDate: Date;
  dueDate: Date;
  currency: string;
  items: InvoiceItem[];
  subtotal: number; // in paise
  discountAmount: number; // in paise
  taxableAmount: number; // in paise
  cgstAmount: number; // in paise
  sgstAmount: number; // in paise
  igstAmount: number; // in paise
  totalTax: number; // in paise
  total: number; // in paise
  amountPaid: number; // in paise
  amountDue: number; // in paise
  notes?: string;
  termsAndConditions?: string;
  fromQuotationId?: string;
  publicToken?: string;
  viewedAt?: Date;
  sentAt?: Date;
  paidAt?: Date;
  isRecurring: boolean;
  recurringId?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== PAYMENT ====================
export type PaymentMethod = 'RAZORPAY' | 'UPI' | 'CARD' | 'NETBANKING' | 'WALLET' | 'BANK_TRANSFER' | 'CASH' | 'CHEQUE' | 'OTHER';
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'REFUNDED';

export interface Payment {
  _id?: ObjectId;
  businessId: string;
  clientId: string;
  invoiceId: string;
  receiptNumber: string;
  amount: number; // in paise
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  gatewaySignature?: string;
  gatewayResponse?: Record<string, unknown>;
  notes?: string;
  paidAt?: Date;
  refundedAt?: Date;
  refundAmount?: number; // in paise
  refundReason?: string;
  isManual: boolean;
  recordedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== EXPENSE ====================
export type ExpenseCategory = 'OFFICE' | 'TRAVEL' | 'MARKETING' | 'SALARIES' | 'UTILITIES' | 'RENT' | 'EQUIPMENT' | 'SOFTWARE' | 'OTHER';

export interface Expense {
  _id?: ObjectId;
  businessId: string;
  title: string;
  category: ExpenseCategory;
  amount: number; // in paise
  currency: string;
  expenseDate: Date;
  description?: string;
  receipt?: string; // file URL
  isRecurring: boolean;
  vendor?: string;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== NOTIFICATION ====================
export type NotificationCategory = 'INVOICE' | 'PAYMENT' | 'REMINDER' | 'SYSTEM' | 'QUOTATION';

export interface Notification {
  _id?: ObjectId;
  userId: string;
  businessId: string;
  title: string;
  message: string;
  category: NotificationCategory;
  isRead: boolean;
  entityType?: 'INVOICE' | 'PAYMENT' | 'QUOTATION' | 'CLIENT' | 'EXPENSE';
  entityId?: string;
  actionUrl?: string;
  createdAt: Date;
}

// ==================== INVOICE REMINDER ====================
export interface InvoiceReminder {
  _id?: ObjectId;
  businessId: string;
  invoiceId: string;
  clientId: string;
  type: 'BEFORE_DUE' | 'ON_DUE' | 'AFTER_DUE';
  daysOffset: number;
  sentAt?: Date;
  scheduledFor: Date;
  isSent: boolean;
  createdAt: Date;
}

// ==================== AUDIT LOG ====================
export type AuditAction =
  | 'LOGIN' | 'LOGOUT' | 'REGISTER'
  | 'CLIENT_CREATED' | 'CLIENT_UPDATED' | 'CLIENT_DELETED' | 'CLIENT_RESTORED'
  | 'INVOICE_CREATED' | 'INVOICE_UPDATED' | 'INVOICE_DELETED' | 'INVOICE_SENT' | 'INVOICE_CANCELLED'
  | 'QUOTATION_CREATED' | 'QUOTATION_UPDATED' | 'QUOTATION_DELETED' | 'QUOTATION_SENT' | 'QUOTATION_CONVERTED'
  | 'PAYMENT_CREATED' | 'PAYMENT_VERIFIED' | 'PAYMENT_REFUNDED' | 'PAYMENT_FAILED'
  | 'EXPENSE_CREATED' | 'EXPENSE_UPDATED' | 'EXPENSE_DELETED'
  | 'SETTINGS_UPDATED' | 'BUSINESS_CREATED' | 'BUSINESS_UPDATED'
  | 'TEAM_MEMBER_ADDED' | 'TEAM_MEMBER_REMOVED' | 'TEAM_MEMBER_UPDATED';

export interface AuditLog {
  _id?: ObjectId;
  userId: string;
  businessId: string;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

// ==================== RECURRING INVOICE ====================
export type RecurringFrequency = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

export interface RecurringInvoice {
  _id?: ObjectId;
  businessId: string;
  clientId: string;
  frequency: RecurringFrequency;
  startDate: Date;
  endDate?: Date;
  nextRunDate: Date;
  lastRunDate?: Date;
  isActive: boolean;
  autoSend: boolean;
  template: Omit<Invoice, '_id' | 'invoiceNumber' | 'status' | 'invoiceDate' | 'dueDate' | 'amountPaid' | 'amountDue' | 'publicToken' | 'viewedAt' | 'sentAt' | 'paidAt' | 'createdAt' | 'updatedAt'>;
  generatedInvoices: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== TEAM MEMBER ====================
export type TeamRole = 'OWNER' | 'ADMIN' | 'ACCOUNTANT' | 'STAFF';

export interface TeamMember {
  _id?: ObjectId;
  businessId: string;
  userId: string;
  role: TeamRole;
  permissions: string[];
  isActive: boolean;
  invitedAt: Date;
  joinedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== OTP ====================
export interface OTP {
  _id?: ObjectId;
  email: string;
  otp: string; // hashed
  purpose: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET' | 'LOGIN_2FA' | 'SENSITIVE_ACTION';
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
  isUsed: boolean;
  createdAt: Date;
}
