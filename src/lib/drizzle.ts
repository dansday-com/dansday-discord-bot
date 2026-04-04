import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema.js';

function getConnectionConfig() {
	const databaseUrl = process.env.DATABASE_URL;

	if (databaseUrl) {
		const url = new URL(databaseUrl);
		return {
			host: url.hostname,
			port: parseInt(url.port),
			user: url.username,
			password: url.password,
			database: url.pathname.slice(1)
		};
	}

	if (!process.env.DB_HOST) throw new Error('Missing DB_HOST environment variable');
	if (!process.env.DB_PORT) throw new Error('Missing DB_PORT environment variable');
	if (!process.env.DB_USER) throw new Error('Missing DB_USER environment variable');
	if (!process.env.DB_PASSWORD) throw new Error('Missing DB_PASSWORD environment variable');
	if (!process.env.DB_NAME) throw new Error('Missing DB_NAME environment variable');

	return {
		host: process.env.DB_HOST,
		port: parseInt(process.env.DB_PORT),
		user: process.env.DB_USER,
		password: process.env.DB_PASSWORD,
		database: process.env.DB_NAME
	};
}

const tzOffset = 'Z';

let _db: ReturnType<typeof drizzle> | null = null;

function getDb() {
	if (!_db) {
		const pool = mysql.createPool({
			...getConnectionConfig(),
			waitForConnections: true,
			connectionLimit: 10,
			queueLimit: 0,
			dateStrings: true,
			timezone: tzOffset
		});
		_db = drizzle(pool, { schema, mode: 'default' });
	}
	return _db;
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
	get(_target, prop) {
		return (getDb() as any)[prop];
	}
});

export type DB = typeof db;
