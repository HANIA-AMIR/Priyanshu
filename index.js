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
//========= Simulate Typing Indicator =========//
/////////////////////////////////////////////////////////

async function simulateTyping(api, threadID, duration = 3000) {
    try {
        // Send typing indicator
        await api.sendTypingIndicator(threadID, true);
        await new Promise((resolve) => setTimeout(resolve, duration)); // Simulate typing duration
        await api.sendTypingIndicator(threadID, false); // Stop typing
    } catch (err) {
        console.error("Error simulating typing:", err.message);
    }
}

/////////////////////////////////////////////////////////
//========= Handle Commands =========//
/////////////////////////////////////////////////////////

function handleCommands(api, event) {
    const message = event.body ? event.body.toLowerCase().trim() : "";

    // Command responses
    const responses = {
        help: "Available commands:\n1. help - Show this list\n2. greet - Sends a greeting\n3. about - Get info about this bot",
        greet: "Hello! How can I assist you today?",
        about: "I'm a Messenger bot powered by NextGen-FCA. Ready to help!",
    };

    if (responses[message]) {
        simulateTyping(api, event.threadID).then(() => {
            api.sendMessage(responses[message], event.threadID);
        });
    } else {
        simulateTyping(api, event.threadID).then(() => {
            api.sendMessage("Unrecognized command. Type 'help' for a list of commands.", event.threadID);
        });
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
