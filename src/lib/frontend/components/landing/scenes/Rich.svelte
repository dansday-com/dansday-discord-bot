<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';

	let { text, roles = {} }: { text: string; roles?: Record<string, string> } = $props();

	type Token = { kind: 'text' | 'bold' | 'user' | 'role' | 'channel' | 'link'; value: string };

	const TOKEN = /(\*\*.+?\*\*|<@&[^>]+>|<@[^>]+>|<#[^>]+>|\[[^\]]+\]\([^)]*\))/g;

	const tokens = $derived(
		text
			.split(TOKEN)
			.filter(Boolean)
			.map((part): Token => {
				if (part.startsWith('**')) return { kind: 'bold', value: part.slice(2, -2) };
				if (part.startsWith('<@&')) return { kind: 'role', value: part.slice(3, -1) };
				if (part.startsWith('<@')) return { kind: 'user', value: part === '<@bot>' ? APP_NAME : part.slice(2, -1) };
				if (part.startsWith('<#')) return { kind: 'channel', value: part.slice(2, -1) };
				if (part.startsWith('[') && part.includes('](')) return { kind: 'link', value: part.slice(1, part.indexOf('](')) };
				return { kind: 'text', value: part };
			})
	);
</script>

{#each tokens as token, i (i)}{#if token.kind === 'bold'}<strong class="font-semibold">{token.value}</strong>{:else if token.kind === 'user'}<span
			class="rounded-[3px] bg-[#5865f2]/30 px-0.5 font-medium text-[#c9cdfb]">@{token.value}</span
		>{:else if token.kind === 'channel'}<span class="rounded-[3px] bg-[#5865f2]/30 px-0.5 font-medium text-[#c9cdfb]">#{token.value}</span
		>{:else if token.kind === 'role'}<span
			class="rounded-[3px] px-0.5 font-medium"
			style="color: {roles[token.value] ?? '#c9cdfb'}; background: color-mix(in srgb, {roles[token.value] ?? '#5865f2'} 14%, transparent);">@{token.value}</span
		>{:else if token.kind === 'link'}<span class="text-[#00a8fc]">{token.value}</span>{:else}{token.value}{/if}{/each}
