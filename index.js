

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
    "http://proxy2.example.com:8080",
    "http://proxy3.example.com:8080"
];
const getRandomProxy = () => proxyList[Math.floor(Math.random() * proxyList.length)];
const proxyAgent = new ProxyAgent(getRandomProxy());

global.countRestart = global.countRestart || 0;

// Track group activity and delays
let lastProcessedGroup = null;
let isProcessingGroup = false;
const groupActivity = {}; // Stores last activity time for each group
const minGroupDelay = 120000; // 2 minutes
const maxGroupDelay = 180000; // 3 minutes

///////////////////////////////////////////////////////////
//========= Bot Start and Restart Mechanism =============//
///////////////////////////////////////////////////////////

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

function getRandomDelay(min, max) {
    return Math.random() * (max - min) + min;
}

async function processGroup(api, event) {
    if (isProcessingGroup) return;

    const threadID = event.threadID;
    const now = Date.now();

    // Check if this group is due for processing
    if (groupActivity[threadID] && now - groupActivity[threadID] < minGroupDelay) {
        logger(`Skipping group ${threadID}, waiting for cooldown.`, "[ Skipping ]");
        return;
    }

    // Handle group switching
    if (lastProcessedGroup && lastProcessedGroup !== threadID) {
        const delay = getRandomDelay(minGroupDelay, maxGroupDelay);
        logger(`Switching groups. Delaying ${Math.round(delay / 1000)} seconds.`, "[ Group Delay ]");
        await new Promise((resolve) => setTimeout(resolve, delay));
    }

    isProcessingGroup = true;
    lastProcessedGroup = threadID;
    groupActivity[threadID] = now;

    await simulateTyping(api, threadID, getRandomDelay(2000, 5000));

    const message = event.body ? event.body.trim().toLowerCase() : "";
    if (message.startsWith(".")) {
        const command = message.slice(1);

        const responseDelay = getRandomDelay(5000, 10000);
        setTimeout(() => {
            if (command === "help") {
                api.sendMessage("Commands:\n1. .help\n2. .info\n3. .settings", threadID);
            } else if (command === "info") {
                api.sendMessage("This bot is running with enhanced anti-automation logic.", threadID);
            } else {
                api.sendMessage("Unrecognized command. Type .help for more info.", threadID);
            }
            isProcessingGroup = false;
        }, responseDelay);
    } else {
        isProcessingGroup = false;
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
            processGroup(api, event);
        }
    });
});

startBot();
