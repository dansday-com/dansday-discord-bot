<script lang="ts">
	import LabeledSelect from '$lib/frontend/components/LabeledSelect.svelte';
	import { MESSAGE_LIMITS, MESSAGE_ROLE_MODES, type MessageAction } from '$lib/messages.js';
	import { messageEditor } from './editorContext.js';
	import { GHOST_BUTTON, ICON_BUTTON, LABEL } from './styles.js';

	let { actions = $bindable() }: { actions: MessageAction[] } = $props();

	const editor = messageEditor();
	const MODE_OPTIONS = MESSAGE_ROLE_MODES.map((mode) => ({ value: mode.id, label: mode.label }));

	const messageOptions = $derived([
		{ value: '', label: 'Pick a message' },
		...editor.messages.map((message) => ({ value: String(message.id), label: message.id === editor.selfId ? `${message.name} (this message)` : message.name }))
	]);
	const hasShow = $derived(actions.some((action) => action.type === 'show'));

	function roleOptions(current: string) {
		const taken = new Set(actions.flatMap((action) => (action.type === 'role' && action.role_id !== current ? [action.role_id] : [])));
		return [{ value: '', label: 'Pick a role' }, ...editor.roles.filter((role) => !taken.has(role.id)).map((role) => ({ value: role.id, label: role.name }))];
	}
</script>

<div>
	<span class="{LABEL} mb-1.5 block">When clicked</span>
	<div class="flex flex-col gap-2">
		{#each actions as action, i (i)}
			<div class="bg-ash-800 border-ash-600 flex flex-wrap items-center gap-2 rounded-lg border p-2">
				{#if action.type === 'show'}
					<span class="text-ash-200 flex shrink-0 items-center gap-1.5 text-xs"><i class="fas fa-eye text-sky-300"></i>Show privately</span>
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
			{#if !hasShow}
				<button type="button" class={GHOST_BUTTON} onclick={() => actions.push({ type: 'show', message_id: 0 })}>
					<i class="fas fa-eye text-sky-300"></i>Show a message
				</button>
			{/if}
			<button type="button" class={GHOST_BUTTON} onclick={() => actions.push({ type: 'role', mode: 'toggle', role_id: '' })}>
				<i class="fas fa-user-tag text-emerald-300"></i>Give or take a role
			</button>
		</div>
	{/if}
	{#if actions.some((action) => action.type === 'show') && editor.messages.length === 0}
		<p class="text-ash-500 mt-2 text-xs">There is no saved message to show yet. Save this one, create the message you want to show, then pick it here.</p>
	{/if}
</div>
