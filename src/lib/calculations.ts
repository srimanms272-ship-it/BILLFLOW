import { InvoiceItem } from './types';

/**
 * All monetary values are stored as integers in smallest unit (paise for INR).
 * This prevents floating-point precision issues.
 */

/** Convert rupees to paise */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/** Convert paise to rupees */
export function paiseToRupees(paise: number): number {
  return paise / 100;
}

/** Format paise amount to currency string */
export function formatCurrency(paise: number, currency = 'INR'): string {
  const amount = paiseToRupees(paise);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export interface CalculatedItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number; // in paise
  discount: number; // percentage
  taxRate: number; // percentage
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  subtotal: number; // in paise (qty * unit price)
  discountAmount: number; // in paise
  taxableAmount: number; // in paise (subtotal - discount)
  cgstAmount: number; // in paise
  sgstAmount: number; // in paise
  igstAmount: number; // in paise
  taxAmount: number; // in paise (total tax)
  total: number; // in paise (taxable + tax)
  unit?: string;
}

export interface InvoiceTotals {
  items: CalculatedItem[];
  subtotal: number; // in paise
  discountAmount: number; // in paise
  taxableAmount: number; // in paise
  cgstAmount: number; // in paise
  sgstAmount: number; // in paise
  igstAmount: number; // in paise
  totalTax: number; // in paise
  total: number; // in paise
}

export interface ItemInput {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number; // in rupees (from form input)
  discount: number; // percentage
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  unit?: string;
  taxRate?: number;
  taxType?: string;
}

/**
 * Calculate invoice totals server-side.
 * Input prices are in rupees (from form), all outputs in paise.
 */
export function calculateInvoiceTotals(items: ItemInput[]): InvoiceTotals {
  const calculatedItems: CalculatedItem[] = items.map((item) => {
    // Convert to paise and use integers throughout
    const unitPricePaise = rupeesToPaise(item.unitPrice);
    const quantity = item.quantity;
    const discountPct = Math.max(0, Math.min(100, item.discount));
    const cgstRate = Math.max(0, item.cgstRate);
    const sgstRate = Math.max(0, item.sgstRate);
    const igstRate = Math.max(0, item.igstRate);
    const taxRate = cgstRate + sgstRate + igstRate;

    // Validate
    if (quantity <= 0) throw new Error('Quantity must be positive');
    if (unitPricePaise < 0) throw new Error('Unit price cannot be negative');

    const subtotal = Math.round(unitPricePaise * quantity);
    const discountAmount = Math.round(subtotal * discountPct / 100);
    const taxableAmount = subtotal - discountAmount;

    const cgstAmount = Math.round(taxableAmount * cgstRate / 100);
    const sgstAmount = Math.round(taxableAmount * sgstRate / 100);
    const igstAmount = Math.round(taxableAmount * igstRate / 100);
    const taxAmount = cgstAmount + sgstAmount + igstAmount;
    const total = taxableAmount + taxAmount;

    return {
      id: item.id || `item_${Math.random().toString(36).substring(2, 9)}`,
      description: item.description,
      quantity,
      unitPrice: unitPricePaise,
      discount: discountPct,
      taxRate,
      cgstRate,
      sgstRate,
      igstRate,
      subtotal,
      discountAmount,
      taxableAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      taxAmount,
      total,
      unit: item.unit,
    };
  });

  const subtotal = calculatedItems.reduce((sum, i) => sum + i.subtotal, 0);
  const discountAmount = calculatedItems.reduce((sum, i) => sum + i.discountAmount, 0);
  const taxableAmount = calculatedItems.reduce((sum, i) => sum + i.taxableAmount, 0);
  const cgstAmount = calculatedItems.reduce((sum, i) => sum + i.cgstAmount, 0);
  const sgstAmount = calculatedItems.reduce((sum, i) => sum + i.sgstAmount, 0);
  const igstAmount = calculatedItems.reduce((sum, i) => sum + i.igstAmount, 0);
  const totalTax = calculatedItems.reduce((sum, i) => sum + i.taxAmount, 0);
  const total = calculatedItems.reduce((sum, i) => sum + i.total, 0);

  return {
    items: calculatedItems,
    subtotal,
    discountAmount,
    taxableAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalTax,
    total,
  };
}

/**
 * Generate concurrency-safe invoice number using MongoDB findAndModify
 */
export async function generateInvoiceNumber(
  businessId: string,
  prefix: string,
  year?: number
): Promise<string> {
  const { getDb } = await import('./db');
  const db = await getDb();

  const currentYear = year || new Date().getFullYear();
  const counterKey = `${businessId}_invoice_${currentYear}`;

  const result = await db.collection('counters').findOneAndUpdate(
    { _id: counterKey as unknown as import('mongodb').ObjectId },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );

  const seq = (result as { seq?: number } | null)?.seq || 1;
  const paddedSeq = seq.toString().padStart(4, '0');
  const cleanPrefix = (prefix || 'INV').replace(/-+$/, '');
  return `${cleanPrefix}-${currentYear}-${paddedSeq}`;
}

export async function generateQuotationNumber(
  businessId: string,
  prefix: string,
  year?: number
): Promise<string> {
  const { getDb } = await import('./db');
  const db = await getDb();

  const currentYear = year || new Date().getFullYear();
  const counterKey = `${businessId}_quotation_${currentYear}`;

  const result = await db.collection('counters').findOneAndUpdate(
    { _id: counterKey as unknown as import('mongodb').ObjectId },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );

  const seq = (result as { seq?: number } | null)?.seq || 1;
  const paddedSeq = seq.toString().padStart(4, '0');
  const cleanPrefix = (prefix || 'QTN').replace(/-+$/, '');
  return `${cleanPrefix}-${currentYear}-${paddedSeq}`;
}

export async function generateReceiptNumber(businessId: string): Promise<string> {
  const { getDb } = await import('./db');
  const db = await getDb();

  const year = new Date().getFullYear();
  const counterKey = `${businessId}_receipt_${year}`;

  const result = await db.collection('counters').findOneAndUpdate(
    { _id: counterKey as unknown as import('mongodb').ObjectId },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );

  const seq = (result as { seq?: number } | null)?.seq || 1;
  const paddedSeq = seq.toString().padStart(4, '0');
  return `RCP-${year}-${paddedSeq}`;
}
