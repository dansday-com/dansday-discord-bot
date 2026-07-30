<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { showToast } from '$lib/frontend/toast.svelte';
	import LabeledSelect from '$lib/frontend/components/LabeledSelect.svelte';
	import ConfigToggleRow from '$lib/frontend/components/ConfigToggleRow.svelte';
	import type { LabeledSelectOption } from '$lib/frontend/components/labeledSelect.js';
	import type { PageProps } from './$types';

	const AI_REASONING_OPTIONS: LabeledSelectOption[] = [
		{ value: 'none', label: 'Off' },
		{ value: 'low', label: 'Low' },
		{ value: 'medium', label: 'Medium' },
		{ value: 'high', label: 'High' },
		{ value: 'xhigh', label: 'Extra high' }
	];

	let { data }: PageProps = $props();

	function aiFromServer(a: typeof data.botAi) {
		return {
			enabled: a.enabled,
			api_url: a.api_url ?? '',
			model: a.model ?? '',
			system_prompt: a.system_prompt ?? '',
			reasoning: a.reasoning,
			voice_enabled: a.voice_enabled,
			voice_model: a.voice_model ?? '',
			has_api_key: a.has_api_key
		};
	}

	let ai = $state(aiFromServer(data.botAi));
	let aiKeyInput = $state('');
	let savingAi = $state(false);

	$effect(() => {
		ai = aiFromServer(data.botAi);
		aiKeyInput = '';
	});

	async function saveAi() {
		savingAi = true;
		try {
			const res = await fetch(`/api/bots/${data.bot.id}/ai`, {
				method: 'PATCH',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					enabled: ai.enabled,
					api_url: ai.api_url.trim() === '' ? null : ai.api_url.trim(),
					api_key: aiKeyInput.trim() === '' ? null : aiKeyInput.trim(),
					model: ai.model.trim() === '' ? null : ai.model.trim(),
					system_prompt: ai.system_prompt.trim() === '' ? null : ai.system_prompt.trim(),
					reasoning: ai.reasoning,
					voice_enabled: ai.voice_enabled,
					voice_model: ai.voice_model.trim() === '' ? null : ai.voice_model.trim()
				})
			});
			const d = await res.json();
			if (!res.ok) {
				showToast(d.error || 'Failed to save AI settings', 'error');
				return;
			}
			showToast('AI settings saved', 'success');
			await invalidateAll();
		} finally {
			savingAi = false;
		}
	}
</script>

