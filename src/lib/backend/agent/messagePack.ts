import { SERVER_LANGUAGES, isServerLanguage, serverLanguageEnglishName, type ServerLanguage } from '../../languages.js';
import {
	MESSAGE_LIMITS,
	messageDocProblems,
	messageRoleIds,
	messageShownIds,
	messageSummary,
	normalizeMessageDoc,
	type MessageDoc,
	type MessageScope
} from '../../messages.js';
import type { AgentTool, AgentVerdict } from './core.js';
import { translateMessage, type TranslationAsk } from './messageTranslate.js';

const MAX_REPLY_LENGTH = 600;
const MAX_LISTED_ROLES = 150;
const MAX_LISTED_EMOJIS = 80;

export type MessageAgentContext = {
	scope: MessageScope;
	serverName: string;
	messageId: number | null;
	name: string;
	doc: MessageDoc;
	posted: boolean;
	defaults: { color: string; footer: string };
	messages: { id: number; name: string; content: MessageDoc }[];
	roles: { id: string; name: string }[];
	emojis: { id: string; name: string; animated: boolean }[];
	ownsUpload: (key: string) => boolean;
	ask?: TranslationAsk;
};

export type MessageAgentResult = { reply: string; name: string | null; content: MessageDoc | null };

export type MessagePack = { instructions: string; tools: AgentTool[]; finish: (answer: string) => Promise<AgentVerdict<MessageAgentResult>> };

const L = MESSAGE_LIMITS;

const INSTRUCTIONS = `# The message open in the editor
The admin has the message builder open. When they want that message built or changed, you build it for them: the text, embeds, buttons, dropdowns and translations. You never post it. Your result is loaded into the editor, where the admin reviews it and presses Save or Send.

# How to answer
Answer with one JSON object and nothing else, with no code fence around it:
{"reply": "...", "name": "...", "message": { ... }}
- reply: one or two short plain sentences for the admin, in the language they wrote to you in. Say what you built or changed, or ask the one question you cannot work without. No markdown.
- name: the name of this message in the admin's library, ${L.name} characters at most. Keep the current name unless it is empty or the admin asks for another.
- message: the whole message after your change, in the format below. Always send the complete message, never a fragment. Leave it out when the message stays as it is: when you have to ask a question first, or when the admin asked for something else that you did with your other tools.
- retranslate: optional. A list of language codes to translate again from scratch, for when the admin is unhappy with a translation.
- translation_note: optional. One sentence for the translator, such as the tone the admin wants.

Keep every part of the message the admin did not ask you to change exactly as it is.

# Message format
type Code = a language code from the list under Languages
type Localized = { [code: Code]: string }      you write the main language entry only, for example {"en": "Hello"}
type Media = an https:// image link the admin gave you, or an upload key already present in the current message, or ""
type Url = an https:// link, or ""

type Message = {
  layout: "standard" | "components";
  language: Code;                 the main language
  languages: Code[];              every language the message is written in, main language included
  language_switch: boolean;       adds a control under the message that lets a member switch language. Only matters with two or more languages
  text: Localized;                standard layout: plain text above the embeds, up to ${L.text} characters
  embeds: Embed[];                standard layout: up to ${L.embeds}
  rows: Row[];                    standard layout: up to ${L.rows}, or ${L.rows - 1} when language_switch is on and there are two or more languages
  attachments: Attachment[];      standard layout: uploaded files. Return them exactly as given and never add one
  blocks: Block[];                components layout: up to ${L.blocks}
};
type Embed = { id?: string; color: "#rrggbb" | ""; author: Localized; author_icon: Media; author_url: Url; title: Localized; url: Url; description: Localized; fields: Field[]; thumbnail: Media; image: Media; footer: Localized; footer_icon: Media; timestamp: boolean };
type Field = { id?: string; name: Localized; value: Localized; inline: boolean };      up to ${L.fields} per embed, name and value are both required
type Attachment = { id: string; file: string; spoiler: boolean };
type Row = Buttons | Select;
type Buttons = { id?: string; type: "buttons"; buttons: Button[] };      1 to ${L.buttons} buttons
type Button = { id?: string; style: "secondary" | "primary" | "success" | "danger" | "link"; label: Localized; emoji: string; url: Url; actions: Action[] };
type Select = { id?: string; type: "select"; placeholder: Localized; multiple: boolean; options: Option[] };      a dropdown with 1 to ${L.options} options
type Option = { id?: string; label: Localized; description: Localized; emoji: string; actions: Action[] };
type Action = { type: "show"; message_id: number } | { type: "role"; mode: "toggle" | "add" | "remove"; role_id: string };
type Block = Container | Inner;
type Container = { id?: string; type: "container"; color: "#rrggbb" | ""; blocks: Inner[] };      a box with a colored edge holding up to ${L.innerBlocks} parts. A container cannot hold another container
type Inner =
  | { id?: string; type: "text"; text: Localized }
  | { id?: string; type: "section"; text: Localized; accessory: "thumbnail" | "button"; image: Media; button: Button }      text with a small image or one button beside it
  | { id?: string; type: "gallery"; items: { id?: string; media: Media; caption: Localized }[] }      1 to ${L.galleryItems} images or videos
  | { id?: string; type: "separator"; line: boolean; large: boolean }
  | Buttons
  | Select;

Length limits, per language: embed title ${L.title}, description ${L.description}, field name ${L.fieldName}, field value ${L.fieldValue}, footer ${L.footer}, author ${L.author}, all text of all embeds together ${L.embedTotal}. Button label ${L.label}, dropdown placeholder ${L.placeholder}, option label ${L.optionLabel}, option description ${L.optionDescription}. In the components layout all text together is ${L.blockText} at most.

# Rules
- Keep the "id" of every part you keep, and leave "id" out on every part you add.
- Text uses Discord markdown. {server} becomes the server's name and {year} the current year.
- Keep the current layout unless the admin asks for another one or the message is still empty. "standard" is classic text with embeds and rows of buttons. "components" is the modern one built from blocks: boxes, text beside an image, dividers and galleries. Each layout only uses its own fields.
- Never invent an image link, an upload key or a website link. Without one, leave that part out.
- Button colors carry meaning. At most one "primary" button per message, for its single main action. Everything else is "secondary". "danger" only for something that cannot be undone. "success" only for the yes of a yes or no pair. "link" opens a website: it needs a url and takes no actions.
- Every button that is not a link, and every dropdown option, needs at least one action. "show" opens another saved message privately for the member who clicked. "role" gives, takes or toggles a role.
- A "show" action may only use a message id from the saved messages listed below, and a "role" action only a role id from the roles listed below. If what the admin wants needs a message or role that is not listed, leave that button or option out and say in reply what has to exist first.
- emoji is one unicode emoji, or a custom emoji from the list below written exactly as shown, or "".
- You write every text in the main language only, and the current message below shows you only that language. Translations are made for you after you answer, into every other language in "languages": for each text you add or change, and for each language you add. So to translate the message, add the language codes to "languages" and send the message. Never write a translation yourself, unless the admin dictates the exact wording in another language: then add that entry to the text and it is kept as written. In reply, say the translations are being added, not that you wrote them.
- When the admin asks for real numbers or names from a server, such as a leaderboard, statistics, leveling rules, giveaways or the shop, read them with your tools first and write only what the tools returned. Never make such data up. If a tool is missing or fails, say so in reply.

# Languages
${SERVER_LANGUAGES.map((language) => `${language.code} (${language.englishName})`).join(', ')}`;

