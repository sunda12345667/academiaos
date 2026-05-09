/**
 * Typed Error System
 *
 * Replace raw `new Error('message')` throws with typed errors that carry:
 *   - machine-readable error code (for API responses + frontend matching)
 *   - HTTP status code (for backend function responses)
 *   - structured metadata (for logging and debugging)
 *
 * Usage:
 *   throw new AppError(ErrorCodes.INSUFFICIENT_BALANCE, 'Not enough funds', 402, { available: 5000, required: 10000 });
 *
 * Frontend catch:
 *   } catch (err) {
 *     if (err.code === ErrorCodes.INSUFFICIENT_BALANCE) showTopUpModal();
 *     else toast.error(err.message);
 *   }
 */

export class AppError extends Error {
  constructor(code, message, statusCode = 400, metadata = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.metadata = metadata;
  }

  toJSON() {
    return {
      error: true,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      metadata: this.metadata,
    };
  }
}

// ─── Error Code Registry ──────────────────────────────────────────────────────

export const ErrorCodes = {

  // Wallet / Fintech (WALLET_xxx)
  INSUFFICIENT_BALANCE:       'WALLET_001',
  WALLET_FROZEN:              'WALLET_002',
  WALLET_CLOSED:              'WALLET_003',
  DUPLICATE_TRANSACTION:      'WALLET_004',
  WITHDRAWAL_LIMIT_EXCEEDED:  'WALLET_005',
  KYC_REQUIRED:               'WALLET_006',
  PAYOUT_ALREADY_PROCESSING:  'WALLET_007',
  INVALID_AMOUNT:             'WALLET_008',
  TRANSFER_FAILED:            'WALLET_009',

  // Auth / Identity (AUTH_xxx)
  UNAUTHORIZED:               'AUTH_001',
  FORBIDDEN:                  'AUTH_002',
  INSUFFICIENT_ROLE:          'AUTH_003',
  ACCOUNT_SUSPENDED:          'AUTH_004',
  ACCOUNT_BANNED:             'AUTH_005',
  KYC_MISMATCH:               'AUTH_006',

  // Content / Engagement (CONTENT_xxx)
  POST_NOT_FOUND:             'CONTENT_001',
  DUPLICATE_INTERACTION:      'CONTENT_002',
  POST_REMOVED:               'CONTENT_003',
  RATE_LIMIT_EXCEEDED:        'CONTENT_004',
  CONTENT_TOO_LARGE:          'CONTENT_005',

  // Creator Economy (CREATOR_xxx)
  CREATOR_NOT_FOUND:          'CREATOR_001',
  TRUST_SCORE_TOO_LOW:        'CREATOR_002',
  FOLLOWERS_INSUFFICIENT:     'CREATOR_003',
  MONETIZATION_NOT_ELIGIBLE:  'CREATOR_004',
  VERIFICATION_PENDING:       'CREATOR_005',

  // Social (SOCIAL_xxx)
  ALREADY_FOLLOWING:          'SOCIAL_001',
  BLOCKED_USER:               'SOCIAL_002',
  SELF_FOLLOW_FORBIDDEN:      'SOCIAL_003',

  // Community (COMMUNITY_xxx)
  GROUP_NOT_FOUND:            'COMMUNITY_001',
  ALREADY_MEMBER:             'COMMUNITY_002',
  INVITE_REQUIRED:            'COMMUNITY_003',
  INSUFFICIENT_GROUP_ROLE:    'COMMUNITY_004',

  // Onboarding / Growth (GROWTH_xxx)
  STEP_NOT_FOUND:             'GROWTH_001',
  STEP_ALREADY_COMPLETE:      'GROWTH_002',
  REFERRAL_INVALID:           'GROWTH_003',
  SELF_REFERRAL:              'GROWTH_004',

  // Infrastructure (INFRA_xxx)
  EXTERNAL_SERVICE_TIMEOUT:   'INFRA_001',
  CIRCUIT_OPEN:               'INFRA_002',
  RATE_LIMITED:               'INFRA_003',
  MEDIA_UPLOAD_FAILED:        'INFRA_004',

};

// ─── Guard Helpers ────────────────────────────────────────────────────────────

/**
 * Assert a condition; throw AppError if false.
 * Replaces verbose if-throw patterns.
 *
 * @example
 * assertOrThrow(wallet.balance >= amount, ErrorCodes.INSUFFICIENT_BALANCE,
 *   'Not enough funds', 402, { available: wallet.balance, required: amount });
 */
export function assertOrThrow(condition, code, message, statusCode = 400, metadata = {}) {
  if (!condition) throw new AppError(code, message, statusCode, metadata);
}

/**
 * Check if a caught error is a typed AppError with a specific code.
 * @example
 * } catch (err) {
 *   if (isAppError(err, ErrorCodes.INSUFFICIENT_BALANCE)) showTopUpModal();
 *   else throw err; // re-throw unknown errors
 * }
 */
export function isAppError(err, code = null) {
  if (!(err instanceof AppError)) return false;
  if (code === null) return true;
  return err.code === code;
}

export default { AppError, ErrorCodes, assertOrThrow, isAppError };