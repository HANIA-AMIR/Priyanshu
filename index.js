const { spawn } = require("child_process");
const axios = require("axios");
const express = require("express");
const path = require("path");
const logger = require("./utils/log");
const login = require("nextgen-fca");
const ProxyAgent = require("https-proxy-agent");

// Proxy configuration for IP rotation
const proxyList = [
    "http://proxy1.example.com:8080",
    "http://proxy2.example.com:8080"
];
const proxyAgent = new ProxyAgent(proxyList[Math.floor(Math.random() * proxyList.length)]);

global.countRestart = global.countRestart || 0;

// Track group processing
let lastProcessedGroup = null; // Track the last processed group
let isProcessingGroup = false; // To avoid simultaneous processing
const groupDelay = 10000; // Delay in milliseconds (e.g., 10 seconds)

///////////////////////////////////////////////////////////
//========= Create website for dashboard/uptime =========//
///////////////////////////////////////////////////////////

const app = express();
const port = process.env.PORT || 8080;

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "/index.html"));
});

app.listen(port, () => {
    logger(`Server running on port ${port}...`, "[ Starting ]");
}).on("error", (err) => {
    logger(`Server error: ${err.message}`, "[ Error ]");
});

/////////////////////////////////////////////////////////
//========= Create start bot and make it loop =========//
/////////////////////////////////////////////////////////

function startBot(message) {
    if (message) logger(message, "[ Starting ]");

    const child = spawn("node", ["--trace-warnings", "--async-stack-traces", "Priyansh.js"], {
        cwd: __dirname,
        stdio: "inherit",
        shell: true,
    });

    child.on("close", (codeExit) => {
        if (codeExit !== 0 && global.countRestart < 5) {
            global.countRestart += 1;
            logger(`Bot exited with code ${codeExit}. Restarting... (${global.countRestart}/5)`, "[ Restarting ]");
            startBot();
        } else {
            logger(`Bot stopped after ${global.countRestart} restarts.`, "[ Stopped ]");
        }
    });

    child.on("error", (error) => {
        logger(`An error occurred: ${JSON.stringify(error)}`, "[ Error ]");
    });
}

///////////////////////////////////////////////////////////
//========= Add Typing Indicator and Command Logic =======//
///////////////////////////////////////////////////////////

async function simulateTyping(api, threadID, duration = 3000) {
    try {
        await api.sendTypingIndicator(threadID, true);
        await new Promise((resolve) => setTimeout(resolve, duration));
        await api.sendTypingIndicator(threadID, false);
    } catch (err) {
        logger(`Typing indicator error: ${err.message}`, "[ Typing Error ]");
    }
}

// Function to randomize delays
function simulateRandomDelay(min = 5000, max = 10000) {
    return Math.random() * (max - min) + min;
}

// Handle group-specific delay
async function processGroup(api, event) {
    if (isProcessingGroup) return; // Ignore new requests if already processing a group

    const threadID = event.threadID;

    // Check if switching groups
    if (lastProcessedGroup && lastProcessedGroup !== threadID) {
        logger(`Switching from group ${lastProcessedGroup} to group ${threadID}`, "[ Group Delay ]");
        await new Promise((resolve) => setTimeout(resolve, groupDelay)); // Delay before processing new group
    }

    isProcessingGroup = true; // Lock processing to this group
    lastProcessedGroup = threadID; // Update last processed group

    // Simulate typing and process the command
    await simulateTyping(api, threadID);

    const message = event.body ? event.body.trim().toLowerCase() : "";
    if (message.startsWith(".")) {
        const command = message.slice(1);

        const delay = simulateRandomDelay();
        setTimeout(() => {
            if (command === "help") {
                api.sendMessage("Commands:\n1. .help\n2. .info\n3. .settings", threadID);
            } else if (command === "info") {
                api.sendMessage("This bot is running with enhanced group handling.", threadID);
            } else {
                api.sendMessage("Unrecognized command. Type .help for more info.", threadID);
            }
            isProcessingGroup = false; // Unlock group processing
        }, delay);
    } else {
        isProcessingGroup = false; // Unlock if no valid command
    }
}

///////////////////////////////////////////////////////////
//========= Login and Start Listening for Events =========//
///////////////////////////////////////////////////////////

login({ appState: require("./appstate.json"), agent: proxyAgent }, (err, api) => {
    if (err) {
        logger(`Login error: ${err.message}`, "[ Error ]");
        return;
    }

    logger("Bot logged in and listening...", "[ Starting ]");

    api.setOptions({
        listenEvents: true,
        selfListen: false,
    });

    api.listenMqtt((error, event) => {
        if (error) return logger(`Listen error: ${error.message}`, "[ Error ]");

        if (event.type === "message" && event.body) {
            processGroup(api, event); // Process group-specific logic
        }
    });
});

startBot();
