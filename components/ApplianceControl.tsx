"use client";

import * as React from "react";
import { 
  SunIcon, 
  MixerHorizontalIcon, 
  LockClosedIcon, 
  LightningBoltIcon 
} from "@radix-ui/react-icons";

interface Device {
  id: string;
  name: string;
  type: 'light' | 'fan' | 'security' | 'temperature';
  status: boolean;
  value?: number; // For brightness/speed (0-255)
  features: {
    dimmable?: boolean;
    hasTimer?: boolean;
    hasSchedule?: boolean;
    speedControl?: boolean;
  };
}

interface Client {
  id: string;
  name: string;
  location: string;
  devices: Device[];
  isOnline: boolean;
}

interface DeviceSliderProps {
  type: 'brightness' | 'speed';
  value: number;
  onChange: (value: number) => void;
  isDisabled?: boolean;
}

function DeviceSlider({ type, value, onChange, isDisabled }: DeviceSliderProps) {
  const percentage = Math.round((value / 255) * 100);
  
  return (
    <div className="mt-2 px-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
        <span>{type === 'brightness' ? 'Brightness' : 'Speed'}</span>
        <span>{percentage}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={255}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        disabled={isDisabled}
        aria-label={`${type === 'brightness' ? 'Brightness' : 'Speed'} control`}
        className="w-full h-1.5 bg-primary/20 rounded-full appearance-none cursor-pointer disabled:opacity-50
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
      />
    </div>
  );
}

