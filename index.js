const { spawn } = require("child_process");
const axios = require("axios");
const express = require("express");
const path = require("path");
const logger = require("./utils/log");

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
        shell: true
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

////////////////////////////////////////////////
//========= Add Random Delays for Realism =========//
////////////////////////////////////////////////

// Random delay function (5-15 seconds)
function randomDelay(min = 5000, max = 15000) {
    return new Promise((resolve) => setTimeout(resolve, Math.random() * (max - min) + min));
}

// Handle bot commands with delay and "typing..." simulation
async function handleCommand(command) {
    console.log("Typing..."); // Simulate typing
    let dots = "";
    const typingInterval = setInterval(() => {
        dots = dots.length < 3 ? dots + "." : ""; // Add/remove dots
        process.stdout.write(`\rTyping${dots} `); // Update console output
    }, 500); // Update every 500ms

    await randomDelay(3000, 7000); // Typing delay (3-7 seconds)

    clearInterval(typingInterval); // Stop typing effect
    process.stdout.write("\r"); // Clear the typing line

    // List of random responses for commands
    const responses = [
        `Command received: ${command}`,
        `Processing: ${command}...`,
        `Task "${command}" completed successfully.`,
        `Command "${command}" executed as requested.`,
    ];
    const response = responses[Math.floor(Math.random() * responses.length)];

    console.log(response); // Simulate sending response
    await randomDelay(5000, 15000); // Action delay (5-15 seconds)
}

// Simulate receiving commands
process.on("message", async (command) => {
    if (command) {
        console.log(`Processing command: ${command}`);
        await handleCommand(command);
    }
});

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

// Start the bot
startBot();
