@description('Name of the Event Grid namespace')
param eventGridNamespaceName string = 'makerspace-eventgrid'

@description('Name of the Container App for certificate management')
param containerAppName string = 'makerspace-cert-service'

@description('Location for all resources')
param location string = resourceGroup().location

@description('Base64 encoded CA certificate content')
param caCertificateContent string

@description('Intermediate CA private key content (PEM format)')
@secure()
param intermediatePrivateKeyContent string = ''

@description('MQTT client certificate content (PEM format)')
@secure()
param mqttClientCertificateContent string = ''

@description('MQTT client private key content (PEM format)')
@secure()
param mqttClientPrivateKeyContent string = ''

@description('MQTT CA certificate content (PEM format)')
@secure()
param mqttCaCertificateContent string = ''

@description('Deploy CA certificate (defaults to true when certificate content is provided)')
param deployCaCertificate bool = true

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
    intermediateCertificateContent: caCertificateContent
    intermediatePrivateKeyContent: intermediatePrivateKeyContent
    mqttClientCertificateContent: mqttClientCertificateContent
    mqttClientPrivateKeyContent: mqttClientPrivateKeyContent
    mqttCaCertificateContent: mqttCaCertificateContent
  }
}

output eventGridNamespaceName string = eventGrid.outputs.eventGridNamespaceName
output eventGridNamespaceId string = eventGrid.outputs.eventGridNamespaceId
output mqttHostname string = eventGrid.outputs.mqttHostname
output caCertificateName string = eventGrid.outputs.caCertificateName
output mqttClientName string = eventGrid.outputs.mqttClientName
output resourceGroupName string = resourceGroup().name
output containerAppName string = containerApp.outputs.containerAppName
output containerAppUrl string = containerApp.outputs.containerAppUrl
output containerRegistryName string = containerApp.outputs.containerRegistryName
