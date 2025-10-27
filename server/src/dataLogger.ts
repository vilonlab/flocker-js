import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';

/**
 * SQLite-based DataLogger using Singleton pattern
 * All rooms share a single database connection to avoid write conflicts
 */
class DataLogger {
	private static instance: DataLogger | undefined = null;
	private static db: Database.Database;

	private constructor() {
		const dataDir = process.env.DB_DIR || path.join(__dirname, '../data');
		const dbPath = path.join(dataDir, 'flocker.db');

		// Ensure data directory exists
		if (!fs.existsSync(dataDir)) {
			fs.mkdirSync(dataDir, {recursive: true});
			console.log(`Created data directory: ${dataDir}`);
		}

		// Initialize database connection
		DataLogger.db = new Database(dbPath);

		// Configure SQLite for optimal concurrent writes
		DataLogger.db.pragma('journal_mode = WAL'); // Write-Ahead Logging for better concurrency
		DataLogger.db.pragma('busy_timeout = 5000'); // Wait up to 5 seconds for locks
		DataLogger.db.pragma('synchronous = NORMAL'); // Balance safety and performance

		console.log(`DataLogger initialized. Database: ${dbPath}`);

		// Initialize database schema
		this.initSchema();
	}

	/**
     * Get the singleton instance of DataLogger
     * All rooms should use this method to get the logger
     */
	static getInstance(): DataLogger {
		DataLogger.instance ||= new DataLogger();

		return DataLogger.instance;
	}

	/**
     * Initialize database schema
     */
	private initSchema(): void {
		DataLogger.db.exec(`
            CREATE TABLE IF NOT EXISTS snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp INTEGER NOT NULL,
                server_time INTEGER NOT NULL,
                room_id TEXT NOT NULL,
                round_number INTEGER,
                phase TEXT,
                target_zone TEXT,
                players JSON NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                room_id TEXT,
                session_id TEXT,
                data JSON,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_snapshots_room_time
                ON snapshots(room_id, timestamp);

            CREATE INDEX IF NOT EXISTS idx_events_type_time
                ON events(event_type, timestamp);

            CREATE INDEX IF NOT EXISTS idx_events_room
                ON events(room_id, timestamp);
        `);

		console.log('Database schema initialized');
	}

	/**
     * Log a game state snapshot
     */
	logSnapshot(data: {
		timestamp: number;
		serverTime: number;
		roomId: string;
		roundNumber?: number;
		phase?: string;
		targetZone?: string;
		players: any[];
	}): void {
		try {
			const stmt = DataLogger.db.prepare(`
                INSERT INTO snapshots (timestamp, server_time, room_id, round_number, phase, target_zone, players)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);

			stmt.run(
				data.timestamp,
				data.serverTime,
				data.roomId,
				data.roundNumber ?? null,
				data.phase ?? null,
				data.targetZone ?? null,
				JSON.stringify(data.players),
			);
		} catch (error) {
			console.error('Failed to log snapshot:', error);
		}
	}

	/**
     * Log a game event (join, leave, phase change, etc.)
     */
	logEvent(eventType: string, data: {
		timestamp?: number;
		roomId?: string;
		sessionId?: string;
		[key: string]: any;
	}): void {
		try {
			const stmt = DataLogger.db.prepare(`
                INSERT INTO events (event_type, timestamp, room_id, session_id, data)
                VALUES (?, ?, ?, ?, ?)
            `);

			stmt.run(
				eventType,
				data.timestamp ?? Date.now(),
				data.roomId ?? null,
				data.sessionId ?? null,
				JSON.stringify(data),
			);
		} catch (error) {
			console.error('Failed to log event:', error);
		}
	}

	/**
     * Close database connection (call on server shutdown)
     */
	close(): void {
		if (DataLogger.db) {
			DataLogger.db.close();
			console.log('Database connection closed');
		}
	}

	/**
     * Get the database instance (for advanced queries)
     */
	getDatabase(): Database.Database {
		return DataLogger.db;
	}
}

export default DataLogger;
