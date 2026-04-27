import "dotenv/config";
import nodemailer from 'nodemailer';

type MailConfigSource = "SMTP" | "GMAIL" | "NODEMAILER" | "NONE";
type MailProvider = "smtp" | "gmail" | "not_configured";

export type EmailTransportMetadata = {
  configured: boolean;
  provider: MailProvider;
  source: MailConfigSource;
  fromAddress: string | null;
  host: string | null;
  port: number | null;
  secure: boolean | null;
};

export type EmailTransportRuntimeConfig = {
  metadata: EmailTransportMetadata;
  transportOptions: Record<string, unknown>;
  fromAddress: string;
};

type EmailConfigResolution =
  | {
    kind: "none";
    metadata: EmailTransportMetadata;
  }
  | {
    kind: "configured";
    metadata: EmailTransportMetadata;
    transportOptions: Record<string, unknown>;
  };

const readTrimmed = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
};

const parsePort = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const resolveEmailConfig = (): EmailConfigResolution => {
  const smtpHost = readTrimmed(process.env.SMTP_HOST);
  const smtpUser = readTrimmed(process.env.SMTP_USER);
  const smtpPass = readTrimmed(process.env.SMTP_PASS);
  const smtpPort = parsePort(process.env.SMTP_PORT, 587);
  const smtpSecure = parseBoolean(process.env.SMTP_SECURE, smtpPort === 465);
  const smtpFrom = readTrimmed(process.env.SMTP_FROM) || smtpUser || null;

  if (smtpHost && smtpUser && smtpPass) {
    return {
      kind: "configured",
      metadata: {
        configured: true,
        provider: "smtp",
        source: "SMTP",
        fromAddress: smtpFrom,
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
      },
      transportOptions: {
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      },
    };
  }

  const gmailUser = readTrimmed(process.env.GMAIL_USER) || readTrimmed(process.env.NODEMAILER_EMAIL);
  const gmailPass = (readTrimmed(process.env.GMAIL_APP_PASSWORD) || readTrimmed(process.env.NODEMAILER_PASSWORD))?.replace(/\s+/g, '');
  const source: MailConfigSource = process.env.GMAIL_USER || process.env.GMAIL_APP_PASSWORD ? "GMAIL" : "NODEMAILER";

  if (gmailUser && gmailPass) {
    return {
      kind: "configured",
      metadata: {
        configured: true,
        provider: "gmail",
        source,
        fromAddress: gmailUser,
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
      },
      transportOptions: {
        service: "gmail",
        auth: {
          user: gmailUser,
          pass: gmailPass,
        },
      },
    };
  }

  return {
    kind: "none",
    metadata: {
      configured: false,
      provider: "not_configured",
      source: "NONE",
      fromAddress: null,
      host: null,
      port: null,
      secure: null,
    },
  };
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
  let timeoutHandle: NodeJS.Timeout | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
};

export const getEmailTransportMetadata = (): EmailTransportMetadata => resolveEmailConfig().metadata;

export const getEmailTransportRuntimeConfig = (): EmailTransportRuntimeConfig | null => {
  const resolvedConfig = resolveEmailConfig();
  if (resolvedConfig.kind !== "configured") {
    return null;
  }

  const fromAddress = resolvedConfig.metadata.fromAddress;
  if (!fromAddress) {
    return null;
  }

  return {
    metadata: resolvedConfig.metadata,
    transportOptions: resolvedConfig.transportOptions,
    fromAddress,
  };
};

export const verifyEmailTransportConnection = async (timeoutMs = 6000): Promise<{
  status: "healthy" | "not_configured" | "unhealthy";
  latencyMs: number;
  metadata: EmailTransportMetadata;
  error?: string;
}> => {
  const startedAt = Date.now();
  const resolvedConfig = resolveEmailConfig();

  if (resolvedConfig.kind === "none") {
    return {
      status: "not_configured",
      latencyMs: Date.now() - startedAt,
      metadata: resolvedConfig.metadata,
    };
  }

  const transporter = nodemailer.createTransport(resolvedConfig.transportOptions);
  try {
    await withTimeout(
      transporter.verify(),
      timeoutMs,
      `SMTP verification timed out after ${timeoutMs}ms`,
    );

    return {
      status: "healthy",
      latencyMs: Date.now() - startedAt,
      metadata: resolvedConfig.metadata,
    };
  } catch (error: any) {
    return {
      status: "unhealthy",
      latencyMs: Date.now() - startedAt,
      metadata: resolvedConfig.metadata,
      error: error?.message || "SMTP verification failed",
    };
  }
};

