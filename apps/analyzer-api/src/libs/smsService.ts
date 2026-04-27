import "dotenv/config";
import path from "path";
import { logOperationalEvent } from "./serviceHealthLogger";
import axios from 'axios';
import nodemailer from 'nodemailer';
import { getEmailTransportRuntimeConfig } from "./emailService";

export type SMSProvider = "FLASH49" | "GMAIL" | "MOCK";

export interface SMSDispatchResult {
  accepted: boolean;
  provider: SMSProvider;
  transactionId?: string;
  providerState?: string;
  providerDescription?: string;
  errorMessage?: string;
  rawResponse?: unknown;
}

export interface SMSService {
  sendOTP(phoneNumber: string, otp: string): Promise<SMSDispatchResult>;
}

export class Flash49SMSService implements SMSService {
  async sendOTP(phoneNumber: string, otp: string): Promise<SMSDispatchResult> {
    try {
      const username = process.env.FLASH49_USERNAME;
      const password = process.env.FLASH49_PASSWORD;
      const from = process.env.FLASH49_FROM;
      const dltContentId = process.env.FLASH49_DLT_CONTENT_ID;

      let formattedPhoneNumber = phoneNumber.replace(/\D/g, '');

      if (!formattedPhoneNumber.startsWith('91')) {
        formattedPhoneNumber = '91' + formattedPhoneNumber;
      }

      if (dltContentId && !/^\d{4,19}$/.test(dltContentId)) {
        logOperationalEvent("sms.flash49.config_error", { dltContentId, reason: "invalid_format" }, "error");
        return {
          accepted: false,
          provider: "FLASH49",
          providerState: "CONFIG_ERROR",
          providerDescription: "Invalid DLT Content ID format",
          errorMessage: "Invalid DLT Content ID format"
        };
      }

      if (!username || !password || !from || !dltContentId) {
        logOperationalEvent("sms.flash49.config_error", { 
          missing_username: !username,
          missing_password: !password,
          missing_from: !from,
          missing_dltContentId: !dltContentId
        }, "error");
        return {
          accepted: false,
          provider: "FLASH49",
          providerState: "CONFIG_ERROR",
          providerDescription: "Missing required Flash49 environment variables",
          errorMessage: "Missing required Flash49 environment variables",
        };
      }

      const url = `https://api.flash49.com/fe/api/v1/send`;
      const smsText = `Your OTP is ${otp} to Login GUPIO. It is valid for 5 minutes. Do not share this with anyone. GUPIO.`;
      const params = {
        username: username,
        password: password,
        unicode: 1,
        from: from,
        to: formattedPhoneNumber,
        text: smsText,
        dltContentId: dltContentId,
      };

      logOperationalEvent("sms.flash49.sending", {
        to: formattedPhoneNumber,
        from,
        contentId: dltContentId,
        textLength: smsText.length,
      });

      const response = await axios.get(url, { params });

      logOperationalEvent("sms.flash49.response", { response: response.data });

      const transactionId =
        response.data?.transactionId !== undefined && response.data?.transactionId !== null
          ? String(response.data.transactionId)
          : undefined;
      const state =
        typeof response.data?.state === "string" ? response.data.state : undefined;
      const description =
        typeof response.data?.description === "string" ? response.data.description : undefined;

      if (response.data && response.data.state === 'SUBMIT_ACCEPTED') {
        logOperationalEvent("sms.flash49.success", { to: formattedPhoneNumber });
        return {
          accepted: true,
          provider: "FLASH49",
          transactionId,
          providerState: state,
          providerDescription: description,
          rawResponse: response.data,
        };
      } else if (response.data && response.data.state === 'SUBMIT_FAILED') {
        logOperationalEvent("sms.flash49.submit_failed", { description, data: response.data }, "error");
        return {
          accepted: false,
          provider: "FLASH49",
          transactionId,
          providerState: state,
          providerDescription: description || "SMS submission failed",
          rawResponse: response.data,
        };
      } else {
        logOperationalEvent("sms.flash49.unexpected_state", { state, data: response.data }, "error");
        return {
          accepted: false,
          provider: "FLASH49",
          transactionId,
          providerState: state || "UNKNOWN",
          providerDescription: description || "Unexpected Flash49 response state",
          rawResponse: response.data,
        };
      }
    } catch (error: any) {
      logOperationalEvent("sms.flash49.error", { 
        message: error?.message,
        status: error?.response?.status,
        data: error?.response?.data
      }, "error");
      return {
        accepted: false,
        provider: "FLASH49",
        providerState: "HTTP_ERROR",
        providerDescription: "Flash49 request failed",
        errorMessage: error?.message || "Unknown Flash49 error",
        rawResponse: error?.response?.data,
      };
    }
  }
}

