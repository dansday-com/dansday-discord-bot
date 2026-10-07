<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import ModerationRules from '$lib/frontend/components/ModerationRules.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<div class="bg-ash-800 border-ash-700 space-y-5 rounded-xl border p-4 sm:p-6">
	<h3 class="text-ash-100 flex items-center gap-2 text-base font-semibold">
		<i class="fas fa-gavel text-red-400"></i>Moderation
	</h3>
	<p class="text-ash-400 text-xs">Warning expiry, auto-escalation and reason presets.</p>

	<ModerationRules serverId={data.serverId} rules={data.rules} onsaved={() => invalidateAll()} />
</div>
