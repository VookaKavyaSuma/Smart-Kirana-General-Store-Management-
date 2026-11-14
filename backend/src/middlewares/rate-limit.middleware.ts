import rateLimit from 'express-rate-limit';

// Skip rate limiting in test or local development environments so test suites don't get blocked
const shouldSkip = (req: any) =>
  process.env.NODE_ENV === 'test' ||
  process.env.NODE_ENV === 'development' ||
  req.ip === '127.0.0.1' ||
  req.ip === '::1' ||
  req.ip === '::ffff:127.0.0.1';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 login requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many login attempts. Please try again after 15 minutes.',
  },
  skip: shouldSkip,
});

export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 OTP requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many OTP requests. Please try again after 15 minutes.',
  },
  skip: shouldSkip,
});

export const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // generous limit for general API usage
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkip,
});

