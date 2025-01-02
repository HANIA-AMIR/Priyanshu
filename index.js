const { spawn } = require("child_process");
const axios = require("axios");
const express = require("express");
const path = require("path");
const logger = require("./utils/log");
const login = require("nextgen-fca");

global.countRestart = global.countRestart || 0;

///////////////////////////////////////////////////////////
//========= Create website for dashboard/uptime =========//
///////////////////////////////////////////////////////////

const app = express();
const port = process.env.PORT || 8080;

app.get("/", function (req, res) {
    res.sendFile(path.join(__dirname, "/index.html"));
});

app.listen(port, () => {
    logger(`Server is running on port ${port}...`, "[ Starting ]");
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

async function simulateTyping(api, threadID, duration = 2000) {
    try {
        await api.sendTypingIndicator(threadID, true); // Start typing
        await new Promise((resolve) => setTimeout(resolve, duration)); // Wait for duration
        await api.sendTypingIndicator(threadID, false); // Stop typing
    } catch (err) {
        console.error("Typing indicator error:", err.message);
    }
}

function simulateRandomDelay(min = 1000, max = 5000) {
    return Math.random() * (max - min) + min; // Random delay between 1-5 seconds
}

// Delay per group to reduce suspicion (3-5 minutes)
function delayBetweenGroups(min = 180000, max = 300000) {
    return Math.random() * (max - min) + min;
}

async function handleGroupMessages(api, event) {
    const message = event.body ? event.body.trim().toLowerCase() : "";

    if (message.startsWith(".")) {
        const command = message.slice(1);

        // Simulate typing before responding
        await simulateTyping(api, event.threadID);

        // Add random delay between responses
        const delay = simulateRandomDelay();
        setTimeout(async () => {
            if (command === "help") {
                await api.sendMessage("Available commands:\n1. .help\n2. .lock\n3. .unlock", event.threadID);
            } else if (command === "lock") {
                await api.sendMessage("System locked.", event.threadID);
            } else if (command === "unlock") {
                await api.sendMessage("System unlocked.", event.threadID);
            } else {
                await api.sendMessage("Unknown command. Type .help for commands.", event.threadID);
            }
        }, delay);
    }
}

///////////////////////////////////////////////////////////
//========= Login and Start Listening for Events =========//
///////////////////////////////////////////////////////////

login(
    {
        appState: require("./appstate.json"),
        proxy: "http://your-proxy-server:port", // Add proxy to distribute traffic (optional)
    },
    (err, api) => {
        if (err) {
            logger(`Login error: ${err.message}`, "[ Error ]");
            return;
        }

        logger("Bot logged in and listening for events...", "[ Starting ]");
        api.listenMqtt((error, event) => {
            if (error) return console.error("Listening Error:", error);

            if (event.type === "message" && event.body) {
                // Add delay between handling messages in groups
                const groupDelay = delayBetweenGroups();
                setTimeout(() => {
                    handleGroupMessages(api, event);
                }, groupDelay);
            }
        });
    }
);

/////////////////////////////////////////////////////////
//========= Check Updates from GitHub =========//
/////////////////////////////////////////////////////////

axios.get("https://raw.githubusercontent.com/priyanshu192/bot/main/package.json")
    .then((res) => {
        logger(res.data.name, "[ NAME ]");
        logger(`Version: ${res.data.version}`, "[ VERSION ]");
        logger(res.data.description, "[ DESCRIPTION ]");
    })
    .catch((err) => {
        logger(`Failed to fetch update info: ${err.message}`, "[ Update Error ]");
    });

// Start the bot
startBot();