function mainLanguageOnly(doc: MessageDoc, ctx: MessageAgentContext) {
	return { ...normalizeMessageDoc({ ...doc, languages: [doc.language] }, ctx.ownsUpload, ctx.scope), languages: doc.languages };
}

function context(ctx: MessageAgentContext): string {
	const global = ctx.scope === 'global';
	const status =
		ctx.messageId === null
			? 'new and not saved yet'
			: ctx.posted
				? 'saved and already posted in Discord. Posted copies keep what they were sent with'
				: 'saved';
	const others = ctx.messages.filter((message) => message.id !== ctx.messageId);
	const lines = [
		'# This message',
		global
			? "Kind: a global message. It is sent to every server the bots are in, so write it for all of them and use {server} where the server name belongs. Role actions do not exist here. An embed color left empty takes each server's own color."
			: `Kind: a message for the Discord server "${ctx.serverName}".`,
		`Name: ${ctx.name.trim() ? JSON.stringify(ctx.name.trim()) : 'not named yet, so give it one'}`,
		`Status: ${status}`,
		`Color for new embeds and boxes: ${ctx.defaults.color || (global ? 'leave empty' : 'none set')}`,
		...(ctx.defaults.footer ? [`Footer for new embeds, in the main language: ${JSON.stringify(ctx.defaults.footer)}`] : []),
		'Current message, main language only:',
		JSON.stringify(mainLanguageOnly(ctx.doc, ctx)),
		'',
		'# Saved messages a "show" action can open',
		...(others.length > 0
			? others.map((message) => `- ${message.id}: ${JSON.stringify(message.name)} ${JSON.stringify(messageSummary(message.content))}`)
			: ['None yet. A "show" action has nothing to open.']),
		...(ctx.messageId !== null ? [`This message itself is id ${ctx.messageId}.`] : [])
	];

	if (!global) {
		lines.push(
			'',
			'# Roles a "role" action can use',
			...(ctx.roles.length > 0 ? ctx.roles.slice(0, MAX_LISTED_ROLES).map((role) => `- ${role.id}: ${JSON.stringify(role.name)}`) : ['None.'])
		);
	}
	if (ctx.emojis.length > 0) {
		lines.push(
			'',
			'# Custom emojis',
			ctx.emojis
				.slice(0, MAX_LISTED_EMOJIS)
				.map((emoji) => `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`)
				.join(' ')
		);
	}
	return lines.join('\n');
}

