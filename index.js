const { spawn } = require("child_process");
const axios = require("axios");
const express = require("express");
const path = require("path");
const logger = require("./utils/log");
const login = require("fca-priyansh");

global.countRestart = global.countRestart || 0;

///////////////////////////////////////////////////////////
//========= Create website for dashboard/uptime =========//
///////////////////////////////////////////////////////////

const app = express();
const port = process.env.PORT || 8080;

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, '/index.html'));
});

app.listen(port, () => {
    logger(`Server is running on port ${port}...`, "[ Starting ]");
}).on('error', (err) => {
    if (err.code === 'EACCES') {
        logger(`Permission denied. Cannot bind to port ${port}.`, "[ Error ]");
    } else {
        logger(`Server error: ${err.message}`, "[ Error ]");
    }
});

/////////////////////////////////////////////////////////
//========= Create start bot and make it loop =========//
/////////////////////////////////////////////////////////

function startBot() {
    login({ appState: require('./appstate.json') }, (err, api) => {
        if (err) {
            logger(`Login error: ${err.message}`, "[ Error ]");
            process.exit(1);
        }

        logger("Bot logged in successfully!", "[ Starting ]");

        api.listenMqtt(async (err, message) => {
            if (err) {
                logger(`Listener error: ${err.message}`, "[ Error ]");
                return;
            }

            const threadID = message.threadID;
            const command = message.body;

            if (command) {
                logger(`Received command: ${command}`, "[ Command ]");
                await handleCommand(api, threadID, command);
            }
        });
    });
}

/////////////////////////////////////////////////////////
//========= Handle Typing Indicator & Commands =========//
/////////////////////////////////////////////////////////

async function handleCommand(api, threadID, command) {
    try {
        // Start typing indicator
        api.sendTypingIndicator(threadID, true);
        logger("Typing indicator started...", "[ Typing ]");

        // Simulate typing delay (3-7 seconds)
        await new Promise(resolve => setTimeout(resolve, Math.random() * 4000 + 3000));

        // Stop typing indicator
        api.sendTypingIndicator(threadID, false);
        logger("Typing indicator stopped.", "[ Typing ]");

        // List of random responses
        const responses = [
            `Command received: ${command}`,
            `Processing: ${command}...`,
            `Task "${command}" completed successfully.`,
            `Command "${command}" executed as requested.`,
        ];

        // Select a random response
        const response = responses[Math.floor(Math.random() * responses.length)];

        // Send response
        api.sendMessage(response, threadID);
        logger(`Response sent: ${response}`, "[ Response ]");
    } catch (err) {
        logger(`Error handling command: ${err.message}`, "[ Error ]");
    }
}

////////////////////////////////////////////////
//========= Check Updates from GitHub =========//
////////////////////////////////////////////////

axios.get("https://raw.githubusercontent.com/priyanshu192/bot/main/package.json")
    .then((res) => {
        logger(res.data.name, "[ NAME ]");
        logger(`Version: ${res.data.version}`, "[ VERSION ]");
        logger(res.data.description, "[ DESCRIPTION ]");
    })
    .catch((err) => {
        logger(`Failed to fetch update info: ${err.message}`, "[ Update Error ]");
    });

/////////////////////////////////////////////////////////
//========= Start the bot with Typing Feature =========//
/////////////////////////////////////////////////////////

startBot();
