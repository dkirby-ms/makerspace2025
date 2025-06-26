import { CertificateManager } from './certificateManager';
import { EventGridClientManager } from './eventGridClient';
import { CONFIG } from './config';

// Service container for better dependency management
export class ServiceContainer {
  private static instance: ServiceContainer;
  private _certificateManager: CertificateManager | null = null;
  private _eventGridManager: EventGridClientManager | null = null;
  private _caCertificateData: any = null;

  static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer();
    }
    return ServiceContainer.instance;
  }

  get certificateManager(): CertificateManager {
    if (!this._certificateManager) {
      this._certificateManager = new CertificateManager(
        CONFIG.certificates.caSubject,
        CONFIG.certificates.useIntermediateCa,
        CONFIG.certificates.intermediateCertPath,
        CONFIG.certificates.intermediateKeyPath,
        CONFIG.certificates.intermediateCertContent,
        CONFIG.certificates.intermediateKeyContent
      );
    }
    return this._certificateManager;
  }

  get eventGridManager(): EventGridClientManager {
    if (!this._eventGridManager) {
      this._eventGridManager = new EventGridClientManager(
        CONFIG.eventGrid.namespaceName,
        CONFIG.eventGrid.resourceGroup,
        CONFIG.eventGrid.subscriptionId
      );
    }
    return this._eventGridManager;
  }

  get caCertificateData(): any {
    return this._caCertificateData;
  }

  set caCertificateData(data: any) {
    this._caCertificateData = data;
  }
}

// Initialize CA certificate
export async function initializeCa(): Promise<void> {
  try {
    const services = ServiceContainer.getInstance();
    
    if (CONFIG.certificates.useIntermediateCa) {
      console.log('Loading intermediate CA certificate...');
      services.certificateManager.initialize();
      console.log('Intermediate CA certificate loaded successfully');
    } else {
      console.log('Generating CA certificate...');
      services.caCertificateData = services.certificateManager.initialize();
      console.log('CA certificate generated successfully');
    }
  } catch (error) {
    console.error('Failed to initialize CA certificate:', error);
    throw error;
  }
}
