#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>

// Configuration structure
struct Config {
    char wifi_ssid[32];
    char wifi_password[64];
    char server_url[128];  // Backend server URL
    char client_id[32];
    char auth_key[64];
    char location[32];
    char firmware_version[16];
    bool initialized;
};

Config config;
Preferences preferences;

// Device Configuration for Lights
struct Light {
    const char* id;
    const char* name;
    int pin;
    bool status;
};

// Define your lights here
Light lights[] = {
    {"light1", "Main Light", 2, false},     // Main light on GPIO2
    {"light2", "Reading Light", 5, false}    // Reading light on GPIO5
};

// Command to enter config mode
const char CONFIG_COMMAND = '?';
bool configMode = false;

// HTTP polling interval (in milliseconds)
const unsigned long POLLING_INTERVAL = 1000;  // Poll every second
const unsigned long HEARTBEAT_INTERVAL = 30000;  // Send heartbeat every 30 seconds
unsigned long lastPollTime = 0;
unsigned long lastHeartbeatTime = 0;

void loadConfig() {
    preferences.begin("light-ctrl", true); // Read-only mode
    
    // Load configuration with default values
    strlcpy(config.wifi_ssid, preferences.getString("wifi_ssid", "F34 5G").c_str(), sizeof(config.wifi_ssid));
    strlcpy(config.wifi_password, preferences.getString("wifi_pass", "cttfjya2mvzf6u6").c_str(), sizeof(config.wifi_password));
    strlcpy(config.server_url, preferences.getString("server_url", "http://192.168.127.230:3000/api").c_str(), sizeof(config.server_url));
    strlcpy(config.client_id, preferences.getString("client_id", "esp32_livingroom").c_str(), sizeof(config.client_id));
    strlcpy(config.auth_key, preferences.getString("auth_key", "f1A3n2Vyq7VhDW97oDg06ks+TTAhPMocARCB5u8Wj6I=").c_str(), sizeof(config.auth_key));
    strlcpy(config.location, preferences.getString("location", "Living Room").c_str(), sizeof(config.location));
    strlcpy(config.firmware_version, "1.0.0", sizeof(config.firmware_version));
    config.initialized = preferences.getBool("initialized", false);
    
    preferences.end();
}

void saveConfig() {
    preferences.begin("light-ctrl", false); // Read-write mode
    
    preferences.putString("wifi_ssid", config.wifi_ssid);
    preferences.putString("wifi_pass", config.wifi_password);
    preferences.putString("server_url", config.server_url);
    preferences.putString("client_id", config.client_id);
    preferences.putString("auth_key", config.auth_key);
    preferences.putString("location", config.location);
    preferences.putBool("initialized", true);
    
    preferences.end();
}

void setup_wifi() {
    WiFi.mode(WIFI_STA);
    WiFi.disconnect();
    delay(100);

    Serial.println("\n=== WiFi Setup ===");
    Serial.print("Connecting to WiFi: ");
    Serial.println(config.wifi_ssid);
    
    WiFi.begin(config.wifi_ssid, config.wifi_password);

    int attempts = 0;
    const int maxAttempts = 20;
    
    Serial.println("Attempting connection:");
    while (WiFi.status() != WL_CONNECTED && attempts < maxAttempts) {
        delay(1000);
        Serial.print(".");
        attempts++;
        
        if (attempts % 5 == 0) {
            Serial.print("\nStatus: ");
            switch(WiFi.status()) {
                case WL_IDLE_STATUS:
                    Serial.println("Idle");
                    break;
                case WL_NO_SSID_AVAIL:
                    Serial.println("SSID not found");
                    break;
                case WL_CONNECT_FAILED:
                    Serial.println("Connection failed");
                    break;
                case WL_DISCONNECTED:
                    Serial.println("Disconnected");
                    break;
                default:
                    Serial.println("Unknown status");
            }
        }
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\nWiFi connected successfully!");
        Serial.print("IP address: ");
        Serial.println(WiFi.localIP());
        Serial.print("Signal strength (RSSI): ");
        Serial.print(WiFi.RSSI());
        Serial.println(" dBm");
    } else {
        Serial.println("\nWiFi connection failed!");
    }
}

void control_light(Light& light, bool newStatus) {
    digitalWrite(light.pin, newStatus ? HIGH : LOW);
    light.status = newStatus;

    // Send status update to server
    HTTPClient http;
    String url = String(config.server_url) + "/device";
    http.begin(url);
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<200> doc;
    doc["clientId"] = config.client_id;
    doc["authKey"] = config.auth_key;
    doc["deviceId"] = light.id;
    doc["status"] = light.status;

    String jsonString;
    serializeJson(doc, jsonString);

    int httpResponseCode = http.PUT(jsonString);
    if (httpResponseCode > 0) {
        String response = http.getString();
        Serial.print("Status update response: ");
        Serial.println(response);
    } else {
        Serial.print("Error sending status update: ");
        Serial.println(httpResponseCode);
    }

    http.end();
}

