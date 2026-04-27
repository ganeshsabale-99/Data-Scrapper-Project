import crypto from 'crypto';

let warnedAboutMissingSecrets = false;
let cachedConfig: {
  otpSecret: string;
  sessionSecret: string;
  otpTtlMs: number;
  mfaTokenTtlMs: number;
} | null = null;

function getConfig() {
  if (cachedConfig) return cachedConfig;

  const otpSecret = (process.env.OTP_SECRET || '').trim();
  const sessionSecret = (process.env.SESSION_SECRET || '').trim();
  const otpTtlMs = Number(process.env.OTP_TTL_MS || 5 * 60 * 1000);
  const mfaTokenTtlMs = Number(process.env.MFA_TOKEN_TTL_MS || 10 * 60 * 1000);

  const isDev = (process.env.NODE_ENV || '').trim().toLowerCase() === 'development';
  if (!otpSecret || !sessionSecret) {
    if (isDev) {
      if (!warnedAboutMissingSecrets) {
        console.warn(
          'OTP_SECRET/SESSION_SECRET missing. Using insecure defaults in development.',
        );
        warnedAboutMissingSecrets = true;
      }
      cachedConfig = {
        otpSecret: otpSecret || 'dev-otp-secret',
        sessionSecret: sessionSecret || 'dev-session-secret',
        otpTtlMs,
        mfaTokenTtlMs,
      };
      return cachedConfig;
    }
    throw new Error('Missing OTP_SECRET or SESSION_SECRET env vars');
  }

  cachedConfig = { otpSecret, sessionSecret, otpTtlMs, mfaTokenTtlMs };
  return cachedConfig;
}

interface OTPData {
  identifier: string; 
  type: 'phone' | 'email';
  timestamp: number;
  counter: number;
}

const isHexString = (value: string): boolean =>
  /^[a-fA-F0-9]+$/.test(value) && value.length % 2 === 0;


export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}


export function createOTPHash(identifier: string, otp: string, timestamp: number, counter: number): string {
  const { otpSecret } = getConfig();
  const data = `${identifier}:${otp}:${timestamp}:${counter}`;
  return crypto.createHmac('sha256', otpSecret).update(data).digest('hex');
}

export function createOTPVerificationData(identifier: string, otp: string, type: 'phone' | 'email' = 'phone'): {
  hash: string;
  timestamp: number;
  counter: number;
  expiresAt: number;
  type: 'phone' | 'email';
} {
  const { otpTtlMs } = getConfig();
  const timestamp = Date.now();
  const counter = Math.floor(timestamp / otpTtlMs); 
  const expiresAt = timestamp + otpTtlMs; 
  
  const hash = createOTPHash(identifier, otp, timestamp, counter);
  
  return {
    hash,
    timestamp,
    counter,
    expiresAt,
    type
  };
}

export function verifyOTP(
  identifier: string, 
  otp: string, 
  hash: string, 
  timestamp: number, 
  counter: number
): boolean {
  const { otpTtlMs } = getConfig();
  if (Date.now() > timestamp + otpTtlMs) {
    return false;
  }
  
  const expectedHash = createOTPHash(identifier, otp, timestamp, counter);
  if (!isHexString(hash) || !isHexString(expectedHash)) {
    return false;
  }

  const providedBuffer = Buffer.from(hash, "hex");
  const expectedBuffer = Buffer.from(expectedHash, "hex");
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

export function createSessionToken(userId: string, identifier: string, type: 'phone' | 'email' = 'phone'): string {
  const { sessionSecret } = getConfig();
  const timestamp = Date.now();
  const data = `${userId}:${identifier}:${type}:${timestamp}:session`;
  const hash = crypto.createHmac('sha256', sessionSecret).update(data).digest('hex');
  
  const tokenData = {
    userId,
    identifier,
    type,
    timestamp,
    hash
  };
  
  return Buffer.from(JSON.stringify(tokenData)).toString('base64');
}

export function createMfaToken(userId: string, identifier: string, type: 'phone' | 'email' = 'phone'): string {
  const { sessionSecret } = getConfig();
  const timestamp = Date.now();
  const data = `${userId}:${identifier}:${type}:${timestamp}:mfa`;
  const hash = crypto.createHmac('sha256', sessionSecret).update(data).digest('hex');

  const tokenData = {
    userId,
    identifier,
    type,
    timestamp,
    hash,
    purpose: 'mfa'
  };

  return Buffer.from(JSON.stringify(tokenData)).toString('base64');
}

export function verifySessionToken(token: string): { userId: string; identifier: string; type: 'phone' | 'email' } | null {
  try {
    const { sessionSecret } = getConfig();
    const tokenData = JSON.parse(Buffer.from(token, 'base64').toString());
    const { userId, identifier, type, timestamp, hash } = tokenData;
    
    if (Date.now() > timestamp + (24 * 60 * 60 * 1000)) {
      return null;
    }
    
    const data = `${userId}:${identifier}:${type}:${timestamp}:session`;
    const expectedHash = crypto.createHmac('sha256', sessionSecret).update(data).digest('hex');
    
    if (!crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(expectedHash, 'hex')
    )) {
      return null;
    }
    
    return { userId, identifier, type };
  } catch (error) {
    return null;
  }
}

export function verifyMfaToken(token: string): { userId: string; identifier: string; type: 'phone' | 'email' } | null {
  try {
    const { sessionSecret, mfaTokenTtlMs } = getConfig();
    const tokenData = JSON.parse(Buffer.from(token, 'base64').toString());
    const { userId, identifier, type, timestamp, hash, purpose } = tokenData;

    if (purpose !== 'mfa') {
      return null;
    }

    if (Date.now() > timestamp + mfaTokenTtlMs) {
      return null;
    }

    const data = `${userId}:${identifier}:${type}:${timestamp}:mfa`;
    const expectedHash = crypto.createHmac('sha256', sessionSecret).update(data).digest('hex');

    if (!crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(expectedHash, 'hex')
    )) {
      return null;
    }

    return { userId, identifier, type };
  } catch (error) {
    return null;
  }
}

export function getTokenExpirationInfo(token: string): { 
  isValid: boolean; 
  expiresAt: Date; 
  isExpired: boolean;
  timeRemaining: number; 
} | null {
  try {
    const tokenData = JSON.parse(Buffer.from(token, 'base64').toString());
    const { timestamp } = tokenData;
    
    const expiresAt = new Date(timestamp + (24 * 60 * 60 * 1000));
    const now = new Date();
    const timeRemaining = expiresAt.getTime() - now.getTime();
    const isExpired = timeRemaining <= 0;
    
    return {
      isValid: true,
      expiresAt,
      isExpired,
      timeRemaining: Math.max(0, timeRemaining)
    };
  } catch (error) {
    return null;
  }
}

export function generateSalt(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function createSaltedOTPHash(identifier: string, otp: string, salt: string, timestamp: number): string {
  const { otpSecret } = getConfig();
  const data = `${identifier}:${otp}:${salt}:${timestamp}`;
  return crypto.createHmac('sha256', otpSecret).update(data).digest('hex');
}

export function createRateLimitHash(identifier: string, timestamp: number): string {
  const { otpSecret } = getConfig();
  const window = Math.floor(timestamp / (60 * 1000)); 
  const data = `${identifier}:${window}`;
  return crypto.createHmac('sha256', otpSecret).update(data).digest('hex');
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPhoneNumber(phoneNumber: string): boolean {
  const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
  return phoneRegex.test(phoneNumber);
}

export function getIdentifierType(identifier: string): 'email' | 'phone' {
  return isValidEmail(identifier) ? 'email' : 'phone';
} 
