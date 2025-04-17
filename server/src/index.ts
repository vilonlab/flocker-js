// Entry point for Colyseus server
import { Server } from 'colyseus';
import { createServer } from 'http';
import express from 'express';
import { GameRoom } from './GameRoom';

const PORT = process.env.PORT || 2567;
const app = express();
const httpServer = createServer(app);

const gameServer = new Server({
  server: httpServer,
});

gameServer.define('flocker', GameRoom);

app.get('/', (req: express.Request, res: express.Response) => {
  res.send('Flocker experiment server running.');
});

httpServer.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
