<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import LabeledSelect from '$lib/frontend/components/LabeledSelect.svelte';
	import LocalTime from '$lib/frontend/components/LocalTime.svelte';
	import MemberActionBar from '$lib/frontend/components/MemberActionBar.svelte';
	import Pagination from '$lib/frontend/components/Pagination.svelte';
	import { MODERATION_ACTION_META } from '$lib/frontend/moderation.js';
	import { adminServerSectionPath } from '$lib/frontend/redirect.js';
	import { dbDateTimeToMs } from '$lib/utils/datetime.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Row = PageProps['data']['rows'][number];
	type Show = { icon: string; text?: (r: Row) => string; date?: (r: Row) => unknown; gone?: boolean };
	type Sort = { value: string; label: string; by: (r: Row) => number | string; desc?: boolean; show?: Show };

	const PAGE_SIZE = 50;
	const STATUSES = [
		{ id: 'all', label: 'Members', suggest: 'warn' },
		{ id: 'warned', label: 'Warned', suggest: 'clearwarns' },
		{ id: 'timedout', label: 'Timed out', suggest: 'untimeout' },
		{ id: 'banned', label: 'Banned', suggest: 'unban' },
		{ id: 'left', label: 'Left', suggest: 'warn' }
	] as const;
	type Status = (typeof STATUSES)[number]['id'];
	const GROUPS = [
		{ value: 'g:supporter', label: 'Supporters' },
		{ value: 'g:creator', label: 'Content creators' },
		{ value: 'g:staff', label: 'Staff' },
		{ value: 'g:admin', label: 'Admins' }
	];
	const GROUP_CONFIG: Record<string, { section: string; label: string }> = {
		'g:creator': { section: 'config/content-creator', label: 'Open Content Creator configuration' },
		'g:staff': { section: 'config', label: 'Open Main configuration' }
	};

	const fmt = (n: number) => Number(n || 0).toLocaleString();
	const SHOW = {
		rank: { icon: 'fa-medal text-sky-400', text: (r) => (r.rank ? `#${r.rank}` : 'N/A') },
		xp: { icon: 'fa-star text-violet-400', text: (r) => `${fmt(r.xp)} XP` },
		chat: { icon: 'fa-comment text-emerald-400', text: (r) => fmt(r.chat_total) },
		voice: { icon: 'fa-microphone text-cyan-400', text: (r) => `${fmt(r.voice_minutes_active)}m` },
		voiceAfk: { icon: 'fa-moon text-orange-400', text: (r) => `${fmt(r.voice_minutes_afk)}m` },
		joins: { icon: 'fa-right-to-bracket text-sky-400', text: (r) => `${fmt(r.invite_joins)} joined`, gone: true },
		left: { icon: 'fa-user-minus text-amber-400', text: (r) => `${fmt(r.invite_left)} left`, gone: true },
		fake: { icon: 'fa-user-secret text-red-400', text: (r) => `${fmt(r.invite_fake)} fake`, gone: true },
		lastInvite: { icon: 'fa-right-to-bracket text-sky-400', date: (r) => r.last_invite_at, gone: true },
		since: { icon: 'fa-calendar-alt text-indigo-400', date: (r) => r.member_since },
		created: { icon: 'fa-id-card text-rose-400', date: (r) => r.profile_created_at }
	} satisfies Record<string, Show>;
	const SORTS: Sort[] = [
		{ value: 'rank_asc', label: 'Rank (Low → High)', by: (r) => r.rank ?? 9999, show: SHOW.rank },
		{ value: 'rank_desc', label: 'Rank (High → Low)', by: (r) => r.rank ?? 9999, desc: true, show: SHOW.rank },
		{ value: 'level_desc', label: 'Level (High → Low)', by: (r) => r.level, desc: true },
		{ value: 'level_asc', label: 'Level (Low → High)', by: (r) => r.level },
		{ value: 'xp_desc', label: 'XP (High → Low)', by: (r) => r.xp, desc: true, show: SHOW.xp },
		{ value: 'xp_asc', label: 'XP (Low → High)', by: (r) => r.xp, show: SHOW.xp },
		{ value: 'chat_desc', label: 'Chat Messages (High → Low)', by: (r) => r.chat_total, desc: true, show: SHOW.chat },
		{ value: 'chat_asc', label: 'Chat Messages (Low → High)', by: (r) => r.chat_total, show: SHOW.chat },
		{ value: 'voice_active_desc', label: 'Voice Active (High → Low)', by: (r) => r.voice_minutes_active, desc: true, show: SHOW.voice },
		{ value: 'voice_active_asc', label: 'Voice Active (Low → High)', by: (r) => r.voice_minutes_active, show: SHOW.voice },
		{ value: 'voice_afk_desc', label: 'Voice AFK (High → Low)', by: (r) => r.voice_minutes_afk, desc: true, show: SHOW.voiceAfk },
		{ value: 'voice_afk_asc', label: 'Voice AFK (Low → High)', by: (r) => r.voice_minutes_afk, show: SHOW.voiceAfk },
		{ value: 'invites_desc', label: 'Invites (High → Low)', by: (r) => r.invites, desc: true },
		{ value: 'invites_asc', label: 'Invites (Low → High)', by: (r) => r.invites },
		{ value: 'invite_joins', label: 'Invited Joins (Most)', by: (r) => r.invite_joins, desc: true, show: SHOW.joins },
		{ value: 'invite_left', label: 'Invited Who Left (Most)', by: (r) => r.invite_left, desc: true, show: SHOW.left },
		{ value: 'invite_fake', label: 'Fake Invites (Most)', by: (r) => r.invite_fake, desc: true, show: SHOW.fake },
		{ value: 'invite_recent', label: 'Latest Invited Join', by: (r) => dbDateTimeToMs(r.last_invite_at), desc: true, show: SHOW.lastInvite },
		{ value: 'name_asc', label: 'Name (A-Z)', by: (r) => (r.username ?? r.name).toLowerCase() },
		{ value: 'name_desc', label: 'Name (Z-A)', by: (r) => (r.username ?? r.name).toLowerCase(), desc: true },
		{ value: 'member_since_asc', label: 'Member Since (Oldest First)', by: (r) => dbDateTimeToMs(r.member_since), show: SHOW.since },
		{ value: 'member_since_desc', label: 'Member Since (Newest First)', by: (r) => dbDateTimeToMs(r.member_since), desc: true, show: SHOW.since },
		{ value: 'account_created_asc', label: 'Account Created (Oldest First)', by: (r) => dbDateTimeToMs(r.profile_created_at), show: SHOW.created },
		{
			value: 'account_created_desc',
			label: 'Account Created (Newest First)',
			by: (r) => dbDateTimeToMs(r.profile_created_at),
			desc: true,
			show: SHOW.created
		},
		{ value: 'afk_first', label: 'AFK Status (AFK First)', by: (r) => (r.is_afk ? 1 : 0), desc: true },
		{ value: 'afk_last', label: 'AFK Status (Non-AFK First)', by: (r) => (r.is_afk ? 1 : 0) }
	];

	let status = $state<Status>('all');
	let search = $state('');
	let who = $state('');
	let sortBy = $state('rank_asc');
	let page = $state(1);
	let selected = $state<Set<string>>(new Set());

	const base = $derived(adminServerSectionPath(data.botId, data.serverId, 'members'));
	const q = $derived(search.trim().toLowerCase());
	const sort = $derived(SORTS.find((s) => s.value === sortBy) ?? SORTS[0]);
	const roleById = $derived(new Map(data.roles.map((r) => [r.id, r])));
	const gone = $derived(status === 'banned' || status === 'left');
	const whoOptions = $derived([{ value: '', label: 'Everyone' }, ...GROUPS, ...data.roles.map((r) => ({ value: r.id, label: r.name }))]);
	const groupIds = $derived(who.startsWith('g:') ? ((data.groups as Record<string, string[]>)[who.slice(2)] ?? null) : null);
	const groupUnset = $derived(!gone && !!GROUP_CONFIG[who] && groupIds?.length === 0);

	const tabs = $derived(STATUSES.map((s) => ({ ...s, count: data.rows.filter((r) => inStatus(r, s.id)).length })));
	const rows = $derived(
		data.rows
			.filter(
				(r) =>
					inStatus(r, status) &&
					(gone || inGroup(r)) &&
					(!q || r.name.toLowerCase().includes(q) || (r.username ?? '').toLowerCase().includes(q) || r.id.includes(q))
			)
			.sort((a, b) => {
				const x = sort.by(a);
				const y = sort.by(b);
				const d = typeof x === 'string' ? x.localeCompare(String(y)) : x - Number(y);
				return sort.desc ? -d : d;
			})
	);
	const totalPages = $derived(Math.max(1, Math.ceil(rows.length / PAGE_SIZE)));
	const current = $derived(Math.min(page, totalPages));
	const pageRows = $derived(rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE));
	const pickable = $derived(status === 'left' ? [] : rows.filter((r) => !r.locked).map((r) => r.id));
	const pageIds = $derived(status === 'left' ? [] : pageRows.filter((r) => !r.locked).map((r) => r.id));
	const pageAllSelected = $derived(pageIds.length > 0 && pageIds.every((id) => selected.has(id)));
	const targets = $derived(data.rows.filter((r) => selected.has(r.id)));

	$effect(() => {
		void search;
		void who;
		void sortBy;
		page = 1;
	});

	function inStatus(r: Row, s: Status) {
		if (s === 'banned') return r.ban !== null;
		if (s === 'left') return !r.here && r.ban === null;
		if (!r.here) return false;
		if (s === 'warned') return r.warnings > 0;
		if (s === 'timedout') return r.timeout_until !== null;
		return true;
	}

	function inGroup(r: Row) {
		if (!who) return true;
		if (who === 'g:supporter') return r.is_booster;
		const ids = groupIds ?? [who];
		return r.role_ids.some((id) => ids.includes(id));
	}

	function setStatus(next: Status) {
		status = next;
		page = 1;
		selected = new Set();
	}

	function toggle(id: string) {
		const next = new Set(selected);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selected = next;
	}

	function togglePage() {
		const next = new Set(selected);
		if (pageAllSelected) for (const id of pageIds) next.delete(id);
		else for (const id of pageIds) next.add(id);
		selected = next;
	}

	function roleDot(color: string | null) {
		return `background-color: ${color && color !== '#000000' ? color : 'var(--color-ash-400)'}`;
	}

	async function done(failedIds: string[]) {
		selected = new Set(failedIds);
		await invalidateAll();
	}
