@description('Name of the Event Grid topic')
param eventGridTopicName string = 'Makerspace2025'

@description('Location for the Event Grid topic')
param location string = resourceGroup().location

resource eventGridTopic 'Microsoft.EventGrid/topics@2025-02-15' = {
  name: eventGridTopicName
  location: location
  properties: {
    inputSchema: 'CloudEventSchemaV1_0'
    publicNetworkAccess: 'Enabled'
  }
}

output topicEndpoint string = eventGridTopic.properties.endpoint
