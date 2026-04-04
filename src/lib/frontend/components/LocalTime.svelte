<script lang="ts">
	import { browser } from '$app/environment';
	import { formatDbDateTime, formatDbDateTimeLocal, dbUtcValueToIso } from '$lib/utils/datetime.js';

	interface Props {
		value: unknown;
		includeSeconds?: boolean;
		fallback?: string;
		class?: string;
	}

	let { value, includeSeconds = false, fallback = '—', class: className = '' }: Props = $props();

	const utcText = $derived.by(() => {
		if (value == null || value === '') return fallback;
		const s = formatDbDateTime(value, includeSeconds);
		return s === '—' ? fallback : s;
	});

	let localText = $state<string | null>(null);

	$effect(() => {
		if (!browser) {
			localText = null;
			return;
		}
		if (value == null || value === '') {
			localText = null;
			return;
		}
		const s = formatDbDateTimeLocal(value, includeSeconds);
		localText = s === '—' ? null : s;
	});

	const displayed = $derived(localText ?? utcText);
	const iso = $derived(dbUtcValueToIso(value));
	const title = $derived(iso ? `UTC: ${utcText}` : undefined);
</script>

{#if iso}
	<time {title} datetime={iso} class={className}>{displayed}</time>
{:else}
	<span class={className}>{fallback}</span>
{/if}
