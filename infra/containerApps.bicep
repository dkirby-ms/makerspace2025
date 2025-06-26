@description('Name of the Container App')
param containerAppName string = 'makerspace-cert-service'

@description('Name of the Container Registry')
param containerRegistryName string = 'makerspaceacr${uniqueString(resourceGroup().id)}'

@description('Location for all resources')
param location string = resourceGroup().location

@description('Event Grid namespace name for client registration')
param eventGridNamespaceName string

@description('Event Grid namespace resource group')
param eventGridResourceGroupName string = resourceGroup().name

@description('Intermediate certificate content (PEM format)')
param intermediateCertificateContent string = ''

@description('Intermediate CA private key content (PEM format)')
@secure()
param intermediatePrivateKeyContent string = ''

// Container Registry
resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-01-01-preview' = {
  name: containerRegistryName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: true
    publicNetworkAccess: 'Enabled'
  }
  identity: {
    type: 'SystemAssigned'
  }
}

// Container Apps Environment
resource containerAppEnvironment 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: '${containerAppName}-env'
  location: location
  properties: {
    daprAIInstrumentationKey: null
    daprAIConnectionString: null
  }
}

// Container App
resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: containerAppName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: containerAppEnvironment.id
    configuration: {
      ingress: {
        external: true
        targetPort: 3000
        allowInsecure: false
        traffic: [
          {
            weight: 100
            latestRevision: true
          }
        ]
      }
      registries: [
        {
          server: containerRegistry.properties.loginServer
          username: containerRegistry.listCredentials().username
          passwordSecretRef: 'registry-password'
        }
      ]
      secrets: [
        {
          name: 'registry-password'
          value: containerRegistry.listCredentials().passwords[0].value
        }
        {
          name: 'intermediate-key'
          value: intermediatePrivateKeyContent
        }
      ]
    }
    template: {
      containers: [
        {
          image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
          name: 'cert-service'
          env: [
            {
              name: 'EVENTGRID_NAMESPACE_NAME'
              value: eventGridNamespaceName
            }
            {
              name: 'EVENTGRID_RESOURCE_GROUP'
              value: eventGridResourceGroupName
            }
            {
              name: 'AZURE_SUBSCRIPTION_ID'
              value: subscription().subscriptionId
            }
            {
              name: 'PORT'
              value: '3000'
            }
            {
              name: 'INTERMEDIATE_CERT_CONTENT'
              value: intermediateCertificateContent
            }
            {
              name: 'INTERMEDIATE_KEY_CONTENT'
              secretRef: 'intermediate-key'
            }
            {
              name: 'USE_INTERMEDIATE_CA'
              value: 'true'
            }
          ]
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 10
      }
    }
  }
}

// Role assignment for Container App to access Event Grid
resource eventGridDataSenderRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: resourceGroup()
  name: guid(resourceGroup().id, containerApp.name, '69a216fc-b8fb-44d8-bc22-1f3c2cd27a39')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '69a216fc-b8fb-44d8-bc22-1f3c2cd27a39') // EventGrid Data Sender
    principalId: containerApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// Role assignment for Container App to read Event Grid
resource eventGridDataReaderRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: resourceGroup()
  name: guid(resourceGroup().id, containerApp.name, 'acdd72a7-3385-48ef-bd42-f606fba81ae7')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'acdd72a7-3385-48ef-bd42-f606fba81ae7') // Reader
    principalId: containerApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// Role assignment for Container App as EventGrid Contributor
resource eventGridContributorRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: resourceGroup()
  name: guid(resourceGroup().id, containerApp.name, '1e241071-0855-49ea-94dc-649edcd759de')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '1e241071-0855-49ea-94dc-649edcd759de') // EventGrid Contributor
    principalId: containerApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

output containerAppName string = containerApp.name
output containerAppUrl string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output containerRegistryName string = containerRegistry.name
output containerRegistryLoginServer string = containerRegistry.properties.loginServer
output updateImageCommand string = 'az containerapp update --name ${containerApp.name} --resource-group ${resourceGroup().name} --image ${containerRegistry.properties.loginServer}/cert-service:latest'
