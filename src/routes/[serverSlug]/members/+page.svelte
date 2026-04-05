<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type { PageProps } from './$types';
	import { dbDateTimeToMs } from '$lib/utils/datetime.js';
	import LocalTime from '$lib/frontend/components/LocalTime.svelte';
	import type { LabeledSelectOption } from '$lib/frontend/components/labeledSelect.js';
	import type { PublicMembersStreamPayload } from '$lib/publicMembers/index.js';

	let { data }: PageProps = $props();

	let liveMembers = $state([...(data.members ?? [])]);
	let es: EventSource | null = null;
	let mounted = $state(false);

	$effect(() => {
		liveMembers = [...(data.members ?? [])];
	});

	const members = $derived(liveMembers);

	const directoryStrip = $derived.by(() => {
		const list = members;
		const n = list.length;
		const afkNow = list.filter((m) => m.is_afk).length;
		const levels = list.map((m) => Number(m.level) || 0);
		const avgLevel = n ? Math.round(levels.reduce((a, b) => a + b, 0) / n) : 0;
		const maxLevel = n ? Math.max(...levels) : 0;
		const voiceSum = list.reduce((a, m) => a + Number(m.voice_minutes_active ?? 0) + Number(m.voice_minutes_afk ?? 0), 0);
		const xpPool = list.reduce((a, m) => a + Number(m.experience ?? 0), 0);
		return { n, afkNow, avgLevel, maxLevel, voiceSum, xpPool };
	});

	onMount(() => {
		const url = `/api/leaderboards/${encodeURIComponent(data.server.slug)}/members-stream`;
		const source = new EventSource(url);
		es = source;
		source.onmessage = (e) => {
			try {
				const payload = JSON.parse(e.data) as PublicMembersStreamPayload;
				if (payload?.members && Array.isArray(payload.members)) liveMembers = payload.members;
			} catch (_) {}
		};
		source.onerror = () => {};
		requestAnimationFrame(() => {
			mounted = true;
		});
	});

	onDestroy(() => {
		es?.close();
	});

	const SORT_OPTIONS: LabeledSelectOption[] = [
		{ value: 'name_asc', label: 'Name (A-Z)' },
		{ value: 'name_desc', label: 'Name (Z-A)' },
		{ value: 'rank_asc', label: 'Rank (Low → High)' },
		{ value: 'rank_desc', label: 'Rank (High → Low)' },
		{ value: 'level_desc', label: 'Level (High → Low)' },
		{ value: 'level_asc', label: 'Level (Low → High)' },
		{ value: 'xp_desc', label: 'XP (High → Low)' },
		{ value: 'xp_asc', label: 'XP (Low → High)' },
		{ value: 'chat_desc', label: 'Chat (High → Low)' },
		{ value: 'chat_asc', label: 'Chat (Low → High)' },
		{ value: 'voice_active_desc', label: 'Voice Active (High → Low)' },
		{ value: 'voice_active_asc', label: 'Voice Active (Low → High)' },
		{ value: 'voice_afk_desc', label: 'Voice AFK (High → Low)' },
		{ value: 'voice_afk_asc', label: 'Voice AFK (Low → High)' },
		{ value: 'member_since_asc', label: 'Member Since (Oldest First)' },
		{ value: 'member_since_desc', label: 'Member Since (Newest First)' },
		{ value: 'account_created_asc', label: 'Account Created (Oldest First)' },
		{ value: 'account_created_desc', label: 'Account Created (Newest First)' },
		{ value: 'afk_first', label: 'AFK First' },
		{ value: 'afk_last', label: 'Non-AFK First' }
	];

	/** Show everyone on one page until this many; paginate only above. */
	const PER_PAGE = 100;

	let search = $state('');
	let sortBy = $state('name_asc');
	let listPage = $state(1);

	const filtered = $derived(
		members.filter((m) => {
			const q = search.toLowerCase();
			return (
				!q ||
				(m.username ?? '').toLowerCase().includes(q) ||
				(m.display_name ?? '').toLowerCase().includes(q) ||
				(m.server_display_name ?? '').toLowerCase().includes(q) ||
				(m.discord_member_id ?? '').includes(q)
			);
		})
	);

	const sorted = $derived(
		[...filtered].sort((a, b) => {
			switch (sortBy) {
				case 'rank_asc':
					return (a.rank ?? 9999) - (b.rank ?? 9999);
				case 'rank_desc':
					return (b.rank ?? 9999) - (a.rank ?? 9999);
				case 'level_desc':
					return (b.level ?? 0) - (a.level ?? 0);
				case 'level_asc':
					return (a.level ?? 0) - (b.level ?? 0);
				case 'xp_desc':
					return (b.experience ?? 0) - (a.experience ?? 0);
				case 'xp_asc':
					return (a.experience ?? 0) - (b.experience ?? 0);
				case 'chat_desc':
					return (b.chat_total ?? 0) - (a.chat_total ?? 0);
				case 'chat_asc':
					return (a.chat_total ?? 0) - (b.chat_total ?? 0);
				case 'voice_active_desc':
					return (b.voice_minutes_active ?? 0) - (a.voice_minutes_active ?? 0);
				case 'voice_active_asc':
					return (a.voice_minutes_active ?? 0) - (b.voice_minutes_active ?? 0);
				case 'voice_afk_desc':
					return (b.voice_minutes_afk ?? 0) - (a.voice_minutes_afk ?? 0);
				case 'voice_afk_asc':
					return (a.voice_minutes_afk ?? 0) - (b.voice_minutes_afk ?? 0);
				case 'name_asc':
					return (a.username ?? '').localeCompare(b.username ?? '');
				case 'name_desc':
					return (b.username ?? '').localeCompare(a.username ?? '');
				case 'member_since_asc':
					return dbDateTimeToMs(a.member_since) - dbDateTimeToMs(b.member_since);
				case 'member_since_desc':
					return dbDateTimeToMs(b.member_since) - dbDateTimeToMs(a.member_since);
				case 'account_created_asc':
					return dbDateTimeToMs(a.profile_created_at) - dbDateTimeToMs(b.profile_created_at);
				case 'account_created_desc':
					return dbDateTimeToMs(b.profile_created_at) - dbDateTimeToMs(a.profile_created_at);
				case 'afk_first':
					return (b.is_afk ? 1 : 0) - (a.is_afk ? 1 : 0);
				case 'afk_last':
					return (a.is_afk ? 1 : 0) - (b.is_afk ? 1 : 0);
				default:
					return 0;
			}
		})
	);

	const maxXpInView = $derived(Math.max(1, ...sorted.map((m) => Number(m.experience ?? 0))));

	const totalPages = $derived(Math.max(1, Math.ceil(sorted.length / PER_PAGE)));

	$effect(() => {
		const tp = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
		if (listPage > tp) listPage = tp;
	});

	const paged = $derived(sorted.slice((listPage - 1) * PER_PAGE, listPage * PER_PAGE));

	function onSearchInput() {
		listPage = 1;
	}

	function onSortChange() {
		listPage = 1;
	}

	function fmtNum(n: number): string {
		if (n == null) return '0';
		return Number(n).toLocaleString();
	}

	function roleColor(hex: string | null | undefined): string {
		const h = hex ?? '';
		if (!h || h === '#000000' || h === '0' || h === 'null') return 'var(--chili-hot)';
		if (h.startsWith('#')) return h;
		if (/^[0-9A-Fa-f]{6}$/.test(h)) return `#${h}`;
		const num = parseInt(h, 10);
		if (!isNaN(num) && num !== 0) return `#${num.toString(16).padStart(6, '0')}`;
		return 'var(--chili-hot)';
	}

	function displayName(m: (typeof members)[number]): string {
		if (m.server_display_name?.trim()) return m.server_display_name;
		if (m.display_name?.trim()) return m.display_name;
		return m.username ?? 'Unknown';
	}

	function listDisplayName(m: (typeof members)[number]): string {
		return (
			displayName(m)
				.replace(/^\s*(\[AFK\]\s*)+/gi, '')
				.trim() || displayName(m)
		);
	}

	function avatarSrc(m: (typeof members)[number]): string {
		return m.avatar ?? `https://cdn.discordapp.com/embed/avatars/${Number(m.discord_member_id) % 5 || 0}.png`;
	}

	function xpBarPercent(m: (typeof members)[number]): number {
		const xp = Number(m.experience ?? 0);
		return Math.min(100, Math.max(4, (xp / maxXpInView) * 100));
	}

	function voiceMixPercents(m: (typeof members)[number]): { activePct: number; afkPct: number; empty: boolean } {
		const a = Math.max(0, Number(m.voice_minutes_active) || 0);
		const k = Math.max(0, Number(m.voice_minutes_afk) || 0);
		const t = a + k;
		if (t <= 0) return { activePct: 0, afkPct: 0, empty: true };
		return { activePct: (a / t) * 100, afkPct: (k / t) * 100, empty: false };
	}

	function podiumModifier(rank: number | null | undefined): string {
		if (rank === 1) return 'lb-members-card--podium-1';
		if (rank === 2) return 'lb-members-card--podium-2';
		if (rank === 3) return 'lb-members-card--podium-3';
		return '';
	}
