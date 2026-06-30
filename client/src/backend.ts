// Colyseus server always runs on port 2567
const COLYSEUS_PORT = 2567;

// Use the current hostname but always connect to Colyseus port 2567
const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
export let BACKEND_URL = ""
if (window.location.hostname != "localhost") {
    BACKEND_URL = `${protocol}://${window.location.hostname}/flocker/app`;
}
else {
    BACKEND_URL = `${protocol}://${window.location.hostname}:${COLYSEUS_PORT}`;
}

export const BACKEND_HTTP_URL = BACKEND_URL.replace("ws", "http");