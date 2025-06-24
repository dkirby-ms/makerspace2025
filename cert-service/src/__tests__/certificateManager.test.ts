import { CertificateManager } from '../certificateManager';
import forge from 'node-forge';

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

  test('should use authentication name as CN in device certificate', () => {
    // First generate CA certificate
    certManager.generateCaCertificate();
    
    const deviceId = 'test-device-001';
    const authenticationName = `${deviceId}-authnID`;
    
    // Generate device certificate with explicit authentication name
    const deviceCert = certManager.generateDeviceCertificate(deviceId, authenticationName);
    
    expect(deviceCert).toBeDefined();
    expect(deviceCert.certificate).toContain('-----BEGIN CERTIFICATE-----');
    
    // Parse certificate to verify CN
    const cert = forge.pki.certificateFromPem(deviceCert.certificate);
    const commonName = cert.subject.getField('CN');
    
    expect(commonName.value).toBe(authenticationName);
  });

  test('should default to deviceId-authnID as CN when no authentication name provided', () => {
    // First generate CA certificate
    certManager.generateCaCertificate();
    
    const deviceId = 'test-device-002';
    
    // Generate device certificate without explicit authentication name
    const deviceCert = certManager.generateDeviceCertificate(deviceId);
    
    expect(deviceCert).toBeDefined();
    expect(deviceCert.certificate).toContain('-----BEGIN CERTIFICATE-----');
    
    // Parse certificate to verify CN defaults to deviceId-authnID
    const cert = forge.pki.certificateFromPem(deviceCert.certificate);
    const commonName = cert.subject.getField('CN');
    
    expect(commonName.value).toBe(`${deviceId}-authnID`);
  });
});