</script>

<svelte:head>
	<title>{data.server.name || data.server.slug} Members | Dansday Discord Bot</title>
	<meta name="description" content="Members, ranks, XP, and voice stats for {data.server.name || data.server.slug}." />
	<meta name="theme-color" content="#245f73" />
	<meta property="og:title" content="{data.server.name || data.server.slug} Members | Dansday Discord Bot" />
	<meta property="og:description" content="Explore members, ranks, XP, and voice activity for this community." />
</svelte:head>

<div class="lb-members-page-head">
	<p class="lb-leaderboard-subhead lb-members-subhead">Members</p>
</div>

<section class="lb-overview-strip lb-members-overview-strip" aria-label="Members overview">
	<div class="lb-overview-strip-item">
		<div class="lb-overview-strip-icon"><i class="fas fa-star"></i></div>
		<div class="lb-overview-strip-text">
			<span class="lb-overview-strip-value">{fmtNum(directoryStrip.xpPool)}</span>
			<span class="lb-overview-strip-label">Total XP</span>
		</div>
	</div>
	<div class="lb-overview-strip-item">
		<div class="lb-overview-strip-icon"><i class="fas fa-chart-line"></i></div>
		<div class="lb-overview-strip-text">
			<span class="lb-overview-strip-value">{directoryStrip.n ? fmtNum(directoryStrip.avgLevel) : '0'}</span>
			<span class="lb-overview-strip-label">Avg level</span>
		</div>
	</div>
	<div class="lb-overview-strip-item">
		<div class="lb-overview-strip-icon"><i class="fas fa-crown"></i></div>
		<div class="lb-overview-strip-text">
			<span class="lb-overview-strip-value">{fmtNum(directoryStrip.maxLevel)}</span>
			<span class="lb-overview-strip-label">Peak level</span>
		</div>
	</div>
	<div class="lb-overview-strip-item">
		<div class="lb-overview-strip-icon"><i class="fas fa-microphone"></i></div>
		<div class="lb-overview-strip-text">
			<span class="lb-overview-strip-value">{fmtNum(directoryStrip.voiceSum)}</span>
			<span class="lb-overview-strip-label">Voice min</span>
		</div>
	</div>
	<div class="lb-overview-strip-item">
		<div class="lb-overview-strip-icon"><i class="fas fa-moon"></i></div>
		<div class="lb-overview-strip-text">
			<span class="lb-overview-strip-value">{fmtNum(directoryStrip.afkNow)}</span>
			<span class="lb-overview-strip-label">AFK now</span>
		</div>
	</div>
