import config from '@colyseus/tools';
import {monitor} from '@colyseus/monitor';
import {playground} from '@colyseus/playground';
import type { Server } from '@colyseus/core';
import { matchMaker } from 'colyseus';
import { config as appConfig } from './config';
import cookieParser from 'cookie-parser';
import { v4 as uuidv4 } from 'uuid';
import winston from "winston";

/**
 * Import your Room files
 */
import {ExperimentRoom} from './rooms/experimentRoom';
import {Phase} from './rooms/schema/experimentSchema';
import { mintSpectatorToken } from './spectatorTokens';
import DataLogger from './dataLogger';
import path from 'node:path';
// Import { ExperimentRoom } from "/home/gus/Documents/Programming/flocker-js/server/src/rooms/experiment"

// Store reference to gameServer for API endpoints
let gameServerInstance: Server;

export default config({

    options: {
        logger: winston.createLogger({
            level: 'info',
            format: winston.format.json(),
            defaultMeta: { service: 'user-service' },
            transports: [
                // - Write all logs with importance level of `error` or less to `error.log`
                // - Write all logs with importance level of `info` or less to `combined.log`
                //
                new winston.transports.File({ filename: 'error.log', level: 'error' }),
                new winston.transports.File({ filename: 'combined.log' }),
            ],
        })
    },

	initializeGameServer(gameServer) {
		/**
         * Define your room handlers:
         */
		gameServer.define('ExperimentRoom', ExperimentRoom)
            // .maxClients()
            // .filterBy(['mode'])
            // .maxClients appConfig.game.maxClients);

		// Store reference for API endpoints
		gameServerInstance = gameServer;
	},

	initializeExpress(app) {
		// Enable cookie parsing
		app.use(cookieParser());

		/**
         * Data extraction webpage
         */
		app.get('/admin/data', (req, res) => {
			res.sendFile(path.join(__dirname, 'views', 'data-extraction.html'));
		});

		/**
         * Clients display webpage
         */
		app.get('/admin/clients', (req, res) => {
			res.sendFile(path.join(__dirname, 'views', 'clients-display.html'));
		});

		/**
         * Admin panel webpage
         */
		app.get('/admin', (req, res) => {
			res.sendFile(path.join(__dirname, 'views', 'admin.html'));
		});

		/**
         * Room list webpage -- lists active ExperimentRooms and lets an admin join one as a spectator
         */
		app.get('/admin/rooms', (req, res) => {
			res.sendFile(path.join(__dirname, 'views', 'rooms.html'));
		});

		/**
         * API endpoint listing active ExperimentRooms with live info, plus a freshly minted
         * single-use spectator join token per room (see spectatorTokens.ts)
         */
		app.get('/admin/api/rooms', async (req, res) => {
			try {
				const cachedRooms = await matchMaker.query({ name: 'ExperimentRoom' });

				const rooms = cachedRooms.map((cached) => {
					const room = matchMaker.getLocalRoomById(cached.roomId) as ExperimentRoom | undefined;

					return {
						roomId: cached.roomId,
						clients: cached.clients,
						maxClients: cached.maxClients,
						playerCount: room ? room.state.players.size : null,
						phase: room ? Phase[room.state.phase] : null,
						roundNumber: room ? room.state.roundNumber + 1 : null,
						totalRounds: room ? room.state.totalRounds : null,
						spectateToken: mintSpectatorToken(cached.roomId),
					};
				});

				res.json({ rooms });
			} catch (error) {
				console.error('Error listing rooms:', error);
				res.status(500).json({ error: 'Failed to list rooms' });
			}
		});

	/**
         * API endpoint to export snapshot data by date range
         */
		app.get('/admin/api/data', (req, res) => {
			try {
				const dataLogger = DataLogger.getInstance();
				const db = dataLogger.getDatabase();

				const startDate = req.query.startDate as string | undefined;
				const endDate = req.query.endDate as string | undefined;
				const timezoneOffset = req.query.timezoneOffset ? parseInt(req.query.timezoneOffset as string) : 0;

				// Build query with date filtering
				let query = 'SELECT * FROM snapshots'
				const params: any[] = [];
				const conditions: string[] = [];

				if (startDate) {
					// Parse date as UTC midnight, then adjust for client's timezone
					// Client sends date-only string and timezone offset
					// We want start of day (00:00:00) in client's local timezone
					const utcTimestamp = new Date(startDate + 'T00:00:00.000Z').getTime();
					const startTimestamp = utcTimestamp + (timezoneOffset * 60 * 1000);
					conditions.push(`timestamp >= ?`);
					params.push(startTimestamp);
				}

				if (endDate) {
					// Parse date as UTC end of day, then adjust for client's timezone
					// We want end of day (23:59:59.999) in client's local timezone
					const utcTimestamp = new Date(endDate + 'T23:59:59.999Z').getTime();
					const endTimestamp = utcTimestamp + (timezoneOffset * 60 * 1000);
					conditions.push(`timestamp <= ?`);
					params.push(endTimestamp);
				}

				if (conditions.length > 0) {
					query += ' WHERE ' + conditions.join(' AND ');
				}

				query += ` ORDER BY timestamp ASC`;

                console.log('Querying database:' + query)
                console.log('Parameters:' + params)

				const stmt = db.prepare(query);
				const results = stmt.all(...params) as any[];

				// Generate CSV
				let csv = '';
				let filename = '';

				csv = 'id,timestamp,server_time,room_id,round_number,phase,target_zone,players,created_at\n';
				results.forEach((row) => {
					csv += `${row.id},${row.timestamp},${row.server_time},${row.room_id},${row.round_number || ''},${row.phase || ''},${row.target_zone || ''},"${row.players.replace(/"/g, '""')}",${row.created_at}\n`;
				});
				filename = 'state-snapshots-export.csv';

				res.setHeader('Content-Type', 'text/csv');
				res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
				res.send(csv);
			} catch (error) {
				console.error('Error exporting snapshots:', error);
				res.status(500).json({error: 'Failed to export snapshots'});
			}
		});

		/**
         * API endpoint to get most recent client data from database snapshot
         */
		app.get('/admin/api/clients/current', (req, res) => {
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
         * API endpoint to get or set unique client ID
         */
		app.get('/api/client-id', (req, res) => {
            const dataLogger = DataLogger.getInstance();
			try {
				let clientId = req.cookies?.clientId;

				if (!clientId) {
					// Generate a new unique ID
                    clientId = dataLogger.updatePlayerData({});
					// clientId = uuidv4();
					// Set cookie with 1 year expiration
					res.cookie('clientId', clientId, {
						maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year in milliseconds
						httpOnly: false, // Allow client-side JavaScript to read the cookie
						sameSite: 'lax',
						secure: process.env.NODE_ENV === 'production' // Use secure cookies in production
					});
					console.log('Generated new client ID:', clientId);
				} else {
					console.log('Existing client ID:', clientId);
				}

				res.json({ clientId });
			} catch (error) {
				console.error('Error handling client ID:', error);
				res.status(500).json({ error: 'Failed to handle client ID' });
			}
		});

		/**
         * Use @colyseus/playground
         * (It is not recommended to expose this route in a production environment)
         */
		if (process.env.NODE_ENV !== 'production') {
			app.use('/admin/playground', playground());
		}

		/**
         * Use @colyseus/monitor
         * It is recommended to protect this route with a password
         * Read more: https://docs.colyseus.io/tools/monitor/#restrict-access-to-the-panel-using-a-password
         */
		app.use('/admin/monitor', monitor());
	},

	beforeListen() {
		/**
         * Before before gameServer.listen() is called.
         */
	},
});
