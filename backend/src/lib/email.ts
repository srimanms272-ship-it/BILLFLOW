import nodemailer, { type Transporter } from 'nodemailer';
import fs from 'fs';
import path from 'path';

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
}

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}

/**
 * Check if a string is missing, empty, or a known placeholder
 */
export function isPlaceholderValue(val?: string | null): boolean {
  if (!val) return true;
  const v = val.trim().toLowerCase();
  return (
    v === '' ||
    v === 'your-email@gmail.com' ||
    v === 'your_real_gmail_address@gmail.com' ||
    v === 'your-app-password' ||
    v === 'your_16_character_app_password' ||
    v === 'your_resend_api_key' ||
    v === 're_your_resend_api_key' ||
    v.includes('your-app-password') ||
    v.includes('your-email@') ||
    v.includes('example.com')
  );
}

/**
 * Safely retrieve an environment variable.
 * If process.env has a placeholder or hasn't loaded a newly updated .env.local,
 * this function parses .env.local directly from disk so updates take effect
 * immediately without requiring a manual server restart.
 */
export function getLiveEnv(key: string): string | undefined {
  const procVal = process.env[key];
  if (procVal && !isPlaceholderValue(procVal)) {
    return procVal;
  }

  // Fallback: parse .env.local dynamically from disk
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
        const [k, ...v] = trimmed.split('=');
        if (k.trim() === key) {
          const val = v.join('=').trim().replace(/^["']|["']$/g, '');
          if (val) return val;
        }
      }
    }
  } catch {
    // Ignore file read errors
  }

  return procVal;
}

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  resendApiKey?: string;
  isConfigured: boolean;
}

export function getEmailConfig(): EmailConfig {
  const resendApiKey = getLiveEnv('RESEND_API_KEY')?.trim();

  const host = getLiveEnv('EMAIL_HOST')?.trim() || 'smtp.gmail.com';
  const rawPort = getLiveEnv('EMAIL_PORT')?.trim() || '587';
  const port = parseInt(rawPort, 10) || 587;
  const rawSecure = getLiveEnv('EMAIL_SECURE')?.trim()?.toLowerCase();
  const secure = rawSecure === 'true' || port === 465;

  const rawUser = getLiveEnv('EMAIL_USER')?.trim() || '';
  const rawPass = getLiveEnv('EMAIL_PASS')?.trim() || '';

  // Google App Passwords often have spaces (e.g. "abcd efgh ijkl mnop"). Strip whitespace for SMTP auth.
  const pass = rawPass.replace(/\s+/g, '');
  const user = rawUser;

  const defaultFrom = user ? `BillFlow <${user}>` : 'BillFlow <noreply@billflow.app>';
  const from = getLiveEnv('EMAIL_FROM')?.trim() || defaultFrom;

  const hasResend = Boolean(resendApiKey && !isPlaceholderValue(resendApiKey));
  const hasSmtp = Boolean(user && pass && !isPlaceholderValue(user) && !isPlaceholderValue(pass));

  return {
    host,
    port,
    secure,
    user,
    pass,
    from,
    resendApiKey: hasResend ? resendApiKey : undefined,
    isConfigured: hasResend || hasSmtp,
  };
}

let etherealTransporterPromise: Promise<Transporter> | null = null;

async function getEtherealTransporter(): Promise<Transporter> {
  if (!etherealTransporterPromise) {
    etherealTransporterPromise = nodemailer.createTestAccount().then((testAccount) => {
      console.log(`[Email] Initialized development Ethereal test mailer (user: ${testAccount.user})`);
      return nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    });
  }
  return etherealTransporterPromise;
}

