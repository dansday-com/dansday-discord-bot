<script lang="ts">
	import ChannelPicker from '$lib/frontend/components/ChannelPicker.svelte';
	import LabeledSelect from '$lib/frontend/components/LabeledSelect.svelte';
	import LocalTime from '$lib/frontend/components/LocalTime.svelte';
	import RolePicker from '$lib/frontend/components/RolePicker.svelte';
	import { scrollLocked } from '$lib/frontend/scrollLock.js';
	import { showToast } from '$lib/frontend/toast.svelte';
	import { serverLanguageLabel, type ServerLanguage } from '$lib/languages.js';
	import type { PostedCopy } from './selection.js';
	import { GHOST_BUTTON, ICON_BUTTON, LABEL } from './styles.js';

	let {
		open = $bindable(false),
		global,
		channels,
		categories,
		mentionRoles,
		languages,
		posts,
		sending,
		removing,
		updating,
		onsend,
		onupdate,
		onremove
	}: {
		open: boolean;
		global: boolean;
		channels: any[];
		categories: any[];
		mentionRoles: any[];
		languages: ServerLanguage[];
		posts: PostedCopy[];
		sending: boolean;
		removing: number | 'all' | null;
		updating: number | 'all' | null;
		onsend: (target: { channelIds: string[]; mentionIds: string[]; language: string }) => Promise<boolean>;
		onupdate: (post: PostedCopy | 'all') => void;
		onremove: (post: PostedCopy | 'all') => void;
	} = $props();

	let channelIds = $state<string[]>([]);
	let mentionIds = $state<string[]>([]);
	let language = $state('');

	const languageOptions = $derived(languages.map((code) => ({ value: code, label: serverLanguageLabel(code) })));
	const postLanguage = $derived(languages.includes(language as ServerLanguage) ? language : languages[0]);
	const outdated = $derived(posts.filter((post) => post.outdated).length);
	const busy = $derived(removing !== null || updating !== null);

	async function send() {
		if (!global && channelIds.length === 0) return showToast('Pick at least one channel to send it to.', 'error');
		if (!(await onsend({ channelIds, mentionIds, language: postLanguage }))) return;
		channelIds = [];
		mentionIds = [];
	}
</script>