<div class="bg-ash-800 border-ash-700 rounded-xl border p-4 sm:p-6">
	<h3 class="text-ash-100 mb-1 text-lg font-semibold">
		<i class="fas fa-robot mr-2 text-violet-400"></i>AI chat
	</h3>
	<p class="text-ash-400 mb-4 text-sm">
		Members talk to the bot by mentioning it, or by replying to its messages. Each member keeps their own conversation in every server. Requires an
		<strong class="text-ash-300">OpenAI-compatible</strong> endpoint. Restart the bot to apply changes.
	</p>

	<ConfigToggleRow
		label="Enable AI chat"
		description="When off, mentions and replies are ignored. Needs API URL, key and model to turn on."
		labelIconClass="fas fa-robot text-violet-400"
		bind:enabled={ai.enabled}
		ariaLabel="Toggle AI chat"
	/>

	<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
		<div class="min-w-0 sm:col-span-2">
			<label for="ai-api-url" class="text-ash-400 mb-1 block text-xs">API URL</label>
			<input
				id="ai-api-url"
				type="text"
				inputmode="url"
				autocomplete="off"
				bind:value={ai.api_url}
				placeholder="https://generativelanguage.googleapis.com/v1beta/openai"
				class="bg-ash-700 border-ash-600 text-ash-100 placeholder:text-ash-500 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
			/>
		</div>
		<div class="min-w-0">
			<label for="ai-model" class="text-ash-400 mb-1 block text-xs">Model name</label>
			<input
				id="ai-model"
				type="text"
				maxlength="191"
				autocomplete="off"
				bind:value={ai.model}
				placeholder="gemini-3.6-flash"
				class="bg-ash-700 border-ash-600 text-ash-100 placeholder:text-ash-500 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
			/>
		</div>
		<div class="min-w-0">
			<LabeledSelect
				id="ai-reasoning"
				label="Reasoning"
				labelIconClass="fas fa-brain text-violet-400"
				labelTone="cyan"
				appearance="dashboard"
				options={AI_REASONING_OPTIONS}
				bind:value={ai.reasoning}
				ariaLabel="AI reasoning effort"
			/>
		</div>
		<div class="min-w-0">
			<label for="ai-api-key" class="text-ash-400 mb-1 block text-xs">API key</label>
			<input
				id="ai-api-key"
				type="password"
				autocomplete="new-password"
				bind:value={aiKeyInput}
				placeholder={ai.has_api_key ? 'Saved — type to replace' : 'Paste your API key'}
				class="bg-ash-700 border-ash-600 text-ash-100 placeholder:text-ash-500 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
			/>
		</div>
		<div class="sm:col-span-2">
			<label for="ai-system-prompt" class="text-ash-400 mb-1 block text-xs">System prompt</label>
			<p class="text-ash-500 mb-1 text-xs">
				Applies to both chat and voice. Use <code class="text-ash-300">&#123;&#123;today&#125;&#125;</code> to insert the current date.
			</p>
			<textarea
				id="ai-system-prompt"
				rows="4"
				maxlength="8000"
				bind:value={ai.system_prompt}
				placeholder="Describe how the bot should behave and reply"
				class="bg-ash-700 border-ash-600 text-ash-100 placeholder:text-ash-500 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
			></textarea>
		</div>
	</div>

	<div class="border-ash-700 mt-6 border-t pt-5">
		<h4 class="text-ash-100 mb-1 text-base font-semibold">
			<i class="fas fa-microphone mr-2 text-violet-400"></i>Voice AI
		</h4>
		<p class="text-ash-400 mb-4 text-sm">
			Members ask the bot in chat to join their voice channel, then talk to it out loud. Uses the
			<strong class="text-ash-300">Gemini Live API</strong> with the API key above, so that key must be a Google AI key. One voice session at a time.
		</p>

		<ConfigToggleRow
			label="Enable voice AI"
			description="Lets members ask the bot to join voice. Needs AI chat on, plus an API key and voice model."
			labelIconClass="fas fa-microphone text-violet-400"
			bind:enabled={ai.voice_enabled}
			ariaLabel="Toggle voice AI"
		/>

		<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
			<div class="min-w-0">
				<label for="ai-voice-model" class="text-ash-400 mb-1 block text-xs">Voice model</label>
				<input
					id="ai-voice-model"
					type="text"
					maxlength="191"
					autocomplete="off"
					bind:value={ai.voice_model}
					placeholder="gemini-3.1-flash-live-preview"
					class="bg-ash-700 border-ash-600 text-ash-100 placeholder:text-ash-500 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
				/>
			</div>
		</div>

		<p class="mt-3 flex items-start gap-2 text-xs text-amber-200/90">
			<i class="fas fa-triangle-exclamation mt-0.5 shrink-0 text-amber-400/90" aria-hidden="true"></i>
			<span>
				Voice sends everyone's audio in the channel to Google. On the free tier that audio is used to improve their products. Tell your members before turning
				this on.
			</span>
		</p>
	</div>

	<div class="mt-4 flex flex-wrap items-center gap-3">
		<button
			type="button"
			onclick={saveAi}
			disabled={savingAi}
			class="text-ash-100 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
		>
			{#if savingAi}
				<i class="fas fa-spinner fa-spin mr-2"></i>Saving…
			{:else}
				<i class="fas fa-save mr-2"></i>Save AI settings
			{/if}
		</button>
	</div>
</div>
