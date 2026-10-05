import { parseQuestRewardLine, parseQuestTaskLine, questTaskLabel, type QuestAutomationResult } from '../../../config.js';
import type { Translator } from '../i18n.js';

export function questTaskName(tr: Translator, taskKey: string): string {
	const key = `questEnroll.taskTypes.${taskKey || 'default'}`;
	const label = tr(key);
	return label === key ? questTaskLabel(taskKey) : label;
}

export function questRewardText(tr: Translator, line: unknown): string {
	const parts = parseQuestRewardLine(line);
	if (parts.length === 0) return tr('questEnroll.reward.fallback');
	return parts.map((p) => (p.kind === 'currency' ? tr('questEnroll.reward.currency', { count: p.quantity }) : p.name)).join(' · ');
}

export function questTaskText(tr: Translator, line: unknown, taskKey: string): string {
	const parsed = parseQuestTaskLine(line, taskKey);
	const task = questTaskName(tr, taskKey);
	switch (parsed.kind) {
		case 'label':
			return task;
		case 'minutes':
			return tr(parsed.value === 1 ? 'questEnroll.task.forMinute' : 'questEnroll.task.forMinutes', { task, count: parsed.value });
		case 'seconds':
			return tr('questEnroll.task.forSeconds', { task, count: parsed.value });
		case 'secondsTarget':
			return tr('questEnroll.task.secondsTarget', { task, count: parsed.value });
		case 'target':
			return tr('questEnroll.task.target', { task, count: parsed.value });
		default:
			return parsed.text;
	}
}

export function questResultText(tr: Translator, result: QuestAutomationResult): { title: string; description: string } {
	const params = {
		quest: result.questName,
		task: questTaskName(tr, result.taskKey ?? ''),
		reward: questRewardText(tr, result.rewardLine),
		status: result.httpStatus ?? '',
		error: result.error ?? '',
		detail: result.error ? ` (${result.error})` : ''
	};
	return {
		title: tr(`questEnroll.auto.${result.code}.title`, params),
		description: tr(`questEnroll.auto.${result.code}.description`, params)
	};
}
