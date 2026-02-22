import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});

export const logRequest = (req: any) => {
  logger.info({
    method: req.method,
    url: req.url,
    ip: req.ip,
  }, 'Incoming request');
};

export const logError = (error: Error, context?: string) => {
  logger.error({
    error: error.message,
    stack: error.stack,
    context,
  }, 'Application error');
};

export const logBotEvent = (event: string, data: any) => {
  logger.info({
    event,
    ...data,
  }, 'Bot event');
};
