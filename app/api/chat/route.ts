import { NextRequest, NextResponse } from 'next/server';
import mqtt from 'mqtt';
import { GoogleGenerativeAI } from "@google/generative-ai";

// MQTT Broker setup
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost';
const MQTT_PORT = process.env.MQTT_PORT || 1883;
const broker = mqtt.connect(`${MQTT_BROKER_URL}:${MQTT_PORT}`);
const TOPIC_LED = 'device/led';

// Google Gemini API setup with Gemini Flash 2.0 configuration
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
});

const generationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
    responseMimeType: "text/plain",
};

// MQTT connection handlers
broker.on('connect', () => {
    console.log('Connected to MQTT broker');
});

broker.on('error', (error) => {
    console.error('MQTT Broker Connection Error:', error);
});

// Calculate parameters for blinking LED
function calculateBlinkParams(delay: number | undefined, times: number | undefined, duration: number | undefined) {
    let calculatedDelay: number, calculatedTimes: number, calculatedDuration: number;

    if (duration !== undefined && times !== undefined) {
        calculatedDelay = duration / (times * 2);
        calculatedTimes = times;
        calculatedDuration = duration;
    } else if (duration !== undefined) {
        calculatedDelay = 0.5;
        calculatedTimes = 5;
        calculatedDuration = duration;
    } else if (times !== undefined) {
        calculatedDelay = 0.5;
        calculatedTimes = times;
        calculatedDuration = 5;
    } else {
        calculatedDelay = 0.5;
        calculatedTimes = 5;
        calculatedDuration = 5;
    }

    return { delay: calculatedDelay, times: calculatedTimes, duration: calculatedDuration };
}

async function processGeminiResponse(prompt: string) {
    const systemPrompt = `Your name is Sol. You are a helpful home automation assistant. When the user asks to control an LED, extract the desired state and parameters.

For LED control commands, respond in a structured way, ONLY providing a code block with parameters and a concise natural language confirmation.

- For turning ON the LED:
    - If a duration is mentioned in the user prompt, say "Turning LED ON for <duration> seconds" and ONLY include the following code block in your response: \`\`\`action:control,device:led,state:ON,duration=<seconds>\`\`\`.
    - If NO duration is mentioned, just say "Turning LED ON" and ONLY include the following code block: \`\`\`action:control,device:led,state:ON\`\`\`.

- For turning OFF the LED:
    - Say "Turning LED OFF" and ONLY include this code block: \`\`\`action:control,device:led,state:OFF\`\`\`.

- For blinking the LED:
    - If delay, times, AND duration are ALL explicitly mentioned in the user prompt, acknowledge them in your natural language response (e.g., "Blinking LED with delay <delay>s, <times> times, for <duration>s"). Then, ONLY include the following code block with the parameters from the user prompt: \`\`\`action:control,device:led,state:BLINK,delay=<seconds>,times=<number>,duration=<seconds>\`\`\`.
    - If ONLY duration and times are mentioned, use the calculated delay based on duration and times. Acknowledge the duration and times in your response (e.g., "Blinking LED for <duration> seconds, <times> times").  Then, ONLY include the code block with calculated parameters: \`\`\`action:control,device:led,state:BLINK,delay=<calculated_delay>,times=<times>,duration=<duration>\`\`\`.
    - If ONLY duration is mentioned, use default times (5) and calculate delay. Acknowledge the duration and default times in your response (e.g., "Blinking LED for <duration> seconds, using default 5 times"). Include code block with calculated parameters.
    - If ONLY times is mentioned, use default duration (5s) and calculate delay. Acknowledge the times and default duration. Include code block with calculated parameters.
    - If NEITHER duration NOR times are mentioned, use default duration (5s) and default times (5) and default delay (0.5s). Say "Blinking LED using default parameters". Include code block with default parameters.

For questions or other requests NOT related to LED control, respond naturally as a chatbot WITHOUT any code blocks.`;

    const chatSession = model.startChat({
        generationConfig,
        history: [
            { role: "user", parts: [{ text: systemPrompt }] }
        ]
    });

    try {
        const result = await chatSession.sendMessage(prompt);
        const response = result.response.text();
        console.log("Gemini Response:", response);

        let state = null;
        let params: Record<string, number> = {};
        let isControlCommand = false;

        const codeBlockMatch = response.match(/```([\s\S]*?)```/);
        const codeBlockContent = codeBlockMatch ? codeBlockMatch[1].trim() : null;

        if (codeBlockContent) {
            const keyValuePairs = codeBlockContent.split(',').map(pair => pair.trim());
            const action = keyValuePairs.find(pair => pair.startsWith('action:'))?.split(':')[1];
            const device = keyValuePairs.find(pair => pair.startsWith('device:'))?.split(':')[1];
            state = keyValuePairs.find(pair => pair.startsWith('state:'))?.split(':')[1];

            if (action === 'control' && device === 'led' && state) {
                isControlCommand = true;
                let delay, times, duration;

                keyValuePairs.forEach(pair => {
                    if (pair.includes('duration=')) duration = parseFloat(pair.split('=')[1]);
                    if (pair.includes('delay=')) delay = parseFloat(pair.split('=')[1]);
                    if (pair.includes('times=')) times = parseInt(pair.split('=')[1]);
                });

                if (state === 'BLINK') {
                    params = calculateBlinkParams(delay, times, duration);
                } else if (state === 'ON' && typeof duration !== 'undefined') {
                    params = { duration };
                }
            }
        }

        if (isControlCommand) {
            return { type: 'control', state, params, response };
        } else {
            return { type: 'chat', response };
        }

    } catch (error: unknown) {
        console.error("Gemini API Error:", error instanceof Error ? error.message : 'Unknown error');
        return { type: 'error', response: "Failed to get response from AI model." };
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { prompt } = body;

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        const geminiResponse = await processGeminiResponse(prompt);

        if (geminiResponse.type === 'control' && geminiResponse.state) {
            console.log("Gemini Response Object before MQTT Publish:", geminiResponse);
            const mqttPayload = JSON.stringify({ state: geminiResponse.state, params: geminiResponse.params });
            console.log("MQTT Payload being published:", mqttPayload);
            broker.publish(TOPIC_LED, mqttPayload);
            return NextResponse.json({ 
                success: true, 
                message: "Message sent to device", 
                response: geminiResponse.response 
            });
        } else if (geminiResponse.type === 'chat') {
            return NextResponse.json({ 
                success: true, 
                message: "Chat response.", 
                response: geminiResponse.response 
            });
        } else {
            return NextResponse.json({ 
                success: false, 
                message: "AI processing error", 
                response: geminiResponse.response 
            }, { status: 500 });
        }
    } catch (error: unknown) {
        console.error("Error processing request:", error);
        return NextResponse.json({ 
            error: 'Error processing prompt', 
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}