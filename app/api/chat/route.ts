import { NextRequest, NextResponse } from 'next/server';
import mqtt from 'mqtt';
import { GoogleGenerativeAI } from "@google/generative-ai";

// MQTT Broker setup
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost';
const MQTT_PORT = parseInt(process.env.MQTT_PORT || '1883', 10);
const TOPIC_LED = 'device/led';

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

broker.on('connect', () => console.log('Connected to MQTT broker'));
broker.on('error', (error) => console.error('MQTT Error:', error));

function calculateBlinkParams(userDelay?: number, userTimes?: number, userDuration?: number) {
    let delay: number;
    let times: number;
    let duration: number;

  if (userDuration !== undefined) {
        times = userTimes ?? 5;
        delay = userDuration / (times * 2);
        duration = userDuration;
    } else if (userTimes !== undefined) {
        delay = userDelay ?? 0.5;
        times = userTimes;
        duration = times * delay * 2;
    } else if (userDelay !== undefined) {
        delay = userDelay;
        times = userTimes ?? 5;
        duration = delay * times * 2;
    } else {
        delay = 0.5;
        times = 5;
        duration = 5;
    }
     delay = Math.max(0.1, Math.min(delay, 10));
     times = Math.max(1, Math.min(times, 50));
     duration = Math.max(0.2, Math.min(duration, 60));

    return { delay, times, duration };
}

async function processGeminiResponse(prompt: string) {
  const systemPrompt = `Your name is Sol. You are a home automation assistant. Handle LED control requests as follows:

- **Immediate ON:**
    - "Turn on the LED": \`\`\`action:control,device:led,state:ON\`\`\`
    - "Turn on the LED for [duration] seconds": \`\`\`action:control,device:led,state:ON,duration=[duration_seconds]\`\`\`

- **Immediate OFF:**
    - "Turn off the LED": \`\`\`action:control,device:led,state:OFF\`\`\`

- **Delayed ON:**
    - "Turn on the LED after [delay] seconds": \`\`\`action:control,device:led,state:DELAYED_ON,delay=[delay_seconds]\`\`\`
    - "Turn on the LED after [delay] seconds for [duration] seconds": \`\`\`action:control,device:led,state:DELAYED_ON,delay=[delay_seconds],duration=[duration_seconds]\`\`\`

- **Delayed OFF:**
    -  "Turn off the LED after [delay] seconds": \`\`\`action:control,device:led,state:DELAYED_OFF,delay=[delay_seconds]\`\`\`

- **Blinking:**
   - "Blink the LED": \`\`\`action:control,device:led,state:BLINK,delay=0.5,times=5,duration=5\`\`\` (default values)
    - "Blink the LED [times] times": \`\`\`action:control,device:led,state:BLINK,times=[times],delay=0.5,duration=[calculated_duration]\`\`\`
    - "Blink the LED with a delay of [delay] seconds": \`\`\`action:control,device:led,state:BLINK,delay=[delay],times=5,duration=[calculated_duration]\`\`\`
    - "Blink the LED for [duration] seconds": \`\`\`action:control,device:led,state:BLINK,duration=[duration],times=5,delay=[calculated_delay]\`\`\`
    - "Blink the LED [times] times with a delay of [delay] seconds": \`\`\`action:control,device:led,state:BLINK,times=[times],delay=[delay],duration=[calculated_duration]\`\`\`
    - "Blink the LED for [duration] seconds with a delay of [delay] seconds": \`\`\`action:control,device:led,state:BLINK,duration=[duration],delay=[delay],times=[calculated_times]\`\`\`
    - "Blink the LED [times] times for [duration] seconds": \`\`\`action:control,device:led,state:BLINK,times=[times],duration=[duration],delay=[calculated_delay]\`\`\`

For any other request, respond naturally without code blocks. Always include ALL calculated parameters.`;


    const chatSession = model.startChat({
        generationConfig,
        history: [{ role: "user", parts: [{ text: systemPrompt }] }],
    });

    try {
        const result = await chatSession.sendMessage(prompt);
        const response = result.response.text();
        console.log("Gemini Response:", response);

        let state: string | null = null;
        let params: Record<string, number> = {};

        const codeBlockMatch = response.match(/```([\s\S]*?)```/);
        const codeBlockContent = codeBlockMatch ? codeBlockMatch[1].trim() : null;

        if (codeBlockContent) {
            const keyValuePairs = codeBlockContent.split(',').map(pair => pair.trim());
            const action = keyValuePairs.find(pair => pair.startsWith('action:'))?.split(':')[1];
            const device = keyValuePairs.find(pair => pair.startsWith('device:'))?.split(':')[1];
            state = keyValuePairs.find(pair => pair.startsWith('state:'))?.split(':')[1] ?? null;

            if (action === 'control' && device === 'led' && state) {
                let delay: number | undefined;
                let times: number | undefined;
                let duration: number | undefined;

                keyValuePairs.forEach(pair => {
                    const [key, value] = pair.split('=');
                    if (key === 'duration') duration = parseFloat(value);
                    if (key === 'delay') delay = parseFloat(value);
                    if (key === 'times') times = parseInt(value, 10);
                });

                if (state === 'BLINK') {
                    params = calculateBlinkParams(delay, times, duration);
                } else if (state === 'ON' && duration !== undefined) {
                    params = { duration };
                } else if (state === 'DELAYED_ON') {
                    params = { delay: delay ?? 0 };
                    if (duration !== undefined) params.duration = duration;
                } else if (state === 'DELAYED_OFF') {
                    params = { delay: delay ?? 0 };
                }
            }
        }

        return { type: 'control', state, params, response };

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

        const geminiResponse = await processGeminiResponse(prompt);

        if (geminiResponse.type === 'control' && geminiResponse.state) {
            console.log("Gemini Response:", geminiResponse);
            const mqttPayload = JSON.stringify({ state: geminiResponse.state, params: geminiResponse.params });
            console.log("MQTT Payload:", mqttPayload);
            broker.publish(TOPIC_LED, mqttPayload);
            return NextResponse.json({ success: true, message: "Command sent", response: geminiResponse.response });
        } else if (geminiResponse.type === 'chat') {
            return NextResponse.json({ success: true, message: "Chat response", response: geminiResponse.response });
        } else {
            return NextResponse.json({ success: false, message: "AI error", response: geminiResponse.response }, { status: 500 });
        }
    } catch (error) {
        console.error("Request Error:", error);
        return NextResponse.json({ error: 'Request error', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }
}