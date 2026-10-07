<script lang="ts">
	import type { ServerLanguage } from '$lib/languages.js';
	import type { MessageAction, MessageDoc } from '$lib/messages.js';
	import MessageBody from './MessageBody.svelte';
	import { discordMarkdown, type MarkdownContext } from './discordMarkdown.js';

	type Reply = { key: number; doc: MessageDoc | null; lines: string[] };

	let {
		doc,
		lang,
		server,
		bot,
		context,
		resolve
	}: {
		doc: MessageDoc;
		lang: ServerLanguage;
		server: string;
		bot: { name: string; avatar: string | null };
		context: MarkdownContext;
		resolve: (messageId: number) => MessageDoc | null;
	} = $props();

	let replies = $state<Reply[]>([]);
	let held = $state<string[]>([]);
	let now = $state('');
	let nextKey = 0;

	$effect(() => {
		now = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
	});

	function roleLines(actions: MessageAction[]): string[] {
		const lines: string[] = [];
		for (const action of actions) {
			if (action.type !== 'role') continue;
			if (!action.role_id) {
				lines.push('❌ No role is picked for this yet.');
				continue;
			}
			const mention = `<@&${action.role_id}>`;
			const has = held.includes(action.role_id);
			const give = action.mode === 'add' || (action.mode === 'toggle' && !has);
			if (give === has) lines.push(give ? `You already have ${mention}.` : `You don't have ${mention}.`);
			else if (give) {
				held = [...held, action.role_id];
				lines.push(`✅ You now have ${mention}.`);
			} else {
				held = held.filter((id) => id !== action.role_id);
				lines.push(`✅ ${mention} was removed from you.`);
			}
		}
		return lines;
	}

	function press(actions: MessageAction[], from: Reply | null) {
		const show = actions.find((action) => action.type === 'show');
		const target = show ? (show.message_id ? resolve(show.message_id) : null) : null;
		const lines = roleLines(actions);
		if (actions.length === 0) lines.push('Nothing happens yet. Pick what this does in the editor.');
		if (show && !target) lines.push(show.message_id ? '❌ The message this shows no longer exists.' : '❌ No message is picked for this yet.');

		if (target) {
			const inPlace = from?.doc && (target.layout === 'components' || from.doc.layout !== 'components');
			if (from && inPlace) from.doc = target;
			else replies.push({ key: nextKey++, doc: target, lines: [] });
		}
		if (lines.length > 0) replies.push({ key: nextKey++, doc: null, lines });
	}

	function dismiss(key: number) {
		replies = replies.filter((reply) => reply.key !== key);
	}
</script>

{#snippet author()}
	<div class="dc-author">
		<span class="dc-name">{bot.name}</span>
		<span class="dc-tag">APP</span>
		<span class="dc-timestamp">{now}</span>
	</div>
{/snippet}

{#snippet avatar()}
	{#if bot.avatar}
		<img class="dc-avatar" src={bot.avatar} alt="" />
	{:else}
		<span class="dc-avatar dc-avatar-empty"><i class="fas fa-robot"></i></span>
	{/if}
{/snippet}

<div class="dc-chat">
	<div class="dc-message">
		{@render avatar()}
		<div class="dc-content">
			{@render author()}
			<MessageBody {doc} {lang} {server} {context} {now} onpress={(actions) => press(actions, null)} />
		</div>
	</div>

	{#each replies as reply (reply.key)}
		<div class="dc-message dc-ephemeral">
			{@render avatar()}
			<div class="dc-content">
				{@render author()}
				{#if reply.doc}
					<MessageBody doc={reply.doc} {lang} {server} {context} {now} onpress={(actions) => press(actions, reply)} />
				{:else}
					<div class="dc-result">
						{#each reply.lines as line, i (i)}
							<div>{@html discordMarkdown(line, context)}</div>
						{/each}
					</div>
				{/if}
				<div class="dc-only-you">
					<i class="fas fa-eye"></i>Only you can see this •
					<button type="button" onclick={() => dismiss(reply.key)}>Dismiss message</button>
				</div>
			</div>
		</div>
	{/each}
</div>

<style>
	.dc-chat {
		display: flex;
		flex-direction: column;
		gap: 4px;
		border-radius: 10px;
		background: #1a1a1e;
		padding: 14px 12px;
		font-family: 'gg sans', 'Noto Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
	}

	.dc-message {
		display: flex;
		gap: 12px;
		border-radius: 6px;
		padding: 6px;
		min-width: 0;
	}

	.dc-ephemeral {
		background: rgba(88, 101, 242, 0.08);
		box-shadow: inset 2px 0 0 #5865f2;
	}

	.dc-avatar {
		flex-shrink: 0;
		border-radius: 50%;
		width: 40px;
		height: 40px;
		object-fit: cover;
	}

	.dc-avatar-empty {
		display: grid;
		place-items: center;
		background: #5865f2;
		color: #fff;
	}

	.dc-content {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}

	.dc-author {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}

	.dc-name {
		overflow: hidden;
		color: #f2f3f5;
		font-weight: 600;
		font-size: 15px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.dc-tag {
		flex-shrink: 0;
		border-radius: 4px;
		background: #5865f2;
		padding: 1px 5px;
		color: #fff;
		font-weight: 600;
		font-size: 10px;
	}

	.dc-timestamp {
		flex-shrink: 0;
		color: #949ba4;
		font-size: 12px;
	}

	.dc-result {
		color: #dbdee1;
		font-size: 15px;
		line-height: 1.375;
	}

	.dc-result :global(.dc-mention) {
		border-radius: 3px;
		background: rgba(88, 101, 242, 0.3);
		padding: 0 2px;
		color: #c9cdfb;
		font-weight: 500;
	}

	.dc-only-you {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
		margin-top: 2px;
		color: #949ba4;
		font-size: 12px;
	}

	.dc-only-you button {
		color: #00a8fc;
	}

	.dc-only-you button:hover {
		text-decoration: underline;
	}
</style>
