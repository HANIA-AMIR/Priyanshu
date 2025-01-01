const { spawn } = require("child_process");
const axios = require("axios");
const express = require("express");
const path = require("path");
const logger = require("./utils/log");
const login = require("nextgen-fca");

// Initialize global restart counter
global.countRestart = global.countRestart || 0;

// Create website for dashboard/uptime
const app = express();
const port = process.env.PORT || 8080;

// Serve the index.html file
app.get("/", function (req, res) {
    res.sendFile(path.join(__dirname, "/index.html"));
});

// Start the server and add error handling
app.listen(port, () => {
    logger(`Server is running on port ${port}...`, "[ Starting ]");
}).on("error", (err) => {
    if (err.code === "EACCES") {
        logger(`Permission denied. Cannot bind to port ${port}.`, "[ Error ]");
    } else {
        logger(`Server error: ${err.message}`, "[ Error ]");
    }
});

// Function to simulate typing indicator
async function simulateTyping(api, threadID, duration = 3000) {
    try {
        await api.sendTypingIndicator(threadID, true);
        await new Promise((resolve) => setTimeout(resolve, duration));
        await api.sendTypingIndicator(threadID, false);
    } catch (err) {
        console.error("Error simulating typing:", err.message);
    }
}

// Function to add group delay
function delayBetweenGroups(minDelay = 5000, maxDelay = 10000) {
    const delay = Math.random() * (maxDelay - minDelay) + minDelay;
    return new Promise((resolve) => setTimeout(resolve, delay));
}

// Handle commands
async function handleCommands(api, event) {
    const message = event.body ? event.body.trim().toLowerCase() : "";

    if (message.startsWith(".")) {  // Prefix check
        const command = message.slice(1);  // Remove prefix

        await simulateTyping(api, event.threadID); // Simulate typing

        const delay = Math.random() * (5000 - 1000) + 1000; // Random delay for natural response
        setTimeout(() => {
            if (command === "help") {
                api.sendMessage("Here are the available commands:\n1. .help\n2. .lock\n3. .unlock", event.threadID);
            } else if (command === "lock") {
                api.sendMessage("Locking the system...", event.threadID);
            } else if (command === "unlock") {
                api.sendMessage("Unlocking the system...", event.threadID);
            } else {
                api.sendMessage("Unrecognized command. Type .help for a list of commands.", event.threadID);
            }
        }, delay);
    }
}

// Login and start listening
login({ appState: require("./appstate.json") }, async (err, api) => {
    if (err) {
        logger(`Login error: ${err.message}`, "[ Error ]");
        return;
    }

    logger("Bot logged in and listening for events...", "[ Starting ]");

    api.listenMqtt(async (error, event) => {
        if (error) {
            console.error("Error in listening:", error);
            return;
        }

        if (event.type === "message" && event.body) {
            await delayBetweenGroups(); // Add delay before handling each group message
            handleCommands(api, event);
        }
    });
});

// Start the bot
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

// Check for updates
axios.get("https://raw.githubusercontent.com/priyanshu192/bot/main/package.json")
    .then((res) => {
        logger(res.data.name, "[ NAME ]");
        logger(`Version: ${res.data.version}`, "[ VERSION ]");
        logger(res.data.description, "[ DESCRIPTION ]");
    })
    .catch((err) => {
        logger(`Failed to fetch update info: ${err.message}`, "[ Update Error ]");
    });

// Start the bot loop
startBot();
