import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { headers } from 'next/headers';

// Base URL for API calls
async function getBaseUrl() {
    // Server-side
    const headersList = await headers();
    const forwardedHost = await headersList.get('x-forwarded-host');
    const forwardedProto = await headersList.get('x-forwarded-proto');
    
    return forwardedHost
        ? `${forwardedProto || 'http'}://${forwardedHost}`
        : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
}

// Device types and states
type DeviceType = 'light' | 'fan' | 'security';
type DeviceState = 'ON' | 'OFF';

interface Device {
    id: string;
    name: string;
    type: DeviceType;
    status: boolean;
    features: {
        hasTimer?: boolean;
        hasSchedule?: boolean;
    };
}

interface Client {
    id: string;
    name: string;
    location: string;
    devices: Device[];
    isOnline: boolean;
    lastSeen?: Date;
}

// Google Gemini API setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const generationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
};

// Store chat history
let chatHistory: { role: string, parts: { text: string }[] }[] = [];

async function getDeviceInfo(location: string, deviceType: DeviceType, deviceName: string): Promise<{ clientId: string; deviceId: string } | null> {
    try {
        const baseUrl = await getBaseUrl();
        const encodedLocation = encodeURIComponent(location);
        const url = new URL(`/api/device`, baseUrl);
        url.searchParams.append('location', encodedLocation);

        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) {
            console.error('Device API error:', await res.text());
            return null;
        }

        const data: { clients: Client[] } = await res.json();
        
        const client = data.clients?.[0];
        if (!client) return null;

        const device = client.devices.find((d: Device) => 
            d.type === deviceType && 
            d.name.toLowerCase() === deviceName.toLowerCase()
        );

        if (!device) return null;

        return {
            clientId: client.id,
            deviceId: device.id
        };
    } catch (error) {
        console.error('Error getting device info:', error);
        return null;
    }
}

async function controlDevice(clientId: string, deviceId: string, type: DeviceType, command: { state: DeviceState }) {
    try {
        const baseUrl = await getBaseUrl();
        const url = new URL('/api/device', baseUrl);

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                clientId,
                deviceId,
                type,
                command
            }),
        });

        if (!res.ok) {
            console.error('Control device error:', await res.text());
            return { success: false };
        }

        return res.json();
    } catch (error) {
        console.error('Error controlling device:', error);
        return { success: false };
    }
}

async function processGeminiResponse(prompt: string) {
    const systemPrompt = `Your name is Sol. 
    You are a home automation assistant. 
    Introduce yourself when the user greets. Give your response in markdown.
    You can control various devices in different rooms:

    Lights:
    - "Turn on/off the [room] light": \`\`\`action:control,type:light,location:[room],name:Main Light,state:ON/OFF\`\`\`
    - "Turn on/off [room]'s [name] light": \`\`\`action:control,type:light,location:[room],name:[name] Light,state:ON/OFF\`\`\`
    
    Fans:
    - "Turn on/off the [room] fan": \`\`\`action:control,type:fan,location:[room],name:Ceiling Fan,state:ON/OFF\`\`\`
    
    Security System:
    - "Turn on/off security system": \`\`\`action:control,type:security,state:ON/OFF\`\`\``;

    // Initialize chat with system prompt if history is empty
    if (chatHistory.length === 0) {
        chatHistory.push({ role: "user", parts: [{ text: systemPrompt }] });
    }

    chatHistory.push({ role: "user", parts: [{ text: prompt }] });

    try {
        const chatSession = model.startChat({
            generationConfig,
            history: chatHistory,
        });

        const result = await chatSession.sendMessage(prompt);
        const response = result.response.text();
        
        chatHistory.push({ role: "model", parts: [{ text: response }] });

        // Limit history size (keep last 10 messages + system prompt)
        if (chatHistory.length > 11) {
            chatHistory = [
                chatHistory[0],
                ...chatHistory.slice(-10)
            ];
        }

        const codeBlockMatch = response.match(/```([\s\S]*?)```/);
        const codeBlockContent = codeBlockMatch ? codeBlockMatch[1].trim() : null;

        if (codeBlockContent) {
            const keyValuePairs = codeBlockContent.split(',').map(pair => pair.trim());
            const action = keyValuePairs.find(pair => pair.startsWith('action:'))?.split(':')[1];
            const type = keyValuePairs.find(pair => pair.startsWith('type:'))?.split(':')[1] as DeviceType | undefined;
            const location = keyValuePairs.find(pair => pair.startsWith('location:'))?.split(':')[1];
            const name = keyValuePairs.find(pair => pair.startsWith('name:'))?.split(':')[1];
            const state = keyValuePairs.find(pair => pair.startsWith('state:'))?.split(':')[1] as DeviceState | undefined;

            if (action === 'control' && type && state && location && name) {
                try {
                    const deviceInfo = await getDeviceInfo(location, type, name);
                    if (deviceInfo) {
                        const result = await controlDevice(deviceInfo.clientId, deviceInfo.deviceId, type, { state });
                        if (result.success) {
                            return { type: 'control', success: true, response };
                        }
                    }
                } catch (error) {
                    console.error('Error processing command:', error);
                }
            }
        }

        return { type: 'chat', response };

    } catch (error) {
        console.error("Gemini Error:", error instanceof Error ? error.message : 'Unknown error');
        return { type: 'error', response: "AI error." };
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { prompt } = body;

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        const response = await processGeminiResponse(prompt);
        return NextResponse.json({ 
            success: true,
            ...response
        });
    } catch (error) {
        return NextResponse.json({ 
            error: 'Request error', 
            details: error instanceof Error ? error.message : 'Unknown error' 
        }, { status: 500 });
    }
}