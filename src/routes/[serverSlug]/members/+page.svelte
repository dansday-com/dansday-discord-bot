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

	$effect(() => {
		liveMembers = [...(data.members ?? [])];
	});

	const members = $derived(liveMembers);

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

	const PER_PAGE = 20;

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

	const totalPages = $derived(Math.ceil(sorted.length / PER_PAGE));
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
</script>

<svelte:head>
	<title>{data.server.name || data.server.slug} Members | Dansday Discord Bot</title>
	<meta name="description" content="Member directory for {data.server.name || data.server.slug}." />
	<meta name="theme-color" content="#245f73" />
</svelte:head>

<div class="lb-members-page-head">
	<p class="lb-leaderboard-subhead lb-members-subhead">
		<span>Members</span>
		<span class="lb-metric-pill">All</span>
	</p>
</div>

<div class="lb-members-toolbar">
	<div class="lb-members-search-wrap">
		<i class="fas fa-search lb-members-search-icon"></i>
		<input type="text" class="lb-members-search-input" placeholder="Search by name or ID…" bind:value={search} oninput={onSearchInput} />
	</div>
	<div class="lb-members-sort-wrap">
		<label class="lb-members-sort-label" for="lb-members-sort">Sort</label>
		<select id="lb-members-sort" class="lb-members-sort" bind:value={sortBy} onchange={onSortChange}>
			{#each SORT_OPTIONS as opt}
				<option value={opt.value}>{opt.label}</option>
			{/each}
		</select>
	</div>
</div>

<p class="lb-members-count">
	{sorted.length} member{sorted.length !== 1 ? 's' : ''}{search ? ` matching “${search}”` : ''}
</p>

{#if paged.length === 0}
	<div class="lb-members-empty">No members found</div>
{:else}
	<div class="lb-members-list">
		{#each paged as member (member.discord_member_id)}
			<article class="lb-members-card">
				<div class="lb-members-card-inner">
					<div class="lb-members-avatar-wrap">
						<img
							src={avatarSrc(member)}
							alt={listDisplayName(member)}
							class="lb-members-avatar"
							onerror={(e) => ((e.currentTarget as HTMLImageElement).src = 'https://cdn.discordapp.com/embed/avatars/0.png')}
						/>
					</div>
					<div class="lb-members-body">
						<div class="lb-members-title-row">
							<h2 class="lb-members-name">{listDisplayName(member)}</h2>
							{#if member.is_afk}
								<span class="lb-members-afk"><i class="fas fa-moon"></i> AFK</span>
							{/if}
						</div>

						<div class="lb-members-stats">
							<div class="lb-members-stat">
								<div class="lb-members-stat-icon lb-members-stat-icon--teal"><i class="fas fa-medal"></i></div>
								<div>
									<div class="lb-members-stat-label">Rank</div>
									<div class="lb-members-stat-value">{member.rank != null ? `#${member.rank}` : 'N/A'}</div>
								</div>
							</div>
							<div class="lb-members-stat">
								<div class="lb-members-stat-icon lb-members-stat-icon--mahogany"><i class="fas fa-trophy"></i></div>
								<div>
									<div class="lb-members-stat-label">Level</div>
									<div class="lb-members-stat-value">{member.level ?? 0}</div>
								</div>
							</div>
							<div class="lb-members-stat">
								<div class="lb-members-stat-icon lb-members-stat-icon--teal"><i class="fas fa-star"></i></div>
								<div>
									<div class="lb-members-stat-label">XP</div>
									<div class="lb-members-stat-value">{fmtNum(member.experience ?? 0)}</div>
								</div>
							</div>
							<div class="lb-members-stat">
								<div class="lb-members-stat-icon lb-members-stat-icon--stone"><i class="fas fa-comment"></i></div>
								<div>
									<div class="lb-members-stat-label">Chat</div>
									<div class="lb-members-stat-value">{fmtNum(member.chat_total ?? 0)}</div>
								</div>
							</div>
							<div class="lb-members-stat">
								<div class="lb-members-stat-icon lb-members-stat-icon--teal"><i class="fas fa-microphone"></i></div>
								<div>
									<div class="lb-members-stat-label">Voice active</div>
									<div class="lb-members-stat-value">{fmtNum(member.voice_minutes_active ?? 0)}m</div>
								</div>
							</div>
							<div class="lb-members-stat">
								<div class="lb-members-stat-icon lb-members-stat-icon--mahogany"><i class="fas fa-moon"></i></div>
								<div>
									<div class="lb-members-stat-label">Voice AFK</div>
									<div class="lb-members-stat-value">{fmtNum(member.voice_minutes_afk ?? 0)}m</div>
								</div>
							</div>
							<div class="lb-members-stat">
								<div class="lb-members-stat-icon lb-members-stat-icon--stone"><i class="fas fa-calendar-alt"></i></div>
								<div>
									<div class="lb-members-stat-label">Member since</div>
									<div class="lb-members-stat-value">
										<LocalTime value={member.member_since} fallback="N/A" class="lb-members-time" />
									</div>
								</div>
							</div>
							<div class="lb-members-stat">
								<div class="lb-members-stat-icon lb-members-stat-icon--mahogany"><i class="fas fa-user-plus"></i></div>
								<div>
									<div class="lb-members-stat-label">Account created</div>
									<div class="lb-members-stat-value">
										<LocalTime value={member.profile_created_at} fallback="N/A" class="lb-members-time" />
									</div>
								</div>
							</div>
						</div>

						{#if member.roles?.length > 0}
							<div class="lb-members-roles">
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

	{#if totalPages > 1}
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
