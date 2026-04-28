import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { logger } from '$lib/utils/index.js';

export const GET: RequestHandler = async ({ params, url }) => {
	const serverId = parseInt(params.id ?? '');
	if (isNaN(serverId)) {
		return json({ error: 'Invalid server ID' }, { status: 400 });
	}

	const type = url.searchParams.get('type') || 'overview';
	const days = parseInt(url.searchParams.get('days') ?? '30');

	try {
		let analytics;

		switch (type) {
			case 'daily':
				analytics = await db.getServerAnalyticsDaily(serverId, days);
				break;
			case 'hourly':
				analytics = await db.getServerAnalyticsHourly(serverId, 24);
				break;
			case 'channels':
				analytics = await db.getChannelHealthMetrics(serverId, days);
				break;
			case 'engagement':
				analytics = await db.getMemberEngagementMetrics(serverId);
				break;
			case 'retention':
				analytics = await db.getRetentionMetrics(serverId, days);
				break;
			case 'overview':
			default:
				analytics = await db.getAnalyticsOverview(serverId);
				break;
		}

		if (!analytics) {
			return json({ error: 'No analytics data found' }, { status: 404 });
		}

		return json(analytics);
	} catch (err: any) {
		logger.log(`❌ Error fetching analytics: ${err.message}`);
		return json({ error: 'Internal error' }, { status: 500 });
	}
};
