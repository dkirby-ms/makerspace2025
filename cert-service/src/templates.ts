export interface HomePageData {
  devices: string[];
  eventGridNamespace: string;
}

export interface TopicsPageData {
  topicSpaces: any[];
  permissionBindings: any[];
  eventGridNamespace: string;
}

export class HtmlTemplates {
  static generateHomePage(data: HomePageData): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Makerspace Certificate Service</title>
    <link rel="stylesheet" href="/styles.css">
</head>
<body>
    <div class="header">
        <h1>🔐 Makerspace Certificate Service</h1>
        <p>Device Certificate Management & MQTT Client Registration</p>
    </div>

    ${this.generateStatsSection(data.devices.length)}
    ${this.generateDevicesSection(data.devices)}
    ${this.generateApiInfoSection(data)}
    ${this.generateTimestamp()}

    <script src="/scripts/home.js"></script>
</body>
</html>`;
  }

  static generateTopicsPage(data: TopicsPageData): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MQTT Topics - Makerspace Certificate Service</title>
    <link rel="stylesheet" href="/styles.css">
</head>
<body>
    <div class="container">
        ${this.generateNavigation()}
        ${this.generateTopicsHeader(data.eventGridNamespace)}
        ${this.generateTopicsContent(data)}
    </div>
    <script src="/scripts/topics.js"></script>
</body>
</html>`;
  }

  private static generateStatsSection(deviceCount: number): string {
    return `
    <div class="stats">
        <div class="stat-card">
            <div class="stat-number">${deviceCount}</div>
            <div>Registered Devices</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">🟢</div>
            <div>Service Status: Healthy</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">MQTT</div>
            <div>Protocol: TLS 1.3</div>
        </div>
    </div>`;
  }

  private static generateDevicesSection(devices: string[]): string {
    return `
    <div class="devices-container">
        <div class="devices-header">
            <h2>📱 Registered Devices</h2>
            <div class="actions">
                <a href="/topics" class="btn btn-secondary">📡 MQTT Topics</a>
                <a href="/ca-certificate" class="btn btn-secondary">📥 Download CA Certificate</a>
                <button id="refresh-btn" class="btn btn-primary">🔄 Refresh</button>
            </div>
        </div>

        ${devices.length === 0 ? 
            '<div class="no-devices">No devices registered yet. Use the API to register your first device.</div>' :
            this.generateDeviceList(devices)
        }
    </div>`;
  }

  private static generateDeviceList(devices: string[]): string {
    return `
    <div class="device-list">
        ${devices.map(deviceId => `
            <div class="device-card">
                <div class="device-id">🔗 ${deviceId}</div>
                <div class="device-details">
                    <div><strong>Client:</strong> device-${deviceId}</div>
                    <div><strong>Auth ID:</strong> ${deviceId}-authnID</div>
                    <div><strong>Status:</strong> Active</div>
                </div>
                <div class="actions">
                    <a href="/device/${deviceId}/status" class="btn btn-secondary">📊 Status</a>
                    <button class="btn btn-danger unregister-btn" data-device-id="${deviceId}">🗑️ Unregister</button>
                </div>
            </div>
        `).join('')}
    </div>`;
  }

  private static generateApiInfoSection(data: HomePageData): string {
    return `
    <div class="api-info">
        <h3>📚 API Endpoints</h3>
        <ul>
            <li><strong>POST /register-device</strong> - Register a new device and get certificates (includes bitnet_runner app deployment)</li>
            <li><strong>GET /devices</strong> - List all registered devices (JSON)</li>
            <li><strong>GET /topics</strong> - View MQTT topic spaces and permissions</li>
            <li><strong>GET /device/:deviceId/status</strong> - Get device status</li>
            <li><strong>DELETE /device/:deviceId</strong> - Unregister a device</li>
            <li><strong>POST /device/:deviceId/deploy-app</strong> - Deploy app to specific device</li>
            <li><strong>GET /device/:deviceId/app-status</strong> - Get app deployment status</li>
            <li><strong>GET /ca-certificate</strong> - Download CA certificate</li>
            <li><strong>GET /health</strong> - Service health check</li>
        </ul>
        <p><strong>MQTT Hostname:</strong> ${data.eventGridNamespace}.westus2-1.ts.eventgrid.azure.net:8883</p>
    </div>`;
  }

  private static generateNavigation(): string {
    return `
    <div class="navigation">
        <a href="/" class="nav-link">🏠 Home</a>
        <a href="/topics" class="nav-link">📡 MQTT Topics</a>
        <a href="/ca-certificate" class="nav-link">📥 CA Certificate</a>
    </div>`;
  }

  private static generateTopicsHeader(namespace: string): string {
    return `
    <div class="header">
        <h1>📡 MQTT Topics & Permissions</h1>
        <p>Event Grid Namespace: ${namespace}</p>
    </div>`;
  }

  private static generateTopicsContent(data: TopicsPageData): string {
    return `
    <div class="content">
        <div class="section">
            <h2>🏷️ Topic Spaces</h2>
            ${this.generateTopicSpaces(data.topicSpaces)}
        </div>
        <div class="section">
            <h2>🔐 Permission Bindings</h2>
            ${this.generatePermissionBindings(data.permissionBindings)}
        </div>
        <div class="messages-section">
            <h2>📨 Live Messages <span id="connection-status" class="connection-status status-disconnected">Disconnected</span></h2>
            <div class="message-monitor">
                <input type="text" id="topic-input" class="topic-input" placeholder="Enter topic to monitor (e.g., devices/+/telemetry)" />
                <button id="subscribe-btn" class="monitor-btn" onclick="subscribeToTopic()">Subscribe</button>
                <button id="unsubscribe-btn" class="monitor-btn" onclick="unsubscribeFromTopic()" disabled>Unsubscribe</button>
                <button onclick="clearMessages()" class="monitor-btn" style="background: #ff9800;">Clear</button>
            </div>
            <div id="messages-list" class="messages-list">
                <div style="padding: 20px; text-align: center; color: #666;">No messages yet</div>
            </div>
        </div>
    </div>`;
  }

  private static generateTopicSpaces(topicSpaces: any[]): string {
    if (topicSpaces.length === 0) {
      return '<div class="no-data">No topic spaces configured.</div>';
    }

    return `
    <div class="topic-spaces">
        ${topicSpaces.map(space => `
            <div class="card">
                <div class="card-title">📂 ${space.name}</div>
                ${space.description ? `<div class="card-description">${space.description}</div>` : ''}
                <div class="topic-templates">
                    <strong>Topic Templates:</strong>
                    ${space.topicTemplates.map((template: string) => 
                        `<div class="topic-template">${template}</div>`
                    ).join('')}
                </div>
            </div>
        `).join('')}
    </div>`;
  }

  private static generatePermissionBindings(permissionBindings: any[]): string {
    if (permissionBindings.length === 0) {
      return '<div class="no-data">No permission bindings configured.</div>';
    }

    return `
    <div class="permission-bindings">
        ${permissionBindings.map(binding => `
            <div class="card">
                <div class="card-title">🔑 ${binding.name}</div>
                ${binding.description ? `<div class="card-description">${binding.description}</div>` : ''}
                <div class="permission-info">
                    <span class="permission-badge ${binding.permission.toLowerCase()}">${binding.permission}</span>
                    ${binding.clientGroupName ? `<span class="client-group">👥 ${binding.clientGroupName}</span>` : ''}
                </div>
                <div style="margin-top: 10px;">
                    <strong>Topic Space:</strong> <span style="font-family: monospace; color: #1976d2;">${binding.topicSpaceName}</span>
                </div>
            </div>
        `).join('')}
    </div>`;
  }

  private static generateTimestamp(): string {
    return `
    <div class="timestamp">
        Last updated: ${new Date().toLocaleString()}
    </div>`;
  }
}
