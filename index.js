const { spawn } = require("child_process");
const axios = require("axios");
const express = require("express");
const path = require("path");
const logger = require("./utils/log");
const login = require("nextgen-fca"); // Correctly import `nextgen-fca`

// Initialize global restart counter
global.countRestart = global.countRestart || 0;

///////////////////////////////////////////////////////////
//========= Create website for dashboard/uptime =========//
///////////////////////////////////////////////////////////

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
        // Send typing indicator
        await api.sendTypingIndicator(threadID, true);
        await new Promise((resolve) => setTimeout(resolve, duration)); // Wait for duration
        await api.sendTypingIndicator(threadID, false); // Stop typing
    } catch (err) {
        console.error("Error simulating typing:", err.message);
    }
}

// Function to simulate random delay between responses
function simulateRandomDelay(min = 1000, max = 5000) {
    return Math.random() * (max - min) + min; // Random delay between 1 and 5 seconds
}

// Handle bot commands
async function handleCommands(api, event) {
    const message = event.body ? event.body.trim().toLowerCase() : "";

    if (message.startsWith(".")) {  // Check if the message starts with '.'
        const command = message.slice(1);  // Remove '.' from the start of the command

        // Simulate typing before sending response and introduce random delay for more natural behavior
        await simulateTyping(api, event.threadID);
        
        const delay = simulateRandomDelay();
        setTimeout(() => {
            if (command === "help") {
                api.sendMessage("Here are the available commands:\n1. .help\n2. .lock\n3. .unlock", event.threadID);
            } else if (command === "lock") {
                api.sendMessage("Locking the system...", event.threadID);
                // Lock functionality
            } else if (command === "unlock") {
                api.sendMessage("Unlocking the system...", event.threadID);
                // Unlock functionality
            } else {
                api.sendMessage("Unrecognized command. Type .help for a list of commands.", event.threadID);
            }
        }, delay); // Introduce random delay before replying
    }
}

///////////////////////////////////////////////////////////
//========= Login and Start Listening for Events =========//
///////////////////////////////////////////////////////////

login({ appState: require("./appstate.json") }, (err, api) => {
    if (err) {
        logger(`Login error: ${err.message}`, "[ Error ]");
        return;
    }

    logger("Bot logged in and listening for events...", "[ Starting ]");
    api.listenMqtt((error, event) => {
        if (error) return console.error("Error in listening:", error);

        if (event.type === "message" && event.body) {
            handleCommands(api, event);
        }
    });
});

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