/**
 * Universal email dispatcher supporting:
 * 1. Resend API (when RESEND_API_KEY is configured in .env.local)
 * 2. Nodemailer SMTP (Gmail App Password, Brevo, SendGrid, custom SMTP)
 * 3. Automatic Ethereal test inbox fallback for local development when credentials are not yet set
 * With detailed logging and error isolation.
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
  attachments,
}: EmailPayload): Promise<{ success: boolean; messageId?: string }> {
  const config = getEmailConfig();

  // Option 1: Resend REST API (if RESEND_API_KEY is configured)
  if (config.resendApiKey) {
    console.log(`[Email] Attempting delivery via Resend API to: ${to}`);
    try {
      const fromAddress = config.from || 'onboarding@resend.dev';
      const bodyPayload: Record<string, unknown> = {
        from: fromAddress,
        to: [to],
        subject,
        html,
        text,
      };

      if (attachments && attachments.length > 0) {
        bodyPayload.attachments = attachments.map(att => ({
          filename: att.filename,
          content: typeof att.content === 'string' ? Buffer.from(att.content).toString('base64') : att.content.toString('base64'),
        }));
      }

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorMsg = data?.message || JSON.stringify(data);
        console.error(`\n❌ [RESEND API DELIVERY ERROR]\nStatus: ${res.status}\nMessage: ${errorMsg}\n`);
        throw new Error(`Resend delivery failed: ${errorMsg}`);
      }

      console.log(`✅ [Email] Successfully sent via Resend API to ${to}! MessageId: ${data.id}`);
      return { success: true, messageId: data.id };
    } catch (err: any) {
      console.error(`❌ [Email] Resend dispatch failed:`, err.message);
      throw err;
    }
  }

  // Option 2: Nodemailer SMTP
  const isPlaceholderUser = isPlaceholderValue(config.user);
  const isPlaceholderPass = isPlaceholderValue(config.pass);

  if (isPlaceholderUser || isPlaceholderPass) {
    console.log(`ℹ️ [Email] Notice: EMAIL_USER/EMAIL_PASS are unconfigured in .env.local. Dispatching via development Ethereal test mailer to: ${to}...`);
    try {
      const etherealTransporter = await getEtherealTransporter();
      const info = await etherealTransporter.sendMail({
        from: config.from || 'BillFlow <billing@billflow.app>',
        to,
        subject,
        html,
        text,
        attachments: attachments?.map(att => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType,
        })),
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`✅ [Email] Successfully sent to ${to}! MessageId: ${info.messageId}`);
      if (previewUrl) {
        console.log(`🔗 [Email Preview URL]: ${previewUrl}`);
      }
      return { success: true, messageId: info.messageId };
    } catch (testErr: any) {
      console.warn(`[Email] Ethereal fallback failed (${testErr.message}), recording as simulated delivery for development...`);
      return { success: true, messageId: `local-sim-${Date.now()}` };
    }
  }

  console.log(`[Email] Connecting to SMTP ${config.host}:${config.port} (user: ${config.user})...`);

  const transportConfig: any = {
    auth: {
      user: config.user,
      pass: config.pass,
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
      minVersion: 'TLSv1.2',
    },
  };

  if (config.host.toLowerCase().includes('gmail')) {
    transportConfig.service = 'gmail';
  } else {
    transportConfig.host = config.host;
    transportConfig.port = config.port;
    transportConfig.secure = config.secure;
    transportConfig.requireTLS = !config.secure && config.port === 587;
  }

  const transporter = nodemailer.createTransport(transportConfig);

  try {
    const info = await transporter.sendMail({
      from: config.from,
      to,
      subject,
      html,
      text,
      attachments: attachments?.map(att => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType,
      })),
    });
    console.log(`✅ [Email] Successfully sent via SMTP to ${to}! MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    console.error('\n------------------------------------------------------------------');
    console.error(`❌ [SMTP DELIVERY FAILED] Could not send to "${to}"`);
    console.error(`Host: ${config.host}:${config.port}`);
    console.error(`User: ${config.user}`);
    console.error(`Error Code: ${err.code || 'UNKNOWN'}`);
    console.error(`Error Message: ${err.message}`);
    if (err.response) {
      console.error(`SMTP Response: ${err.response}`);
    }

    if (err.code === 'EAUTH' || (err.response && err.response.includes('535'))) {
      console.error('\n💡 AUTHENTICATION FAILED (535):');
      console.error('   If using Gmail, regular account passwords do NOT work with SMTP.');
      console.error('   You MUST generate a 16-character Google App Password:');
      console.error('   Go to: https://myaccount.google.com/apppasswords');
    } else if (err.code === 'ESOCKET' || err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
      console.error('\n💡 CONNECTION FAILED:');
      console.error(`   Unable to reach ${config.host} on port ${config.port}. Check internet connection or firewall.`);
    }
    console.error('------------------------------------------------------------------\n');

    throw err;
  }
}

const FROM = process.env.EMAIL_FROM || 'BillFlow <noreply@billflow.app>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

function baseEmailTemplate(content: string, title: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;max-width:600px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);padding:32px 40px;text-align:center;">
            <div style="font-size:28px;font-weight:800;color:#fff;letter-spacing:-0.5px;">
              ⚡ BillFlow
            </div>
            <div style="font-size:13px;color:rgba(255,255,255,0.7);margin-top:4px;">Professional Billing Platform</div>
          </td>
        </tr>
        <!-- Content -->
        <tr>
          <td style="padding:40px;">
            ${content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="border-top:1px solid #334155;padding:24px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#64748b;">
              © 2026 BillFlow. All rights reserved.<br/>
              This is an automated email, please do not reply.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendVerificationEmail(email: string, url: string, name: string): Promise<void> {
  const content = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#f1f5f9;">Verify your email</h1>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;">Hi ${name || 'there'}, click the button below to verify your email address and activate your BillFlow account.</p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${url}" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;display:inline-block;">
        Verify Email Address
      </a>
    </div>
    <p style="margin:0;color:#64748b;font-size:13px;text-align:center;">
      This link expires in 24 hours. If you did not create an account, you can safely ignore this email.
    </p>
  `;
  await sendEmail({
    to: email,
    subject: 'Verify your BillFlow account',
    html: baseEmailTemplate(content, 'Verify your email'),
  });
}

export async function sendPasswordResetEmail(email: string, url: string, name: string): Promise<void> {
  const content = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#f1f5f9;">Reset your password</h1>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;">Hi ${name || 'there'}, we received a request to reset your password. Click the button below to create a new password.</p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${url}" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;display:inline-block;">
        Reset Password
      </a>
    </div>
    <p style="margin:0;color:#64748b;font-size:13px;text-align:center;">
      This link expires in 1 hour. If you did not request a password reset, please ignore this email and your password will remain unchanged.
    </p>
  `;
  await sendEmail({
    to: email,
    subject: 'Reset your BillFlow password',
    html: baseEmailTemplate(content, 'Reset Password'),
  });
}

export async function sendOTPEmail(email: string, otp: string, name: string, purpose: string): Promise<void> {
  const content = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#f1f5f9;">Your verification code</h1>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;">Hi ${name || 'there'}, use the code below to ${purpose}.</p>
    <div style="text-align:center;margin:32px 0;">
      <div style="background:#0f172a;border:2px solid #6366f1;border-radius:12px;padding:24px;display:inline-block;min-width:200px;">
        <span style="font-size:42px;font-weight:800;color:#6366f1;letter-spacing:8px;">${otp}</span>
      </div>
    </div>
    <p style="margin:0;color:#64748b;font-size:13px;text-align:center;">
      This code expires in 10 minutes. Do not share this code with anyone.
    </p>
  `;
  await sendEmail({
    to: email,
    subject: `Your BillFlow verification code: ${otp}`,
    html: baseEmailTemplate(content, 'Verification Code'),
  });
}

export async function sendInvoiceEmail(
  email: string,
  clientName: string,
  invoiceNumber: string,
  amount: string,
  dueDate: string,
  businessName: string,
  viewUrl: string,
  payUrl: string,
  attachment?: EmailAttachment
): Promise<void> {
  const content = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#f1f5f9;">Invoice from ${businessName}</h1>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;">Hi ${clientName}, you have a new invoice.</p>
    <div style="background:#0f172a;border-radius:12px;padding:24px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#64748b;font-size:13px;padding:6px 0;">Invoice Number</td>
          <td style="color:#f1f5f9;font-size:13px;font-weight:600;text-align:right;">${invoiceNumber}</td>
        </tr>
        <tr>
          <td style="color:#64748b;font-size:13px;padding:6px 0;">Amount Due</td>
          <td style="color:#6366f1;font-size:18px;font-weight:800;text-align:right;">${amount}</td>
        </tr>
        <tr>
          <td style="color:#64748b;font-size:13px;padding:6px 0;">Due Date</td>
          <td style="color:#f1f5f9;font-size:13px;font-weight:600;text-align:right;">${dueDate}</td>
        </tr>
      </table>
    </div>
    <div style="text-align:center;margin:32px 0;display:flex;gap:12px;justify-content:center;">
      <a href="${payUrl}" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:600;display:inline-block;margin:4px;">
        Pay Now
      </a>
      <a href="${viewUrl}" style="background:#1e293b;border:1px solid #334155;color:#94a3b8;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:600;display:inline-block;margin:4px;">
        View Invoice
      </a>
    </div>
  `;
  await sendEmail({
    to: email,
    subject: `Invoice ${invoiceNumber} from ${businessName} - ${amount} due`,
    html: baseEmailTemplate(content, `Invoice ${invoiceNumber}`),
    attachments: attachment ? [attachment] : undefined,
  });
}

export async function sendPaymentReceiptEmail(
  email: string,
  clientName: string,
  receiptNumber: string,
  invoiceNumber: string,
  amount: string,
  paymentMethod: string,
  transactionId: string,
  paymentDate: string,
  businessName: string,
  downloadUrl: string
): Promise<void> {
  const content = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#f1f5f9;">Payment Confirmed! ✓</h1>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;">Hi ${clientName}, your payment has been received.</p>
    <div style="background:#0f172a;border-radius:12px;padding:24px;margin-bottom:24px;border-left:4px solid #22c55e;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="color:#64748b;font-size:13px;padding:6px 0;">Receipt Number</td><td style="color:#f1f5f9;font-size:13px;font-weight:600;text-align:right;">${receiptNumber}</td></tr>
        <tr><td style="color:#64748b;font-size:13px;padding:6px 0;">Invoice Number</td><td style="color:#f1f5f9;font-size:13px;font-weight:600;text-align:right;">${invoiceNumber}</td></tr>
        <tr><td style="color:#64748b;font-size:13px;padding:6px 0;">Amount Paid</td><td style="color:#22c55e;font-size:18px;font-weight:800;text-align:right;">${amount}</td></tr>
        <tr><td style="color:#64748b;font-size:13px;padding:6px 0;">Payment Method</td><td style="color:#f1f5f9;font-size:13px;font-weight:600;text-align:right;">${paymentMethod}</td></tr>
        <tr><td style="color:#64748b;font-size:13px;padding:6px 0;">Transaction ID</td><td style="color:#f1f5f9;font-size:12px;font-weight:600;text-align:right;">${transactionId}</td></tr>
        <tr><td style="color:#64748b;font-size:13px;padding:6px 0;">Date</td><td style="color:#f1f5f9;font-size:13px;font-weight:600;text-align:right;">${paymentDate}</td></tr>
      </table>
    </div>
    <div style="text-align:center;margin:32px 0;">
      <a href="${downloadUrl}" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;display:inline-block;">
        Download Receipt
      </a>
    </div>
  `;
  await sendEmail({
    to: email,
    subject: `Payment Confirmed - ${receiptNumber} - ${amount}`,
    html: baseEmailTemplate(content, 'Payment Receipt'),
  });
}

export async function sendInvoiceReminderEmail(
  email: string,
  clientName: string,
  invoiceNumber: string,
  amount: string,
  dueDate: string,
  businessName: string,
  daysOverdue: number,
  payUrl: string
): Promise<void> {
  const isOverdue = daysOverdue > 0;
  const subject = isOverdue
    ? `OVERDUE: Invoice ${invoiceNumber} - ${daysOverdue} days past due`
    : `Reminder: Invoice ${invoiceNumber} due in ${Math.abs(daysOverdue)} days`;

  const content = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#f1f5f9;">${isOverdue ? '⚠️ Overdue Invoice' : '🔔 Payment Reminder'}</h1>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;">Hi ${clientName}, ${isOverdue ? `invoice ${invoiceNumber} from ${businessName} is ${daysOverdue} day(s) overdue.` : `invoice ${invoiceNumber} from ${businessName} is due soon.`}</p>
    <div style="background:#0f172a;border-radius:12px;padding:24px;margin-bottom:24px;border-left:4px solid ${isOverdue ? '#ef4444' : '#f59e0b'};">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="color:#64748b;font-size:13px;padding:6px 0;">Invoice</td><td style="color:#f1f5f9;font-size:13px;font-weight:600;text-align:right;">${invoiceNumber}</td></tr>
        <tr><td style="color:#64748b;font-size:13px;padding:6px 0;">Amount Due</td><td style="color:${isOverdue ? '#ef4444' : '#f59e0b'};font-size:18px;font-weight:800;text-align:right;">${amount}</td></tr>
        <tr><td style="color:#64748b;font-size:13px;padding:6px 0;">Due Date</td><td style="color:#f1f5f9;font-size:13px;font-weight:600;text-align:right;">${dueDate}</td></tr>
      </table>
    </div>
    <div style="text-align:center;margin:32px 0;">
      <a href="${payUrl}" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;display:inline-block;">
        Pay Now
      </a>
    </div>
  `;
  await sendEmail({
    to: email,
    subject,
    html: baseEmailTemplate(content, subject),
  });
}

export async function sendWelcomeEmail(email: string, name: string): Promise<void> {
  const content = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#f1f5f9;">Welcome to BillFlow! 🎉</h1>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;">Hi ${name || 'there'}, your account is ready. Start managing your invoices and payments professionally.</p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${APP_URL}/admin/dashboard" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;display:inline-block;">
        Go to Dashboard
      </a>
    </div>
  `;
  await sendEmail({
    to: email,
    subject: 'Welcome to BillFlow!',
    html: baseEmailTemplate(content, 'Welcome to BillFlow'),
  });
}
