/**
 * Utility functions for the certificate service
 */

/**
 * Generate MQTT hostname for a given namespace and region
 */
export function generateMqttHostname(namespaceName: string, region: string = 'westus2'): string {
  return `${namespaceName}.${region}-1.ts.eventgrid.azure.net`;
}

/**
 * Generate device client name from device ID
 */
export function generateClientName(deviceId: string): string {
  return `device-${deviceId}`;
}

/**
 * Generate authentication name from device ID
 */
export function generateAuthenticationName(deviceId: string): string {
  return `${deviceId}-authnID`;
}

/**
 * Validate device ID format
 */
export function validateDeviceId(deviceId: string): { valid: boolean; error?: string } {
  if (!deviceId || typeof deviceId !== 'string') {
    return { valid: false, error: 'Device ID is required and must be a string' };
  }

  if (deviceId.length < 3 || deviceId.length > 50) {
    return { valid: false, error: 'Device ID must be between 3 and 50 characters' };
  }

  const DEVICE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
  if (!DEVICE_ID_PATTERN.test(deviceId)) {
    return { valid: false, error: 'Device ID can only contain alphanumeric characters, hyphens, and underscores' };
  }

  return { valid: true };
}

/**
 * Standard API response interfaces and formatters
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  details?: string;
  timestamp: string;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Format error response
 */
export function formatErrorResponse(error: any, defaultMessage: string = 'Unknown error'): ApiResponse {
  return {
    success: false,
    error: defaultMessage,
    details: error instanceof Error ? error.message : String(error),
    timestamp: new Date().toISOString()
  };
}

/**
 * Format success response
 */
export function formatSuccessResponse<T>(data?: T, message?: string): ApiResponse<T> {
  const response: ApiResponse<T> = {
    success: true,
    timestamp: new Date().toISOString()
  };

  if (data !== undefined) {
    response.data = data;
  }

  if (message) {
    response.message = message;
  }

  return response;
}

/**
 * Log with timestamp
 */
export function logWithTimestamp(level: 'info' | 'warn' | 'error', message: string, ...args: any[]): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  
  switch (level) {
    case 'info':
      console.log(logMessage, ...args);
      break;
    case 'warn':
      console.warn(logMessage, ...args);
      break;
    case 'error':
      console.error(logMessage, ...args);
      break;
  }
}

/**
 * Sleep utility function
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        break;
      }

      const delay = baseDelay * Math.pow(2, attempt);
      logWithTimestamp('warn', `Attempt ${attempt + 1} failed, retrying in ${delay}ms`, error);
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Sanitize HTML to prevent XSS
 */
export function sanitizeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Parse and validate JSON safely
 */
export function safeJsonParse<T>(jsonString: string, fallback: T): T {
  try {
    return JSON.parse(jsonString);
  } catch {
    return fallback;
  }
}

/**
 * Check if a string is a valid URL
 */
export function isValidUrl(urlString: string): boolean {
  try {
    new URL(urlString);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract region from Azure resource hostname
 */
export function extractRegionFromHostname(hostname: string): string | null {
  const match = hostname.match(/\.([a-z0-9-]+)-\d+\./);
  return match ? match[1] : null;
}

/**
 * Generate random string for IDs
 */
export function generateRandomId(length: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
