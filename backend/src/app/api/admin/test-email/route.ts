import { NextRequest } from 'next/server';
import { requireAdmin, createErrorResponse, createSuccessResponse, ApiError } from '@/lib/auth-utils';
import { sendEmail, getEmailConfig } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin();
    const body = await request.json().catch(() => ({}));
    const recipient = body.email || user.email;

    if (!recipient) {
      throw new ApiError('Recipient email is required', 400);
    }

    const config = getEmailConfig();
    const usingResend = Boolean(config.resendApiKey);

    const configInfo = {
      provider: usingResend ? 'Resend' : 'Nodemailer SMTP',
      host: usingResend ? 'api.resend.com' : config.host,
      port: usingResend ? 443 : config.port,
      from: config.from,
      user: usingResend ? 'resend_api_key' : (config.user || '(not set)'),
      isConfigured: config.isConfigured,
    };

    console.log(`\n========================================`);
    console.log(`[TEST EMAIL] Initiating test dispatch`);
    console.log(`Recipient: ${recipient}`);
    console.log(`Config:`, configInfo);
    console.log(`========================================\n`);

    const result = await sendEmail({
      to: recipient,
      subject: 'BillFlow Email Configuration Test ✓',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 12px; max-width: 500px; margin: auto;">
          <h2 style="color: #6366f1; margin-top: 0;">⚡ BillFlow Email Test</h2>
          <p>Congratulations! Your email service is properly configured and functioning correctly.</p>
          <hr style="border: 1px solid #334155; margin: 16px 0;" />
          <p style="font-size: 13px; color: #94a3b8;">
            <strong>Provider:</strong> ${configInfo.provider}<br />
            <strong>Timestamp:</strong> ${new Date().toISOString()}<br />
            <strong>Sent to:</strong> ${recipient}
          </p>
        </div>
      `,
      text: `BillFlow Email Test: Email service is working properly! Provider: ${configInfo.provider}`,
    });

    return createSuccessResponse({
      recipient,
      config: configInfo,
      delivery: result,
    }, 'Test email sent successfully');
  } catch (err: any) {
    return createErrorResponse(err);
  }
}
