#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>

// Configuration structure
struct Config {
    char wifi_ssid[32];
    char wifi_password[64];
    char mqtt_broker[128];
    int mqtt_port;
    char mqtt_username[32];
    char mqtt_password[64];
    char client_id[32];
    char auth_key[64];
    char location[32];
    char firmware_version[16];
    bool initialized;
};

Config config;
Preferences preferences;

// Device Configuration
struct Device {
    const char* id;
    const char* type;
    const char* name;
    int pin;
    int pwmPin;  // For dimmable lights and variable speed fans
    bool status;
    int value;   // For brightness/speed (0-255)
};

// Define your devices here with PWM pins
Device devices[] = {
    {"light1", "light", "Main Light", 2, 4, false, 255},  // Main light with dimming on GPIO4
    {"fan1", "fan", "Ceiling Fan", 5, 15, false, 255}     // Fan with speed control on GPIO15
};

// SSL/TLS Certificate (replace with your broker's certificate)
const char* ROOT_CA = R"EOF(
-----BEGIN CERTIFICATE-----
YOUR_CA_CERTIFICATE_HERE
-----END CERTIFICATE-----
)EOF";

WiFiClientSecure espClient;
PubSubClient mqttClient(espClient);

// Command to enter config mode
const char CONFIG_COMMAND = '?';
bool configMode = false;

// Topics
String getDeviceTopic(const Device& device) {
    return String("device/") + device.type + "/" + config.client_id + "/" + device.id;
}

String getClientStatusTopic() {
    return String("client/") + config.client_id + "/status";
}

void loadConfig() {
    preferences.begin("home-asst", true); // Read-only mode
    
    strlcpy(config.wifi_ssid, preferences.getString("wifi_ssid", "").c_str(), sizeof(config.wifi_ssid));
    strlcpy(config.wifi_password, preferences.getString("wifi_pass", "").c_str(), sizeof(config.wifi_password));
    strlcpy(config.mqtt_broker, preferences.getString("mqtt_broker", "").c_str(), sizeof(config.mqtt_broker));
    config.mqtt_port = preferences.getInt("mqtt_port", 8883);
    strlcpy(config.mqtt_username, preferences.getString("mqtt_user", "").c_str(), sizeof(config.mqtt_username));
    strlcpy(config.mqtt_password, preferences.getString("mqtt_pass", "").c_str(), sizeof(config.mqtt_password));
    strlcpy(config.client_id, preferences.getString("client_id", "").c_str(), sizeof(config.client_id));
    strlcpy(config.auth_key, preferences.getString("auth_key", "").c_str(), sizeof(config.auth_key));
    strlcpy(config.location, preferences.getString("location", "").c_str(), sizeof(config.location));
    strlcpy(config.firmware_version, "1.0.0", sizeof(config.firmware_version));
    config.initialized = preferences.getBool("initialized", false);
    
    preferences.end();
}

void saveConfig() {
    preferences.begin("home-asst", false); // Read-write mode
    
    preferences.putString("wifi_ssid", config.wifi_ssid);
    preferences.putString("wifi_pass", config.wifi_password);
    preferences.putString("mqtt_broker", config.mqtt_broker);
    preferences.putInt("mqtt_port", config.mqtt_port);
    preferences.putString("mqtt_user", config.mqtt_username);
    preferences.putString("mqtt_pass", config.mqtt_password);
    preferences.putString("client_id", config.client_id);
    preferences.putString("auth_key", config.auth_key);
    preferences.putString("location", config.location);
    preferences.putBool("initialized", true);
    
    preferences.end();
}

void setup_wifi() {
    delay(10);
    Serial.println("Connecting to WiFi...");
    WiFi.begin(config.wifi_ssid, config.wifi_password);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print(".");
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\nWiFi connected");
        Serial.println("IP address: ");
        Serial.println(WiFi.localIP());
    } else {
        Serial.println("\nWiFi connection failed");
    }
}

void setup_security() {
    espClient.setCACert(ROOT_CA);
}

