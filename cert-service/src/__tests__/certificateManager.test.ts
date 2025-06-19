import { CertificateManager } from '../certificateManager';

describe('CertificateManager', () => {
  let certManager: CertificateManager;

  beforeEach(() => {
    certManager = new CertificateManager();
  });

  test('should generate CA certificate', () => {
    const caCert = certManager.generateCaCertificate();
    
    expect(caCert).toBeDefined();
    expect(caCert.certificate).toContain('-----BEGIN CERTIFICATE-----');
    expect(caCert.privateKey).toContain('-----BEGIN RSA PRIVATE KEY-----');
    expect(caCert.publicKey).toContain('-----BEGIN PUBLIC KEY-----');
    expect(caCert.serialNumber).toBeDefined();
  });

  test('should generate device certificate after CA is initialized', () => {
    // First generate CA certificate
    certManager.generateCaCertificate();
    
    // Then generate device certificate
    const deviceCert = certManager.generateDeviceCertificate('test-device-001');
    
    expect(deviceCert).toBeDefined();
    expect(deviceCert.certificate).toContain('-----BEGIN CERTIFICATE-----');
    expect(deviceCert.privateKey).toContain('-----BEGIN RSA PRIVATE KEY-----');
    expect(deviceCert.publicKey).toContain('-----BEGIN PUBLIC KEY-----');
  });

  test('should throw error when generating device certificate without CA', () => {
    expect(() => {
      certManager.generateDeviceCertificate('test-device-001');
    }).toThrow('CA certificate not initialized');
  });

  test('should parse subject string correctly', () => {
    const customSubject = '/C=US/ST=CA/L=SF/O=Test/OU=Dev/CN=Test CA';
    const customCertManager = new CertificateManager(customSubject);
    
    const caCert = customCertManager.generateCaCertificate();
    expect(caCert.certificate).toContain('-----BEGIN CERTIFICATE-----');
  });
});