</section>

<div class="lb-members-controls-card">
	<div class="lb-members-toolbar lb-members-toolbar--compact">
		<div class="lb-members-search-wrap">
			<i class="fas fa-search lb-members-search-icon"></i>
			<input
				type="text"
				class="lb-members-search-input"
				placeholder="Search name or ID…"
				aria-label="Search members by name or Discord ID"
				bind:value={search}
				oninput={onSearchInput}
			/>
		</div>
		<div class="lb-members-sort-wrap lb-members-sort-wrap--compact">
			<label class="lb-members-sort-label visually-hidden" for="lb-members-sort">Sort list</label>
			<select id="lb-members-sort" class="lb-members-sort" bind:value={sortBy} onchange={onSortChange} aria-label="Sort members">
				{#each SORT_OPTIONS as opt}
					<option value={opt.value}>{opt.label}</option>
				{/each}
			</select>
		</div>
		<p class="lb-members-count lb-members-count--toolbar">
			<span class="lb-members-count-num">{sorted.length}</span><span class="lb-members-count-noun">{sorted.length === 1 ? ' member' : ' members'}</span
			>{#if search}<span class="lb-members-count-query"> · “{search}”</span>{/if}{#if sorted.length > PER_PAGE}<span class="lb-members-count-page">
					· p.{listPage}/{totalPages}</span
				>{/if}
		</p>
	</div>
</div>

{#if paged.length === 0}
	<div class="lb-members-empty lb-empty">
		<i class="fas fa-users" style="font-size: 48px; opacity: 0.2;"></i>
		<p>No members found</p>
	</div>
{:else}
	<div class="lb-members-list lb-members-list--v2">
		{#each paged as member, i (member.discord_member_id)}
			{@const vm = voiceMixPercents(member)}
			<article
				class="lb-members-card lb-members-card--v2 lb-members-card--compact {podiumModifier(member.rank)}"
				class:lb-members-card--mounted={mounted}
				style="--lb-members-enter-delay: {i * 28}ms"
			>
				<div class="lb-members-card-inner lb-members-card-inner--compact">
					<div class="lb-members-card-aside lb-members-card-aside--compact">
						<div class="lb-members-avatar-wrap lb-members-avatar-wrap--compact">
							<div class="lb-members-avatar-ring lb-members-avatar-ring--compact">
								<img
									src={avatarSrc(member)}
									alt={listDisplayName(member)}
									class="lb-members-avatar lb-members-avatar--compact"
									onerror={(e) => ((e.currentTarget as HTMLImageElement).src = 'https://cdn.discordapp.com/embed/avatars/0.png')}
								/>
							</div>
							<span class="lb-members-rank-overlay" title="Leaderboard rank">{member.rank != null ? `#${member.rank}` : '—'}</span>
						</div>
					</div>

					<div class="lb-members-body lb-members-body--compact">
						<div class="lb-members-title-row lb-members-title-row--compact">
							<div class="lb-members-name-block">
								<h2 class="lb-members-name lb-members-name--compact">{listDisplayName(member)}</h2>
								<p class="lb-members-tagline lb-members-tagline--compact">
									<span>Lv.{member.level ?? 0}</span>
									<span class="lb-members-tagline-dot" aria-hidden="true">·</span>
									<span>{fmtNum(member.experience ?? 0)} XP</span>
								</p>
							</div>
							{#if member.is_afk}
								<span class="lb-members-afk lb-members-afk--compact"><i class="fas fa-moon"></i> AFK</span>
							{/if}
						</div>

						<div class="lb-members-bars-compact">
							<div class="lb-members-xp-block lb-members-xp-block--compact">
								<div class="lb-members-xp-head lb-members-xp-head--compact">
									<span>XP vs list</span>
									<span class="lb-members-xp-meta">{fmtNum(member.experience ?? 0)} / {fmtNum(maxXpInView)}</span>
								</div>
								<div class="lb-members-xp-track lb-members-xp-track--compact">
									<div class="lb-members-xp-fill" style="width: {xpBarPercent(member)}%"></div>
								</div>
							</div>
							{#if !vm.empty}
								<div class="lb-members-voice-block lb-members-voice-block--compact">
									<div class="lb-members-voice-stack lb-members-voice-stack--compact" title="Active vs AFK voice minutes">
										<div class="lb-members-voice-stack-active" style="width: {vm.activePct}%"></div>
										<div class="lb-members-voice-stack-afk" style="width: {vm.afkPct}%"></div>
									</div>
								</div>
							{/if}
						</div>

						<div class="lb-members-inline-stats" aria-label="Activity summary">
							<span class="lb-members-inline-stat" title="Messages"><i class="fas fa-comment"></i>{fmtNum(member.chat_total ?? 0)}</span>
							<span class="lb-members-inline-stat" title="Voice active minutes"
								><i class="fas fa-microphone-lines"></i>{fmtNum(member.voice_minutes_active ?? 0)}m</span
							>
							<span class="lb-members-inline-stat" title="Voice AFK minutes"><i class="fas fa-moon"></i>{fmtNum(member.voice_minutes_afk ?? 0)}m</span>
						</div>

						<div class="lb-members-dates lb-members-dates--compact">
							<span class="lb-members-date-inline"
								><span class="lb-members-date-k">Joined</span>
								<LocalTime value={member.member_since} fallback="N/A" class="lb-members-time" /></span
							>
							<span class="lb-members-date-inline"
								><span class="lb-members-date-k">Account</span>
								<LocalTime value={member.profile_created_at} fallback="N/A" class="lb-members-time" /></span
							>
						</div>

						{#if member.roles?.length > 0}
							<div class="lb-members-roles lb-members-roles--compact">
								<div class="lb-members-roles-head">
									<i class="fas fa-user-tag"></i>
									<span>Roles</span>
								</div>
								<div class="lb-members-role-list">
									{#each member.roles as role}
										{@const c = roleColor(role.color)}
										<span class="lb-members-role-pill" style="--role:{c}">
											<i class="fas fa-circle"></i>
											{role.name || 'Role'}
										</span>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				</div>
			</article>
		{/each}
	</div>

	{#if sorted.length > PER_PAGE}
		<div class="lb-members-pagination">
			<button type="button" class="lb-members-page-btn" disabled={listPage === 1} onclick={() => (listPage = Math.max(1, listPage - 1))}>
				<i class="fas fa-chevron-left"></i> Previous
			</button>
			<span class="lb-members-page-meta">Page {listPage} of {totalPages}</span>
			<button type="button" class="lb-members-page-btn" disabled={listPage === totalPages} onclick={() => (listPage = Math.min(totalPages, listPage + 1))}>
				Next <i class="fas fa-chevron-right"></i>
			</button>
		</div>
	{/if}
{/if}
