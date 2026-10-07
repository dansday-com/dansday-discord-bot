import { json } from '@sveltejs/kit';
import db from '$lib/database.js';
import type { AgentTask } from '$lib/backend/agent/core.js';
import { itemsPack } from './items.server.js';
import { canBuildMessage, messageBuilderPack, messageRequest, type MessageRequest } from './messages.server.js';
import {
	agentReach,
	agentReady,
	agentSession,
	agentTurns,
	runPanelAgent,
	type AgentAnswer,
	type AgentPack,
	type AgentReach,
	type AgentSession
} from './runtime.server.js';
import { serverDataPack } from './serverData.server.js';
import { settingsPack } from './settings.server.js';
import { wikisPack } from './wikis.server.js';

const MAX_REPLY_LENGTH = 2000;

type Scope = { reach: AgentReach; session: AgentSession; message: MessageRequest | null };

type Capability = {
	can: (scope: Scope) => string;
	available: (scope: Scope) => boolean;
	confirms?: boolean;
	pack: (scope: Scope) => AgentPack | Promise<AgentPack>;
};

const CAPABILITIES: Capability[] = [
	{
		can: () => 'Build or change the message open in the editor, translations included',
		available: ({ reach, message }) => canBuildMessage(reach, message),
		pack: ({ reach, message }) => messageBuilderPack(reach, message as MessageRequest)
	},
	{
		can: ({ reach }) =>
			reach.all ? 'Read live data of any server, like its leaderboard or statistics' : "Read this server's live data, like its leaderboard or statistics",
		available: () => true,
		pack: ({ reach }) => serverDataPack(reach)
	},
	{
		can: () => 'Add, change and delete wikis',
		available: ({ reach }) => reach.all,
		confirms: true,
		pack: ({ reach, session }) => wikisPack(reach, session)
	},
	{
		can: () => 'Add, change and delete shop items',
		available: ({ reach }) => reach.all,
		confirms: true,
		pack: ({ reach, session }) => itemsPack(reach, session)
	},
	{
		can: () => 'Change the panel settings',
		available: ({ reach }) => reach.all,
		pack: ({ reach, session }) => settingsPack(reach, session)
	}
];

const RULES = `# Rules
- Do the work with your tools instead of explaining how to do it by hand. Ask only when you cannot go on without an answer.
- Say something was created, changed or read only after the tool for it returned ok. When a tool fails, say what went wrong in plain words.
- A tool that deletes does not delete right away. The admin gets a Confirm button under your reply and nothing is gone until they press it, so tell them to press it and never say it is already deleted.
- You only have the tools you were given. When the admin asks for something outside them, say in one sentence that you cannot do that from here.
- Never show an API key, token or password, and never ask for one unless a tool needs it for what the admin asked.`;

const PLAIN_ANSWER =
	'# How to answer\nReply in the language the admin writes in, in one to three short sentences of plain text. Use short lines when you list things. No markdown, no tables, no headings.';

function introduction(locals: App.Locals, reach: AgentReach): string {
	const who =
		locals.user.authenticated && locals.user.account_source === 'server_accounts'
			? `a ${locals.user.account_type} account of the Discord server "${reach.server?.name ?? ''}"`
			: `the superadmin of this panel${reach.server ? `, with the Discord server "${reach.server.name ?? ''}" open` : ''}`;
	return `You are the assistant built into the admin panel of a Discord bot. The person talking to you is signed in as ${who}. You set things up for them with your tools and answer their questions from what the tools return.`;
}

async function scopeFor(locals: App.Locals, rawServerId: unknown, message: MessageRequest | null): Promise<Scope | null> {
	if (!locals.user.authenticated) return null;
	const serverId = locals.user.account_source === 'server_accounts' ? locals.user.server_id : Math.trunc(Number(rawServerId));
	const server = serverId > 0 ? await db.getServer(serverId).catch(() => null) : null;
	if (serverId > 0 && !server) return null;

	const reach = await agentReach(locals, server);
	return reach ? { reach, session: agentSession(locals), message } : null;
}

export async function describeAssistant(locals: App.Locals, url: URL): Promise<Response> {
	const scope = await scopeFor(locals, url.searchParams.get('server_id'), messageRequest({ scope: url.searchParams.get('message') }));
	if (!scope) return json({ ok: false, error: 'Access denied' }, { status: 403 });

	return json({
		ok: true,
		ready: await agentReady(scope.reach.panelId),
		can: CAPABILITIES.filter((capability) => capability.available(scope)).map((capability) => capability.can(scope))
	});
}

async function confirmAction(scope: Scope, confirm: any): Promise<Response> {
	const packs = await Promise.all(
		CAPABILITIES.filter((capability) => capability.confirms && capability.available(scope)).map((capability) => capability.pack(scope))
	);
	const action = packs.flatMap((pack) => pack.dangers ?? []).find((danger) => danger.name === confirm?.name);
	if (!action) return json({ ok: false, error: 'That action is not available here.' }, { status: 403 });

	try {
		const reply = await action.run(confirm.args && typeof confirm.args === 'object' ? confirm.args : {});
		return json({ ok: true, reply, confirms: [], changed: [...scope.session.changed] });
	} catch {
		return json({ ok: false, error: 'That did not go through. Try again in a moment.' }, { status: 500 });
	}
}

export async function answerAssistant(locals: App.Locals, body: any): Promise<Response> {
	const scope = await scopeFor(locals, body?.server_id, messageRequest(body?.message));
	if (!scope) return json({ ok: false, error: 'Access denied' }, { status: 403 });
	if (body?.confirm) return confirmAction(scope, body.confirm);

	const turns = agentTurns(body?.history, body?.prompt);
	if (!turns) return json({ ok: false, error: 'Tell the assistant what you need.' }, { status: 400 });

	const packs = await Promise.all(CAPABILITIES.filter((capability) => capability.available(scope)).map((capability) => capability.pack(scope)));
	const structured = packs.find((pack) => pack.finish);
	const task: AgentTask<AgentAnswer> = {
		system: [introduction(locals, scope.reach), RULES, ...packs.map((pack) => pack.instructions), ...(structured ? [] : [PLAIN_ANSWER])].join('\n\n'),
		tools: packs.flatMap((pack) => pack.tools),
		finish:
			structured?.finish ??
			((answer) =>
				answer
					? { ok: true, result: { reply: answer.slice(0, MAX_REPLY_LENGTH) } }
					: { ok: false, feedback: 'Answer the admin in one to three short sentences.' })
	};

	const where = scope.reach.server ? ` on server "${scope.reach.server.name || scope.reach.server.id}"` : '';
	const reply = await runPanelAgent(scope.reach, task, turns, `${scope.session.actor} asked the assistant${where}`);
	const effects = { confirms: scope.session.confirms, changed: [...scope.session.changed] };

	if (reply.ok) return json({ ok: true, reply: reply.result.reply, message: reply.result.message ?? null, ...effects });
	if (effects.confirms.length > 0 || effects.changed.length > 0) {
		return json({
			ok: true,
			reply: 'I got part of the way and then ran out of time. Check what changed, then tell me what is left.',
			message: null,
			...effects
		});
	}
	return json({ ok: false, error: reply.error }, { status: reply.status });
}
