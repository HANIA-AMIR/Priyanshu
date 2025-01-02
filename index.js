const { spawn } = require("child_process");
const axios = require("axios");
const express = require("express");
const path = require("path");
const logger = require("./utils/log");
const login = require("nextgen-fca");

// Global cooldowns for groups and rate limiting
const groupCooldowns = new Map();

// Helper: Random Delay for Human-like Timing
function randomDelay(min = 2000, max = 8000) {
    return new Promise((resolve) => setTimeout(resolve, Math.random() * (max - min) + min));
}

// Helper: Simulate Typing Indicator
async function simulateTyping(api, threadID, minTime = 2000, maxTime = 5000) {
    try {
        const typingTime = Math.random() * (maxTime - minTime) + minTime;
        await api.sendTypingIndicator(threadID, true);
        await new Promise((resolve) => setTimeout(resolve, typingTime));
        await api.sendTypingIndicator(threadID, false);
    } catch (err) {
        console.error("Error simulating typing:", err.message);
    }
}

// Handle Commands with Group Cooldowns
async function handleCommands(api, event) {
    const message = event.body ? event.body.trim().toLowerCase() : "";

    if (message.startsWith(".")) {
        const command = message.slice(1);
        const threadID = event.threadID;

        // Check group cooldown
        if (groupCooldowns.has(threadID)) {
            logger(`Group ${threadID} is in cooldown. Skipping response.`, "[ Cooldown ]");
            return;
        }

        // Add group to cooldown (5 minutes)
        groupCooldowns.set(threadID, true);
        setTimeout(() => groupCooldowns.delete(threadID), 5 * 60 * 1000);

        // Simulate typing before responding
        await simulateTyping(api, threadID);

        // Add random delay for response
        await randomDelay();

        // Respond to commands
        switch (command) {
            case "help":
                api.sendMessage(
                    "Here are the available commands:\n1. .help\n2. .lock\n3. .unlock",
                    threadID
                );
                break;

            case "lock":
                api.sendMessage("Locking the system...", threadID);
                break;

            case "unlock":
                api.sendMessage("Unlocking the system...", threadID);
                break;

            default:
                api.sendMessage(
                    "Unrecognized command. Type .help for a list of commands.",
                    threadID
                );
        }
    }
}

// Login and Start Listening
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
            handleCommands(api, event);
        }
    });
});

// Start Bot with Restart Logic
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
            logger(
                `Bot exited with code ${codeExit}. Restarting... (${global.countRestart}/5)`,
                "[ Restarting ]"
            );
            startBot();
        } else {
            logger(`Bot stopped after ${global.countRestart} restarts.`, "[ Stopped ]");
        }
    });

    child.on("error", (error) => {
        logger(`An error occurred: ${JSON.stringify(error)}`, "[ Error ]");
    });
}

// Start Bot
startBot();