export function ApplianceControl() {
  const [clients, setClients] = React.useState<Client[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [deviceValues, setDeviceValues] = React.useState<Record<string, number>>({});
  
  // Fetch device status
  const fetchStatus = React.useCallback(async () => {
    try {
      const response = await fetch('/api/device');
      if (!response.ok) throw new Error('Failed to fetch status');
      const data = await response.json();
      setClients(data.clients);
      // Update device values
      const newValues: Record<string, number> = {};
      data.clients.forEach((client: Client) => {
        client.devices.forEach((device: Device) => {
          if ((device.features.dimmable || device.features.speedControl) && device.value !== undefined) {
            newValues[`${client.id}/${device.id}`] = device.value;
          }
        });
      });
      setDeviceValues(prev => ({...prev, ...newValues}));
    } catch (error) {
      console.error('Error fetching status:', error);
    }
  }, []);

  // Initial fetch and polling setup
  React.useEffect(() => {
    // Initial fetch
    const init = async () => {
      await fetchStatus();
      setIsLoading(false);
    };
    init();

    // Set up polling every 1 second
    const pollInterval = setInterval(fetchStatus, 1000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [fetchStatus]);

  // Remove WebSocket setup for now since it's not implemented in the backend

  const getDeviceIcon = (type: Device['type']) => {
    switch (type) {
      case 'light':
        return <LightningBoltIcon className="h-5 w-5" />;
      case 'fan':
        return <MixerHorizontalIcon className="h-5 w-5" />;
      case 'security':
        return <LockClosedIcon className="h-5 w-5" />;
      case 'temperature':
        return <SunIcon className="h-5 w-5" />;
      default:
        return <LightningBoltIcon className="h-5 w-5" />;
    }
  };

  const toggleDevice = async (clientId: string, deviceId: string, type: Device['type']) => {
    // Only proceed if client is online
    const client = clients.find(c => c.id === clientId);
    if (!client?.isOnline) {
      console.error('Client is offline');
      return;
    }

    const device = client.devices.find(d => d.id === deviceId);
    if (!device) return;

    const newStatus = !device.status;

    // Update local state optimistically
    setClients(prev => prev.map(client => {
      if (client.id === clientId) {
        return {
          ...client,
          devices: client.devices.map(device => {
            if (device.id === deviceId) {
              return { ...device, status: newStatus };
            }
            return device;
          })
        };
      }
      return client;
    }));

    try {
      const response = await fetch('/api/device', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId,
          deviceId,
          type,
          command: {
            state: newStatus ? 'ON' : 'OFF',
            ...(device.value !== undefined && {
              [type === 'light' ? 'brightness' : 'speed']: Math.round((device.value / 255) * 100)
            })
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to control device');
      }
    } catch (error) {
      // Revert state on error
      setClients(prev => prev.map(client => {
        if (client.id === clientId) {
          return {
            ...client,
            devices: client.devices.map(device => {
              if (device.id === deviceId) {
                return { ...device, status: !newStatus };
              }
              return device;
            })
          };
        }
        return client;
      }));
      console.error('Error controlling device:', error);
    }
  };

  const updateDeviceValue = async (
    clientId: string, 
    deviceId: string, 
    type: Device['type'], 
    value: number
  ) => {
    // Only proceed if client is online
    const client = clients.find(c => c.id === clientId);
    if (!client?.isOnline) {
      console.error('Client is offline');
      return;
    }

    const device = client.devices.find(d => d.id === deviceId);
    if (!device) return;

    // Update local state
    setDeviceValues(prev => ({
      ...prev,
      [`${clientId}/${deviceId}`]: value
    }));

    try {
      const percentage = Math.round((value / 255) * 100);
      const response = await fetch('/api/device', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId,
          deviceId,
          type,
          command: {
            state: 'ON',
            [type === 'light' ? 'brightness' : 'speed']: percentage
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to control device');
      }
    } catch (error) {
      console.error('Error controlling device:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-full bg-background">
        <div className="flex-shrink-0 px-3 py-2 sm:px-4 sm:py-3 border-b">
          <h2 className="text-sm font-semibold sm:text-base lg:text-lg">Device Control</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Control your smart home devices</p>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-background">
      <div className="flex-shrink-0 px-3 py-2 sm:px-4 sm:py-3 border-b">
        <h2 className="text-sm font-semibold sm:text-base lg:text-lg">Device Control</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Control your smart home devices</p>
      </div>
      <div className="flex-1 overflow-y-auto h-full p-2 sm:p-3 lg:p-4">
        {clients.map((client) => (
          <div key={client.id} className="mb-4 last:mb-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-medium">{client.location}</h3>
              <div className={`h-1.5 w-1.5 rounded-full ${client.isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
            </div>
            <div className="grid grid-cols-1 gap-2">
              {client.devices.map((device) => (
                <div key={device.id} className="rounded-lg border">
                  <button
                    onClick={() => toggleDevice(client.id, device.id, device.type)}
                    disabled={!client.isOnline}
                    className={`w-full flex items-center justify-between p-3 sm:p-4 transition-colors ${
                      device.status 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted hover:bg-muted/80"
                    } ${!client.isOnline ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      {getDeviceIcon(device.type)}
                      <div className="text-left">
                        <span className="text-sm sm:text-base">{device.name}</span>
                        {Object.entries(device.features).some(([, value]) => value) && (
                          <div className="flex gap-1 mt-1">
                            {device.features.dimmable && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-background/10">Dimmable</span>
                            )}
                            {device.features.speedControl && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-background/10">Speed Control</span>
                            )}
                            {device.features.hasTimer && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-background/10">Timer</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-xs sm:text-sm font-medium bg-background/10 px-2 py-1 rounded-full">
                      {device.status ? "ON" : "OFF"}
                    </span>
                  </button>
                  {device.status && (device.features.dimmable || device.features.speedControl) && (
                    <div className={`p-3 sm:p-4 border-t ${device.status ? 'bg-primary/5' : 'bg-muted'}`}>
                      <DeviceSlider
                        type={device.type === 'light' ? 'brightness' : 'speed'}
                        value={deviceValues[`${client.id}/${device.id}`] ?? 255}
                        onChange={(value) => updateDeviceValue(client.id, device.id, device.type, value)}
                        isDisabled={!device.status || !client.isOnline}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}