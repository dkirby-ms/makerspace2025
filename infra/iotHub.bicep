@description('Name of the IoT Hub')
param iotHubName string

@description('Location for the IoT Hub')
param location string = resourceGroup().location

@description('IoT Hub SKU')
param iotHubSku string = 'S1'

@description('Number of IoT Hub units')
param iotHubUnits int = 1

resource iotHub 'Microsoft.Devices/IotHubs@2023-06-30' = {
  name: iotHubName
  location: location
  sku: {
    name: iotHubSku
    capacity: iotHubUnits
  }
  properties: {
    eventHubEndpoints: {
      events: {
        retentionTimeInDays: 1
        partitionCount: 2
      }
    }
    routing: {
      endpoints: {
        serviceBusQueues: []
        serviceBusTopics: []
        eventHubs: []
        storageContainers: []
      }
      routes: []
      fallbackRoute: {
        name: '$fallback'
        source: 'DeviceMessages'
        condition: 'true'
        endpointNames: [
          'events'
        ]
        isEnabled: true
      }
    }
    messagingEndpoints: {
      fileNotifications: {
        lockDurationAsIso8601: 'PT1M'
        ttlAsIso8601: 'PT1H'
        maxDeliveryCount: 10
      }
    }
    enableFileUploadNotifications: false
    cloudToDevice: {
      maxDeliveryCount: 10
      defaultTtlAsIso8601: 'PT1H'
      feedback: {
        lockDurationAsIso8601: 'PT1M'
        ttlAsIso8601: 'PT1H'
        maxDeliveryCount: 10
      }
    }
    features: 'None'
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: false
    allowedFqdnList: []
  }
}

// Create device identities for the makerspace devices will be done via Azure CLI
// as device resources are not supported in ARM templates

output iotHubName string = iotHub.name
output iotHubHostName string = iotHub.properties.hostName
output iotHubResourceId string = iotHub.id
