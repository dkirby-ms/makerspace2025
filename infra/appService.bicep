@description('Name of the App Service Plan')
param appServicePlanName string = 'makerspace-asp'

@description('Name of the App Service')
param appServiceName string = 'makerspace-cert-service'

@description('Name of the Container Registry')
param containerRegistryName string = 'makerspaceacr${uniqueString(resourceGroup().id)}'

@description('Location for all resources')
param location string = resourceGroup().location

@description('Event Grid namespace name for client registration')
param eventGridNamespaceName string

@description('Event Grid namespace resource group')
param eventGridResourceGroupName string = resourceGroup().name

@description('Docker image tag')
param imageTag string = 'latest'

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

// App Service Plan
resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: appServicePlanName
  location: location
  sku: {
    name: 'F1'
    tier: 'Free'
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

// App Service
resource appService 'Microsoft.Web/sites@2023-01-01' = {
  name: appServiceName
  location: location
  kind: 'app,linux,container'
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'DOCKER|${containerRegistry.properties.loginServer}/cert-service:${imageTag}'
      appSettings: [
        {
          name: 'DOCKER_REGISTRY_SERVER_URL'
          value: 'https://${containerRegistry.properties.loginServer}'
        }
        {
          name: 'DOCKER_REGISTRY_SERVER_USERNAME'
          value: containerRegistry.name
        }
        {
          name: 'DOCKER_REGISTRY_SERVER_PASSWORD'
          value: containerRegistry.listCredentials().passwords[0].value
        }
        {
          name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE'
          value: 'false'
        }
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
          name: 'CA_CERT_SUBJECT'
          value: '/C=US/ST=CA/L=SanFrancisco/O=Makerspace/OU=IT/CN=Makerspace CA'
        }
        {
          name: 'CERT_VALIDITY_DAYS'
          value: '365'
        }
      ]
      httpLoggingEnabled: true
      logsDirectorySizeLimit: 100
    }
    httpsOnly: true
  }
  identity: {
    type: 'SystemAssigned'
  }
}

// Role assignment for App Service to manage Event Grid resources at resource group level
resource eventGridContributorRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, appService.id, 'EventGrid Data Contributor')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '1d8c89da-726b-4d2e-b256-9d05b3dd0f01') // EventGrid Data Contributor
    principalId: appService.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

output appServiceName string = appService.name
output appServiceUrl string = 'https://${appService.properties.defaultHostName}'
output containerRegistryName string = containerRegistry.name
output containerRegistryLoginServer string = containerRegistry.properties.loginServer
output appServicePrincipalId string = appService.identity.principalId
