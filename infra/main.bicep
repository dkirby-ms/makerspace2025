@description('Name of the Event Grid topic')
param eventGridTopicName string = 'Makerspace2025'

@description('Location for the Event Grid topic')
param location string = resourceGroup().location

module eventGrid 'eventGrid.bicep' = {
  name: 'eventGridDeployment'
  params: {
    eventGridTopicName: eventGridTopicName
    location: location
  }
}

output topicEndpoint string = eventGrid.outputs.topicEndpoint
