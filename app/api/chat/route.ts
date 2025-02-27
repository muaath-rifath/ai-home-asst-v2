import { NextRequest, NextResponse } from 'next/server';
import mqtt from 'mqtt';
import { GoogleGenerativeAI } from "@google/generative-ai";

// MQTT Broker setup (use environment variables)
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost';
const MQTT_PORT = parseInt(process.env.MQTT_PORT || '1883', 10); // Ensure port is a number
const TOPIC_LED = 'device/led';

// Connect to MQTT broker
const broker = mqtt.connect(`${MQTT_BROKER_URL}:${MQTT_PORT}`);

// Google Gemini API setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const generationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
    responseMimeType: "text/plain",
};

// --- MQTT Connection Handlers ---
broker.on('connect', () => {
    console.log('Connected to MQTT broker');
});

broker.on('error', (error) => {
    console.error('MQTT Broker Connection Error:', error);
});

// --- Parameter Calculation ---
function calculateBlinkParams(
    userDelay?: number,
    userTimes?: number,
    userDuration?: number
) {
    let delay: number;
    let times: number;
    let duration: number;

    // Prioritize parameters: duration > times > delay
    if (userDuration !== undefined) {
        times = userTimes ?? 5; // Default to 5 cycles if times is not provided
        delay = userDuration / (times * 2);
        duration = userDuration;
    } else if (userTimes !== undefined) {
        delay = userDelay ?? 0.5; // Default to 0.5s delay if delay is not provided
        times = userTimes;
        duration = times * delay * 2;
    } else if (userDelay !== undefined) {
        delay = userDelay;
        times = userTimes ?? 5; //Default to 5 cycles
        duration = delay * times * 2;
    }
      else {
        // Default values if no parameters provided
        delay = 0.5;
        times = 5;
        duration = 5;
    }

    // Validation (optional, but good practice)
    delay = Math.max(0.1, Math.min(delay, 10));     // 0.1s to 10s
    times = Math.max(1, Math.min(times, 50));       // 1 to 50 times
    duration = Math.max(0.2, Math.min(duration, 60)); // Ensure reasonable duration.

    return { delay, times, duration };
}

// --- Process Gemini Response ---
async function processGeminiResponse(prompt: string) {
    const systemPrompt = `Your name is Sol. You are a helpful home automation assistant.  When the user asks to control an LED, extract the desired state and parameters.

For LED control commands, respond in a structured way, ONLY providing a code block with parameters and a concise natural language confirmation.

- For turning ON the LED:
    - If a duration is mentioned, respond with: "Turning LED ON for <duration> seconds" and the code block: \`\`\`action:control,device:led,state:ON,duration=<seconds>\`\`\`
    - If NO duration is mentioned, respond with: "Turning LED ON" and the code block: \`\`\`action:control,device:led,state:ON\`\`\`

- For turning OFF the LED:
    - Respond with: "Turning LED OFF" and the code block: \`\`\`action:control,device:led,state:OFF\`\`\`

- For blinking the LED:
    - Respond with a natural language confirmation, e.g., "Blinking LED with delay <delay>s, <times> times, for <duration>s".
    - Include a code block with ALL parameters, even if calculated: \`\`\`action:control,device:led,state:BLINK,delay=<seconds>,times=<number>,duration=<seconds>\`\`\`
        - If only some parameters are provided, calculate the missing ones.  Prioritize duration, then times, then delay.

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

        let state: string | null = null;
        let params: Record<string, number> = {};
        let isControlCommand = false;

        const codeBlockMatch = response.match(/```([\s\S]*?)```/);
        const codeBlockContent = codeBlockMatch ? codeBlockMatch[1].trim() : null;

        if (codeBlockContent) {
            const keyValuePairs = codeBlockContent.split(',').map(pair => pair.trim());
            const action = keyValuePairs.find(pair => pair.startsWith('action:'))?.split(':')[1];
            const device = keyValuePairs.find(pair => pair.startsWith('device:'))?.split(':')[1];
            state = keyValuePairs.find(pair => pair.startsWith('state:'))?.split(':')[1] ?? null; // Use nullish coalescing

            if (action === 'control' && device === 'led' && state) {
                isControlCommand = true;
                let delay: number | undefined, times: number | undefined, duration:number | undefined;

                keyValuePairs.forEach(pair => {
                    const [key, value] = pair.split('='); // Split only on the first '='
                    if (key === 'duration') duration = parseFloat(value);
                    if (key === 'delay') delay = parseFloat(value);
                    if (key === 'times') times = parseInt(value, 10);
                });

                if (state === 'BLINK') {
                    params = calculateBlinkParams(delay, times, duration);
                } else if (state === 'ON' && duration !== undefined) {
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
        return { type: 'error', response: "Failed to get a response from the AI model." };
    }
}

// --- POST Handler ---
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { prompt } = body;

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        const geminiResponse = await processGeminiResponse(prompt);

        if (geminiResponse.type === 'control' && geminiResponse.state) {
            console.log("Gemini Response:", geminiResponse);
            const mqttPayload = JSON.stringify({ state: geminiResponse.state, params: geminiResponse.params });
            console.log("MQTT Payload:", mqttPayload);
            broker.publish(TOPIC_LED, mqttPayload);
            return NextResponse.json({ success: true, message: "Message sent to device", response: geminiResponse.response });
        } else if (geminiResponse.type === 'chat') {
            return NextResponse.json({ success: true, message: "Chat response.", response: geminiResponse.response });
        } else {
            return NextResponse.json({ success: false, message: "AI processing error", response: geminiResponse.response }, { status: 500 });
        }
    } catch (error: unknown) {
        console.error("Error processing request:", error);
        return NextResponse.json({ error: 'Error processing prompt', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }
}