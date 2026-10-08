<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import LocalTime from '$lib/frontend/components/LocalTime.svelte';
	import MemberActionBar from '$lib/frontend/components/MemberActionBar.svelte';
	import MemberInvitesPanel from '$lib/frontend/components/MemberInvitesPanel.svelte';
	import ModerationMemberRecord from '$lib/frontend/components/ModerationMemberRecord.svelte';
	import { APP_NAME } from '$lib/backend/panelServer.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const TABS = [
		{ id: 'moderation', label: 'Moderation', icon: 'fa-gavel text-red-400' },
		{ id: 'invites', label: 'Invites', icon: 'fa-user-plus text-cyan-400' }
	] as const;

	let tab = $state<(typeof TABS)[number]['id']>('moderation');

	const m = $derived(data.member);
	const targets = $derived([m]);
	const inviteMember = $derived({ id: m.id, name: m.name });
	const fmt = (n: number) => Number(n || 0).toLocaleString();
	const tiles = $derived<{ icon: string; box: string; label: string; value?: string; date?: unknown }[]>([
		{ icon: 'fa-medal text-sky-400', box: 'bg-sky-500/20', label: 'Rank', value: m.rank ? `#${m.rank}` : 'N/A' },
		{ icon: 'fa-trophy text-amber-400', box: 'bg-amber-500/20', label: 'Level', value: String(m.level) },
		{ icon: 'fa-star text-violet-400', box: 'bg-violet-500/20', label: 'XP', value: fmt(m.xp) },
		{ icon: 'fa-comment text-emerald-400', box: 'bg-emerald-500/20', label: 'Chat', value: fmt(m.chat_total) },
		{ icon: 'fa-microphone text-cyan-400', box: 'bg-cyan-500/20', label: 'Voice Active', value: `${fmt(m.voice_minutes_active)}m` },
		{ icon: 'fa-moon text-orange-400', box: 'bg-orange-500/20', label: 'Voice AFK', value: `${fmt(m.voice_minutes_afk)}m` },
		{ icon: 'fa-user-plus text-teal-400', box: 'bg-teal-500/20', label: 'Invites', value: fmt(m.invites) },
		{ icon: 'fa-calendar-alt text-indigo-400', box: 'bg-indigo-500/20', label: 'Member Since', date: m.member_since },
		{ icon: 'fa-id-card text-rose-400', box: 'bg-rose-500/20', label: 'Account Created', date: m.profile_created_at }
	]);

	function roleColor(color: string | null) {
		return color && color !== '#000000' ? color : '#99AAB5';
	}
</script>

<svelte:head>
	<title>{m.name} | {APP_NAME} Discord Bot</title>
</svelte:head>

<div class="space-y-4">
	<section class="bg-ash-800 border-ash-700 rounded-xl border p-4 sm:p-6">
		<div class="flex flex-col items-center gap-4 sm:flex-row">
			<div class="bg-ash-600 border-ash-600 flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2">
				{#if m.avatar}
					<img src={m.avatar} alt="" class="h-full w-full object-cover" />
				{:else}
					<i class="fas fa-user text-ash-400 text-2xl"></i>
				{/if}
			</div>
			<div class="w-full min-w-0 flex-1 text-center sm:text-left">
				<div class="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
					<h2 class="text-ash-100 max-w-full truncate text-lg font-bold">{m.name}</h2>
					{#if m.is_afk}
						<span class="rounded-full bg-yellow-900 px-2 py-0.5 text-xs font-medium text-yellow-200"><i class="fas fa-moon mr-1"></i>AFK</span>
					{/if}
					{#if m.is_booster}
						<span class="rounded-full bg-purple-900 px-2 py-0.5 text-xs font-medium text-purple-200"><i class="fas fa-gem mr-1"></i>Supporter</span>
					{/if}
					{#if !m.here}
						<span class="bg-ash-600 text-ash-300 rounded-full px-2 py-0.5 text-xs font-medium">Left the server</span>
					{/if}
				</div>
				<p class="text-ash-400 mt-1 text-xs break-all">
					{#if m.username}@{m.username} ·
					{/if}<span class="font-mono">{m.id}</span>
				</p>
				{#if m.roles.length > 0}
					<div class="mt-3 flex flex-wrap justify-center gap-1.5 sm:justify-start">
						{#each m.roles as role (role.id)}
							{@const c = roleColor(role.color)}
							<span
								class="flex max-w-full items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium"
								style="background:{c}20;color:{c};border:1px solid {c}40"
							>
								<i class="fas fa-circle text-[0.4rem]"></i><span class="truncate">{role.name}</span>
							</span>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<div class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
			{#each tiles as t (t.label)}
				<div class="bg-ash-700 border-ash-600 flex items-center gap-2 rounded-lg border p-2">
					<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg {t.box}">
						<i class="fas {t.icon} text-xs"></i>
					</div>
					<div class="min-w-0">
						<div class="text-ash-400 truncate text-[0.6rem] tracking-wide uppercase">{t.label}</div>
						<div class="text-ash-100 text-sm font-bold">
							{#if t.value !== undefined}{t.value}{:else}<LocalTime value={t.date} fallback="N/A" />{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>
	</section>

	<div class="bg-ash-800 border-ash-700 grid grid-cols-2 gap-1 rounded-xl border p-1">
		{#each TABS as t (t.id)}
			<button
				type="button"
				onclick={() => (tab = t.id)}
				class="flex items-center justify-center gap-2 rounded-lg px-2 py-2.5 text-sm font-medium transition-colors {tab === t.id
					? 'bg-ash-600 text-ash-100'
					: 'text-ash-400 hover:text-ash-200 hover:bg-ash-700'}"
			>
				<i class="fas {t.icon} text-xs"></i>{t.label}
			</button>
		{/each}
	</div>

	{#if tab === 'moderation'}
		{#if data.canModerate && (m.here || m.banned)}
			<section class="bg-ash-800 border-ash-700 rounded-xl border p-3 sm:p-4">
				<MemberActionBar
					serverId={data.serverId}
					{targets}
					banned={m.banned}
					roles={data.roles}
					presets={data.presets}
					deniedReason={data.deniedReason}
					ondone={() => invalidateAll()}
				/>
			</section>
		{/if}
		{#key data}
			<ModerationMemberRecord
				serverId={data.serverId}
				memberId={m.id}
				canEdit={data.canModerate}
				deniedReason={data.moderationDenied}
				presets={data.presets}
				onchange={() => invalidateAll()}
			/>
		{/key}
	{:else}
		<MemberInvitesPanel
			serverId={data.serverId}
			member={inviteMember}
			canEdit={data.canEdit}
			deniedReason={data.deniedReason}
			onchange={() => invalidateAll()}
		/>
	{/if}
</div>
