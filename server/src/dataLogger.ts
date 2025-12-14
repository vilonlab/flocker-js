import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';
import {v4 as uuidv4} from 'uuid'
import { transcode } from 'node:buffer';

/**
 * SQLite-based DataLogger using Singleton pattern
 * All rooms share a single database connection to avoid write conflicts
 */
class DataLogger {
	private static instance: DataLogger | undefined = undefined;
	private static db: Database.Database;
	private snapshotQueue: Array<{
		timestamp: number;
		serverTime: number;
		roomId: string;
		phase?: string;
		targetZone?: string;
		players: any[];
	}> = [];
	private flushInterval: NodeJS.Timeout | null = null;
	private readonly BATCH_SIZE = 50; // Flush after 50 snapshots
	private readonly FLUSH_INTERVAL_MS = 1000; // Or flush every 1 second

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

		// Start periodic flush timer
		this.startFlushTimer();
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

            CREATE TABLE IF NOT EXISTS player_data (
                id TEXT PRIMARY KEY NOT NULL,
                name TEXT,
                color TEXT,
                text_color TEXT,
                points INTEGER,
                last_connection DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_snapshots_room_time
                ON snapshots(room_id, timestamp);

            CREATE INDEX IF NOT EXISTS idx_player_snapshots_snapshot
                ON player_snapshots(snapshot_id);

        `);

		console.log('Database schema initialized');
	}

	/**
     * Log a game state snapshot (queued for batch insert)
     */
	logSnapshot(data: {
		timestamp: number;
		serverTime: number;
		roomId: string;
		phase?: string;
		targetZone?: string;
		players: any[];
	}): void {
		// Add to queue
		this.snapshotQueue.push(data);

		// Flush immediately if batch size reached
		if (this.snapshotQueue.length >= this.BATCH_SIZE) {
			this.flushSnapshots();
		}
	}

	/**
	 * Start periodic flush timer
	 */
	private startFlushTimer(): void {
		this.flushInterval = setInterval(() => {
			if (this.snapshotQueue.length > 0) {
				this.flushSnapshots();
			}
		}, this.FLUSH_INTERVAL_MS);
	}

	/**
	 * Flush all queued snapshots to database in a single transaction
	 */
	private flushSnapshots(): void {
		if (this.snapshotQueue.length === 0) return;

		// Get snapshots to flush and clear queue
		const snapshots = [...this.snapshotQueue];
		this.snapshotQueue = [];

		try {
			// Insert all snapshots in a single transaction
			const transaction = DataLogger.db.transaction(() => {
				const snapshotStmt = DataLogger.db.prepare(`
                    INSERT INTO snapshots (timestamp, server_time, room_id, phase, target_zone, players)
                    VALUES (?, ?, ?, ?, ?, ?)
                `);

				for (const data of snapshots) {
					snapshotStmt.run(
						data.timestamp,
						data.serverTime,
						data.roomId,
						data.phase ?? null,
						data.targetZone ?? null,
						JSON.stringify(data.players),
					);
				}
			});

			transaction();
			console.log(`Flushed ${snapshots.length} snapshots to database`);
		} catch (error) {
			console.error('Failed to flush snapshots:', error);
			// Re-add failed snapshots to front of queue
			this.snapshotQueue.unshift(...snapshots);
		}
	}

    /**
     * Capture player metadata
     */
    updatePlayerData(data: {
		id?: string;
		name?: string;
		color?: string;
		text_color?: string;
		points?: number;
		last_connection?: string;
	}): string {
        // if no id, generate one and store it
        let id = "";

        if (data.id) {
            id = data.id;
            const transaction = DataLogger.db.transaction(() => {
                const stmt = DataLogger.db.prepare(`
                    UPDATE player_data
                    SET
                        name = COALESCE(?, name),
                        color = COALESCE(?, color),
                        text_color = COALESCE(?, text_color),
                        points = COALESCE(?, points),
                        last_connection = COALESCE(?, last_connection)
                    WHERE id = ?
                `);
                stmt.run(
                data.name ?? null,
                data.color ?? null,
                data.text_color ?? null,
                data.points ?? null,
                data.last_connection ?? null,
                id
                );
            });
            transaction();
        } else {
            id = uuidv4();
            const transaction = DataLogger.db.transaction(() => {
                const stmt = DataLogger.db.prepare(`
                    INSERT INTO player_data
                    (id, name, color, text_color, points)
                    VALUES (?, ?, ?, ?, ?)
                `);
                stmt.run(
                    id,
                    data.name ?? null,
                    data.color ?? null,
                    data.text_color ?? null,
                    data.points ?? null,
                );
            });
            transaction();
        }
        return id;
    }

    /**
     * Dedicated method to update player score
     */
    addPlayerScore(id: string, score_delta: number) {
        const transaction = DataLogger.db.transaction(() => {
            const scoreStmt = DataLogger.db.prepare(`
                UPDATE player_data
                SET score = score + ?
                WHERE id = ?
            `);

            const result = scoreStmt.run(
                score_delta,
                id
            )

        });
        transaction();
    }

	/**
     * Close database connection (call on server shutdown)
     */
	close(): void {
		// Stop flush timer
		if (this.flushInterval) {
			clearInterval(this.flushInterval);
			this.flushInterval = null;
		}

		// Flush any remaining snapshots
		if (this.snapshotQueue.length > 0) {
			console.log('Flushing remaining snapshots before closing...');
			this.flushSnapshots();
		}

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
