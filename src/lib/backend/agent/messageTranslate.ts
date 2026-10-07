import { serverLanguageEnglishName, type ServerLanguage } from '../../languages.js';
import { MESSAGE_LIMITS, type InnerBlock, type Localized, type MessageButton, type MessageDoc } from '../../messages.js';

const CHUNK_CHARACTERS = 3500;
const CONCURRENCY = 6;
const ATTEMPTS = 2;

export type MessageText = { key: string; value: Localized; max: number };

export type TranslationAsk = (system: string, user: string) => Promise<string>;

type Item = { id: string; text: string; max: number };
type Job = { target: ServerLanguage; items: Item[]; values: Map<string, Localized> };

const L = MESSAGE_LIMITS;

function buttonText(button: MessageButton): MessageText {
	return { key: `${button.id}.label`, value: button.label, max: L.label };
}

function innerTexts(block: InnerBlock): MessageText[] {
	if (block.type === 'text') return [{ key: `${block.id}.text`, value: block.text, max: L.blockText }];
	if (block.type === 'section') return [{ key: `${block.id}.text`, value: block.text, max: L.blockText }, buttonText(block.button)];
	if (block.type === 'gallery') return block.items.map((item) => ({ key: `${item.id}.caption`, value: item.caption, max: L.caption }));
	if (block.type === 'buttons') return block.buttons.map(buttonText);
	if (block.type === 'select') {
		return [
			{ key: `${block.id}.placeholder`, value: block.placeholder, max: L.placeholder },
			...block.options.flatMap((option) => [
				{ key: `${option.id}.label`, value: option.label, max: L.optionLabel },
				{ key: `${option.id}.description`, value: option.description, max: L.optionDescription }
			])
		];
	}
	return [];
}

export function messageTexts(doc: MessageDoc): MessageText[] {
	if (doc.layout === 'components') return doc.blocks.flatMap((block) => (block.type === 'container' ? block.blocks.flatMap(innerTexts) : innerTexts(block)));
	return [
		{ key: 'text', value: doc.text, max: L.text },
		...doc.embeds.flatMap((embed) => [
			{ key: `${embed.id}.author`, value: embed.author, max: L.author },
			{ key: `${embed.id}.title`, value: embed.title, max: L.title },
			{ key: `${embed.id}.description`, value: embed.description, max: L.description },
			{ key: `${embed.id}.footer`, value: embed.footer, max: L.footer },
			...embed.fields.flatMap((field) => [
				{ key: `${field.id}.name`, value: field.name, max: L.fieldName },
				{ key: `${field.id}.value`, value: field.value, max: L.fieldValue }
			])
		]),
		...doc.rows.flatMap(innerTexts)
	];
}

function system(source: ServerLanguage, target: ServerLanguage, note: string): string {
	return `You translate the texts of a Discord message from ${serverLanguageEnglishName(source)} into ${serverLanguageEnglishName(target)}, for the members of a Discord server. Translate naturally, the way a native speaker would write it, not word for word.

Keep exactly as they are: placeholders such as {server} and {year}, Discord markdown symbols, emoji, mentions such as <@123>, <@&123> and <#123>, custom emoji such as <:name:123>, links, and line breaks.

Each text comes with "max", the most characters its translation may have. Stay within it.${note ? `\n\nThe admin asked for this: ${note}` : ''}

Answer with one JSON object and nothing else, giving the translation for every id: {"1": "...", "2": "..."}`;
}

function parse(answer: string): Record<string, unknown> | null {
	const start = answer.indexOf('{');
	const end = answer.lastIndexOf('}');
	if (start < 0 || end <= start) return null;
	try {
		const parsed = JSON.parse(answer.slice(start, end + 1));
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

async function run(job: Job, source: ServerLanguage, note: string, ask: TranslationAsk): Promise<boolean> {
	for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
		const answer = await ask(system(source, job.target, note), JSON.stringify(job.items)).catch(() => '');
		const translated = parse(answer);
		if (!translated) continue;
		let filled = 0;
		for (const item of job.items) {
			const text = translated[item.id];
			if (typeof text !== 'string' || !text.trim()) continue;
			job.values.get(item.id)![job.target] = text.slice(0, item.max);
			filled++;
		}
		if (filled > 0) return true;
	}
	return false;
}

export async function translateMessage(
	doc: MessageDoc,
	original: MessageDoc,
	options: { retranslate: ServerLanguage[]; note: string; ask?: TranslationAsk }
): Promise<{ translated: ServerLanguage[]; failed: ServerLanguage[] }> {
	const source = doc.language;
	const targets = doc.languages.filter((code) => code !== source);
	const before = new Map(messageTexts(original).map((text) => [text.key, text.value]));
	const sameSource = original.language === source;
	const jobs: Job[] = [];

	for (const target of targets) {
		const again = options.retranslate.includes(target);
		let job: Job | null = null;
		let size = 0;
		let next = 0;

		for (const entry of messageTexts(doc)) {
			const text = (entry.value[source] ?? '').trim();
			if (!text) continue;
			if (!again && (entry.value[target] ?? '').trim()) continue;

			const old = before.get(entry.key);
			const kept = sameSource && !again && old && (old[source] ?? '').trim() === text ? (old[target] ?? '').trim() : '';
			if (kept) {
				entry.value[target] = old![target];
				continue;
			}

			if (!job || size + text.length > CHUNK_CHARACTERS) {
				job = { target, items: [], values: new Map() };
				jobs.push(job);
				size = 0;
			}
			const id = String(++next);
			job.items.push({ id, text, max: entry.max });
			job.values.set(id, entry.value);
			size += text.length;
		}
	}

	const ask = options.ask;
	if (!ask) return { translated: [], failed: [] };

	const failed = new Set<ServerLanguage>();
	let cursor = 0;
	await Promise.all(
		Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, async () => {
			while (cursor < jobs.length) {
				const job = jobs[cursor++];
				if (!(await run(job, source, options.note, ask))) failed.add(job.target);
			}
		})
	);

	return { translated: [...new Set(jobs.map((job) => job.target))].filter((code) => !failed.has(code)), failed: [...failed] };
}
