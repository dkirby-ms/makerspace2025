import { CONFIG, validateConfig } from '../config';

describe('Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('should load default configuration values', () => {
    expect(CONFIG.port).toBe(3000);
    expect(CONFIG.certificates.validityDays).toBe(365);
  });

  test('should use environment variables when provided', () => {
    process.env.PORT = '8080';
    process.env.CERT_VALIDITY_DAYS = '730';

    // Re-import to get updated config
    jest.resetModules();
    const { CONFIG: updatedConfig } = require('../config');

    expect(updatedConfig.port).toBe(8080);
    expect(updatedConfig.certificates.validityDays).toBe(730);
  });

  test('should validate required environment variables', () => {
    delete process.env.EVENTGRID_NAMESPACE_NAME;
    delete process.env.EVENTGRID_RESOURCE_GROUP;
    delete process.env.AZURE_SUBSCRIPTION_ID;

    expect(() => validateConfig()).toThrow('Missing required environment variables');
  });

  test('should pass validation with all required variables', () => {
    process.env.EVENTGRID_NAMESPACE_NAME = 'test-namespace';
    process.env.EVENTGRID_RESOURCE_GROUP = 'test-rg';
    process.env.AZURE_SUBSCRIPTION_ID = 'test-sub';

    // Re-import to get updated config
    jest.resetModules();
    const { validateConfig: updatedValidateConfig } = require('../config');

    expect(() => updatedValidateConfig()).not.toThrow();
  });
});
