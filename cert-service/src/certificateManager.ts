import forge from 'node-forge';
import fs from 'fs';

export interface CertificateData {
  certificate: string;
  privateKey: string;
  publicKey: string;
}

export interface CaCertificateData extends CertificateData {
  serialNumber: string;
}

const CERTIFICATE_CONSTANTS = {
  RSA_KEY_SIZE: 2048,
  CA_VALIDITY_YEARS: 10,
  CA_SERIAL_NUMBER: '01',
  DEFAULT_COUNTRY: 'US',
  DEFAULT_STATE: 'CA',
  DEFAULT_LOCALITY: 'SanFrancisco',
  DEFAULT_ORGANIZATION: 'Makerspace',
  DEFAULT_OU_DEVICES: 'Devices',
  DEFAULT_OU_IT: 'IT'
} as const;

const SUBJECT_NAME_MAPPING: Record<string, string> = {
  'C': 'countryName',
  'ST': 'stateOrProvinceName',
  'L': 'localityName',
  'O': 'organizationName',
  'OU': 'organizationalUnitName',
  'CN': 'commonName',
  'emailAddress': 'emailAddress'
} as const;

export class CertificateManager {
  private caCert: forge.pki.Certificate | null = null;
  private caPrivateKey: forge.pki.PrivateKey | null = null;
  private serialNumber: number = 1;

  constructor(
    private caSubject: string = '/C=US/ST=CA/L=SanFrancisco/O=Makerspace/OU=IT/CN=Makerspace CA',
    private useIntermediateCa: boolean = false,
    private intermediateCertPath?: string,
    private intermediateKeyPath?: string,
    private intermediateCertContent?: string,
    private intermediateKeyContent?: string
  ) {}

