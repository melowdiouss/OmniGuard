/**
 * Application Initialization Guide
 * Shows how to wire all security services and middleware together
 */

// ============================================
// EXAMPLE: main.js or server.js
// ============================================

const express = require('express');
const cookieParser = require('cookie-parser');
const db = require('./config/database');
const redis = require('./config/redis');
const logger = require('./config/logger');

// ============== Import Controllers
const { createAuthController } = require('./controllers/authController');
const { createOrderTrackingController } = require('./controllers/orderTrackingController');
const { createAuthRoutes } = require('./routes/auth');
const { createOrderTrackingRoutes } = require('./routes/orderTracking');

// ============== Import Services
const { AuthService } = require('./services/authService');
const { UserRepository } = require('./repositories/userRepository');
const { OrderRepository } = require('./repositories/orderRepository');
const { ShipmentRepository } = require('./repositories/shipmentRepository');
const { ScanRepository } = require('./repositories/scanRepository');
const { TokenRevocationService } = require('./services/tokenRevocationService');
const { RateLimitService } = require('./services/rateLimitService');
const { AccountLockoutService } = require('./services/accountLockoutService');
const { AuditLogService } = require('./services/auditLogService');
const { EmailVerificationService } = require('./services/emailVerificationService');

// ============== Import Token Service Utilities
const { setTokenRevocationService } = require('./services/tokenService');

// ============== Import Job Schedulers
const { initializeTokenCleanupJobs } = require('./jobs/tokenCleanupScheduler');

// ============== Import Middleware
const { enforceSameSiteCookies } = require('./middleware/csrfMiddleware');
const { createAuthMiddleware, authorizeRoles, requireOrgId } = require('./middleware/authMiddleware');
const { createCSRFMiddleware } = require('./middleware/csrfMiddleware');
const { createIPRateLimitMiddleware } = require('./middleware/ipRateLimitMiddleware');
const { ROLES } = require('./constants/roles');

async function initializeApp() {
  const app = express();

  // ============================================
  // 1. BASIC MIDDLEWARE
  // ============================================
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // Enforce SameSite=Strict on all cookies
  app.use(enforceSameSiteCookies);

  // Health check endpoint (no auth required)
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // ============================================
  // 2. INITIALIZE DATABASE & REDIS
  // ============================================
  try {
    // Run migrations
    logger.info('Running database migrations...');
    await db.runMigrations();
    logger.info('Database migrations completed');

    // Test database connection
    await db.query('SELECT 1');
    logger.info('Database connection verified');

    // Test Redis connection
    await redis.ping();
    logger.info('Redis connection verified');
  } catch (error) {
    logger.error('Failed to initialize database or Redis:', error);
    process.exit(1);
  }

  // ============================================
  // 3. INITIALIZE SECURITY SERVICES
  // ============================================

  // Token Revocation Service
  const tokenRevocationService = new TokenRevocationService(db);

  // Register token revocation service with token service
  setTokenRevocationService(tokenRevocationService);

  // Rate Limit Service (uses Redis)
  const rateLimitService = new RateLimitService(db, redis);

  // Account Lockout Service
  const accountLockoutService = new AccountLockoutService(db);

  // Audit Log Service
  const auditLogService = new AuditLogService(db);

  // Email Verification Service
  const emailVerificationService = new EmailVerificationService(db);

  // User Repository
  const userRepository = new UserRepository(db);

  // Order/Shipment/Scan Repositories
  const orderRepository = new OrderRepository(db);
  const shipmentRepository = new ShipmentRepository(db);
  const scanRepository = new ScanRepository(db);

  // ============================================
  // 4. INITIALIZE CONTROLLERS
  // ============================================
  const authController = createAuthController({
    userRepository,
    rateLimitService,
    accountLockoutService,
    emailVerificationService,
    auditLogService,
  });

  const orderTrackingController = createOrderTrackingController({
    orderRepository,
    shipmentRepository,
    scanRepository,
    auditLogService,
  });

  // ============================================
  // 5. REGISTER ROUTES
  // ============================================
  const authRoutes = createAuthRoutes({
    authController,
    userRepository,
    tokenRevocationService,
    auditLogService,
    redisClient: redis,
  });

  const authenticate = createAuthMiddleware({
    userRepository,
    tokenRevocationService,
    auditLogService,
  });

  const csrf = createCSRFMiddleware({ strict: false });
  const apiRateLimit = createIPRateLimitMiddleware({
    windowMs: 15 * 60 * 1000,
    maxRequests: 200,
    redisClient: redis,
  });

  const orderTrackingRoutes = createOrderTrackingRoutes({
    orderTrackingController,
    authenticate,
    authorizeRoles,
    requireOrgId,
    rateLimitMiddleware: apiRateLimit,
    csrfMiddleware: csrf,
  });

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1', orderTrackingRoutes);

  // ============================================
  // 6. INITIALIZE SCHEDULED JOBS
  // ============================================
  initializeTokenCleanupJobs(tokenRevocationService, logger);

  logger.info('Token cleanup jobs initialized');

  // ============================================
  // 7. ERROR HANDLING MIDDLEWARE
  // ============================================
  app.use((error, request, response, next) => {
    logger.error('Unhandled error:', {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      stack: error.stack,
    });

    const statusCode = error.statusCode || 500;
    const code = error.code || 'INTERNAL_SERVER_ERROR';

    return response.status(statusCode).json({
      error: {
        message: error.message || 'Internal server error',
        code,
      },
    });
  });

  // ============================================
  // 8. START SERVER
  // ============================================
  const PORT = process.env.PORT || 3000;
  const HOST = process.env.HOST || '0.0.0.0';

  const server = app.listen(PORT, HOST, () => {
    logger.info(`OmniGuard API Server listening on ${HOST}:${PORT}`);
  });

  // ============================================
  // 9. GRACEFUL SHUTDOWN
  // ============================================
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully...');

    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        await db.end();
        logger.info('Database connections closed');
      } catch (error) {
        logger.error('Error closing database:', error);
      }

      try {
        await redis.quit();
        logger.info('Redis connections closed');
      } catch (error) {
        logger.error('Error closing Redis:', error);
      }

      process.exit(0);
    });
  });

  return app;
}

// ============================================
// START APPLICATION
// ============================================
if (require.main === module) {
  initializeApp().catch((error) => {
    console.error('Failed to initialize application:', error);
    process.exit(1);
  });
}

module.exports = { initializeApp };
