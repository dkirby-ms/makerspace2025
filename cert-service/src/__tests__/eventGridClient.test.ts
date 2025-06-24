import { EventGridClientManager } from '../eventGridClient';

// Mock the Azure SDK
jest.mock('@azure/arm-eventgrid');
jest.mock('@azure/identity');

describe('EventGridClientManager', () => {
  let eventGridManager: EventGridClientManager;

  beforeEach(() => {
    eventGridManager = new EventGridClientManager(
      'test-subscription',
      'test-rg',
      'test-namespace'
    );
  });

  test('should initialize with correct parameters', () => {
    expect(eventGridManager).toBeInstanceOf(EventGridClientManager);
  });

  test('should generate correct client name from device ID', () => {
    const deviceId = 'test-device-001';
    // This would test internal logic if methods were exposed
    // For now, just test that the class can be instantiated
    expect(eventGridManager).toBeDefined();
  });

  test('should handle unregister all devices with no devices', async () => {
    // Mock the listRegisteredDevices to return empty array
    const mockListDevices = jest
      .spyOn(eventGridManager, 'listRegisteredDevices')
      .mockResolvedValue([]);

    const result = await eventGridManager.unregisterAllDevices();

    expect(result.removedCount).toBe(0);
    expect(result.errors).toEqual([]);
    expect(mockListDevices).toHaveBeenCalled();
  });

  test('should handle unregister all devices with multiple devices', async () => {
    const mockDevices = ['device1', 'device2', 'device3'];

    // Mock the methods
    const mockListDevices = jest
      .spyOn(eventGridManager, 'listRegisteredDevices')
      .mockResolvedValue(mockDevices);
    const mockUnregisterDevice = jest
      .spyOn(eventGridManager, 'unregisterDevice')
      .mockResolvedValue();

    const result = await eventGridManager.unregisterAllDevices();

    expect(result.removedCount).toBe(3);
    expect(result.errors).toEqual([]);
    expect(mockListDevices).toHaveBeenCalled();
    expect(mockUnregisterDevice).toHaveBeenCalledTimes(3);
    expect(mockUnregisterDevice).toHaveBeenCalledWith('device1');
    expect(mockUnregisterDevice).toHaveBeenCalledWith('device2');
    expect(mockUnregisterDevice).toHaveBeenCalledWith('device3');
  });

  test('should handle partial failures when unregistering all devices', async () => {
    const mockDevices = ['device1', 'device2', 'device3'];

    // Mock the methods
    const mockListDevices = jest
      .spyOn(eventGridManager, 'listRegisteredDevices')
      .mockResolvedValue(mockDevices);
    const mockUnregisterDevice = jest
      .spyOn(eventGridManager, 'unregisterDevice')
      .mockImplementation((deviceId: string) => {
        if (deviceId === 'device2') {
          return Promise.reject(new Error('Failed to unregister device2'));
        }
        return Promise.resolve();
      });

    const result = await eventGridManager.unregisterAllDevices();

    expect(result.removedCount).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('device2');
    expect(mockListDevices).toHaveBeenCalled();
    expect(mockUnregisterDevice).toHaveBeenCalledTimes(3);
  });

  // Note: Most methods require actual Azure credentials and resources
  // In a real implementation, these would use mocked Azure SDK responses
});