  /**
   * Generate CA certificate and private key
   */
  generateCaCertificate(): CaCertificateData {
    try {
      const keys = forge.pki.rsa.generateKeyPair(CERTIFICATE_CONSTANTS.RSA_KEY_SIZE);
      const cert = forge.pki.createCertificate();

      cert.publicKey = keys.publicKey;
      cert.serialNumber = CERTIFICATE_CONSTANTS.CA_SERIAL_NUMBER;
      cert.validity.notBefore = new Date();
      cert.validity.notAfter = new Date();
      cert.validity.notAfter.setFullYear(
        cert.validity.notBefore.getFullYear() + CERTIFICATE_CONSTANTS.CA_VALIDITY_YEARS
      );

      const attrs = this.parseSubject(this.caSubject);
      cert.setSubject(attrs);
      cert.setIssuer(attrs);

      cert.setExtensions([
        {
          name: 'basicConstraints',
          cA: true,
          critical: true
        },
        {
          name: 'keyUsage',
          keyCertSign: true,
          digitalSignature: true,
          nonRepudiation: true,
          keyEncipherment: true,
          dataEncipherment: true,
          critical: true
        },
        {
          name: 'extKeyUsage',
          serverAuth: true,
          clientAuth: true,
          codeSigning: true,
          emailProtection: true,
          timeStamping: true
        },
        {
          name: 'nsCertType',
          client: true,
          server: true,
          email: true,
          objsign: true,
          sslCA: true,
          emailCA: true,
          objCA: true
        }
      ]);

      // Sign with SHA256 instead of default SHA1
      cert.sign(keys.privateKey as any, forge.md.sha256.create());

      this.caCert = cert;
      this.caPrivateKey = keys.privateKey;

      return {
        certificate: forge.pki.certificateToPem(cert),
        privateKey: forge.pki.privateKeyToPem(keys.privateKey),
        publicKey: forge.pki.publicKeyToPem(keys.publicKey),
        serialNumber: cert.serialNumber
      };
    } catch (error) {
      throw new Error(`Failed to generate CA certificate: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate device certificate signed by CA
   */
  generateDeviceCertificate(deviceId: string, authenticationName?: string, validityDays: number = 365): CertificateData {
    if (!this.caCert || !this.caPrivateKey) {
      throw new Error('CA certificate not initialized. Call generateCaCertificate() first.');
    }

    try {
      const keys = forge.pki.rsa.generateKeyPair(CERTIFICATE_CONSTANTS.RSA_KEY_SIZE);
      const cert = forge.pki.createCertificate();

      cert.publicKey = keys.publicKey;
      cert.serialNumber = (++this.serialNumber).toString();
      cert.validity.notBefore = new Date();
      cert.validity.notAfter = new Date();
      cert.validity.notAfter.setDate(cert.validity.notBefore.getDate() + validityDays);

      // Set device subject with authenticationName as CN
      const commonName = authenticationName || `${deviceId}-authnID`;
      const deviceSubject = [
        { name: 'countryName', value: CERTIFICATE_CONSTANTS.DEFAULT_COUNTRY },
        { name: 'stateOrProvinceName', value: CERTIFICATE_CONSTANTS.DEFAULT_STATE },
        { name: 'localityName', value: CERTIFICATE_CONSTANTS.DEFAULT_LOCALITY },
        { name: 'organizationName', value: CERTIFICATE_CONSTANTS.DEFAULT_ORGANIZATION },
        { name: 'organizationalUnitName', value: CERTIFICATE_CONSTANTS.DEFAULT_OU_DEVICES },
        { name: 'commonName', value: commonName }
      ];

      cert.setSubject(deviceSubject);
      cert.setIssuer(this.caCert.subject.attributes);

      cert.setExtensions([
        {
          name: 'basicConstraints',
          cA: false
        },
        {
          name: 'keyUsage',
          digitalSignature: true,
          nonRepudiation: true,
          keyEncipherment: true,
          dataEncipherment: true
        },
        {
          name: 'extKeyUsage',
          clientAuth: true
        },
        {
          name: 'subjectAltName',
          altNames: [{
            type: 2, // DNS
            value: deviceId
          }]
        }
      ]);

      // Sign with SHA256 instead of default SHA1
      cert.sign(this.caPrivateKey as any, forge.md.sha256.create());

      return {
        certificate: forge.pki.certificateToPem(cert),
        privateKey: forge.pki.privateKeyToPem(keys.privateKey),
        publicKey: forge.pki.publicKeyToPem(keys.publicKey)
      };
    } catch (error) {
      throw new Error(`Failed to generate device certificate for ${deviceId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Load existing CA certificate and private key
   */
  loadCaCertificate(certPem: string, privateKeyPem: string): void {
    this.caCert = forge.pki.certificateFromPem(certPem);
    this.caPrivateKey = forge.pki.privateKeyFromPem(privateKeyPem);
  }

  /**
   * Load intermediate CA certificate and private key from files or environment variables
   */
  loadIntermediateCertificate(): void {
    try {
      let certPem: string;
      let keyPem: string;

      // Try to load from environment variables first, then fall back to files
      if (this.intermediateCertContent && this.intermediateKeyContent) {
        console.log('Loading intermediate CA from environment variables');
        certPem = this.intermediateCertContent;
        keyPem = this.intermediateKeyContent;
      } else if (this.intermediateCertPath && this.intermediateKeyPath) {
        console.log('Loading intermediate CA from files');
        // Check if files exist
        if (!fs.existsSync(this.intermediateCertPath)) {
          throw new Error(`Intermediate certificate file not found: ${this.intermediateCertPath}`);
        }
        if (!fs.existsSync(this.intermediateKeyPath)) {
          throw new Error(`Intermediate private key file not found: ${this.intermediateKeyPath}`);
        }
        
        certPem = fs.readFileSync(this.intermediateCertPath, 'utf8');
        keyPem = fs.readFileSync(this.intermediateKeyPath, 'utf8');
      } else {
        throw new Error('Intermediate certificate content or file paths must be provided');
      }

      // Parse certificate and private key
      this.caCert = forge.pki.certificateFromPem(certPem);
      this.caPrivateKey = forge.pki.privateKeyFromPem(keyPem);

      console.log('Intermediate CA certificate loaded successfully');
      console.log(`Subject: ${this.caCert.subject.getField('CN')?.value}`);
      console.log(`Issuer: ${this.caCert.issuer.getField('CN')?.value}`);
      console.log(`Valid from: ${this.caCert.validity.notBefore}`);
      console.log(`Valid to: ${this.caCert.validity.notAfter}`);
    } catch (error) {
      throw new Error(`Failed to load intermediate certificate: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get CA certificate in PEM format
   */
  getCaCertificatePem(): string {
    if (!this.caCert) {
      throw new Error('CA certificate not initialized');
    }
    return forge.pki.certificateToPem(this.caCert);
  }

  /**
   * Initialize certificate manager based on configuration
   */
  initialize(): CaCertificateData | null {
    if (this.useIntermediateCa) {
      this.loadIntermediateCertificate();
      return null; // No need to return certificate data as it's already loaded
    } else {
      return this.generateCaCertificate();
    }
  }

  /**
   * Parse subject string into forge attributes
   */
  private parseSubject(subjectString: string): forge.pki.CertificateField[] {
    const parts = subjectString.split('/').filter(part => part.length > 0);
    const attrs: forge.pki.CertificateField[] = [];

    for (const part of parts) {
      const [key, value] = part.split('=');
      if (key && value) {
        const name = this.getAttributeName(key);
        if (name) {
          attrs.push({ name, value });
        }
      }
    }

    return attrs;
  }

  /**
   * Map short names to full attribute names
   */
  private getAttributeName(shortName: string): string | null {
    return SUBJECT_NAME_MAPPING[shortName] || null;
  }
}
