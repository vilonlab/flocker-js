import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';

/**
 * SQLite-based DataLogger using Singleton pattern
 * All rooms share a single database connection to avoid write conflicts
 */
class DataLogger {
	private static instance: DataLogger | undefined = undefined;
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
                phase TEXT,
                target_zone TEXT,
                players JSON NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS player_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                snapshot_id INTEGER NOT NULL,
                timestamp INTEGER NOT NULL,
                room_id TEXT NOT NULL,
                player_id TEXT NOT NULL,
                x REAL,
                y REAL,
                informed BOOLEAN,
                additional_data JSON,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_snapshots_room_time
                ON snapshots(room_id, timestamp);

            CREATE INDEX IF NOT EXISTS idx_player_snapshots_player_time
                ON player_snapshots(player_id, timestamp);

            CREATE INDEX IF NOT EXISTS idx_player_snapshots_snapshot
                ON player_snapshots(snapshot_id);

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
		phase?: string;
		targetZone?: string;
		players: any[];
	}): void {
		try {
			// Use a transaction to ensure both tables are updated atomically
			const transaction = DataLogger.db.transaction(() => {
				// Insert into snapshots table
				const snapshotStmt = DataLogger.db.prepare(`
                    INSERT INTO snapshots (timestamp, server_time, room_id, phase, target_zone, players)
                    VALUES (?, ?, ?, ?, ?, ?)
                `);

				const result = snapshotStmt.run(
					data.timestamp,
					data.serverTime,
					data.roomId,
					data.phase ?? null,
					data.targetZone ?? null,
					JSON.stringify(data.players),
				);

				// const snapshotId = result.lastInsertRowid;

				// // Insert each player into player_snapshots table
				// const playerStmt = DataLogger.db.prepare(`
                //     INSERT INTO player_snapshots (snapshot_id, timestamp, room_id, player_id, x, y, informed, additional_data)
                //     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                // `);

				// for (const player of data.players) {
				// 	// Extract common properties and store the rest in additional_data
				// 	const {id, x, y, informed, ...additionalData} = player;

				// 	playerStmt.run(
				// 		snapshotId,
				// 		data.timestamp,
				// 		data.roomId,
				// 		id ?? null,
				// 		x ?? null,
				// 		y ?? null,
				// 		informed ?? null,
				// 		Object.keys(additionalData).length > 0 ? JSON.stringify(additionalData) : null,
				// 	);
				// }
                console.log('Snapshot:', result)
			});

			transaction();
		} catch (error) {
			console.error('Failed to log snapshot:', error);
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