void setup_pwm() {
    ledcSetup(0, 5000, 8); // Channel 0, 5KHz, 8-bit resolution
    
    // Setup PWM for dimmable devices
    for (Device& device : devices) {
        if (device.pwmPin > 0) {
            ledcAttachPin(device.pwmPin, 0);
        }
    }
}

bool connect_mqtt() {
    if (!mqttClient.connected()) {
        Serial.print("Connecting to MQTT...");
        
        // Set last will testament
        String statusTopic = getClientStatusTopic();
        
        if (mqttClient.connect(config.client_id, config.mqtt_username, config.mqtt_password,
                             statusTopic.c_str(), 1, true, "offline")) {
            Serial.println("connected");
            
            // Subscribe to all device topics
            for (Device& device : devices) {
                String topic = getDeviceTopic(device);
                mqttClient.subscribe(topic.c_str());
            }
            
            // Publish online status
            mqttClient.publish(statusTopic.c_str(), "online", true);
            
            // Publish client info
            DynamicJsonDocument clientInfo(256);
            clientInfo["id"] = config.client_id;
            clientInfo["location"] = config.location;
            clientInfo["firmware"] = config.firmware_version;
            clientInfo["authKey"] = config.auth_key;
            
            String clientInfoJson;
            serializeJson(clientInfo, clientInfoJson);
            
            mqttClient.publish((String("client/") + config.client_id + "/info").c_str(), 
                             clientInfoJson.c_str(), true);
            
            return true;
        }
        
        Serial.print("failed, rc=");
        Serial.print(mqttClient.state());
        Serial.println(" retrying in 5 seconds");
        return false;
    }
    return true;
}

void control_device(Device& device, const JsonObject& command) {
    const char* state = command["state"];
    if (!state) return;

    String stateStr = String(state);
    bool newStatus = (stateStr == "ON");
    
    if (String(device.type) == "light") {
        if (stateStr == "ON" || stateStr == "OFF") {
            // For dimmable lights, use PWM
            if (device.pwmPin > 0) {
                int brightness = command["brightness"] | 255;
                device.value = brightness;
                ledcWrite(0, newStatus ? brightness : 0);
            } else {
                digitalWrite(device.pin, newStatus ? HIGH : LOW);
            }
            device.status = newStatus;
        }
        else if (stateStr == "BLINK") {
            float delaySec = command["delay"] | 0.5f;
            int times = command["times"] | 5;
            float duration = command["duration"] | (delaySec * times * 2);
            
            unsigned long startTime = millis();
            for (int i = 0; i < times; i++) {
                if ((millis() - startTime) >= duration * 1000) break;
                if (device.pwmPin > 0) {
                    ledcWrite(0, device.value);
                } else {
                    digitalWrite(device.pin, HIGH);
                }
                delay(delaySec * 1000);
                if (device.pwmPin > 0) {
                    ledcWrite(0, 0);
                } else {
                    digitalWrite(device.pin, LOW);
                }
                delay(delaySec * 1000);
                mqttClient.loop();
            }
        }
        else if (stateStr == "DELAYED_ON") {
            float delaySec = command["delay"] | 0.0f;
            float durationSec = command["duration"] | 0.0f;
            
            delay(delaySec * 1000);
            if (device.pwmPin > 0) {
                ledcWrite(0, device.value);
            } else {
                digitalWrite(device.pin, HIGH);
            }
            device.status = true;
            
            if (durationSec > 0) {
                delay(durationSec * 1000);
                if (device.pwmPin > 0) {
                    ledcWrite(0, 0);
                } else {
                    digitalWrite(device.pin, LOW);
                }
                device.status = false;
            }
        }
    }
    else if (String(device.type) == "fan") {
        if (stateStr == "ON" || stateStr == "OFF") {
            // For variable speed fans, use PWM
            if (device.pwmPin > 0) {
                int speed = command["speed"] | 255;
                device.value = speed;
                ledcWrite(0, newStatus ? speed : 0);
            } else {
                digitalWrite(device.pin, newStatus ? HIGH : LOW);
            }
            device.status = newStatus;
        }
    }

    // Publish status update
    DynamicJsonDocument statusDoc(128);
    statusDoc["status"] = device.status;
    if (device.pwmPin > 0) {
        statusDoc["value"] = device.value;
    }
    String statusJson;
    serializeJson(statusDoc, statusJson);
    mqttClient.publish((getDeviceTopic(device) + "/status").c_str(), 
                      statusJson.c_str(), true);
}

