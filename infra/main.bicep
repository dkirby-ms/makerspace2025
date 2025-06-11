@description('Name of the IoT Hub')
param iotHubName string = 'makerspace-iot-hub'

@description('Location for all resources')
param location string = resourceGroup().location

module iotHub 'iotHub.bicep' = {
  name: 'iotHubDeployment'
  params: {
    iotHubName: iotHubName
    location: location
  }
}

output iotHubName string = iotHub.outputs.iotHubName
output iotHubHostName string = iotHub.outputs.iotHubHostName
output iotHubResourceId string = iotHub.outputs.iotHubResourceId
output resourceGroupName string = resourceGroup().name