export class GmailSMSService implements SMSService {
  private transporter: nodemailer.Transporter | null;
  private fromAddress: string | null;

  constructor() {
    const runtimeConfig = getEmailTransportRuntimeConfig();
    this.fromAddress = runtimeConfig?.fromAddress || null;
    this.transporter = runtimeConfig
      ? nodemailer.createTransport(runtimeConfig.transportOptions)
      : null;
  }

  async sendOTP(emailAddress: string, otp: string): Promise<SMSDispatchResult> {
    try {
      if (!this.transporter || !this.fromAddress) {
        return {
          accepted: false,
          provider: "GMAIL",
          providerState: "CONFIG_ERROR",
          providerDescription: "Email transport is not configured",
          errorMessage: "Missing SMTP/Gmail credentials for OTP email delivery",
        };
      }

      const mailOptions = {
        from: this.fromAddress,
        to: emailAddress,
        subject: 'GUPIO Tech Park Analyzer - OTP Verification',
        html: this.createEmailTemplate(otp),
        text: `Your OTP is ${otp} to Login GUPIO Tech Park Analyzer. It is valid for 5 minutes. Do not share this with anyone. GUPIO.`,
      };

      const info = await this.transporter.sendMail(mailOptions);

      if (info.messageId) {
        logOperationalEvent("email.gmail.success", { messageId: info.messageId });
        return {
          accepted: true,
          provider: "GMAIL",
          transactionId: info.messageId,
          providerState: "SUBMIT_ACCEPTED",
          providerDescription: "Email queued by Gmail",
        };
      } else {
        logOperationalEvent("email.gmail.failed", { reason: "missing_message_id" }, "error");
        return {
          accepted: false,
          provider: "GMAIL",
          providerState: "SUBMIT_FAILED",
          providerDescription: "Failed to send email via Gmail",
          errorMessage: "Missing messageId in Gmail response",
        };
      }
    } catch (error: any) {
      logOperationalEvent("email.gmail.error", { 
        message: error.message,
        data: error?.response?.data
      }, "error");
      return {
        accepted: false,
        provider: "GMAIL",
        providerState: "HTTP_ERROR",
        providerDescription: "Gmail send failed",
        errorMessage: error?.message || "Unknown Gmail error",
        rawResponse: error?.response?.data,
      };
    }
  }

