import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

export interface AppDeploymentConfig {
  gitRepository: string;
  targetPath: string;
  postInstallCommands?: string[];
  requiredFiles?: string[];
}

export interface DeploymentResult {
  success: boolean;
  message: string;
  deploymentId: string;
  appPath?: string;
  configFiles?: string[];
}

export interface DeviceConnectionInfo {
  deviceId: string;
  mqttHostname: string;
  certificatePath: string;
  privateKeyPath: string;
  caCertPath: string;
}

export class AppDeploymentManager {
  private readonly defaultAppConfig: AppDeploymentConfig = {
    gitRepository: 'https://github.com/dkirby-ms/bitnet_runner',
    targetPath: '/opt/makerspace/apps/bitnet_runner',
    postInstallCommands: [
      'pip install -r requirements.txt'
    ],
    requiredFiles: ['requirements.txt', 'mqtt_listener.py']
  };

  constructor(private tempDir: string = '/tmp/makerspace-deployments') {
    this.ensureDirectoryExists(this.tempDir);
  }

  /**
   * Deploy the bitnet_runner app to a device
   */
  async deployAppToDevice(
    deviceInfo: DeviceConnectionInfo,
    appConfig: AppDeploymentConfig = this.defaultAppConfig
  ): Promise<DeploymentResult> {
    const deploymentId = this.generateDeploymentId();
    const deploymentPath = path.join(this.tempDir, deploymentId);

    try {
      console.log(`Starting app deployment ${deploymentId} for device ${deviceInfo.deviceId}`);

      // Clone the repository
      await this.cloneRepository(appConfig.gitRepository, deploymentPath);

      // Validate required files
      await this.validateAppStructure(deploymentPath, appConfig.requiredFiles);

      // Generate device-specific configuration
      const configFiles = await this.generateDeviceConfig(deploymentPath, deviceInfo);

      // Run post-install commands
      if (appConfig.postInstallCommands) {
        await this.runPostInstallCommands(deploymentPath, appConfig.postInstallCommands);
      }

      // Package the app for deployment
      const packagePath = await this.packageApp(deploymentPath, deploymentId);

      console.log(`App deployment ${deploymentId} completed successfully`);

      return {
        success: true,
        message: 'App deployed successfully',
        deploymentId,
        appPath: packagePath,
        configFiles
      };

    } catch (error) {
      console.error(`App deployment ${deploymentId} failed:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown deployment error',
        deploymentId
      };
    } finally {
      // Cleanup temporary files
      await this.cleanup(deploymentPath);
    }
  }

  /**
   * Generate device-specific configuration for the app
   */
  private async generateDeviceConfig(
    appPath: string,
    deviceInfo: DeviceConnectionInfo
  ): Promise<string[]> {
    const configFiles: string[] = [];

    // Generate MQTT connection configuration
    const mqttConfig = {
      deviceId: deviceInfo.deviceId,
      broker: {
        hostname: deviceInfo.mqttHostname,
        port: 8883,
        protocol: 'mqtts'
      },
      authentication: {
        certificatePath: './certs/device.crt',
        privateKeyPath: './certs/device.key',
        caCertPath: './certs/ca.crt'
      },
      topics: {
        telemetry: `devices/${deviceInfo.deviceId}/telemetry`,
        commands: `devices/${deviceInfo.deviceId}/commands`,
        status: `devices/${deviceInfo.deviceId}/status`
      }
    };

    const configPath = path.join(appPath, 'config', 'device-config.json');
    this.ensureDirectoryExists(path.dirname(configPath));
    await fs.promises.writeFile(configPath, JSON.stringify(mqttConfig, null, 2));
    configFiles.push(configPath);

    // Generate environment configuration
    const envConfig = [
      `DEVICE_ID=${deviceInfo.deviceId}`,
      `MQTT_HOSTNAME=${deviceInfo.mqttHostname}`,
      `MQTT_PORT=8883`,
      `MQTT_PROTOCOL=mqtts`,
      `CERT_PATH=./certs/device.crt`,
      `KEY_PATH=./certs/device.key`,
      `CA_CERT_PATH=./certs/ca.crt`,
      `LOG_LEVEL=info`,
      `APP_NAME=bitnet_runner`,
      `MAKERSPACE_ENVIRONMENT=production`
    ].join('\n');

    const envPath = path.join(appPath, '.env');
    await fs.promises.writeFile(envPath, envConfig);
    configFiles.push(envPath);

    // Create certificates directory and placeholder files
    const certsDir = path.join(appPath, 'certs');
    this.ensureDirectoryExists(certsDir);

    // Create README for certificate setup
    const certReadme = `# Certificate Setup

This directory should contain the device certificates issued by the Makerspace Certificate Service.

Required files:
- device.crt: Device certificate (PEM format)
- device.key: Device private key (PEM format)  
- ca.crt: CA certificate (PEM format)

These files are automatically generated during device registration.
Do not commit these files to version control.
`;

    const readmePath = path.join(certsDir, 'README.md');
    await fs.promises.writeFile(readmePath, certReadme);
    configFiles.push(readmePath);

    return configFiles;
  }

  /**
   * Clone git repository to target path
   */
  private async cloneRepository(repoUrl: string, targetPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const gitClone = spawn('git', ['clone', repoUrl, targetPath], {
        stdio: 'inherit'
      });

      gitClone.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Git clone failed with exit code ${code}`));
        }
      });

      gitClone.on('error', (error) => {
        reject(new Error(`Git clone error: ${error.message}`));
      });
    });
  }

  /**
   * Validate that the app has required structure
   */
  private async validateAppStructure(appPath: string, requiredFiles?: string[]): Promise<void> {
    if (!requiredFiles) return;

    for (const file of requiredFiles) {
      const filePath = path.join(appPath, file);
      try {
        await fs.promises.access(filePath);
      } catch {
        throw new Error(`Required file missing: ${file}`);
      }
    }
  }

  /**
   * Run post-install commands
   */
  private async runPostInstallCommands(appPath: string, commands: string[]): Promise<void> {
    for (const command of commands) {
      await this.runCommand(command, appPath);
    }
  }

  /**
   * Run a shell command in specified directory
   */
  private async runCommand(command: string, workingDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const process = spawn('sh', ['-c', command], {
        cwd: workingDir,
        stdio: 'inherit'
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command "${command}" failed with exit code ${code}`));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Command "${command}" error: ${error.message}`));
      });
    });
  }

  /**
   * Package the app for distribution
   */
  private async packageApp(appPath: string, deploymentId: string): Promise<string> {
    const packagePath = path.join(this.tempDir, `${deploymentId}.tar.gz`);
    
    await this.runCommand(`tar -czf ${packagePath} -C ${path.dirname(appPath)} ${path.basename(appPath)}`, this.tempDir);
    
    return packagePath;
  }

  /**
   * Cleanup temporary files
   */
  private async cleanup(targetPath: string): Promise<void> {
    try {
      if (await this.pathExists(targetPath)) {
        await fs.promises.rm(targetPath, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn(`Failed to cleanup ${targetPath}:`, error);
    }
  }

  /**
   * Generate unique deployment ID
   */
  private generateDeploymentId(): string {
    return `deploy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Ensure directory exists
   */
  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Check if path exists
   */
  private async pathExists(targetPath: string): Promise<boolean> {
    try {
      await fs.promises.access(targetPath);
      return true;
    } catch {
      return false;
    }
  }
}
