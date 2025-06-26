/**
 * Configuration management for the certificate service
 */

export interface ServiceConfig {
  port: number;
  eventGrid: {
    namespaceName: string;
    resourceGroup: string;
    subscriptionId: string;
  };
  certificates: {
    caSubject: string;
    validityDays: number;
    intermediateCertPath: string;
    intermediateKeyPath: string;
    intermediateCertContent: string;
    intermediateKeyContent: string;
    useIntermediateCa: boolean;
  };
}

const DEFAULT_VALUES = {
  PORT: 3000,
  CA_SUBJECT: '/C=US/ST=CA/L=SanFrancisco/O=Makerspace/OU=IT/CN=Makerspace CA',
  CERT_VALIDITY_DAYS: 365,
  INTERMEDIATE_CERT_PATH: '/home/saitcho/makerspace2025/intermediate_ca.crt',
  INTERMEDIATE_KEY_PATH: '/home/saitcho/.step/secrets/intermediate_ca_key',
  USE_INTERMEDIATE_CA: true
} as const;

export const CONFIG: ServiceConfig = {
  port: parseInt(process.env.PORT || DEFAULT_VALUES.PORT.toString(), 10),
  eventGrid: {
    namespaceName: process.env.EVENTGRID_NAMESPACE_NAME || '',
    resourceGroup: process.env.EVENTGRID_RESOURCE_GROUP || '',
    subscriptionId: process.env.AZURE_SUBSCRIPTION_ID || ''
  },
  certificates: {
    caSubject: process.env.CA_CERT_SUBJECT || DEFAULT_VALUES.CA_SUBJECT,
    validityDays: parseInt(process.env.CERT_VALIDITY_DAYS || DEFAULT_VALUES.CERT_VALIDITY_DAYS.toString(), 10),
    intermediateCertPath: process.env.INTERMEDIATE_CERT_PATH || DEFAULT_VALUES.INTERMEDIATE_CERT_PATH,
    intermediateKeyPath: process.env.INTERMEDIATE_KEY_PATH || DEFAULT_VALUES.INTERMEDIATE_KEY_PATH,
    intermediateCertContent: process.env.INTERMEDIATE_CERT_CONTENT || '',
    intermediateKeyContent: process.env.INTERMEDIATE_KEY_CONTENT || '',
    useIntermediateCa: process.env.USE_INTERMEDIATE_CA === 'false' ? false : DEFAULT_VALUES.USE_INTERMEDIATE_CA
  }
};

export const CONSTANTS = {
  MAX_MESSAGES: 50,
  AUTO_REFRESH_INTERVAL: 30000,
  PAGE_REFRESH_INTERVAL: 300000,
  MQTT_PORT: 8883,
  DEFAULT_REGION: 'westus2'
} as const;

/**
 * Validate required configuration
 */
export function validateConfig(): void {
  const requiredEnvVars = [
    'EVENTGRID_NAMESPACE_NAME',
    'EVENTGRID_RESOURCE_GROUP', 
    'AZURE_SUBSCRIPTION_ID'
  ] as const;

  const missing = requiredEnvVars.filter(env => !process.env[env]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (!CONFIG.eventGrid.namespaceName) {
    throw new Error('Event Grid namespace name is required');
  }

  // Validate port is a valid number
  if (isNaN(CONFIG.port) || CONFIG.port < 1 || CONFIG.port > 65535) {
    throw new Error('Port must be a valid number between 1 and 65535');
  }

  // Validate certificate validity days
  if (isNaN(CONFIG.certificates.validityDays) || CONFIG.certificates.validityDays < 1) {
    throw new Error('Certificate validity days must be a positive number');
  }

  // Validate intermediate certificate configuration if using intermediate CA
  if (CONFIG.certificates.useIntermediateCa) {
    if (!CONFIG.certificates.intermediateCertPath) {
      throw new Error('Intermediate certificate path is required when using intermediate CA');
    }
    if (!CONFIG.certificates.intermediateKeyPath) {
      throw new Error('Intermediate key path is required when using intermediate CA');
    }
  }
}
