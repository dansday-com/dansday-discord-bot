export const MODERATION_ACTION_META: Record<string, { label: string; icon: string; color: string }> = {
	warn: { label: 'Warn', icon: 'fa-triangle-exclamation', color: 'text-amber-400' },
	timeout: { label: 'Timeout', icon: 'fa-volume-xmark', color: 'text-orange-400' },
	untimeout: { label: 'Remove timeout', icon: 'fa-volume-high', color: 'text-emerald-400' },
	kick: { label: 'Kick', icon: 'fa-door-open', color: 'text-sky-400' },
	ban: { label: 'Ban', icon: 'fa-gavel', color: 'text-red-400' },
	tempban: { label: 'Temporary ban', icon: 'fa-hourglass-half', color: 'text-rose-400' },
	unban: { label: 'Unban', icon: 'fa-dove', color: 'text-emerald-400' },
	unwarn: { label: 'Remove warning', icon: 'fa-eraser', color: 'text-violet-400' },
	clearwarns: { label: 'Clear warnings', icon: 'fa-broom', color: 'text-violet-400' },
	role_add: { label: 'Give role', icon: 'fa-user-tag', color: 'text-sky-400' },
	role_remove: { label: 'Take role', icon: 'fa-user-minus', color: 'text-sky-400' }
};

export const MODERATION_TIMED_ACTIONS = ['timeout', 'tempban'];
export const MODERATION_REASON_OPTIONAL = ['untimeout', 'clearwarns', 'unban', 'role_add', 'role_remove'];

export const DURATION_UNITS = [
	{ value: '60', label: 'Minutes' },
	{ value: '3600', label: 'Hours' },
	{ value: '86400', label: 'Days' }
];

export function formatDuration(seconds: number | null | undefined): string | null {
	if (!seconds) return null;
	const d = Math.floor(seconds / 86400);
	const h = Math.floor((seconds % 86400) / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	return [d && `${d}d`, h && `${h}h`, m && `${m}m`].filter(Boolean).join(' ') || `${seconds}s`;
}

export function splitDuration(seconds: number | null | undefined): { amount: number; unit: string } {
	const s = Number(seconds) || 0;
	if (s > 0 && s % 86400 === 0) return { amount: s / 86400, unit: '86400' };
	if (s > 0 && s % 3600 === 0) return { amount: s / 3600, unit: '3600' };
	return { amount: Math.max(1, Math.round(s / 60)), unit: '60' };
}

export type ModerateEachResult = { done: number; failed: number; failedIds: string[]; escalated: number; error: string | null };

export async function moderateEach(
	serverId: number | string,
	targetIds: string[],
	body: Record<string, unknown>,
	onprogress?: (done: number) => void
): Promise<ModerateEachResult> {
	const result: ModerateEachResult = { done: 0, failed: 0, failedIds: [], escalated: 0, error: null };
	for (const [index, targetId] of targetIds.entries()) {
		try {
			const res = await fetch(`/api/servers/${serverId}/moderation`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ...body, target_id: targetId })
			});
			const out = await res.json().catch(() => ({}));
			if (res.ok && out.ok) {
				result.done++;
				if (out.escalated) result.escalated++;
			} else {
				result.failed++;
				result.failedIds.push(targetId);
				result.error ??= out.error || 'Moderation action failed';
			}
		} catch {
			result.failed++;
			result.failedIds.push(targetId);
			result.error ??= 'Moderation action failed';
		}
		onprogress?.(index + 1);
	}
	return result;
}