void check_for_commands() {
    HTTPClient http;
    String url = String(config.server_url) + "/device?clientId=" + config.client_id;
    http.begin(url);
    
    // Add authentication header
    http.addHeader("Authorization", String("Bearer ") + config.auth_key);
    
    int httpResponseCode = http.GET();
    Serial.print("Command check response code: ");
    Serial.println(httpResponseCode);
    
    if (httpResponseCode == HTTP_CODE_OK) {
        String payload = http.getString();
        Serial.print("Command payload: ");
        Serial.println(payload);
        
        StaticJsonDocument<1024> doc;
        DeserializationError error = deserializeJson(doc, payload);
        
        if (!error) {
            JsonObject client = doc["client"];
            if (client["devices"].is<JsonArray>()) {
                JsonArray devices = client["devices"];
                for (JsonObject device : devices) {
                    const char* deviceId = device["id"];
                    bool status = device["status"];
                    
                    // Find and update matching light
                    for (Light& light : lights) {
                        if (strcmp(light.id, deviceId) == 0 && light.status != status) {
                            Serial.print("Updating light ");
                            Serial.print(light.name);
                            Serial.print(" to ");
                            Serial.println(status ? "ON" : "OFF");
                            control_light(light, status);
                            break;
                        }
                    }
                }
            }
        } else {
            Serial.print("JSON parsing error: ");
            Serial.println(error.c_str());
        }
    } else {
        Serial.print("Error checking commands: ");
        Serial.println(httpResponseCode);
        if (httpResponseCode > 0) {
            String response = http.getString();
            Serial.print("Error response: ");
            Serial.println(response);
        }
    }
    
    http.end();
}

void send_heartbeat() {
    HTTPClient http;
    String url = String(config.server_url) + "/device";
    http.begin(url);
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<200> doc;
    doc["clientId"] = config.client_id;
    doc["authKey"] = config.auth_key;

    String jsonString;
    serializeJson(doc, jsonString);

    int httpResponseCode = http.PUT(jsonString);
    if (httpResponseCode > 0) {
        String response = http.getString();
        Serial.print("Heartbeat response: ");
        Serial.println(response);
    } else {
        Serial.print("Error sending heartbeat: ");
        Serial.println(httpResponseCode);
    }

    http.end();
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
                StaticJsonDocument<512> doc;
                DeserializationError error = deserializeJson(doc, jsonInput);
                
                if (!error) {
                    strlcpy(config.wifi_ssid, doc["wifi_ssid"] | "F34 5G", sizeof(config.wifi_ssid));
                    strlcpy(config.wifi_password, doc["wifi_password"] | "cttfjya2mvzf6u6", sizeof(config.wifi_password));
                    strlcpy(config.server_url, doc["server_url"] | "http://192.168.127.230:3000/api", sizeof(config.server_url));
                    strlcpy(config.client_id, doc["client_id"] | "esp32_livingroom", sizeof(config.client_id));
                    strlcpy(config.auth_key, doc["auth_key"] | "f1A3n2Vyq7VhDW97oDg06ks+TTAhPMocARCB5u8Wj6I=", sizeof(config.auth_key));
                    strlcpy(config.location, doc["location"] | "Living Room", sizeof(config.location));
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
    
    Serial.println("\n=== ESP32 Light Control System ===");
    Serial.println("Version: 1.0.0");
    Serial.println("Initializing...");
    
    // Initialize light pins
    Serial.println("\nInitializing GPIO pins:");
    for (Light& light : lights) {
        pinMode(light.pin, OUTPUT);
        digitalWrite(light.pin, LOW);
        Serial.print("Set GPIO ");
        Serial.print(light.pin);
        Serial.print(" (");
        Serial.print(light.name);
        Serial.println(") as OUTPUT");
    }
    
    // Load configuration
    Serial.println("\nLoading configuration...");
    loadConfig();
    
    if (!config.initialized) {
        configMode = true;
        Serial.println("\n=== First Time Setup ===");
        Serial.println("Enter configuration in JSON format (or press Enter to use defaults):");
        Serial.println(R"({
    "wifi_ssid": "F34 5G",
    "wifi_password": "cttfjya2mvzf6u6",
    "server_url": "http://192.168.127.230:3000/api",
    "client_id": "esp32_livingroom",
    "auth_key": "f1A3n2Vyq7VhDW97oDg06ks+TTAhPMocARCB5u8Wj6I=",
    "location": "Living Room"
})");
        return;
    }
    
    Serial.println("\nStarting WiFi connection...");
    setup_wifi();
    
    Serial.println("\nSetup complete!");
}

void loop() {
    if (configMode) {
        handleSerialConfig();
        return;
    }

    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("\nWiFi connection lost. Reconnecting...");
        setup_wifi();
        return;
    }
    
    unsigned long currentTime = millis();
    
    // Poll for commands
    if (currentTime - lastPollTime >= POLLING_INTERVAL) {
        check_for_commands();
        lastPollTime = currentTime;
    }
    
    // Send heartbeat
    if (currentTime - lastHeartbeatTime >= HEARTBEAT_INTERVAL) {
        send_heartbeat();
        lastHeartbeatTime = currentTime;
    }
    
    // Print status every 30 seconds
    static unsigned long lastStatus = 0;
    if (currentTime - lastStatus > 30000) {
        Serial.println("\n=== Status Update ===");
        Serial.print("WiFi Connected: ");
        Serial.println(WiFi.status() == WL_CONNECTED ? "Yes" : "No");
        if (WiFi.status() == WL_CONNECTED) {
            Serial.print("Signal strength: ");
            Serial.print(WiFi.RSSI());
            Serial.println(" dBm");
        }
        Serial.println("Light Status:");
        for (const Light& light : lights) {
            Serial.print("  ");
            Serial.print(light.name);
            Serial.print(": ");
            Serial.println(light.status ? "ON" : "OFF");
        }
        lastStatus = currentTime;
    }
}