import config from '@colyseus/tools';
import {monitor} from '@colyseus/monitor';
import {playground} from '@colyseus/playground';
import type { Server } from '@colyseus/core';

/**
 * Import your Room files
 */
import {ExperimentRoom} from './rooms/experimentRoom';
import DataLogger from './dataLogger';
import path from 'node:path';
// Import { ExperimentRoom } from "/home/gus/Documents/Programming/flocker-js/server/src/rooms/experiment"

// Store reference to gameServer for API endpoints
let gameServerInstance: Server;

export default config({

	initializeGameServer(gameServer) {
		/**
         * Define your room handlers:
         */
		gameServer.define('ExperimentRoom', ExperimentRoom);

		// Store reference for API endpoints
		gameServerInstance = gameServer;
	},

	initializeExpress(app) {
		/**
         * Bind your custom express routes here:
         * Read more: https://expressjs.com/en/starter/basic-routing.html
         */
		app.get('/hello_world', (request, res) => {
			res.send('It\'s time to kick ass and chew bubblegum!');
		});

		/**
         * Data extraction webpage
         */
		app.get('/data', (req, res) => {
			res.sendFile(path.join(__dirname, 'views', 'data-extraction.html'));
		});

		/**
         * Clients display webpage
         */
		app.get('/clients', (req, res) => {
			res.sendFile(path.join(__dirname, 'views', 'clients-display.html'));
		});

		/**
         * Admin panel webpage
         */
		app.get('/admin', (req, res) => {
			res.sendFile(path.join(__dirname, 'views', 'admin.html'));
		});

	/**
         * API endpoint to export snapshot data by date range
         */
		app.get('/api/data/snapshots', (req, res) => {
			try {
				const dataLogger = DataLogger.getInstance();
				const db = dataLogger.getDatabase();

				const startDate = req.query.startDate as string | undefined;
				const endDate = req.query.endDate as string | undefined;

				// Build query with date filtering
				let query = 'SELECT * FROM snapshots';
				const params: any[] = [];
				const conditions: string[] = [];

				if (startDate) {
					const startTimestamp = new Date(startDate).getTime();
					conditions.push('timestamp >= ?');
					params.push(startTimestamp);
				}

				if (endDate) {
					const endTimestamp = new Date(endDate).getTime();
					conditions.push('timestamp <= ?');
					params.push(endTimestamp);
				}

				if (conditions.length > 0) {
					query += ' WHERE ' + conditions.join(' AND ');
				}

				query += ' ORDER BY timestamp ASC';

				const stmt = db.prepare(query);
				const snapshots = stmt.all(...params) as any[];

				// Generate CSV
				let csv = 'id,timestamp,server_time,room_id,round_number,phase,target_zone,players,created_at\n';

				snapshots.forEach((row) => {
					csv += `${row.id},${row.timestamp},${row.server_time},${row.room_id},${row.round_number || ''},${row.phase || ''},${row.target_zone || ''},"${row.players.replace(/"/g, '""')}",${row.created_at}\n`;
				});

				res.setHeader('Content-Type', 'text/csv');
				res.setHeader('Content-Disposition', 'attachment; filename=snapshots-export.csv');
				res.send(csv);
			} catch (error) {
				console.error('Error exporting snapshots:', error);
				res.status(500).json({error: 'Failed to export snapshots'});
			}
		});

		/**
         * API endpoint to get most recent client data from database snapshot
         */
		app.get('/api/clients/current', (req, res) => {
			try {
				const dataLogger = DataLogger.getInstance();
				const db = dataLogger.getDatabase();

				// Get the most recent snapshot from the database
				const stmt = db.prepare('SELECT * FROM snapshots ORDER BY timestamp DESC LIMIT 1');
				const snapshot = stmt.get() as any;

				// If no snapshot exists, return empty
				if (!snapshot) {
					res.json({
						timestamp: 0,
						serverTime: Date.now(),
						roomId: 'none',
						clients: []
					});
					return;
				}

				// Check if snapshot is more than 6 seconds old
				const currentTime = Date.now();
				const snapshotAge = currentTime - snapshot.server_time;
				const maxAge = 6000; // 6 seconds in milliseconds

				// If snapshot is too old, assume no clients are connected
				if (snapshotAge > maxAge) {
					res.json({
						timestamp: snapshot.timestamp,
						serverTime: currentTime,
						roomId: snapshot.room_id,
						clients: []
					});
					return;
				}

				// Parse the players JSON string
				const clients = JSON.parse(snapshot.players);

				res.json({
					timestamp: snapshot.timestamp,
					serverTime: snapshot.server_time,
					roomId: snapshot.room_id,
					clients: clients
				});

			} catch (error) {
				console.error('Error fetching client data:', error);
				res.status(500).json({error: 'Failed to fetch client data'});
			}
		});

		/**
         * Use @colyseus/playground
         * (It is not recommended to expose this route in a production environment)
         */
		if (process.env.NODE_ENV !== 'production') {
			app.use('/', playground());
		}

		/**
         * Use @colyseus/monitor
         * It is recommended to protect this route with a password
         * Read more: https://docs.colyseus.io/tools/monitor/#restrict-access-to-the-panel-using-a-password
         */
		app.use('/monitor', monitor());
	},

	beforeListen() {
		/**
         * Before before gameServer.listen() is called.
         */
	},
});