void mqtt_callback(char* topic, byte* payload, unsigned int length) {
    // Verify message authenticity
    String receivedTopic = String(topic);
    
    DynamicJsonDocument doc(512);
    DeserializationError error = deserializeJson(doc, payload, length);
    
    if (error) {
        Serial.println("Failed to parse message");
        return;
    }

    // Find the device this message is for
    for (Device& device : devices) {
        String deviceTopic = getDeviceTopic(device);
        if (receivedTopic == deviceTopic) {
            control_device(device, doc.as<JsonObject>());
            break;
        }
    }
}

void handleSerialConfig() {
    if (Serial.available()) {
        char c = Serial.read();
        if (c == CONFIG_COMMAND && !configMode) {
            configMode = true;
            Serial.println("\n=== Configuration Mode ===");
            Serial.println("Enter configuration in JSON format:");
            return;
        }
        
        if (configMode) {
            static String jsonInput;
            if (c == '\n') {
                DynamicJsonDocument doc(512);
                DeserializationError error = deserializeJson(doc, jsonInput);
                
                if (!error) {
                    strlcpy(config.wifi_ssid, doc["wifi_ssid"] | "", sizeof(config.wifi_ssid));
                    strlcpy(config.wifi_password, doc["wifi_password"] | "", sizeof(config.wifi_password));
                    strlcpy(config.mqtt_broker, doc["mqtt_broker"] | "", sizeof(config.mqtt_broker));
                    config.mqtt_port = doc["mqtt_port"] | 8883;
                    strlcpy(config.mqtt_username, doc["mqtt_username"] | "", sizeof(config.mqtt_username));
                    strlcpy(config.mqtt_password, doc["mqtt_password"] | "", sizeof(config.mqtt_password));
                    strlcpy(config.client_id, doc["client_id"] | "", sizeof(config.client_id));
                    strlcpy(config.auth_key, doc["auth_key"] | "", sizeof(config.auth_key));
                    strlcpy(config.location, doc["location"] | "", sizeof(config.location));
                    strlcpy(config.firmware_version, "1.0.0", sizeof(config.firmware_version));
                    config.initialized = true;
                    
                    saveConfig();
                    Serial.println("Configuration saved!");
                    Serial.println("Restarting...");
                    delay(1000);
                    ESP.restart();
                } else {
                    Serial.println("Invalid JSON configuration");
                }
                jsonInput = "";
                configMode = false;
            } else {
                jsonInput += c;
            }
        }
    }
}

void setup() {
    Serial.begin(115200);
    
    // Initialize device pins
    for (Device& device : devices) {
        pinMode(device.pin, OUTPUT);
        digitalWrite(device.pin, LOW);
    }
    
    // Load configuration
    loadConfig();
    
    // If not configured, enter config mode
    if (!config.initialized) {
        configMode = true;
        Serial.println("\n=== First Time Setup ===");
        Serial.println("Enter configuration in JSON format:");
        Serial.println("Example:");
        Serial.println(R"({
    "wifi_ssid": "YourWiFi",
    "wifi_password": "YourPassword",
    "mqtt_broker": "broker.example.com",
    "mqtt_port": 8883,
    "mqtt_username": "your_username",
    "mqtt_password": "your_password",
    "client_id": "esp32_living",
    "auth_key": "your_auth_key",
    "location": "Living Room"
})");
        return;
    }
    
    setup_wifi();
    setup_security();
    setup_pwm();
    
    mqttClient.setServer(config.mqtt_broker, config.mqtt_port);
    mqttClient.setCallback(mqtt_callback);
}

void loop() {
    if (configMode) {
        handleSerialConfig();
        return;
    }

    if (WiFi.status() != WL_CONNECTED) {
        setup_wifi();
    }
    
    if (!mqttClient.connected()) {
        connect_mqtt();
    }
    
    mqttClient.loop();
    
    // Check for configuration command
    handleSerialConfig();
}