export class EmailService {
  private transporter: nodemailer.Transporter | null;
  private fromAddress: string | null;

  constructor() {
    const runtimeConfig = getEmailTransportRuntimeConfig();
    this.fromAddress = runtimeConfig?.fromAddress || null;
    this.transporter = runtimeConfig
      ? nodemailer.createTransport(runtimeConfig.transportOptions)
      : null;
  }

  async sendApprovalEmail(params: { to: string; name?: string | null; loginUrl: string; username: string; }): Promise<boolean> {
    const { to, name, loginUrl, username } = params;
    try {
      if (!this.transporter || !this.fromAddress) {
        console.error("Email transport is not configured. Skipping approval email.");
        return false;
      }

      const info = await this.transporter.sendMail({
        from: this.fromAddress,
        to,
        subject: 'Your GUPIO account has been approved',
        html: this.approvalTemplate({ name, loginUrl, username }),
        text: `Your GUPIO account has been approved. Username: ${username}. Login: ${loginUrl}. Use the password you created during signup. For security, we never send passwords via email.`,
      });
      return !!info.messageId;
    } catch (error: any) {
      console.error('Error sending approval email:', error?.response?.data || error.message);
      return false;
    }
  }

  async sendRejectionEmail(params: { to: string; name?: string | null; reason?: string | null; supportUrl?: string; }): Promise<boolean> {
    const { to, name, reason, supportUrl } = params;
    try {
      if (!this.transporter || !this.fromAddress) {
        console.error("Email transport is not configured. Skipping rejection email.");
        return false;
      }

      const info = await this.transporter.sendMail({
        from: this.fromAddress,
        to,
        subject: 'Your GUPIO registration was not approved',
        html: this.rejectionTemplate({ name, reason, supportUrl }),
        text: `Your GUPIO registration was not approved.${reason ? ` Reason: ${reason}.` : ''}${supportUrl ? ` Contact support: ${supportUrl}` : ''}`,
      });
      return !!info.messageId;
    } catch (error: any) {
      console.error('Error sending rejection email:', error?.response?.data || error.message);
      return false;
    }
  }

  async sendDailyReportEmail(params: {
    to: string;
    date: string;
    metrics: {
      visited: number;
      verified: number;
      pending: number;
    };
  }): Promise<boolean> {
    const { to, date, metrics } = params;
    try {
      if (!this.transporter || !this.fromAddress) {
        console.error("Email transport is not configured. Skipping daily report email.");
        return false;
      }

      const info = await this.transporter.sendMail({
        from: this.fromAddress,
        to,
        subject: `Daily Progress Report - ${date}`,
        html: this.dailyReportTemplate({ date, metrics }),
        text: `Daily Progress Report for ${date}:\nVisited: ${metrics.visited}\nVerified: ${metrics.verified}\nPending: ${metrics.pending}`,
      });
      return !!info.messageId;
    } catch (error: any) {
      console.error('Error sending daily report email:', error?.response?.data || error.message);
      return false;
    }
  }

  private dailyReportTemplate(params: {
    date: string;
    metrics: {
      visited: number;
      verified: number;
      pending: number;
    };
  }): string {
    const { date, metrics } = params;
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Daily Progress Report</title>
        <style>
          /* Reset and base styles */
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
            line-height: 1.6; color: #1a202c; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            min-height: 100vh; padding: 20px 0; 
          }
          
