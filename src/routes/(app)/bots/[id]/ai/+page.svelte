<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { showToast } from '$lib/frontend/toast.svelte';
	import ConfigToggleRow from '$lib/frontend/components/ConfigToggleRow.svelte';
	import type { LabeledSelectOption } from '$lib/frontend/components/labeledSelect.js';
	import { GEMINI_VOICES } from '$lib/geminiVoices.js';
	import type { PageProps } from './$types';

	const AI_VOICE_OPTIONS: LabeledSelectOption[] = [
		{ value: '', label: 'Default' },
		...GEMINI_VOICES.map((v) => ({ value: v.name, label: `${v.name} — ${v.tone}` }))
	];

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
			voice_name: a.voice_name ?? '',
			voice_api_url: a.voice_api_url ?? '',
			voice_system_prompt: a.voice_system_prompt ?? '',
			search_api_url: a.search_api_url ?? '',
			search_model: a.search_model ?? '',
			fetch_api_url: a.fetch_api_url ?? '',
			fetch_model: a.fetch_model ?? '',
			image_api_url: a.image_api_url ?? '',
			image_model: a.image_model ?? '',
			has_api_key: a.has_api_key,
			has_voice_api_key: a.has_voice_api_key,
			has_search_api_key: a.has_search_api_key,
			has_fetch_api_key: a.has_fetch_api_key,
			has_image_api_key: a.has_image_api_key
		};
	}

	let ai = $state(aiFromServer(data.botAi));
	let aiKeyInput = $state('');
	let voiceKeyInput = $state('');
	let searchKeyInput = $state('');
	let fetchKeyInput = $state('');
	let imageKeyInput = $state('');
	let savingAi = $state(false);

	$effect(() => {
		ai = aiFromServer(data.botAi);
		aiKeyInput = '';
		voiceKeyInput = '';
		searchKeyInput = '';
		fetchKeyInput = '';
		imageKeyInput = '';
	});

	const blankToNull = (value: string) => (value.trim() === '' ? null : value.trim());

	async function saveAi() {
		savingAi = true;
		try {
			const res = await fetch(`/api/bots/${data.bot.id}/ai`, {
				method: 'PATCH',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					enabled: ai.enabled,
					api_url: blankToNull(ai.api_url),
					api_key: blankToNull(aiKeyInput),
					model: blankToNull(ai.model),
					system_prompt: blankToNull(ai.system_prompt),
					reasoning: ai.reasoning,
					voice_enabled: ai.voice_enabled,
					voice_model: blankToNull(ai.voice_model),
					voice_name: blankToNull(ai.voice_name),
					voice_api_url: blankToNull(ai.voice_api_url),
					voice_api_key: blankToNull(voiceKeyInput),
					voice_system_prompt: blankToNull(ai.voice_system_prompt),
					search_api_url: blankToNull(ai.search_api_url),
					search_api_key: blankToNull(searchKeyInput),
					search_model: blankToNull(ai.search_model),
					fetch_api_url: blankToNull(ai.fetch_api_url),
					fetch_api_key: blankToNull(fetchKeyInput),
					fetch_model: blankToNull(ai.fetch_model),
					image_api_url: blankToNull(ai.image_api_url),
					image_api_key: blankToNull(imageKeyInput),
					image_model: blankToNull(ai.image_model)
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

	<div class="mt-5 space-y-4">
		<div class="min-w-0">
			<label for="ai-api-url" class="text-ash-400 mb-1.5 block text-xs font-medium">API URL</label>
			<input
				id="ai-api-url"
				type="text"
				inputmode="url"
				autocomplete="off"
				bind:value={ai.api_url}
				placeholder="https://generativelanguage.googleapis.com/v1beta/openai"
				class="bg-ash-700 border-ash-600 text-ash-100 placeholder:text-ash-500 h-10 w-full rounded-lg border px-3 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
			/>
		</div>

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<div class="min-w-0">
				<label for="ai-model" class="text-ash-400 mb-1.5 block text-xs font-medium">Model name</label>
				<input
					id="ai-model"
					type="text"
					maxlength="191"
					autocomplete="off"
					bind:value={ai.model}
					placeholder="gemini-3.6-flash"
					class="bg-ash-700 border-ash-600 text-ash-100 placeholder:text-ash-500 h-10 w-full rounded-lg border px-3 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
				/>
			</div>
			<div class="min-w-0">
				<label for="ai-api-key" class="text-ash-400 mb-1.5 block text-xs font-medium">API key</label>
				<input
					id="ai-api-key"
					type="password"
					autocomplete="new-password"
					bind:value={aiKeyInput}
					placeholder={ai.has_api_key ? 'Saved — type to replace' : 'Paste your API key'}
					class="bg-ash-700 border-ash-600 text-ash-100 placeholder:text-ash-500 h-10 w-full rounded-lg border px-3 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
				/>
			</div>
		</div>

		<div class="min-w-0 sm:max-w-xs">
			<label for="ai-reasoning" class="text-ash-400 mb-1.5 block text-xs font-medium">Reasoning</label>
			<select
				id="ai-reasoning"
				bind:value={ai.reasoning}
				class="bg-ash-700 border-ash-600 text-ash-100 h-10 w-full rounded-lg border px-3 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
			>
				{#each AI_REASONING_OPTIONS as option}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
		</div>

		<div class="min-w-0">
			<label for="ai-system-prompt" class="text-ash-400 mb-1.5 block text-xs font-medium">System prompt</label>
			<textarea
				id="ai-system-prompt"
				rows="5"
				maxlength="8000"
				bind:value={ai.system_prompt}
				placeholder="Describe how the bot should behave and reply"
				class="bg-ash-700 border-ash-600 text-ash-100 placeholder:text-ash-500 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
			></textarea>
			<p class="text-ash-500 mt-1.5 text-xs">
				Chat only — voice has its own below. Use <code class="text-ash-300">&#123;&#123;today&#125;&#125;</code> to insert the current date.
			</p>
		</div>
	</div>

	<div class="border-ash-700 mt-6 border-t pt-5">
		<h4 class="text-ash-100 mb-1 text-base font-semibold">
			<i class="fas fa-microphone mr-2 text-violet-400"></i>Voice AI
		</h4>
		<p class="text-ash-400 mb-4 text-sm">
			Members ask the bot in chat to join their voice channel, then talk to it out loud. Uses the
			<strong class="text-ash-300">Gemini Live API</strong>, so its key must be a Google AI key. One voice session at a time.
		</p>

		<ConfigToggleRow
			label="Enable voice AI"
			description="Lets members ask the bot to join voice. Needs AI chat on, plus an API key and voice model."
			labelIconClass="fas fa-microphone text-violet-400"
			bind:enabled={ai.voice_enabled}
			ariaLabel="Toggle voice AI"
		/>

		<div class="mt-5 space-y-4">
			<div class="min-w-0">
				<label for="ai-voice-api-url" class="text-ash-400 mb-1.5 block text-xs font-medium">API URL</label>
				<input
					id="ai-voice-api-url"
					type="text"
					inputmode="url"
					autocomplete="off"
					bind:value={ai.voice_api_url}
					placeholder="Blank — reuse the AI chat API URL"
					class="bg-ash-700 border-ash-600 text-ash-100 placeholder:text-ash-500 h-10 w-full rounded-lg border px-3 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
				/>
			</div>

			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div class="min-w-0">
					<label for="ai-voice-model" class="text-ash-400 mb-1.5 block text-xs font-medium">Voice model</label>
					<input
						id="ai-voice-model"
						type="text"
						maxlength="191"
						autocomplete="off"
						bind:value={ai.voice_model}
						placeholder="gemini-3.1-flash-live-preview"
						class="bg-ash-700 border-ash-600 text-ash-100 placeholder:text-ash-500 h-10 w-full rounded-lg border px-3 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
					/>
				</div>
				<div class="min-w-0">
					<label for="ai-voice-api-key" class="text-ash-400 mb-1.5 block text-xs font-medium">API key</label>
					<input
						id="ai-voice-api-key"
						type="password"
						autocomplete="new-password"
						bind:value={voiceKeyInput}
						placeholder={ai.has_voice_api_key ? 'Saved — type to replace' : 'Blank — reuse the AI chat key'}
						class="bg-ash-700 border-ash-600 text-ash-100 placeholder:text-ash-500 h-10 w-full rounded-lg border px-3 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
					/>
				</div>
			</div>

			<div class="min-w-0 sm:max-w-xs">
				<label for="ai-voice-name" class="text-ash-400 mb-1.5 block text-xs font-medium">Voice</label>
				<select
					id="ai-voice-name"
					bind:value={ai.voice_name}
					class="bg-ash-700 border-ash-600 text-ash-100 h-10 w-full rounded-lg border px-3 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
				>
					{#each AI_VOICE_OPTIONS as option}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
				<p class="text-ash-500 mt-1.5 text-xs">Preview every voice in Google AI Studio before picking.</p>
			</div>

			<div class="min-w-0">
				<label for="ai-voice-system-prompt" class="text-ash-400 mb-1.5 block text-xs font-medium">System prompt</label>
				<textarea
					id="ai-voice-system-prompt"
					rows="5"
					maxlength="8000"
					bind:value={ai.voice_system_prompt}
					placeholder="Blank — reuse the AI chat system prompt"
					class="bg-ash-700 border-ash-600 text-ash-100 placeholder:text-ash-500 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
				></textarea>
				<p class="text-ash-500 mt-1.5 text-xs">
					Voice only. Use <code class="text-ash-300">&#123;&#123;today&#125;&#125;</code> to insert the current date.
				</p>
			</div>
		</div>

		<p class="mt-4 flex items-start gap-2 text-xs text-amber-200/90">
			<i class="fas fa-triangle-exclamation mt-0.5 shrink-0 text-amber-400/90" aria-hidden="true"></i>
			<span>
				Voice sends everyone's audio in the channel to Google. On the free tier that audio is used to improve their products. Tell your members before turning
				this on.
			</span>
		</p>
	</div>

	<div class="border-ash-700 mt-6 border-t pt-5">
		<h4 class="text-ash-100 mb-1 text-base font-semibold">
			<i class="fas fa-magnifying-glass mr-2 text-violet-400"></i>Web search
		</h4>
		<p class="text-ash-400 mb-4 text-sm">Lets the bot look things up on the web. Fill all three to enable it.</p>

		<div class="space-y-4">
			<div class="min-w-0">
				<label for="ai-search-api-url" class="text-ash-400 mb-1.5 block text-xs font-medium">API URL</label>
				<input
					id="ai-search-api-url"
					type="text"
					inputmode="url"
					autocomplete="off"
					bind:value={ai.search_api_url}
					placeholder="https://router.dansday.com/v1/search"
					class="bg-ash-700 border-ash-600 text-ash-100 placeholder:text-ash-500 h-10 w-full rounded-lg border px-3 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
				/>
			</div>

			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div class="min-w-0">
					<label for="ai-search-model" class="text-ash-400 mb-1.5 block text-xs font-medium">Model name</label>
					<input
						id="ai-search-model"
						type="text"
						maxlength="191"
						autocomplete="off"
						bind:value={ai.search_model}
						placeholder="searxng"
						class="bg-ash-700 border-ash-600 text-ash-100 placeholder:text-ash-500 h-10 w-full rounded-lg border px-3 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
					/>
				</div>
				<div class="min-w-0">
					<label for="ai-search-api-key" class="text-ash-400 mb-1.5 block text-xs font-medium">API key</label>
					<input
						id="ai-search-api-key"
						type="password"
						autocomplete="new-password"
						bind:value={searchKeyInput}
						placeholder={ai.has_search_api_key ? 'Saved — type to replace' : 'Paste your API key'}
						class="bg-ash-700 border-ash-600 text-ash-100 placeholder:text-ash-500 h-10 w-full rounded-lg border px-3 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
					/>
				</div>
			</div>
		</div>
	</div>

	<div class="border-ash-700 mt-6 border-t pt-5">
		<h4 class="text-ash-100 mb-1 text-base font-semibold">
			<i class="fas fa-file-lines mr-2 text-violet-400"></i>Web fetch
		</h4>
		<p class="text-ash-400 mb-4 text-sm">Lets the bot read a page it was given a link to. Fill all three to enable it.</p>

		<div class="space-y-4">
			<div class="min-w-0">
				<label for="ai-fetch-api-url" class="text-ash-400 mb-1.5 block text-xs font-medium">API URL</label>
				<input
					id="ai-fetch-api-url"
					type="text"
					inputmode="url"
					autocomplete="off"
					bind:value={ai.fetch_api_url}
					placeholder="https://router.dansday.com/v1/web/fetch"
					class="bg-ash-700 border-ash-600 text-ash-100 placeholder:text-ash-500 h-10 w-full rounded-lg border px-3 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
				/>
			</div>

			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div class="min-w-0">
					<label for="ai-fetch-model" class="text-ash-400 mb-1.5 block text-xs font-medium">Model name</label>
					<input
						id="ai-fetch-model"
						type="text"
						maxlength="191"
						autocomplete="off"
						bind:value={ai.fetch_model}
						placeholder="jina-reader"
						class="bg-ash-700 border-ash-600 text-ash-100 placeholder:text-ash-500 h-10 w-full rounded-lg border px-3 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
					/>
				</div>
				<div class="min-w-0">
					<label for="ai-fetch-api-key" class="text-ash-400 mb-1.5 block text-xs font-medium">API key</label>
					<input
						id="ai-fetch-api-key"
						type="password"
						autocomplete="new-password"
						bind:value={fetchKeyInput}
						placeholder={ai.has_fetch_api_key ? 'Saved — type to replace' : 'Paste your API key'}
						class="bg-ash-700 border-ash-600 text-ash-100 placeholder:text-ash-500 h-10 w-full rounded-lg border px-3 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
					/>
				</div>
			</div>
		</div>
	</div>

	<div class="border-ash-700 mt-6 border-t pt-5">
		<h4 class="text-ash-100 mb-1 text-base font-semibold">
			<i class="fas fa-image mr-2 text-violet-400"></i>Image generation
		</h4>
		<p class="text-ash-400 mb-4 text-sm">Lets the bot draw a picture when a member asks for one. Fill all three to enable it.</p>

		<div class="space-y-4">
			<div class="min-w-0">
				<label for="ai-image-api-url" class="text-ash-400 mb-1.5 block text-xs font-medium">API URL</label>
				<input
					id="ai-image-api-url"
					type="text"
					inputmode="url"
					autocomplete="off"
					bind:value={ai.image_api_url}
					placeholder="https://router.dansday.com/v1/images/generations"
					class="bg-ash-700 border-ash-600 text-ash-100 placeholder:text-ash-500 h-10 w-full rounded-lg border px-3 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
				/>
			</div>

			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div class="min-w-0">
					<label for="ai-image-model" class="text-ash-400 mb-1.5 block text-xs font-medium">Model name</label>
					<input
						id="ai-image-model"
						type="text"
						maxlength="191"
						autocomplete="off"
						bind:value={ai.image_model}
						placeholder="gemini/gemini-3-pro-image-preview"
						class="bg-ash-700 border-ash-600 text-ash-100 placeholder:text-ash-500 h-10 w-full rounded-lg border px-3 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
					/>
				</div>
				<div class="min-w-0">
					<label for="ai-image-api-key" class="text-ash-400 mb-1.5 block text-xs font-medium">API key</label>
					<input
						id="ai-image-api-key"
						type="password"
						autocomplete="new-password"
						bind:value={imageKeyInput}
						placeholder={ai.has_image_api_key ? 'Saved — type to replace' : 'Paste your API key'}
						class="bg-ash-700 border-ash-600 text-ash-100 placeholder:text-ash-500 h-10 w-full rounded-lg border px-3 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
					/>
				</div>
			</div>
		</div>
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