{#if open}
	<div
		use:scrollLocked
		class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-4"
		role="dialog"
		aria-modal="true"
		aria-label="Send message"
		tabindex="-1"
		onkeydown={(event) => {
			if (event.key === 'Escape') open = false;
		}}
	>
		<div class="bg-ash-800 border-ash-700 my-4 w-full max-w-lg rounded-2xl border p-4 sm:p-6">
			<div class="mb-4 flex items-center justify-between">
				<h3 class="text-ash-100 flex items-center gap-2 text-base font-bold sm:text-lg">
					<i class="fas fa-paper-plane text-emerald-400"></i>{global ? 'Send to every server' : 'Send this message'}
				</h3>
				<button type="button" onclick={() => (open = false)} aria-label="Close" class="text-ash-400 hover:text-ash-100 p-1 transition-colors">
					<i class="fas fa-times text-lg"></i>
				</button>
			</div>

			<div class="flex flex-col gap-3">
				{#if global}
					<p class="text-ash-300 text-sm">
						It goes to every server on all of your bots, in each server's <strong class="text-ash-100">Bot Updates Channel</strong> and in that server's language.
						Servers without that channel are skipped.
					</p>
				{:else}
					<div>
						<span class="{LABEL} mb-1.5 block">Where should the bot post it?</span>
						<ChannelPicker
							{channels}
							{categories}
							value={channelIds}
							multi={true}
							placeholder="Select channels..."
							onchange={(value) => (channelIds = value as string[])}
						/>
					</div>
				{/if}
				<div>
					<span class="{LABEL} mb-1.5 block">{global ? 'Ping role groups with it' : 'Ping roles with it'} <span class="text-ash-500">(optional)</span></span>
					<RolePicker roles={mentionRoles} value={mentionIds} placeholder="Nobody" onchange={(value) => (mentionIds = value as string[])} />
					{#if global}
						<p class="text-ash-500 mt-1.5 text-[11px]">Each server pings its own admin and staff roles. Servers with no matching role are not pinged.</p>
					{/if}
				</div>
				{#if !global && languages.length > 1}
					<div>
						<span class="{LABEL} mb-1.5 block">Post it in</span>
						<LabeledSelect
							appearance="field"
							options={languageOptions}
							bind:value={() => postLanguage, (next) => (language = next)}
							ariaLabel="Language to post in"
						/>
					</div>
				{/if}
				<button
					type="button"
					onclick={send}
					disabled={sending}
					class="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
				>
					<i class="fas {sending ? 'fa-spinner fa-spin' : 'fa-paper-plane'}"></i>
					{sending ? 'Sending...' : global ? 'Send to every server' : 'Send'}
				</button>
			</div>

			{#if posts.length > 0}
				<div class="border-ash-700 mt-5 border-t pt-4">
					<div class="flex items-center gap-2">
						<h4 class="text-ash-100 mr-auto flex items-center gap-2 text-sm font-semibold"><i class="fas fa-thumbtack text-amber-300"></i>Already posted</h4>
						{#if outdated > 1}
							<button type="button" class={GHOST_BUTTON} disabled={busy} onclick={() => onupdate('all')}>
								<i class="fas {updating === 'all' ? 'fa-spinner fa-spin' : 'fa-rotate'} text-sky-300"></i>Update all
							</button>
						{/if}
						{#if global}
							<button type="button" class={GHOST_BUTTON} disabled={busy} onclick={() => onremove('all')}>
								<i class="fas {removing === 'all' ? 'fa-spinner fa-spin' : 'fa-trash'} text-red-300"></i>Delete from every server
							</button>
						{/if}
					</div>
					<p class="text-ash-400 mt-1 mb-3 text-xs">
						Each copy stays the way it was sent, so you can change this message and send it again. Update gives a copy the saved version.
					</p>
					<div class="flex max-h-60 flex-col gap-1.5 overflow-y-auto">
						{#each posts as post (post.id)}
							<div class="bg-ash-700/50 border-ash-600 flex items-center gap-2 rounded-lg border px-2.5 py-2">
								<div class="min-w-0 flex-1">
									<p class="text-ash-100 truncate text-sm">{post.server_name ? `${post.server_name} · ` : ''}#{post.channel_name}</p>
									<p class="text-ash-400 truncate text-xs">
										<LocalTime value={post.created_at} />{languages.length > 1 ? ` · ${serverLanguageLabel(post.language)}` : ''}{#if post.outdated}<span
												class="text-amber-300"
											>
												· Older version</span
											>{/if}
									</p>
								</div>
								{#if post.outdated}
									<button
										type="button"
										class={ICON_BUTTON}
										aria-label="Update the copy in #{post.channel_name}"
										title="Update to the saved version"
										disabled={busy}
										onclick={() => onupdate(post)}
									>
										<i class="fas {updating === post.id ? 'fa-spinner fa-spin' : 'fa-rotate'}"></i>
									</button>
								{/if}
								<a
									href="https://discord.com/channels/{post.guild_id}/{post.channel_id}/{post.discord_message_id}"
									target="_blank"
									rel="noreferrer"
									class={ICON_BUTTON}
									aria-label="Open in Discord"
									title="Open in Discord"
								>
									<i class="fas fa-arrow-up-right-from-square"></i>
								</a>
								<button
									type="button"
									class={ICON_BUTTON}
									aria-label="Remove from #{post.channel_name}"
									title="Delete from Discord"
									disabled={busy}
									onclick={() => onremove(post)}
								>
									<i class="fas {removing === post.id ? 'fa-spinner fa-spin' : 'fa-trash'}"></i>
								</button>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}
