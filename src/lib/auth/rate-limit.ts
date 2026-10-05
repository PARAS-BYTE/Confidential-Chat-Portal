/**
 * Rate Limiter for Authentication Attempts
 * Tracks failed attempts per IP + Email combination.
 */

interface RateLimitRecord {
  attempts: number;
  lockedUntil: number | null;
  firstAttemptAt: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

function getRateLimitKey(ip: string, email: string): string {
  return `${ip || "unknown-ip"}:${email.toLowerCase().trim()}`;
}

export function checkRateLimit(ip: string, email: string): { isLocked: boolean; remainingAttempts: number; retryAfterSeconds: number } {
  const key = getRateLimitKey(ip, email);
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record) {
    return { isLocked: false, remainingAttempts: MAX_ATTEMPTS, retryAfterSeconds: 0 };
  }

  // Check if locked
  if (record.lockedUntil && record.lockedUntil > now) {
    const retryAfter = Math.ceil((record.lockedUntil - now) / 1000);
    return { isLocked: true, remainingAttempts: 0, retryAfterSeconds: retryAfter };
  }

  // Check if window has expired
  if (now - record.firstAttemptAt > WINDOW_MS) {
    rateLimitMap.delete(key);
    return { isLocked: false, remainingAttempts: MAX_ATTEMPTS, retryAfterSeconds: 0 };
  }

  const remaining = Math.max(0, MAX_ATTEMPTS - record.attempts);
  return { isLocked: false, remainingAttempts: remaining, retryAfterSeconds: 0 };
}

export function recordFailedAttempt(ip: string, email: string): { isLocked: boolean; retryAfterSeconds: number } {
  const key = getRateLimitKey(ip, email);
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now - record.firstAttemptAt > WINDOW_MS) {
    rateLimitMap.set(key, {
      attempts: 1,
      lockedUntil: null,
      firstAttemptAt: now,
    });
    return { isLocked: false, retryAfterSeconds: 0 };
  }

  record.attempts += 1;

  if (record.attempts >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_MS;
    const retryAfter = Math.ceil(LOCKOUT_MS / 1000);
    return { isLocked: true, retryAfterSeconds: retryAfter };
  }

  return { isLocked: false, retryAfterSeconds: 0 };
}

export function clearRateLimit(ip: string, email: string): void {
  const key = getRateLimitKey(ip, email);
  rateLimitMap.delete(key);
}

// For unit testing
export function _resetRateLimits(): void {
  rateLimitMap.clear();
}