  private createEmailTemplate(otp: string): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <title>GUPIO OTP Verification</title>
        <style>
          /* Reset and base styles */
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
            line-height: 1.6; 
            color: #1a202c; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px 0;
          }
          
          /* Container */
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: #ffffff;
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            overflow: hidden;
          }
          
          /* Header */
          .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 30px;
            text-align: center;
            color: white;
          }
          .header h1 { 
            font-size: 28px; 
            font-weight: 700; 
            margin-bottom: 8px;
            letter-spacing: -0.5px;
          }
          .header p { 
            font-size: 16px; 
            opacity: 0.9;
            font-weight: 400;
          }
          
          /* Content */
          .content { 
            padding: 40px 30px;
            background: #ffffff;
          }
          .content h2 { 
            font-size: 24px; 
            font-weight: 600; 
            color: #1a202c;
            margin-bottom: 16px;
          }
          .content p { 
            font-size: 16px; 
            color: #4a5568;
            margin-bottom: 24px;
            line-height: 1.7;
          }
          
          /* OTP Box */
          .otp-box { 
            background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
            padding: 32px 24px;
            text-align: center;
            margin: 32px 0;
            border-radius: 12px;
            border: 2px solid #e2e8f0;
            position: relative;
            overflow: hidden;
          }
          .otp-box::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #667eea, #764ba2);
          }
          .otp-code { 
            font-size: 48px; 
            font-weight: 800; 
            color: #2d3748;
            letter-spacing: 8px;
            font-family: 'Courier New', monospace;
            margin-bottom: 12px;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          .otp-validity { 
            font-size: 14px; 
            color: #718096;
            font-weight: 500;
          }
          
          /* Security Notice */
          .security-notice { 
            background: linear-gradient(135deg, #fff5f5 0%, #fed7d7 100%);
            border: 1px solid #feb2b2;
            padding: 24px;
            border-radius: 12px;
            margin: 32px 0;
            position: relative;
          }
          .security-notice::before {
            content: '🔒';
            position: absolute;
            top: -12px;
            left: 20px;
            background: #ffffff;
            padding: 4px 8px;
            border-radius: 50%;
            font-size: 16px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          .security-notice h3 { 
            font-size: 18px; 
            font-weight: 600; 
            color: #c53030;
            margin-bottom: 16px;
            padding-left: 8px;
          }
          .security-notice ul { 
            list-style: none;
            padding-left: 8px;
          }
          .security-notice li { 
            font-size: 14px; 
            color: #742a2a;
            margin-bottom: 8px;
            position: relative;
            padding-left: 20px;
          }
          .security-notice li::before {
            content: '•';
            position: absolute;
            left: 0;
            color: #e53e3e;
            font-weight: bold;
          }
          
          /* Footer */
          .footer { 
            background: #f7fafc;
            padding: 24px 30px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
          }
          .footer p { 
            font-size: 12px; 
            color: #718096;
            margin-bottom: 8px;
          }
          .footer .copyright {
            font-weight: 500;
            color: #4a5568;
          }
          
          /* Responsive */
          @media (max-width: 600px) {
            .container { margin: 10px; border-radius: 12px; }
            .header { padding: 30px 20px; }
            .content { padding: 30px 20px; }
            .footer { padding: 20px; }
            .otp-code { font-size: 36px; letter-spacing: 6px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>GUPIO Tech Park Analyzer</h1>
          </div>
          
          <div class="content">
            <h2>Hello there! 👋</h2>
            <p>We received a login request for your GUPIO Tech Park Analyzer account. To ensure your account security, please use the verification code below to complete your login process.</p>
            
            <div class="otp-box">
              <div class="otp-code">${otp}</div>
              <div class="otp-validity">⏰ Valid for 5 minutes</div>
            </div>
            
            <div class="security-notice">
              <h3>Security Notice</h3>
              <ul>
                <li>Never share this verification code with anyone</li>
                <li>GUPIO will never ask for your OTP via phone call or email</li>
                <li>If you didn't request this code, please ignore this email</li>
                <li>For additional security, enable two-factor authentication</li>
              </ul>
            </div>
            
            <p>If you have any questions or concerns, please don't hesitate to contact our support team. We're here to help!</p>
            
            <p style="margin-top: 32px; font-weight: 500; color: #2d3748;">
              Best regards,<br>
              <strong>The GUPIO Team</strong>
            </p>
          </div>
          
          <div class="footer">
            <p>This is an automated security message. Please do not reply to this email.</p>
            <p class="copyright">&copy; 2024 GUPIO Tech Park Analyzer. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

class MockSMSService implements SMSService {
  async sendOTP(phoneNumber: string, otp: string): Promise<SMSDispatchResult> {
    logOperationalEvent("sms.mock.sending", { otp, phoneNumber });
    return {
      accepted: true,
      provider: "MOCK",
      transactionId: `mock-${Date.now()}`,
      providerState: "MOCKED",
      providerDescription: "OTP not sent to carrier. Mock mode active.",
    };
  }
}

export function getSMSService(): SMSService {
  const smsProvider = process.env.SMS_PROVIDER;
  const smsMock = process.env.SMS_MOCK === "true";

  if (smsMock) {
    logOperationalEvent("sms.service.init", { provider: "mock" });
    return new MockSMSService();
  }

  if (smsProvider === "flash49") {
    logOperationalEvent("sms.service.init", { provider: "flash49" });
    return new Flash49SMSService();
  }

  if (smsProvider === "gmail") {
    logOperationalEvent("sms.service.init", { provider: "gmail" });
    return new GmailSMSService();
  }

  // Fallbacks if SMS_PROVIDER is not explicitly set
  if (process.env.NODE_ENV === "development") {
    logOperationalEvent("sms.service.init", { provider: "mock", reason: "development_default" });
    return new MockSMSService();
  }

  logOperationalEvent("sms.service.init", { provider: "gmail", reason: "production_fallback" });
  return new GmailSMSService();
}
