<script lang="ts">
	import ConfigToggleRow from '$lib/frontend/components/ConfigToggleRow.svelte';
	import { showToast } from '$lib/frontend/toast.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let autoQuest = $state(data.autoQuestEnrollment === true);
	let savingAutoQuest = $state(false);

	async function saveAutoQuest(next: boolean) {
		if (savingAutoQuest) return;
		savingAutoQuest = true;
		try {
			const res = await fetch('/api/panel/settings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ auto_quest: next })
			});
			const d = await res.json();
			if (d.success) {
				showToast(next ? 'Auto quest enrollment enabled' : 'Auto quest enrollment disabled', 'success');
			} else {
				autoQuest = !next;
				showToast(d.error || 'Failed to save', 'error');
			}
		} catch (_) {
			autoQuest = !next;
			showToast('Failed to save', 'error');
		} finally {
			savingAutoQuest = false;
		}
	}
</script>

<div class="mb-4">
	<h2 class="text-ash-100 mb-1 text-xl font-bold sm:text-2xl">
		<i class="fas fa-sliders mr-2 text-sky-400"></i>Settings
	</h2>
	<p class="text-ash-400 text-xs sm:text-sm">Instance-wide switches that apply to every bot and server on this panel.</p>
</div>

<div class="space-y-3 sm:space-y-4 lg:space-y-5">
	<div class="bg-ash-800 border-ash-700 rounded-xl border p-4 sm:p-5">
		<ConfigToggleRow
			label="Auto quest enrollment"
			description="Instance-wide. When on, members can claim open Discord quests by pasting their own user token — a Discord ToS risk they take on their own account. Off by default."
			labelIconClass="fas fa-bolt text-amber-400"
			bind:enabled={autoQuest}
			disabled={savingAutoQuest}
			onchange={saveAutoQuest}
			ariaLabel="Toggle auto quest enrollment for this instance"
		/>
	</div>
</div>
