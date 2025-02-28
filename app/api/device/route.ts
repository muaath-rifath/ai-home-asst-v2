import { NextRequest, NextResponse } from 'next/server';

// Registered clients and devices state
const REGISTERED_CLIENTS = [
    {
        id: 'esp32_livingroom',
        name: 'Living Room Controller',
        authKey: 'f1A3n2Vyq7VhDW97oDg06ks+TTAhPMocARCB5u8Wj6I=',
        location: 'Living Room',
        firmware: '1.0.0',
        isOnline: false,
        lastSeen: new Date(),
        devices: [
            { 
                id: 'light1', 
                name: 'Main Light', 
                type: 'light', 
                status: false,
                features: {
                    hasTimer: true
                }
            },
            { 
                id: 'light2', 
                name: 'Reading Light', 
                type: 'light', 
                status: false,
                features: {
                    hasTimer: true
                }
            }
        ]
    }
];

// Function to authenticate via Bearer token from header
function authenticateFromHeader(request: NextRequest): string | null {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return null;
    }
    return authHeader.substring(7); // Remove 'Bearer ' prefix
}

// Function to find and authenticate a client
function authenticateClient(clientId: string, authKey?: string, bearerToken?: string) {
    const client = REGISTERED_CLIENTS.find(c => c.id === clientId);
    if (!client) return null;
    
    // Check either authKey from body or bearer token from header
    if (authKey && client.authKey === authKey) return client;
    if (bearerToken && client.authKey === bearerToken) return client;
    
    return null;
}

// Function to update device status
function updateDeviceStatus(clientId: string, deviceId: string, status: boolean) {
    const client = REGISTERED_CLIENTS.find(c => c.id === clientId);
    if (client) {
        const device = client.devices.find(d => d.id === deviceId);
        if (device) {
            device.status = status;
            client.lastSeen = new Date();
            client.isOnline = true;
            return true;
        }
    }
    return false;
}

// Handle device control requests (POST)
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { clientId, deviceId, type, command } = body;

        if (!clientId || !deviceId || !type || !command || !command.state) {
            return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
        }

        if (!["ON", "OFF"].includes(command.state)) {
            return NextResponse.json({ error: "Invalid command state" }, { status: 400 });
        }

        const client = REGISTERED_CLIENTS.find(c => c.id === clientId);
        if (!client) {
            return NextResponse.json({ error: "Client not found" }, { status: 404 });
        }

        const device = client.devices.find(d => d.id === deviceId);
        if (!device) {
            return NextResponse.json({ error: "Device not found" }, { status: 404 });
        }

        // Update device state based on command
        device.status = command.state === "ON";
        
        // Update client's last seen time
        client.lastSeen = new Date();
        client.isOnline = true;

        return NextResponse.json({ 
            success: true,
            command: command,
            deviceState: device.status
        });
    } catch (error) {
        return NextResponse.json({ 
            error: 'Request error', 
            details: error instanceof Error ? error.message : 'Unknown error' 
        }, { status: 500 });
    }
}

// Handle status updates and heartbeat (PUT)
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { clientId, authKey, deviceId, status } = body;

        if (!clientId || !authKey) {
            return NextResponse.json({ error: "Missing authentication parameters" }, { status: 400 });
        }

        const client = authenticateClient(clientId, authKey);
        if (!client) {
            return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
        }

        // Update device status if provided
        if (deviceId !== undefined && status !== undefined) {
            if (!updateDeviceStatus(clientId, deviceId, status)) {
                return NextResponse.json({ error: "Device not found" }, { status: 404 });
            }
        } else {
            // Just update client's online status and last seen
            client.isOnline = true;
            client.lastSeen = new Date();
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ 
            error: 'Request error', 
            details: error instanceof Error ? error.message : 'Unknown error' 
        }, { status: 500 });
    }
}

// Get client and device status (GET)
export async function GET(request: NextRequest) {
    // Check for specific client query
    const clientId = request.nextUrl.searchParams.get('clientId');
    const bearerToken = authenticateFromHeader(request);
    
    if (clientId) {
        // Authenticate if bearer token is present
        if (bearerToken) {
            const client = authenticateClient(clientId, undefined, bearerToken);
            if (!client) {
                return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
            }
        }
        
        const client = REGISTERED_CLIENTS.find(c => c.id === clientId);
        if (!client) {
            return NextResponse.json({ error: "Client not found" }, { status: 404 });
        }
        
        // Update last seen time when device polls
        client.lastSeen = new Date();
        client.isOnline = true;
        
        return NextResponse.json({
            client: {
                ...client,
                authKey: undefined // Don't expose auth key
            }
        });
    }

    // Return all clients (without auth keys)
    return NextResponse.json({
        clients: REGISTERED_CLIENTS.map(client => ({
            ...client,
            authKey: undefined
        }))
    });
}