const { spawn } = require("child_process");
const axios = require("axios");
const express = require("express");
const path = require("path");
const logger = require("./utils/log");
const login = require("nextgen-fca");

let lastProcessedGroup = null; // Track the last processed group
let isProcessingGroup = false; // To avoid simultaneous processing
const groupDelay = 10000; // Delay in milliseconds (e.g., 10 seconds)

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

// Function to handle group delay
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

        // Add random delay for response
        const delay = Math.random() * (5000 - 2000) + 2000; // Random delay between 2-5 seconds
        setTimeout(() => {
            if (command === "help") {
                api.sendMessage("Here are the available commands:\n1. .help\n2. .info", threadID);
            } else if (command === "info") {
                api.sendMessage("This bot is active in multiple groups.", threadID);
            } else {
                api.sendMessage("Unrecognized command. Type .help for assistance.", threadID);
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

login({ appState: require("./appstate.json") }, (err, api) => {
    if (err) {
        logger(`Login error: ${err.message}`, "[ Error ]");
        return;
    }

    logger("Bot logged in and listening for events...", "[ Starting ]");

    api.listenMqtt((error, event) => {
        if (error) return logger(`Listen error: ${error.message}`, "[ Error ]");

        if (event.type === "message" && event.body) {
            processGroup(api, event); // Process group-specific logic
        }
    });
});
