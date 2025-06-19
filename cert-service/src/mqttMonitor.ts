import * as mqtt from 'mqtt';
import * as fs from 'fs';
import { EventEmitter } from 'events';

export interface MqttMessage {
  topic: string;
  payload: string;
  timestamp: Date;
  qos: number;
  retain: boolean;
}

export class MqttTopicMonitor extends EventEmitter {
  private client: mqtt.MqttClient | null = null;
  private messages: Map<string, MqttMessage[]> = new Map();
  private maxMessagesPerTopic = 100;
  private isConnected = false;

  constructor(
    private brokerHost: string,
    private clientCert: string,
    private clientKey: string,
    private caCert: string,
    private clientId: string = 'cert-service-monitor'
  ) {
    super();
  }

  async connect(): Promise<void> {
    try {
      const options: mqtt.IClientOptions = {
        host: this.brokerHost,
        port: 8883,
        protocol: 'mqtts',
        clientId: this.clientId,
        cert: this.clientCert,
        key: this.clientKey,
        ca: this.caCert,
        rejectUnauthorized: true,
        keepalive: 60,
        clean: true,
        reconnectPeriod: 5000,
      };

      this.client = mqtt.connect(options);

      return new Promise((resolve, reject) => {
        if (!this.client) {
          reject(new Error('Failed to create MQTT client'));
          return;
        }

        this.client.on('connect', () => {
          console.log('MQTT Monitor connected');
          this.isConnected = true;
          this.emit('connected');
          resolve();
        });

        this.client.on('error', (error: Error) => {
          console.error('MQTT Monitor error:', error);
          this.isConnected = false;
          this.emit('error', error);
          reject(error);
        });

        this.client.on('message', (topic: string, message: Buffer, packet: mqtt.IPublishPacket) => {
          const mqttMessage: MqttMessage = {
            topic,
            payload: message.toString(),
            timestamp: new Date(),
            qos: packet.qos || 0,
            retain: packet.retain || false
          };

          this.addMessage(topic, mqttMessage);
          this.emit('message', mqttMessage);
        });

        this.client.on('disconnect', () => {
          console.log('MQTT Monitor disconnected');
          this.isConnected = false;
          this.emit('disconnected');
        });

        this.client.on('reconnect', () => {
          console.log('MQTT Monitor reconnecting...');
          this.emit('reconnecting');
        });
      });
    } catch (error) {
      console.error('Failed to connect MQTT monitor:', error);
      throw error;
    }
  }

  private addMessage(topic: string, message: MqttMessage): void {
    if (!this.messages.has(topic)) {
      this.messages.set(topic, []);
    }

    const topicMessages = this.messages.get(topic)!;
    topicMessages.unshift(message); // Add to beginning for newest first

    // Keep only the latest messages
    if (topicMessages.length > this.maxMessagesPerTopic) {
      topicMessages.splice(this.maxMessagesPerTopic);
    }
  }

  async subscribeToTopic(topic: string): Promise<void> {
    if (!this.client || !this.isConnected) {
      throw new Error('MQTT client not connected');
    }

    return new Promise((resolve, reject) => {
      this.client!.subscribe(topic, { qos: 1 }, (error: Error | null) => {
        if (error) {
          console.error(`Failed to subscribe to topic ${topic}:`, error);
          reject(error);
        } else {
          console.log(`Subscribed to topic: ${topic}`);
          resolve();
        }
      });
    });
  }

  async unsubscribeFromTopic(topic: string): Promise<void> {
    if (!this.client || !this.isConnected) {
      throw new Error('MQTT client not connected');
    }

    return new Promise((resolve, reject) => {
      this.client!.unsubscribe(topic, undefined, (error?: Error) => {
        if (error) {
          console.error(`Failed to unsubscribe from topic ${topic}:`, error);
          reject(error);
        } else {
          console.log(`Unsubscribed from topic: ${topic}`);
          resolve();
        }
      });
    });
  }

  getMessagesForTopic(topic: string): MqttMessage[] {
    return this.messages.get(topic) || [];
  }

  getAllMessages(): Map<string, MqttMessage[]> {
    return new Map(this.messages);
  }

  getSubscribedTopics(): string[] {
    if (!this.client || !this.isConnected) {
      return [];
    }
    return Object.keys(this.client.getLastMessageId ? this.client.getLastMessageId() : {});
  }

  isClientConnected(): boolean {
    return this.isConnected && this.client?.connected === true;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      return new Promise((resolve) => {
        this.client!.end(false, {}, () => {
          this.isConnected = false;
          console.log('MQTT Monitor disconnected');
          resolve();
        });
      });
    }
  }

  clearMessages(topic?: string): void {
    if (topic) {
      this.messages.delete(topic);
    } else {
      this.messages.clear();
    }
  }
}
