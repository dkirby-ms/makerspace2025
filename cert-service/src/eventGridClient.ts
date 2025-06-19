import { EventGridManagementClient } from '@azure/arm-eventgrid';
import { DefaultAzureCredential } from '@azure/identity';

export interface DeviceRegistration {
  deviceId: string;
  authenticationName: string;
  clientName: string;
}

export interface TopicSpaceInfo {
  name: string;
  description?: string;
  topicTemplates: string[];
}

export interface PermissionBindingInfo {
  name: string;
  description?: string;
  clientGroupName?: string;
  topicSpaceName: string;
  permission: string;
}

export class EventGridClientManager {
  private client: EventGridManagementClient;
  private subscriptionId: string;
  private resourceGroupName: string;
  private namespaceName: string;

  constructor(
    subscriptionId: string,
    resourceGroupName: string,
    namespaceName: string
  ) {
    this.subscriptionId = subscriptionId;
    this.resourceGroupName = resourceGroupName;
    this.namespaceName = namespaceName;
    this.client = new EventGridManagementClient(
      new DefaultAzureCredential(),
      subscriptionId
    );
  }

  /**
   * Register a new device as an MQTT client in Event Grid namespace
   */
  async registerDevice(deviceId: string): Promise<DeviceRegistration> {
    const clientName = `device-${deviceId}`;
    const authenticationName = `${deviceId}-authnID`;

    try {
      // Create MQTT client for the device
      await this.client.clients.beginCreateOrUpdateAndWait(
        this.resourceGroupName,
        this.namespaceName,
        clientName,
        {
          description: `MQTT client for device ${deviceId}`,
          authenticationName: authenticationName,
          clientCertificateAuthentication: {
            validationScheme: 'SubjectMatchesAuthenticationName'
          },
          state: 'Enabled'
        }
      );

      console.log(`Successfully registered device ${deviceId} as client ${clientName}`);

      return {
        deviceId,
        authenticationName,
        clientName
      };
    } catch (error) {
      console.error(`Failed to register device ${deviceId}:`, error);
      throw new Error(`Failed to register device: ${error}`);
    }
  }

  /**
   * Check if a device is already registered
   */
  async isDeviceRegistered(deviceId: string): Promise<boolean> {
    const clientName = `device-${deviceId}`;

    try {
      await this.client.clients.get(
        this.resourceGroupName,
        this.namespaceName,
        clientName
      );
      return true;
    } catch (error: any) {
      if (error.statusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * List all registered devices
   */
  async listRegisteredDevices(): Promise<string[]> {
    try {
      const clients = await this.client.clients.listByNamespace(
        this.resourceGroupName,
        this.namespaceName
      );

      const deviceIds: string[] = [];
      for await (const client of clients) {
        if (client.name?.startsWith('device-')) {
          const deviceId = client.name.substring(7); // Remove 'device-' prefix
          deviceIds.push(deviceId);
        }
      }

      return deviceIds;
    } catch (error) {
      console.error('Failed to list registered devices:', error);
      throw new Error(`Failed to list devices: ${error}`);
    }
  }

  /**
   * Unregister a device
   */
  async unregisterDevice(deviceId: string): Promise<void> {
    const clientName = `device-${deviceId}`;

    try {
      await this.client.clients.beginDeleteAndWait(
        this.resourceGroupName,
        this.namespaceName,
        clientName
      );

      console.log(`Successfully unregistered device ${deviceId}`);
    } catch (error) {
      console.error(`Failed to unregister device ${deviceId}:`, error);
      throw new Error(`Failed to unregister device: ${error}`);
    }
  }

  /**
   * Get device registration details
   */
  async getDeviceRegistration(deviceId: string): Promise<DeviceRegistration | null> {
    const clientName = `device-${deviceId}`;

    try {
      const client = await this.client.clients.get(
        this.resourceGroupName,
        this.namespaceName,
        clientName
      );

      if (client.authenticationName) {
        return {
          deviceId,
          authenticationName: client.authenticationName,
          clientName: client.name || clientName
        };
      }

      return null;
    } catch (error: any) {
      if (error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get all topic spaces in the namespace
   */
  async getTopicSpaces(): Promise<TopicSpaceInfo[]> {
    try {
      const topicSpaces = [];
      const iterator = this.client.topicSpaces.listByNamespace(
        this.resourceGroupName,
        this.namespaceName
      );

      for await (const topicSpace of iterator) {
        topicSpaces.push({
          name: topicSpace.name || '',
          description: topicSpace.description,
          topicTemplates: topicSpace.topicTemplates || []
        });
      }

      return topicSpaces;
    } catch (error) {
      console.error('Failed to list topic spaces:', error);
      throw new Error(`Failed to list topic spaces: ${error}`);
    }
  }

  /**
   * Get all permission bindings in the namespace
   */
  async getPermissionBindings(): Promise<PermissionBindingInfo[]> {
    try {
      const permissionBindings = [];
      const iterator = this.client.permissionBindings.listByNamespace(
        this.resourceGroupName,
        this.namespaceName
      );

      for await (const binding of iterator) {
        permissionBindings.push({
          name: binding.name || '',
          description: binding.description,
          clientGroupName: binding.clientGroupName,
          topicSpaceName: binding.topicSpaceName || '',
          permission: binding.permission || ''
        });
      }

      return permissionBindings;
    } catch (error) {
      console.error('Failed to list permission bindings:', error);
      throw new Error(`Failed to list permission bindings: ${error}`);
    }
  }
}