</script>

<section class="bg-ash-800 border-ash-700 rounded-xl border p-3 sm:p-6">
	<div class="bg-ash-900/40 border-ash-700 mb-4 flex gap-1 overflow-x-auto rounded-lg border p-1">
		{#each tabs as t (t.id)}
			<button
				type="button"
				onclick={() => setStatus(t.id)}
				class="flex flex-1 shrink-0 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors {status ===
				t.id
					? 'bg-ash-600 text-ash-100'
					: 'text-ash-400 hover:text-ash-200 hover:bg-ash-700'}"
			>
				{t.label}<span class="text-ash-400 text-xs tabular-nums">{t.count.toLocaleString()}</span>
			</button>
		{/each}
	</div>

	<div class="mb-3 flex flex-col gap-3 lg:flex-row">
		<div class="relative flex-1">
			<i class="fas fa-search absolute top-1/2 left-3 -translate-y-1/2 text-sm text-cyan-300"></i>
			<input
				type="text"
				bind:value={search}
				placeholder="Search name, username or ID"
				class="bg-ash-800 border-ash-700 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border py-2.5 pr-4 pl-9 text-sm focus:ring-2 focus:outline-none"
			/>
		</div>
		<div class="flex flex-col gap-3 sm:flex-row">
			{#if !gone}
				<LabeledSelect appearance="members-toolbar" options={whoOptions} bind:value={who} ariaLabel="Role filter" />
			{/if}
			<LabeledSelect appearance="members-toolbar" options={SORTS} bind:value={sortBy} ariaLabel="Sort members" />
		</div>
	</div>

	<div class="text-ash-300 mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
		{#if status !== 'left'}
			<label class="flex items-center gap-2">
				<input type="checkbox" class="checkbox checkbox-sm" checked={pageAllSelected} disabled={pageIds.length === 0} onchange={togglePage} />
				Select page
			</label>
			{#if pickable.length > pageIds.length && selected.size < pickable.length}
				<button type="button" class="text-sky-400 hover:text-sky-300" onclick={() => (selected = new Set(pickable))}>
					Select all {pickable.length.toLocaleString()}
				</button>
			{/if}
		{/if}
		<span class="text-ash-500 ml-auto text-xs">{rows.length.toLocaleString()} shown</span>
	</div>

	{#if groupUnset}
		<div class="text-ash-400 border-ash-600 bg-ash-800/60 rounded-lg border px-4 py-3 text-sm">
			<p class="text-ash-300 mb-1">No roles are set for this group yet.</p>
			<a
				href={adminServerSectionPath(data.botId, data.serverId, GROUP_CONFIG[who].section)}
				class="text-ash-300 hover:text-ash-100 inline-flex items-center gap-1.5 text-xs font-medium underline"
			>
				<i class="fas fa-sliders text-blue-300"></i>{GROUP_CONFIG[who].label}
			</a>
		</div>
	{:else if rows.length === 0}
		<p class="text-ash-400 py-8 text-center text-sm">{status === 'all' ? 'No members match.' : 'Nobody here.'}</p>
	{:else}
		<ul class="space-y-2">
			{#each pageRows as r (r.id)}
				{@const banMeta = r.ban ? (MODERATION_ACTION_META[r.ban.action] ?? MODERATION_ACTION_META.ban) : null}
				<li class="bg-ash-700 border-ash-600 flex items-center gap-2 rounded-lg border p-3 sm:gap-3 {selected.has(r.id) ? 'ring-1 ring-sky-500/60' : ''}">
					{#if status !== 'left'}
						{#if r.locked}
							<span
								class="flex h-5 w-5 shrink-0 items-center justify-center text-amber-300"
								title={r.is_owner ? "The server owner can't be moderated" : data.deniedReason}><i class="fas fa-lock text-xs"></i></span
							>
						{:else}
							<input
								type="checkbox"
								class="checkbox checkbox-sm shrink-0"
								checked={selected.has(r.id)}
								onchange={() => toggle(r.id)}
								aria-label="Select {r.name}"
							/>
						{/if}
					{/if}
					<a href="{base}/{r.id}" class="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
						<div class="bg-ash-600 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full">
							{#if r.avatar}
								<img src={r.avatar} alt="" loading="lazy" class="h-full w-full object-cover" />
							{:else}
								<i class="fas fa-user text-ash-400 text-sm"></i>
							{/if}
						</div>
						<div class="min-w-0 flex-1">
							<p class="text-ash-100 flex items-center gap-1.5 text-sm font-semibold">
								<span class="truncate">{r.name}</span>
								{#if r.is_afk}<i class="fas fa-moon shrink-0 text-[0.65rem] text-yellow-300" title="AFK"></i>{/if}
								{#if r.warnings > 0}
									<span class="shrink-0 text-xs font-medium text-amber-400" title="Active warnings"
										><i class="fas fa-triangle-exclamation mr-0.5"></i>{r.warnings}</span
									>
								{/if}
							</p>
							{#if r.ban}
								<p class="text-ash-300 truncate text-xs">{r.ban.reason || 'No reason provided'}</p>
							{:else if !r.here}
								<p class="text-ash-400 text-xs">Left the server</p>
							{:else if r.username}
								<p class="text-ash-400 truncate text-xs">@{r.username}</p>
							{/if}
							{#if r.timeout_until}
								<p class="truncate text-[0.65rem] text-orange-400">
									<i class="fas fa-volume-xmark mr-1"></i>Timed out until <LocalTime value={r.timeout_until} fallback="" class="inline" />
								</p>
							{/if}
							{#if r.role_ids.length > 0}
								<div class="mt-1 flex flex-wrap gap-1">
									{#each r.role_ids.slice(0, 3) as rid (rid)}
										{@const role = roleById.get(rid)}
										{#if role}
											<span class="border-ash-500 text-ash-200 inline-flex max-w-32 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[0.6rem]">
												<span class="h-1.5 w-1.5 shrink-0 rounded-full" style={roleDot(role.color)}></span><span class="truncate">{role.name}</span>
											</span>
										{/if}
									{/each}
									{#if r.role_ids.length > 3}<span class="text-ash-400 self-center text-[0.6rem]">+{r.role_ids.length - 3}</span>{/if}
								</div>
							{/if}
						</div>
						<div class="flex max-w-[45%] shrink-0 flex-col items-end gap-0.5 text-right text-xs">
							{#if r.ban && banMeta}
								<span class={banMeta.color}><i class="fas {banMeta.icon} mr-1"></i>{banMeta.label}</span>
								<span class="text-ash-500 text-[0.65rem]">
									{#if r.ban.expires_at}Ends <LocalTime value={r.ban.expires_at} fallback="" class="inline" />{:else}<LocalTime
											value={r.ban.created_at}
											fallback=""
											class="inline"
										/>{/if}
								</span>
							{:else}
								{#if r.here}<span class="text-ash-100 font-semibold">Lv {r.level}</span>{/if}
								{#if r.invites !== 0}<span class="text-teal-400">{fmt(r.invites)} {r.invites === 1 ? 'invite' : 'invites'}</span>{/if}
								{#if sort.show && (r.here || sort.show.gone)}
									<span class="text-ash-300 text-[0.65rem]">
										<i class="fas {sort.show.icon} mr-1"></i>{#if sort.show.date}<LocalTime
												value={sort.show.date(r)}
												fallback="N/A"
												class="inline"
											/>{:else}{sort.show.text?.(r)}{/if}
									</span>
								{/if}
							{/if}
						</div>
						<i class="fas fa-chevron-right text-ash-400 hidden shrink-0 text-xs sm:block"></i>
					</a>
				</li>
			{/each}
		</ul>
	{/if}

	<Pagination bind:page {totalPages} />

	{#if targets.length > 0}
		<div class="bg-ash-700 border-ash-500 sticky bottom-3 z-20 mt-4 flex flex-col gap-3 rounded-lg border p-3 shadow-lg shadow-black/40 sm:p-4">
			<p class="text-ash-100 flex items-center gap-3 text-sm font-semibold">
				{targets.length.toLocaleString()} selected
				<button type="button" class="text-ash-400 hover:text-ash-200 text-xs font-normal" onclick={() => (selected = new Set())}>Clear</button>
			</p>
			<MemberActionBar
				serverId={data.serverId}
				{targets}
				banned={status === 'banned'}
				suggest={tabs.find((t) => t.id === status)?.suggest}
				roles={data.roles}
				presets={data.presets}
				deniedReason={data.deniedReason}
				ondone={done}
			/>
		</div>
	{/if}
</section>
