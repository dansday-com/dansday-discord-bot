<script lang="ts">
	import { getContext } from 'svelte';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import LocalTime from '$lib/frontend/components/LocalTime.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const ctx = getContext('items') as any;
	const { fmt } = ctx;

	const p = $derived(data.profile);

	function rolePillVars(color: string | null): string {
		if (!color) return '';
		return `--role-color: ${color};`;
	}
</script>

<svelte:head><title>{data.server.name || data.server.slug} Account | {APP_NAME} Discord Bot</title></svelte:head>

<div class="m-ov">
	<div class="m-stat-card m-overview-card m-ov-full">
		<div class="m-stat-card-head">
			<div class="m-stat-card-icon m-chili-stat-1"><i class="fas fa-id-card"></i></div>
			<h2 class="m-stat-card-title">Membership</h2>
		</div>
		<div class="m-mini-grid">
			<div class="m-mini">
				<i class="fas fa-calendar-check"></i>
				<span class="m-mini-value"><LocalTime value={p.joined} fallback="—" /></span>
				<span class="m-mini-label">Joined server</span>
			</div>
			<div class="m-mini">
				<i class="fab fa-discord"></i>
				<span class="m-mini-value"><LocalTime value={p.discordSince} fallback="—" /></span>
				<span class="m-mini-label">On Discord since</span>
			</div>
			<div class="m-mini">
				<i class="fas fa-gem"></i>
				<span class="m-mini-value">{p.isBooster ? 'Yes' : 'No'}</span>
				<span class="m-mini-label">Server booster</span>
			</div>
			{#if p.isBooster && p.boosterSince}
				<div class="m-mini">
					<i class="fas fa-heart"></i>
					<span class="m-mini-value"><LocalTime value={p.boosterSince} fallback="—" /></span>
					<span class="m-mini-label">Boosting since</span>
				</div>
			{/if}
			<div class="m-mini">
				<i class="fas fa-ranking-star"></i>
				<span class="m-mini-value">{data.balance?.rank ? `#${fmt(data.balance.rank)}` : '—'}</span>
				<span class="m-mini-label">Server rank</span>
			</div>
			<div class="m-mini">
				<i class="fas fa-moon"></i>
				<span class="m-mini-value">{p.isAfk ? 'AFK' : 'Active'}</span>
				<span class="m-mini-label">Status</span>
			</div>
		</div>
	</div>

	<div class="m-stat-card m-overview-card m-ov-full">
		<div class="m-stat-card-head">
			<div class="m-stat-card-icon m-chili-stat-5"><i class="fas fa-microphone-alt"></i></div>
			<h2 class="m-stat-card-title">Activity</h2>
		</div>
		<div class="m-mini-grid">
			<div class="m-mini">
				<i class="fas fa-comments"></i>
				<span class="m-mini-value">{fmt(p.chatTotal)}</span>
				<span class="m-mini-label">Messages</span>
			</div>
			<div class="m-mini">
				<i class="fas fa-check-circle"></i>
				<span class="m-mini-value">{fmt(p.voiceActive)}</span>
				<span class="m-mini-label">Voice min</span>
			</div>
			<div class="m-mini">
				<i class="fas fa-pause-circle"></i>
				<span class="m-mini-value">{fmt(p.voiceAfk)}</span>
				<span class="m-mini-label">AFK min</span>
			</div>
			<div class="m-mini">
				<i class="fas fa-video"></i>
				<span class="m-mini-value">{fmt(p.voiceVideo)}</span>
				<span class="m-mini-label">Video min</span>
			</div>
			<div class="m-mini">
				<i class="fas fa-desktop"></i>
				<span class="m-mini-value">{fmt(p.voiceStreaming)}</span>
				<span class="m-mini-label">Stream min</span>
			</div>
		</div>
	</div>

	{#if p.roles.length > 0}
		<div class="m-stat-card m-overview-card m-ov-full">
			<div class="m-stat-card-head">
				<div class="m-stat-card-icon m-chili-stat-4"><i class="fas fa-user-tag"></i></div>
				<h2 class="m-stat-card-title">Roles</h2>
			</div>
			<div class="m-ov-roles">
				{#each p.roles as role}
					<span class="m-ov-role" style={rolePillVars(role.color)}>
						<i class="fas fa-circle"></i>{role.name || 'Role'}
					</span>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.m-ov {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 16px;
		align-items: start;
	}
	.m-ov-full {
		grid-column: 1 / -1;
	}
	.m-ov-roles {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 14px;
	}
	.m-ov-role {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 5px 12px;
		border-radius: 99px;
		font-size: 12px;
		font-weight: 600;
		color: var(--lb-text);
		background: rgba(255, 255, 255, 0.65);
		border: 1px solid var(--lb-border-light);
	}
	.m-ov-role i {
		font-size: 8px;
		color: var(--role-color, var(--chili-hot));
	}
</style>
