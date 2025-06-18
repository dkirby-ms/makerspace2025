// @description('Name of the IoT Hub')
// param iotHubName string = 'makerspace-iot-hub'

@description('Name of the Event Grid namespace')
param eventGridNamespaceName string = 'makerspace-eventgrid'

@description('Name of the Container App for certificate management')
param containerAppName string = 'makerspace-cert-service'

@description('Location for all resources')
param location string = resourceGroup().location

@description('Base64 encoded CA certificate content (optional, can be added later)')
param caCertificateContent string = ''

@description('Deploy CA certificate (set to false initially, true after certificate generation)')
param deployCaCertificate bool = false

// IoT Hub deployment disabled - using Event Grid MQTT broker only
// module iotHub 'iotHub.bicep' = {
//   name: 'iotHubDeployment'
//   params: {
//     iotHubName: iotHubName
//     location: location
//   }
// }

module eventGrid 'eventGrid.bicep' = {
  name: 'eventGridDeployment'
  params: {
    eventGridNamespaceName: eventGridNamespaceName
    location: location
    caCertificateContent: caCertificateContent
    deployCaCertificate: deployCaCertificate
  }
}

module containerApp 'containerApps.bicep' = {
  name: 'containerAppDeployment'
  params: {
    containerAppName: containerAppName
    location: location
    eventGridNamespaceName: eventGridNamespaceName
    eventGridResourceGroupName: resourceGroup().name
  }
}

// IoT Hub outputs disabled - using Event Grid MQTT broker only
// output iotHubName string = iotHub.outputs.iotHubName
// output iotHubHostName string = iotHub.outputs.iotHubHostName
// output iotHubResourceId string = iotHub.outputs.iotHubResourceId
output eventGridNamespaceName string = eventGrid.outputs.eventGridNamespaceName
output eventGridNamespaceId string = eventGrid.outputs.eventGridNamespaceId
output mqttHostname string = eventGrid.outputs.mqttHostname
output caCertificateName string = eventGrid.outputs.caCertificateName
output mqttClientName string = eventGrid.outputs.mqttClientName
output resourceGroupName string = resourceGroup().name
output containerAppName string = containerApp.outputs.containerAppName
output containerAppUrl string = containerApp.outputs.containerAppUrl
output containerRegistryName string = containerApp.outputs.containerRegistryName
