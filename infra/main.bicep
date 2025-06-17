// @description('Name of the IoT Hub')
// param iotHubName string = 'makerspace-iot-hub'

@description('Name of the Event Grid namespace')
param eventGridNamespaceName string = 'makerspace-eventgrid'

@description('Location for all resources')
param location string = resourceGroup().location

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
  }
}

// IoT Hub outputs disabled - using Event Grid MQTT broker only
// output iotHubName string = iotHub.outputs.iotHubName
// output iotHubHostName string = iotHub.outputs.iotHubHostName
// output iotHubResourceId string = iotHub.outputs.iotHubResourceId
output eventGridNamespaceName string = eventGrid.outputs.eventGridNamespaceName
output eventGridNamespaceId string = eventGrid.outputs.eventGridNamespaceId
output mqttHostname string = eventGrid.outputs.mqttHostname
output resourceGroupName string = resourceGroup().name
