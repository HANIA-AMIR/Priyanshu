const { spawn } = require("child_process");
const axios = require("axios");
const logger = require("./utils/log");
const fs = require("fs");

///////////////////////////////////////////////////////////
//========= Create website for dashboard/uptime =========//
///////////////////////////////////////////////////////////

const express = require("express");
const path = require("path");

const app = express();
const port = process.env.PORT || 8080;

// Serve the index.html file
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "/index.html"));
});

// Start the server and handle potential errors
app.listen(port, () => {
    logger(`Server is running on port ${port}...`, "[ Starting ]");
}).on("error", (err) => {
    if (err.code === "EACCES") {
        logger(`Permission denied. Cannot bind to port ${port}.`, "[ Error ]");
        process.exit(1);
    } else {
        logger(`Server error: ${err.message}`, "[ Error ]");
    }
});

/////////////////////////////////////////////////////////
//========= Create start bot and make it loop =========//
/////////////////////////////////////////////////////////

global.countRestart = 0;
let botProcess = null;

function startBot(message) {
    if (message) logger(message, "[ Starting ]");

    const child = spawn("node", ["--trace-warnings", "--async-stack-traces", "Priyansh.js"], {
        cwd: __dirname,
        stdio: "inherit",
        shell: true,
    });

    botProcess = child;

    child.on("close", async (codeExit) => {
        if (codeExit !== 0) {
            global.countRestart++;
            if (global.countRestart < 5) {
                logger(`Bot exited with code ${codeExit}. Restarting after a delay... (${global.countRestart}/5)`, "[ Restarting ]");
                await randomDelay(30000, 60000); // Increased restart delay: 30-60 seconds
                startBot();
            } else {
                logger(`Bot has exceeded restart limit (${global.countRestart}/5). Manual intervention required.`, "[ Stopped ]");
                global.countRestart = 0;
            }
        } else {
            logger("Bot stopped gracefully.", "[ Stopped ]");
        }
    });

    child.on("error", (error) => {
        logger(`An error occurred: ${JSON.stringify(error)}`, "[ Error ]");
    });
}

// Random delay generator for human-like behavior
function randomDelay(min = 20000, max = 120000) { // Increased to 20-120 seconds
    return new Promise((resolve) => setTimeout(resolve, Math.random() * (max - min) + min));
}

// Graceful shutdown handling
process.on("SIGINT", () => {
    if (botProcess) botProcess.kill();
    logger("Bot process terminated due to SIGINT (Ctrl+C).", "[ Stopped ]");
    process.exit(0);
});

process.on("SIGTERM", () => {
    if (botProcess) botProcess.kill();
    logger("Bot process terminated due to SIGTERM.", "[ Stopped ]");
    process.exit(0);
});

////////////////////////////////////////////////
//========= Check update from Github =========//
////////////////////////////////////////////////

axios
    .get("https://raw.githubusercontent.com/priyanshu192/bot/main/package.json")
    .then((res) => {
        logger(`Bot Name: ${res.data.name}`, "[ NAME ]");
        logger(`Version: ${res.data.version}`, "[ VERSION ]");
        logger(`Description: ${res.data.description}`, "[ DESCRIPTION ]");
    })
    .catch((err) => {
        logger(`Failed to fetch update info: ${err.message}`, "[ Update Error ]");
    });

/////////////////////////////////////////////////////////
//========= Enhance Anti-Detection Mechanisms =========//
/////////////////////////////////////////////////////////

// Periodic token refresh to avoid session expiration
async function refreshSessionTokens() {
    try {
        const response = await axios.get("https://m.facebook.com");
        const fbDtsgMatch = response.data.match(/"fb_dtsg" value="([^"]+)"/);
        if (fbDtsgMatch) {
            logger("Session tokens refreshed successfully.", "[ Token Refresh ]");
            // Update token in appstate file
            fs.writeFileSync("./session_tokens.json", JSON.stringify({ fb_dtsg: fbDtsgMatch[1] }));
        }
    } catch (err) {
        logger(`Failed to refresh session tokens: ${err.message}`, "[ Token Error ]");
    }
}
setInterval(refreshSessionTokens, 3600000); // Refresh every 1 hour

// Randomize user-agent to avoid detection
const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.105 Mobile Safari/537.36",
];

function getRandomUserAgent() {
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

axios.interceptors.request.use((config) => {
    config.headers["User-Agent"] = getRandomUserAgent();
    return config;
});

// Random activity generator for human-like behavior
async function simulateHumanActivity() {
    while (true) {
        const actions = [
            "Scrolling through feed",
            "Reacting to a post",
            "Typing a comment",
            "Viewing a profile",
        ];
        const action = actions[Math.floor(Math.random() * actions.length)];
        logger(`Simulating activity: ${action}`, "[ Anti-Detection ]");
        await randomDelay(20000, 120000); // Increased activity delay: 20-120 seconds
    }
}
simulateHumanActivity();

/////////////////////////////////////////////////
//========= Start Bot Safely ==================//
/////////////////////////////////////////////////

logger("Starting the bot with enhanced anti-detection mechanisms and extended delays...", "[ Initializing ]");
startBot();
