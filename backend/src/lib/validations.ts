import { z } from 'zod';

// ==================== AUTH SCHEMAS ====================
export const RegisterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address').toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  phone: z.string().optional(),
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const OTPSchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d+$/, 'OTP must contain only digits'),
});

// ==================== BUSINESS SCHEMAS ====================
export const BusinessSchema = z.object({
  name: z.string().min(2, 'Business name is required').max(200),
  email: z.string().email('Invalid email'),
  phone: z.string().optional(),
  gstin: z.string().optional(),
  pan: z.string().optional(),
  currency: z.string().default('INR'),
  address: z.object({
    line1: z.string().min(1, 'Address line 1 is required'),
    line2: z.string().optional(),
    city: z.string().min(1, 'City is required'),
    state: z.string().min(1, 'State is required'),
    country: z.string().min(1, 'Country is required').default('India'),
    pincode: z.string().min(1, 'Pincode is required'),
  }),
});

const AddressSchema = z.object({
  line1: z.string().optional().default(''),
  line2: z.string().optional().default(''),
  city: z.string().optional().default(''),
  state: z.string().optional().default(''),
  country: z.string().optional().default('India'),
  pincode: z.string().optional().default(''),
});

export const ClientSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(200),
  email: z.string().email('Invalid email address').toLowerCase(),
  phone: z.string().optional(),
  company: z.string().optional(),
  gstin: z.string().optional(),
  billingAddress: AddressSchema.optional().default({
    line1: '',
    line2: '',
    city: '',
    state: '',
    country: 'India',
    pincode: '',
  }),
  shippingAddress: AddressSchema.optional(),
  notes: z.string().max(500).optional(),
});

// ==================== INVOICE ITEM SCHEMA ====================
export const InvoiceItemSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1, 'Description is required').max(500),
  quantity: z.number().positive('Quantity must be positive').max(100000),
  unitPrice: z.number().min(0, 'Unit price cannot be negative'),
  discount: z.number().min(0).max(100, 'Discount must be between 0 and 100').default(0),
  taxRate: z.number().min(0).max(100).optional(),
  cgstRate: z.number().min(0).max(50).default(0),
  sgstRate: z.number().min(0).max(50).default(0),
  igstRate: z.number().min(0).max(100).default(0),
  taxType: z.string().optional(),
  unit: z.string().optional(),
});

// ==================== INVOICE SCHEMAS ====================
export const InvoiceSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  invoiceDate: z.string().or(z.date()),
  dueDate: z.string().or(z.date()),
  currency: z.string().default('INR'),
  items: z.array(InvoiceItemSchema).min(1, 'At least one item is required'),
  notes: z.string().max(1000).optional(),
  termsAndConditions: z.string().max(2000).optional(),
});

export const UpdateInvoiceStatusSchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'CANCELLED']),
});

// ==================== QUOTATION SCHEMAS ====================
export const QuotationSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  quotationDate: z.string().or(z.date()),
  expiryDate: z.string().or(z.date()),
  currency: z.string().default('INR'),
  items: z.array(InvoiceItemSchema).min(1, 'At least one item is required'),
  notes: z.string().max(1000).optional(),
  termsAndConditions: z.string().max(2000).optional(),
});

// ==================== PAYMENT SCHEMAS ====================
export const CreatePaymentOrderSchema = z.object({
  invoiceId: z.string().min(1, 'Invoice ID is required'),
  amount: z.number().positive('Amount must be positive'),
});

export const VerifyPaymentSchema = z.object({
  invoiceId: z.string().min(1),
  orderId: z.string().min(1),
  paymentId: z.string().min(1),
  signature: z.string().min(1),
});

export const ManualPaymentSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.number().positive('Amount must be positive'),
  method: z.enum(['BANK_TRANSFER', 'CASH', 'CHEQUE', 'UPI', 'OTHER']),
  notes: z.string().max(500).optional(),
  paidAt: z.string().or(z.date()),
});

// ==================== EXPENSE SCHEMAS ====================
export const ExpenseSchema = z.object({
  title: z.string().min(2, 'Title is required').max(200),
  category: z.enum(['OFFICE', 'TRAVEL', 'MARKETING', 'SALARIES', 'UTILITIES', 'RENT', 'EQUIPMENT', 'SOFTWARE', 'OTHER']),
  amount: z.number().positive('Amount must be positive'),
  expenseDate: z.string().or(z.date()),
  description: z.string().max(500).optional(),
  vendor: z.string().max(200).optional(),
  isRecurring: z.boolean().default(false),
});

// ==================== SETTINGS SCHEMAS ====================
export const BusinessSettingsSchema = z.object({
  invoicePrefix: z.string().min(1).max(10).default('INV'),
  quotationPrefix: z.string().min(1).max(10).default('QUO'),
  defaultPaymentTerms: z.number().min(0).max(365).default(30),
  defaultCgstRate: z.number().min(0).max(50).default(9),
  defaultSgstRate: z.number().min(0).max(50).default(9),
  defaultIgstRate: z.number().min(0).max(100).default(0),
  taxEnabled: z.boolean().default(true),
  gstEnabled: z.boolean().default(true),
  invoiceFooter: z.string().max(500).optional(),
  termsAndConditions: z.string().max(2000).optional(),
  reminderDaysBefore: z.array(z.number()).default([3, 7]),
  reminderDaysAfter: z.array(z.number()).default([1, 3, 7, 14]),
  emailNotifications: z.boolean().default(true),
  autoSendInvoice: z.boolean().default(false),
});

// ==================== PAGINATION SCHEMA ====================
export const PaginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  status: z.string().optional(),
  clientId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
