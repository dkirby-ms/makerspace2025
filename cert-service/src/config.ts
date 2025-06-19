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
  };
  appDeployment: {
    enabled: boolean;
    tempDir: string;
    defaultRepo: string;
  };
}

export const CONFIG: ServiceConfig = {
  port: parseInt(process.env.PORT || '3000'),
  eventGrid: {
    namespaceName: process.env.EVENTGRID_NAMESPACE_NAME || '',
    resourceGroup: process.env.EVENTGRID_RESOURCE_GROUP || '',
    subscriptionId: process.env.AZURE_SUBSCRIPTION_ID || ''
  },
  certificates: {
    caSubject: process.env.CA_CERT_SUBJECT || '/C=US/ST=CA/L=SanFrancisco/O=Makerspace/OU=IT/CN=Makerspace CA',
    validityDays: parseInt(process.env.CERT_VALIDITY_DAYS || '365')
  },
  appDeployment: {
    enabled: process.env.ENABLE_APP_DEPLOYMENT === 'true',
    tempDir: process.env.APP_DEPLOYMENT_TEMP_DIR || '/tmp/makerspace-deployments',
    defaultRepo: process.env.BITNET_RUNNER_REPO || 'https://github.com/bitnet_runner.git'
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
  const requiredFields = [
    'EVENTGRID_NAMESPACE_NAME',
    'EVENTGRID_RESOURCE_GROUP', 
    'AZURE_SUBSCRIPTION_ID'
  ];

  const missing = requiredFields.filter(field => !process.env[field]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
