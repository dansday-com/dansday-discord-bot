<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';
	import { showToast } from '$lib/frontend/toast.svelte';
	import type { LabeledSelectOption } from '$lib/frontend/components/labeledSelect.js';
	import { GEMINI_VOICES } from '$lib/geminiVoices.js';
	import { SERVER_AI_SYSTEM_PROMPT_MAX } from '$lib/server-ai-settings.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const fallback = $derived(data.botFallback);

	const VOICE_OPTIONS: LabeledSelectOption[] = $derived([
		{ value: '', label: fallback.voice_name ? `None — bot voice (${fallback.voice_name})` : 'None — bot default voice' },
		...GEMINI_VOICES.map((v) => ({ value: v.name, label: `${v.name} — ${v.tone}` }))
	]);

	let systemPrompt = $state(data.settings.system_prompt ?? '');
	let voiceSystemPrompt = $state(data.settings.voice_system_prompt ?? '');
	let voiceName = $state(data.settings.voice_name ?? '');
	let saving = $state(false);

	const blankToNull = (value: string) => (value.trim() === '' ? null : value.trim());

	async function save() {
		saving = true;
		try {
			const res = await fetch(`/api/servers/${data.serverId}/settings`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					component: SERVER_SETTINGS.component.ai,
					system_prompt: blankToNull(systemPrompt),
					voice_system_prompt: blankToNull(voiceSystemPrompt),
					voice_name: blankToNull(voiceName)
				})
			});
			const d = await res.json();
			if (d.success) {
				showToast('Saved', 'success');
				invalidateAll();
			} else showToast(d.error || 'Failed to save', 'error');
		} finally {
			saving = false;
		}
	}
</script>

<div class="bg-ash-800 border-ash-700 space-y-5 rounded-xl border p-4 sm:p-6">
	<h3 class="text-ash-100 flex items-center gap-2 text-base font-semibold">
		<i class="fas fa-robot text-violet-400"></i>AI
	</h3>
	<p class="text-ash-400 text-xs">Give the bot its own personality and voice in this server. Anything left blank falls back to the bot-wide AI settings.</p>

	<div class="min-w-0">
		<label for="server-ai-system-prompt" class="text-ash-400 mb-1.5 block text-xs font-medium">Chat system prompt</label>
		<textarea
			id="server-ai-system-prompt"
			rows="5"
			maxlength={SERVER_AI_SYSTEM_PROMPT_MAX}
			bind:value={systemPrompt}
			placeholder={fallback.system_prompt ?? 'Describe how the bot should behave and reply in this server'}
			class="bg-ash-700 border-ash-600 text-ash-100 placeholder:text-ash-500 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
		></textarea>
		<p class="text-ash-500 mt-1.5 text-xs">
			Replaces the bot prompt for mentions and replies here. Use <code class="text-ash-300">&#123;&#123;today&#125;&#125;</code> to insert the current date.
		</p>
	</div>

	<div class="min-w-0">
		<label for="server-ai-voice-system-prompt" class="text-ash-400 mb-1.5 block text-xs font-medium">Voice system prompt</label>
		<textarea
			id="server-ai-voice-system-prompt"
			rows="5"
			maxlength={SERVER_AI_SYSTEM_PROMPT_MAX}
			bind:value={voiceSystemPrompt}
			placeholder={fallback.voice_system_prompt ?? 'Describe how the bot should behave and reply out loud in this server'}
			class="bg-ash-700 border-ash-600 text-ash-100 placeholder:text-ash-500 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
		></textarea>
		<p class="text-ash-500 mt-1.5 text-xs">Voice only. Applies the next time the bot joins a voice channel here.</p>
	</div>

	<div class="min-w-0 sm:max-w-xs">
		<label for="server-ai-voice-name" class="text-ash-400 mb-1.5 block text-xs font-medium">Voice</label>
		<select
			id="server-ai-voice-name"
			bind:value={voiceName}
			class="bg-ash-700 border-ash-600 text-ash-100 h-10 w-full rounded-lg border px-3 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
		>
			{#each VOICE_OPTIONS as option}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>
		<p class="text-ash-500 mt-1.5 text-xs">Preview every voice in Google AI Studio before picking.</p>
	</div>

	<button
		onclick={save}
		disabled={saving}
		class="bg-ash-500 hover:bg-ash-400 text-ash-100 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all disabled:opacity-50"
	>
		{#if saving}<i class="fas fa-spinner fa-spin"></i>{/if}
		{saving ? 'Saving...' : 'Save Configuration'}
	</button>
</div>