function parseAnswer(answer: string): Record<string, unknown> | null {
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

export function messagePack(ctx: MessageAgentContext): MessagePack {
	const known = ctx.messages;
	const knownIds = new Set(known.map((message) => message.id));
	const roleIds = new Set(ctx.roles.map((role) => role.id));

	const readMessage: AgentTool = {
		name: 'read_message',
		description:
			'Read the full content of another saved message from this library by its id. Use it when the admin points at another message, for example to match its style, reuse its wording or keep translations consistent.',
		parameters: {
			type: 'object',
			properties: { id: { type: 'integer', description: 'The id of the saved message, from the saved messages list.' } },
			required: ['id']
		},
		run: (args) => {
			const found = known.find((message) => message.id === Number(args.id));
			return found ? { ok: true, name: found.name, message: mainLanguageOnly(found.content, ctx) } : { ok: false, reason: 'not_a_saved_message' };
		}
	};

	return {
		instructions: `${INSTRUCTIONS}\n\n${context(ctx)}`,
		tools: known.some((message) => message.id !== ctx.messageId) ? [readMessage] : [],
		async finish(answer) {
			const parsed = parseAnswer(answer);
			if (!parsed) {
				if (answer && !answer.includes('{')) return { ok: true, result: { reply: answer.slice(0, MAX_REPLY_LENGTH), name: null, content: null } };
				return {
					ok: false,
					feedback:
						'That was not a valid JSON object. Answer again with only the JSON object {"reply": "...", "name": "...", "message": { ... }}, with every quote and line break inside a text escaped.'
				};
			}

			const reply = (typeof parsed.reply === 'string' ? parsed.reply.trim() : '').slice(0, MAX_REPLY_LENGTH);
			const rawName = typeof parsed.name === 'string' ? parsed.name.trim().slice(0, L.name) : '';
			const name = rawName && rawName !== ctx.name.trim() ? rawName : null;
			const retranslate = (Array.isArray(parsed.retranslate) ? parsed.retranslate : []).filter((code): code is ServerLanguage => isServerLanguage(code));
			const note = typeof parsed.translation_note === 'string' ? parsed.translation_note.trim().slice(0, 300) : '';
			const rewritten = parsed.message && typeof parsed.message === 'object';
			if (!rewritten && retranslate.length === 0) {
				return { ok: true, result: { reply: reply || 'Nothing was changed.', name, content: null } };
			}

			const content = normalizeMessageDoc(rewritten ? parsed.message : structuredClone(ctx.doc), ctx.ownsUpload, ctx.scope);
			const problems = [
				...messageDocProblems(content),
				...messageShownIds(content)
					.filter((id) => !knownIds.has(id))
					.map((id) => `A "show" action uses message_id ${id}, which is not a saved message. Use an id from the saved messages list or remove that part.`),
				...messageRoleIds(content)
					.filter((id) => !roleIds.has(id))
					.map((id) => `A "role" action uses role_id ${id}, which is not in the roles list. Use an id from that list or remove that part.`)
			];

			if (problems.length > 0) {
				await translateMessage(content, ctx.doc, { retranslate: [], note });
				return {
					ok: false,
					feedback: `The builder found problems with that message:\n${problems.map((problem) => `- ${problem}`).join('\n')}\n\nFix them and answer again with the complete JSON object. "Pick what happens when it is clicked" means the actions list of that button or option is empty. If you cannot fix a part with what you have, remove it and say so in reply.`,
					fallback: { reply: `${reply || 'Done.'} A few parts still need you, see "Fix before saving".`, name, content }
				};
			}

			const { failed } = await translateMessage(content, ctx.doc, { retranslate, note, ask: ctx.ask });
			const notes = [
				...(failed.length > 0
					? [
							`Could not translate into ${failed.map(serverLanguageEnglishName).join(', ')}, so those parts still show the ${serverLanguageEnglishName(content.language)} text.`
						]
					: []),
				...(messageDocProblems(content).length > 0 ? ['A few parts still need you, see "Fix before saving".'] : [])
			];
			return { ok: true, result: { reply: [reply || 'Done.', ...notes].join(' '), name, content } };
		}
	};
}
