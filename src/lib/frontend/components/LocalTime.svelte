<script lang="ts">
	import { browser } from '$app/environment';
	import { formatDbDateTime, formatDbDateTimeLocal, dbUtcValueToIso, type TimePrecision } from '$lib/utils/datetime.js';

	interface Props {
		value: unknown;
		precision?: TimePrecision;
		fallback?: string;
		class?: string;
	}

	let { value, precision = 'minute', fallback = '—', class: className = '' }: Props = $props();

	const utcText = $derived.by(() => {
		if (value == null || value === '') {
			return fallback;
		}
		const s = formatDbDateTime(value, precision);
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
		const s = formatDbDateTimeLocal(value, precision);
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
