<script lang="ts">
	import LabeledSelect from '$lib/frontend/components/LabeledSelect.svelte';
	import { MESSAGE_LIMITS, MESSAGE_ROLE_MODES, type MessageAction } from '$lib/messages.js';
	import LocalizedField from './LocalizedField.svelte';
	import MediaField from './MediaField.svelte';
	import { messageEditor } from './editorContext.js';
	import { GHOST_BUTTON, ICON_BUTTON, LABEL } from './styles.js';

	let { actions = $bindable() }: { actions: MessageAction[] } = $props();

	const editor = messageEditor();
	const MODE_OPTIONS = MESSAGE_ROLE_MODES.map((mode) => ({ value: mode.id, label: mode.label }));
	const HEADING = 'text-ash-200 flex shrink-0 items-center gap-1.5 text-xs';
	const BELOW = 'order-last min-w-0 basis-full';

	const messageOptions = $derived([
		{ value: '', label: 'Pick a message' },
		...editor.messages.map((message) => ({ value: String(message.id), label: message.id === editor.selfId ? `${message.name} (this message)` : message.name }))
	]);
	const used = $derived(new Set(actions.map((action) => action.type)));
	const replies = $derived(used.has('text') || used.has('attachment') || used.has('show'));

	function roleOptions(current: string) {
		const taken = new Set(actions.flatMap((action) => (action.type === 'role' && action.role_id !== current ? [action.role_id] : [])));
		return [
			{ value: '', label: 'Pick a role' },
			...editor.roles.filter((role) => role.assignable !== false && !taken.has(role.id)).map((role) => ({ value: role.id, label: role.name }))
		];
	}
</script>

<div>
	<span class="{LABEL} mb-1.5 block">When clicked</span>
	<div class="flex flex-col gap-2">
		{#each actions as action, i (i)}
			<div class="bg-ash-800 border-ash-600 flex flex-wrap items-center gap-2 rounded-lg border p-2">
				{#if action.type === 'text'}
					<span class={HEADING}><i class="fas fa-comment text-violet-300"></i>Message</span>
					<div class={BELOW}>
						<LocalizedField bind:value={action.text} label="Text" max={MESSAGE_LIMITS.text} multiline rows={3} placeholder="Write what the member gets back" />
					</div>
				{:else if action.type === 'attachment'}
					<span class={HEADING}><i class="fas fa-paperclip text-amber-300"></i>Attachment</span>
					<div class={BELOW}><MediaField bind:value={action.file} video link={false} /></div>
				{:else if action.type === 'show'}
					<span class={HEADING}><i class="fas fa-eye text-sky-300"></i>Saved message</span>
					<div class="min-w-0 flex-1 basis-40">
						<LabeledSelect
							appearance="field"
							options={messageOptions}
							ariaLabel="Message to show"
							bind:value={() => (action.message_id ? String(action.message_id) : ''), (next) => (action.message_id = Number(next) || 0)}
						/>
					</div>
				{:else}
					<div class="min-w-0 flex-1 basis-40">
						<LabeledSelect appearance="field" options={MODE_OPTIONS} ariaLabel="Role action" bind:value={action.mode} />
					</div>
					<div class="min-w-0 flex-1 basis-40">
						<LabeledSelect appearance="field" options={roleOptions(action.role_id)} ariaLabel="Role" bind:value={action.role_id} />
					</div>
				{/if}
				<button type="button" class="{ICON_BUTTON} ml-auto" aria-label="Remove action" onclick={() => actions.splice(i, 1)}>
					<i class="fas fa-trash"></i>
				</button>
			</div>
		{:else}
			<p class="text-ash-500 text-xs">Nothing happens yet. Add what a click should do.</p>
		{/each}
	</div>
	{#if actions.length < MESSAGE_LIMITS.actions}
		<div class="mt-2 flex flex-wrap gap-2">
			{#if !used.has('text')}
				<button type="button" class={GHOST_BUTTON} onclick={() => actions.push({ type: 'text', text: {} })}>
					<i class="fas fa-comment text-violet-300"></i>Write a message
				</button>
			{/if}
			<button type="button" class={GHOST_BUTTON} onclick={() => actions.push({ type: 'attachment', file: '' })}>
				<i class="fas fa-paperclip text-amber-300"></i>Attach a file
			</button>
			{#if !used.has('show')}
				<button type="button" class={GHOST_BUTTON} onclick={() => actions.push({ type: 'show', message_id: 0 })}>
					<i class="fas fa-eye text-sky-300"></i>Show a saved message
				</button>
			{/if}
			{#if editor.roleActions}
				<button type="button" class={GHOST_BUTTON} onclick={() => actions.push({ type: 'role', mode: 'toggle', role_id: '' })}>
					<i class="fas fa-user-tag text-emerald-300"></i>Give or take a role
				</button>
			{/if}
		</div>
	{/if}
	{#if replies}
		<p class="text-ash-500 mt-2 text-xs">Only the member who clicked sees the reply. A message and its attachments arrive together.</p>
	{/if}
	{#if used.has('role') && editor.roles.some((role) => role.assignable === false)}
		<p class="text-ash-500 mt-2 text-xs">Roles that can moderate or manage the server are left out, so a click can never hand those out.</p>
	{/if}
	{#if used.has('show') && editor.messages.length === 0}
		<p class="text-ash-500 mt-2 text-xs">There is no saved message to show yet. Write the reply here instead, or create the message you want and pick it.</p>
	{/if}
</div>
