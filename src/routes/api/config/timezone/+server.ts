import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = () => {
	const timezone = process.env.TIMEZONE;
	if (!timezone) {
		return json({ error: 'TIMEZONE environment variable not set' }, { status: 500 });
	}
	return json({ timezone });
};
