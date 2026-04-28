/**
 * Token Cleanup Job Scheduler
 * Runs scheduled cleanup tasks for expired tokens and revoked entries
 * Should be initialized in the main application startup
 */

const schedule = require('node-schedule');

const CLEANUP_CRON = '0 2 * * *'; // Run daily at 2 AM
const ARCHIVE_CRON = '0 3 * * 0'; // Run weekly on Sunday at 3 AM

let tokenCleanupJob = null;
let tokenArchiveJob = null;

function initializeTokenCleanupJobs(tokenRevocationService, logger) {
  if (!tokenRevocationService) {
    if (logger) {
      logger.warn('[TokenCleanup] TokenRevocationService not provided, token cleanup disabled');
    }
    return;
  }

  // Schedule token blacklist cleanup
  tokenCleanupJob = schedule.scheduleJob(CLEANUP_CRON, async () => {
    try {
      const result = await tokenRevocationService.removeExpiredEntries();
      if (logger) {
        logger.info('[TokenCleanup] Expired tokens removed from blacklist', {
          rowsDeleted: result?.rowCount || 0,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      if (logger) {
        logger.error('[TokenCleanup] Error removing expired tokens', {
          error: error.message,
          stack: error.stack,
        });
      }
    }
  });

  // Schedule token archiving
  tokenArchiveJob = schedule.scheduleJob(ARCHIVE_CRON, async () => {
    try {
      if (!tokenRevocationService.archiveExpiredTokens) {
        if (logger) {
          logger.debug('[TokenArchive] Archive function not available');
        }
        return;
      }

      await tokenRevocationService.archiveExpiredTokens();
      if (logger) {
        logger.info('[TokenArchive] Archived expired tokens', {
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      if (logger) {
        logger.error('[TokenArchive] Error archiving expired tokens', {
          error: error.message,
          stack: error.stack,
        });
      }
    }
  });

  if (logger) {
    logger.info('[TokenCleanup] Scheduled cleanup jobs initialized', {
      cleanupCron: CLEANUP_CRON,
      archiveCron: ARCHIVE_CRON,
    });
  }
}

function stopTokenCleanupJobs(logger) {
  if (tokenCleanupJob) {
    tokenCleanupJob.cancel();
    if (logger) logger.info('[TokenCleanup] Cleanup job stopped');
  }

  if (tokenArchiveJob) {
    tokenArchiveJob.cancel();
    if (logger) logger.info('[TokenArchive] Archive job stopped');
  }
}

module.exports = {
  initializeTokenCleanupJobs,
  stopTokenCleanupJobs,
  CLEANUP_CRON,
  ARCHIVE_CRON,
};
