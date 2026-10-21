import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1e293b',
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 16,
  },
  logo: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#4f46e5',
  },
  companySubtitle: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 3,
  },
  invoiceTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'right',
    color: '#0f172a',
  },
  invoiceNum: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'right',
    marginTop: 2,
  },
  statusBadge: {
    marginTop: 6,
    alignSelf: 'flex-end',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  statusPaid: { backgroundColor: '#dcfce7', color: '#166534' },
  statusOverdue: { backgroundColor: '#fee2e2', color: '#991b1b' },
  statusPending: { backgroundColor: '#fef3c7', color: '#92400e' },
  statusSent: { backgroundColor: '#dbeafe', color: '#1e40af' },
  statusDraft: { backgroundColor: '#f1f5f9', color: '#475569' },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  col: {
    width: '48%',
  },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: '#94a3b8',
    marginBottom: 4,
  },
  clientName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 2,
  },
  text: {
    fontSize: 9,
    color: '#334155',
    lineHeight: 1.4,
  },
  metaBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  metaItem: {
    width: '30%',
  },
  metaLabel: {
    fontSize: 8,
    textTransform: 'uppercase',
    color: '#94a3b8',
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  table: {
    width: '100%',
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  th: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  td: {
    fontSize: 9,
    color: '#334155',
  },
  colDesc: { width: '45%' },
  colQty: { width: '12%', textAlign: 'right' },
  colPrice: { width: '15%', textAlign: 'right' },
  colTax: { width: '13%', textAlign: 'right' },
  colTotal: { width: '15%', textAlign: 'right' },
  totalsContainer: {
    alignSelf: 'flex-end',
    width: '50%',
    marginBottom: 20,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  totalRowGrand: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1.5,
    borderTopColor: '#0f172a',
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 9,
    color: '#64748b',
  },
  totalVal: {
    fontSize: 9,
    color: '#0f172a',
    fontWeight: 'bold',
  },
  grandTotalLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  grandTotalVal: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#4f46e5',
  },
  notesBox: {
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 6,
    marginBottom: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 36,
    right: 36,
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
    fontSize: 8,
    color: '#94a3b8',
  },
});

function formatINR(paise: number) {
  const val = (paise || 0) / 100;
  return `INR ${val.toFixed(2)}`;
}

interface InvoicePdfProps {
  invoice: any;
  client: any;
  business: any;
}

