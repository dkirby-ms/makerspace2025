/**
 * Centralized logging utility for the certificate service
 */

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

export interface LogContext {
  [key: string]: any;
}

export class Logger {
  private static instance: Logger;
  private serviceName = 'makerspace-cert-service';

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const baseLog = `[${timestamp}] [${level.toUpperCase()}] [${this.serviceName}] ${message}`;
    
    if (context && Object.keys(context).length > 0) {
      return `${baseLog} ${JSON.stringify(context)}`;
    }
    
    return baseLog;
  }

  error(message: string, context?: LogContext): void {
    console.error(this.formatMessage(LogLevel.ERROR, message, context));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage(LogLevel.WARN, message, context));
  }

  info(message: string, context?: LogContext): void {
    console.log(this.formatMessage(LogLevel.INFO, message, context));
  }

  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
      console.log(this.formatMessage(LogLevel.DEBUG, message, context));
    }
  }

  // Convenience method for HTTP request logging
  logRequest(method: string, url: string, statusCode: number, duration?: number): void {
    this.info(`${method} ${url} - ${statusCode}`, { 
      method, 
      url, 
      statusCode, 
      ...(duration && { duration: `${duration}ms` })
    });
  }

  // Convenience method for error logging with stack trace
  logError(error: Error, context?: LogContext): void {
    this.error(error.message, {
      ...context,
      stack: error.stack,
      name: error.name
    });
  }
}

// Export singleton instance
export const logger = Logger.getInstance();