          /* Container */
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); overflow: hidden; }
          
          /* Header */
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; color: white; }
          .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; letter-spacing: -0.5px; }
          .header p { font-size: 16px; opacity: 0.9; }
          
          /* Content */
          .content { padding: 40px 30px; background: #ffffff; }
          .content h2 { font-size: 20px; font-weight: 600; margin-bottom: 24px; color: #334155; }
          
          /* Grid/Cards */
          .grid { margin-bottom: 32px; }
          .card { padding: 24px; border-radius: 12px; background: #f8fafc; margin-bottom: 16px; position: relative; overflow: hidden; border-left: 4px solid; }
          .card::before { content: ''; position: absolute; top: 0; right: 0; bottom: 0; left: 0; background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.8) 100%); opacity: 0.5; pointer-events: none; }
          .card-visited { border-left-color: #3b82f6; border-top: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; }
          .card-verified { border-left-color: #10b981; border-top: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; }
          .card-pending { border-left-color: #f59e0b; border-top: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; }
          
          .card-label { display: block; color: #64748b; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
          .card-value { display: block; font-size: 36px; font-weight: 800; font-family: 'Courier New', monospace; letter-spacing: 2px; }
          .card-desc { margin-top: 8px; color: #64748b; font-size: 13px; }
          
          .card-visited .card-value { color: #1e3a8a; }
          .card-verified .card-value { color: #064e3b; }
          .card-pending .card-value { color: #78350f; }
          
          /* Footer */
          .footer { background: #f7fafc; padding: 24px 30px; text-align: center; border-top: 1px solid #e2e8f0; }
          .footer p { font-size: 12px; color: #718096; margin-bottom: 8px; }
          
          /* Responsive */
          @media (max-width: 600px) {
            .container { margin: 10px; border-radius: 12px; }
            .header { padding: 30px 20px; }
            .content { padding: 30px 20px; }
            .card-value { font-size: 28px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>GUPIO Tech Park Analyzer</h1>
            <p>Daily Progress Report &bull; ${date}</p>
          </div>
          
          <div class="content">
            <h2>Summary for today:</h2>
            
            <div class="grid">
              <div class="card card-visited">
                <span class="card-label">Tech Parks Visited</span>
                <span class="card-value">${metrics.visited}</span>
                <p class="card-desc">Total tech parks updated in the last 24 hours</p>
              </div>
              
              <div class="card card-verified">
                <span class="card-label">Tech Parks Verified</span>
                <span class="card-value">${metrics.verified}</span>
                <p class="card-desc">New verifications completed today</p>
              </div>
              
              <div class="card card-pending">
                <span class="card-label">Pending Verifications</span>
                <span class="card-value">${metrics.pending}</span>
                <p class="card-desc">Total active tech parks still awaiting verification</p>
              </div>
            </div>
            
            <p style="margin-top: 32px; font-weight: 500; color: #2d3748;">
              Keep up the great work!<br>
              <strong>The GUPIO System</strong>
            </p>
          </div>
          
          <div class="footer">
            <p>This is an automated report generated by Tech Park Analyzer.</p>
            <p>&copy; ${new Date().getFullYear()} GUPIO. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private approvalTemplate(params: { name?: string | null; loginUrl: string; username: string; }): string {
    const { name, loginUrl, username } = params;
    const displayName = name || 'there';
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Account Approved</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
            line-height: 1.6; color: #1a202c; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh; padding: 20px 0;
          }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); overflow: hidden; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; color: white; }
          .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; letter-spacing: -0.5px; }
          .content { padding: 40px 30px; }
          .content h2 { font-size: 24px; font-weight: 600; color: #1a202c; margin-bottom: 16px; }
          .content p { font-size: 16px; color: #4a5568; margin-bottom: 24px; }
          
          /* Info Box */
          .info-box { background: #f7fafc; padding: 24px; border-radius: 12px; border: 2px solid #e2e8f0; margin: 32px 0; }
          .info-row { margin-bottom: 12px; }
          .info-label { font-weight: 600; color: #718096; display: block; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; }
          .info-value { font-size: 20px; color: #2d3748; font-weight: 700; word-break: break-all; }
          
          .btn { display: inline-block; background: linear-gradient(90deg, #667eea, #764ba2); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px; text-align: center; margin-top: 16px; transition: opacity 0.2s; border: none; }
          
          /* Notice */
          .notice { font-size: 14px; background: #fffbeb; padding: 16px; border-left: 4px solid #f59e0b; border-radius: 0 8px 8px 0; margin: 24px 0; color: #92400E; }
          
          .footer { background: #f7fafc; padding: 24px 30px; text-align: center; border-top: 1px solid #e2e8f0; }
          .footer p { font-size: 12px; color: #718096; margin-bottom: 8px; }
          
          @media (max-width: 600px) {
            .container { margin: 10px; border-radius: 12px; }
            .header { padding: 30px 20px; }
            .content { padding: 30px 20px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1>GUPIO Tech Park Analyzer</h1></div>
          <div class="content">
            <h2>Welcome aboard, ${displayName}! 🎉</h2>
            <p>Great news! Your GUPIO account has been approved by our administrators. You can now access the full platform.</p>
            
            <div class="info-box">
              <div class="info-row">
                <span class="info-label">Your Username</span>
                <span class="info-value">${username}</span>
              </div>
              <div style="text-align: center;">
                <a href="${loginUrl}" class="btn">Sign In Now</a>
              </div>
            </div>
            
            <div class="notice">
              <strong>Security Note:</strong> Please use the password you created during signup. For your security, we never send passwords via email.
            </div>
            
            <p style="margin-top: 32px; font-weight: 500; color: #2d3748;">
              Best regards,<br>
              <strong>The GUPIO Team</strong>
            </p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>&copy; ${new Date().getFullYear()} GUPIO Tech Park Analyzer. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private rejectionTemplate(params: { name?: string | null; reason?: string | null; supportUrl?: string; }): string {
    const { name, reason, supportUrl } = params;
    const displayName = name || 'there';
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Registration Update</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1a202c; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 20px 0; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); overflow: hidden; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; color: white; }
          .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; letter-spacing: -0.5px; }
          .content { padding: 40px 30px; }
          .content h2 { font-size: 24px; font-weight: 600; color: #1a202c; margin-bottom: 16px; }
          .content p { font-size: 16px; color: #4a5568; margin-bottom: 24px; }
          
          /* Rejection Notice Box */
          .notice-box { background: #fff5f5; border: 1px solid #feb2b2; padding: 24px; border-radius: 12px; margin: 32px 0; }
          .notice-box h3 { color: #c53030; font-size: 18px; margin-bottom: 12px; }
          .reason-text { color: #742a2a; border-left: 3px solid #f56565; padding-left: 12px; margin-top: 8px; }
          
          .btn-outline { display: inline-block; border: 2px solid #667eea; color: #667eea; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 16px; text-align: center; margin-top: 16px; transition: all 0.2s; }
          
          .footer { background: #f7fafc; padding: 24px 30px; text-align: center; border-top: 1px solid #e2e8f0; }
          .footer p { font-size: 12px; color: #718096; margin-bottom: 8px; }
          
          @media (max-width: 600px) {
            .container { margin: 10px; border-radius: 12px; }
            .header { padding: 30px 20px; }
            .content { padding: 30px 20px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1>GUPIO Tech Park Analyzer</h1></div>
          <div class="content">
            <h2>Registration Update</h2>
            <p>Hi ${displayName},</p>
            <p>Thank you for your interest in GUPIO. After careful review, we are unable to approve your registration at this time.</p>
            
            ${reason ? `
            <div class="notice-box">
              <h3>Admin Note</h3>
              <div class="reason-text">${reason}</div>
            </div>
            ` : ''}
            
            <p>If you believe this was a mistake or you have updated information to provide, please reach out to our support team.</p>
            
            ${supportUrl ? `
            <div style="text-align: center; margin: 32px 0;">
              <a href="${supportUrl}" class="btn-outline">Contact Support</a>
            </div>
            ` : ''}
            
            <p style="margin-top: 32px; font-weight: 500; color: #2d3748;">
              Best regards,<br>
              <strong>The GUPIO Team</strong>
            </p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>&copy; ${new Date().getFullYear()} GUPIO Tech Park Analyzer. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

export function getEmailService(): EmailService {
  return new EmailService();
}