export function InvoiceDocument({ invoice, client, business }: InvoicePdfProps) {
  const items = invoice.items || [];
  const rawStatus = (invoice.status || 'PENDING').toUpperCase();
  const isPaid = rawStatus === 'PAID' && (invoice.amountDue <= 0);
  const displayStatus = isPaid
    ? 'PAID'
    : rawStatus === 'OVERDUE'
    ? 'OVERDUE'
    : rawStatus === 'PARTIALLY_PAID'
    ? 'PARTIALLY PAID'
    : rawStatus === 'DRAFT'
    ? 'DRAFT'
    : 'UNPAID';

  const badgeStyle =
    displayStatus === 'PAID'
      ? styles.statusPaid
      : displayStatus === 'OVERDUE'
      ? styles.statusOverdue
      : displayStatus === 'PARTIALLY PAID'
      ? styles.statusPending
      : displayStatus === 'UNPAID'
      ? styles.statusPending
      : styles.statusDraft;

  return (
    <Document title={`Invoice-${invoice.invoiceNumber || 'Draft'}`}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>{business?.name || 'BillFlow'}</Text>
            {business?.email ? <Text style={styles.companySubtitle}>{business.email}</Text> : null}
            {business?.phone ? <Text style={styles.companySubtitle}>{business.phone}</Text> : null}
            {business?.gstin ? <Text style={styles.companySubtitle}>GSTIN: {business.gstin}</Text> : null}
          </View>
          <View>
            <Text style={styles.invoiceTitle}>TAX INVOICE</Text>
            <Text style={styles.invoiceNum}>#{invoice.invoiceNumber || 'INV-DRAFT'}</Text>
            <View style={[styles.statusBadge, badgeStyle]}>
              <Text>{displayStatus}</Text>
            </View>
          </View>
        </View>

        {/* Bill To & From info */}
        <View style={styles.grid}>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Billed To</Text>
            <Text style={styles.clientName}>{client?.name || 'Valued Client'}</Text>
            {client?.company ? <Text style={styles.text}>{client.company}</Text> : null}
            {client?.email ? <Text style={styles.text}>{client.email}</Text> : null}
            {client?.phone ? <Text style={styles.text}>{client.phone}</Text> : null}
            {client?.billingAddress?.line1 ? (
              <Text style={styles.text}>
                {client.billingAddress.line1}
                {client.billingAddress.city ? `, ${client.billingAddress.city}` : ''}
                {client.billingAddress.state ? `, ${client.billingAddress.state}` : ''}
                {client.billingAddress.pincode ? ` - ${client.billingAddress.pincode}` : ''}
              </Text>
            ) : null}
            {client?.gstin ? <Text style={styles.text}>GSTIN: {client.gstin}</Text> : null}
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Payment Details</Text>
            {business?.bankDetails?.bankName ? (
              <Text style={styles.text}>Bank: {business.bankDetails.bankName}</Text>
            ) : null}
            {business?.bankDetails?.accountNumber ? (
              <Text style={styles.text}>A/C: {business.bankDetails.accountNumber}</Text>
            ) : null}
            {business?.bankDetails?.ifsc ? (
              <Text style={styles.text}>IFSC: {business.bankDetails.ifsc}</Text>
            ) : null}
            {business?.bankDetails?.upiId ? (
              <Text style={styles.text}>UPI ID: {business.bankDetails.upiId}</Text>
            ) : null}
          </View>
        </View>

        {/* Meta box */}
        <View style={styles.metaBox}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Invoice Date</Text>
            <Text style={styles.metaValue}>
              {invoice.invoiceDate
                ? new Date(invoice.invoiceDate).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })
                : '-'}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Due Date</Text>
            <Text style={styles.metaValue}>
              {invoice.dueDate
                ? new Date(invoice.dueDate).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })
                : '-'}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Currency</Text>
            <Text style={styles.metaValue}>{invoice.currency || 'INR'}</Text>
          </View>
        </View>

        {/* Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.colDesc]}>Description</Text>
            <Text style={[styles.th, styles.colQty]}>Qty</Text>
            <Text style={[styles.th, styles.colPrice]}>Unit Price</Text>
            <Text style={[styles.th, styles.colTax]}>Tax</Text>
            <Text style={[styles.th, styles.colTotal]}>Total</Text>
          </View>
          {items.map((item: any, i: number) => {
            const taxPct = (item.cgstRate || 0) + (item.sgstRate || 0) + (item.igstRate || 0);
            return (
              <View key={i} style={styles.tableRow}>
                <Text style={[styles.td, styles.colDesc]}>{item.description || 'Item'}</Text>
                <Text style={[styles.td, styles.colQty]}>
                  {item.quantity} {item.unit || ''}
                </Text>
                <Text style={[styles.td, styles.colPrice]}>{formatINR(item.unitPrice)}</Text>
                <Text style={[styles.td, styles.colTax]}>{taxPct}%</Text>
                <Text style={[styles.td, styles.colTotal]}>{formatINR(item.total)}</Text>
              </View>
            );
          })}
        </View>

        {/* Totals */}
        <View style={styles.totalsContainer}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal:</Text>
            <Text style={styles.totalVal}>{formatINR(invoice.subtotal)}</Text>
          </View>
          {invoice.discountAmount > 0 ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Discount:</Text>
              <Text style={styles.totalVal}>-{formatINR(invoice.discountAmount)}</Text>
            </View>
          ) : null}
          {invoice.cgstAmount > 0 ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>CGST:</Text>
              <Text style={styles.totalVal}>{formatINR(invoice.cgstAmount)}</Text>
            </View>
          ) : null}
          {invoice.sgstAmount > 0 ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>SGST:</Text>
              <Text style={styles.totalVal}>{formatINR(invoice.sgstAmount)}</Text>
            </View>
          ) : null}
          {invoice.igstAmount > 0 ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>IGST:</Text>
              <Text style={styles.totalVal}>{formatINR(invoice.igstAmount)}</Text>
            </View>
          ) : null}
          <View style={styles.totalRowGrand}>
            <Text style={styles.grandTotalLabel}>Total Amount:</Text>
            <Text style={styles.grandTotalVal}>{formatINR(invoice.total)}</Text>
          </View>
          {invoice.amountPaid > 0 ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Amount Paid:</Text>
              <Text style={[styles.totalVal, { color: '#16a34a' }]}>{formatINR(invoice.amountPaid)}</Text>
            </View>
          ) : null}
          {invoice.amountDue > 0 ? (
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { fontWeight: 'bold' }]}>Amount Due:</Text>
              <Text style={[styles.totalVal, { color: '#dc2626' }]}>{formatINR(invoice.amountDue)}</Text>
            </View>
          ) : null}
        </View>

        {/* Notes */}
        {invoice.notes ? (
          <View style={styles.notesBox}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.text}>{invoice.notes}</Text>
          </View>
        ) : null}

        {/* Footer */}
        <Text style={styles.footer}>
          Thank you for choosing {business?.name || 'BillFlow'}! Generated via BillFlow Platform.
        </Text>
      </Page>
    </Document>
  );
}

export async function generateInvoicePDFBuffer(invoice: any, client: any, business: any): Promise<Buffer> {
  const element = React.createElement(InvoiceDocument, { invoice, client, business });
  return await renderToBuffer(element as any);
}
