const fs = require('fs');
const path = require('path');

// --- IMPORTANT for Railway ---
// Railway provides a persistent volume, typically mounted at /data
// We should write our logs there. If run locally, it will write to project dir.
const LOG_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, '../'); // Use Railway path or project root
const LOG_FILE_PATH = path.join(LOG_DIR, 'experiment_data_log.jsonl'); // Using .jsonl for JSON Lines format

class DataLogger {
    constructor() {
        this.logFilePath = LOG_FILE_PATH;
        this.writeStream = null;
        this.initLogFile();
        console.log(`Data logger initialized. Log file path: ${this.logFilePath}`);
    }

    initLogFile() {
         // Ensure directory exists (useful locally, Railway volume should exist)
        try {
            if (!fs.existsSync(LOG_DIR)) {
                fs.mkdirSync(LOG_DIR, { recursive: true });
                console.log(`Created log directory: ${LOG_DIR}`);
            }
        } catch (err) {
            console.error("Error creating log directory:", err);
            // Fallback to local directory if persistent volume fails?
            this.logFilePath = path.join(__dirname, '../experiment_data_log.jsonl');
            console.warn(`Falling back to local log file: ${this.logFilePath}`);
        }
        this.startNewLog(); // Open the stream
    }


    startNewLog() {
        this.finalizeLog(); // Close existing stream if any
        try {
             // Append mode ensures we don't overwrite data on restarts/redeployments within the same session/file
            this.writeStream = fs.createWriteStream(this.logFilePath, { flags: 'a' });
            console.log(`Opened log file for appending: ${this.logFilePath}`);
             // Optional: Write a session start marker
             this.log({ eventType: 'session_start', timestamp: Date.now() });
        } catch (err) {
            console.error("Error opening log file stream:", err);
            this.writeStream = null;
        }
    }

    log(data) {
        if (!this.writeStream) {
             console.error("Log stream not available. Data not logged:", data);
             // Attempt to re-open stream
             this.startNewLog();
             if (!this.writeStream) return; // Still failed
        }

        try {
            // Write data as a JSON string followed by a newline (JSON Lines format)
            this.writeStream.write(JSON.stringify(data) + '\n');
        } catch (err) {
            console.error("Error writing to log stream:", err);
            // Handle potential stream errors (e.g., disk full on Railway volume)
        }
    }

    finalizeLog() {
        if (this.writeStream) {
            console.log(`Closing log file stream: ${this.logFilePath}`);
            this.writeStream.end();
            this.writeStream = null;
        }
    }
}

module.exports = DataLogger;