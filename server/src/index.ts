const http = require('http');
const express = require('express');
const cors = require('cors'); // Need cors middleware
const colyseus = require('colyseus');
const path = require('path');
const ExperimentRoom = require('./rooms/ExperimentRoom'); // Import the room

const app = express();
const port = Number(process.env.PORT || 3000); // Use Railway port or default

// --- Middleware ---
app.use(cors()); // Enable CORS for all origins (restrict in production)
app.use(express.json()); // Needed by Colyseus monitor, etc.

// --- Static File Serving ---
const clientPath = path.join(__dirname, '../client');
app.use(express.static(clientPath));
console.log(`Serving static files from: ${clientPath}`);
// Add a fallback route for client-side routing if needed (not strictly necessary here)
// app.get('*', (req, res) => {
//     res.sendFile(path.join(clientPath, 'index.html'));
// });


// --- Colyseus Game Server ---
const server = http.createServer(app); // Use the Express app
const gameServer = new colyseus.Server({
  server: server,
});

// Define the "experiment_room" and associate it with our custom Room class
gameServer.define('experiment_room', ExperimentRoom);

// Add Colyseus Monitor (optional, useful for debugging)
// Access at http://localhost:3000/colyseus
if (process.env.NODE_ENV !== 'production') {
    const monitor = require("@colyseus/monitor").monitor;
     app.use("/colyseus", monitor());
     console.log("Colyseus Monitor available at /colyseus");
}


// --- Start Listening ---
gameServer.listen(port);
console.log(`Colyseus server listening on ws://localhost:${port}`);
console.log(`Access the experiment at http://localhost:${port}`);

// Graceful shutdown integration (Colyseus handles some internally)
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing server');
    gameServer.gracefullyShutdown().then(() => {
        console.log('Colyseus server shut down.');
        process.exit(0);
    }).catch(e => {
        console.error('Error during shutdown:', e);
        process.exit(1);
    });
});