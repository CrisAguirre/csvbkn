const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const fs = require('fs');
const path = require('path');

// Render tiene FS efímero: asegurar que logs/ existe para no crashear antes del listen
const logsDir = path.join(__dirname, '../logs');
try {
  fs.mkdirSync(logsDir, { recursive: true });
} catch (e) {
  console.error('No se pudo crear logs/:', e.message);
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} ${level}: ${stack || message}`;
  })
);

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  transports: [
    new DailyRotateFile({
      filename: path.join(__dirname, '../logs', 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      level: 'error'
    }),
    new DailyRotateFile({
      filename: path.join(__dirname, '../logs', 'application-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d'
    })
  ]
});

// En producción (Render) TAMBIÉN loguear a consola: si solo hay file transport,
// Render no muestra nada y el "Timed Out" es imposible de diagnosticar.
logger.add(new winston.transports.Console({
  format: consoleFormat
}));

module.exports = logger;
