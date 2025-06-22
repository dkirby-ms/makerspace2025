@description('Name of the Event Grid namespace')
param eventGridNamespaceName string

@description('Location for the Event Grid namespace')
param location string = resourceGroup().location

@description('SKU for the Event Grid namespace')
param sku string = 'Standard'

@description('Capacity for the Event Grid namespace')
param capacity int = 1

@description('Base64 encoded CA certificate content')
param caCertificateContent string

@description('Deploy CA certificate (defaults to true when certificate content is provided)')
param deployCaCertificate bool = true

resource eventGridNamespace 'Microsoft.EventGrid/namespaces@2023-12-15-preview' = {
  name: eventGridNamespaceName
  location: location
  sku: {
    name: sku
    capacity: capacity
  }
  properties: {
    isZoneRedundant: true
    publicNetworkAccess: 'Enabled'
    inboundIpRules: []
    topicSpacesConfiguration: {
      state: 'Enabled'
      maximumSessionExpiryInHours: 8
      maximumClientSessionsPerAuthenticationName: 100
      clientAuthentication: {
        alternativeAuthenticationNameSources: [
          'ClientCertificateSubject'
          'ClientCertificateDns'
        ]
      }
      routeTopicResourceId: null
    }
  }
  identity: {
    type: 'SystemAssigned'
  }
}

// Create CA certificate for client authentication
resource caCertificate 'Microsoft.EventGrid/namespaces/caCertificates@2023-12-15-preview' = if (deployCaCertificate && !empty(caCertificateContent)) {
  parent: eventGridNamespace
  name: 'makerspace-ca'
  properties: {
    description: 'Makerspace CA intermediate certificate for device authentication'
    encodedCertificate: caCertificateContent
  }
}

// Create MQTT client for device authentication
resource mqttClient 'Microsoft.EventGrid/namespaces/clients@2023-12-15-preview' = {
  parent: eventGridNamespace
  name: 'client1'
  properties: {
    description: 'MQTT client for makerspace device'
    authenticationName: 'client1-authnID'
    clientCertificateAuthentication: {
      validationScheme: 'SubjectMatchesAuthenticationName'
    }
    state: 'Enabled'
  }
}

// Create topic space for device communication
resource deviceTopicSpace 'Microsoft.EventGrid/namespaces/topicSpaces@2023-12-15-preview' = {
  parent: eventGridNamespace
  name: 'device-topics'
  properties: {
    description: 'Topic space for device communication'
    topicTemplates: [
      'devices/+/telemetry'
      'devices/+/commands'
      'devices/+/status'
    ]
  }
}

// Create permission binding for devices
resource devicePermissionBinding 'Microsoft.EventGrid/namespaces/permissionBindings@2023-12-15-preview' = {
  parent: eventGridNamespace
  name: 'device-permissions'
  properties: {
    description: 'Permissions for device clients'
    topicSpaceName: deviceTopicSpace.name
    permission: 'Publisher'
    clientGroupName: '$all'
  }
}

// Create permission binding for subscribers (like MQTT Explorer)
resource subscriberPermissionBinding 'Microsoft.EventGrid/namespaces/permissionBindings@2023-12-15-preview' = {
  parent: eventGridNamespace
  name: 'subscriber-permissions'
  properties: {
    description: 'Permissions for subscriber clients'
    topicSpaceName: deviceTopicSpace.name
    permission: 'Subscriber'
    clientGroupName: '$all'
  }
}

output eventGridNamespaceName string = eventGridNamespace.name
output eventGridNamespaceId string = eventGridNamespace.id
output mqttHostname string = eventGridNamespace.properties.topicSpacesConfiguration.hostname
output caCertificateName string = deployCaCertificate && !empty(caCertificateContent) ? caCertificate.name : 'not-deployed'
output mqttClientName string = mqttClient.name
