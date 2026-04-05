<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type { PageProps } from './$types';
	import { dbDateTimeToMs } from '$lib/utils/datetime.js';
	import LocalTime from '$lib/frontend/components/LocalTime.svelte';
	import type { LabeledSelectOption } from '$lib/frontend/components/labeledSelect.js';
	import type { PublicMembersStreamPayload } from '$lib/publicMembers/index.js';

	let { data }: PageProps = $props();

	type RoleRgb = { r: number; g: number; b: number };

	function parseRoleColorRaw(raw: string | null | undefined): RoleRgb | null {
		if (raw == null) return null;
		const s = String(raw).trim();
		if (s === '' || s.toLowerCase() === 'null' || s === 'undefined' || s === '0') return null;
		if (s.startsWith('#')) {
			let h = s.slice(1);
			if (h.length === 3)
				h = h
					.split('')
					.map((c) => c + c)
					.join('');
			if (h.length === 6 && /^[0-9a-fA-F]+$/.test(h)) {
				return {
					r: parseInt(h.slice(0, 2), 16),
					g: parseInt(h.slice(2, 4), 16),
					b: parseInt(h.slice(4, 6), 16)
				};
			}
			return null;
		}
		if (/^[0-9A-Fa-f]{6}$/.test(s)) {
			return {
				r: parseInt(s.slice(0, 2), 16),
				g: parseInt(s.slice(2, 4), 16),
				b: parseInt(s.slice(4, 6), 16)
			};
		}
		const n = Number.parseInt(s, 10);
		if (Number.isFinite(n) && n >= 0 && n <= 0xffffff) {
			return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
		}
		return null;
	}

	function rgbToHex({ r, g, b }: RoleRgb): string {
		return `#${[r, g, b].map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')).join('')}`;
	}

	function roleColorLuminance({ r, g, b }: RoleRgb): number {
		const lin = (c: number) => {
			c /= 255;
			return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
		};
		return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
	}

	function rolePillCssVars(color: string | null | undefined): Record<string, string> {
		const fb = {
			fg: '#1a343f',
			bg: 'rgba(36, 95, 115, 0.1)',
			bd: 'rgba(36, 95, 115, 0.38)',
			dot: '#245f73'
		};
		const rgb = parseRoleColorRaw(color);
		if (!rgb) {
			return { '--role-fg': fb.fg, '--role-bg': fb.bg, '--role-bd': fb.bd, '--role-dot': fb.dot };
		}
		const L = roleColorLuminance(rgb);
		const hex = rgbToHex(rgb);
		const nearWhite = L >= 0.78 || (rgb.r >= 248 && rgb.g >= 248 && rgb.b >= 248);
		if (nearWhite) {
			return { '--role-fg': fb.fg, '--role-bg': fb.bg, '--role-bd': fb.bd, '--role-dot': fb.dot };
		}
		const softText = L > 0.52;
		return {
			'--role-fg': softText ? '#1a343f' : hex,
			'--role-bg': `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.13)`,
			'--role-bd': `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.45)`,
			'--role-dot': hex
		};
	}

	let liveMembers = $state([...(data.members ?? [])]);
	let es: EventSource | null = null;
	let mounted = $state(false);

	$effect(() => {
		liveMembers = [...(data.members ?? [])];
	});

	const members = $derived(liveMembers);

	const summary = $derived.by(() => {
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

	function rowAccent(rank: number | null | undefined): string {
		if (rank === 1) return 'pubm-row--g1';
		if (rank === 2) return 'pubm-row--g2';
		if (rank === 3) return 'pubm-row--g3';
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

<div class="pubm">
	<p class="pubm-kicker">Members</p>

	<div class="pubm-chips" aria-label="Members overview">
		<div class="pubm-chip"><span class="pubm-chip-v">{fmtNum(summary.xpPool)}</span><span class="pubm-chip-l">Total XP</span></div>
		<div class="pubm-chip"><span class="pubm-chip-v">{summary.n ? fmtNum(summary.avgLevel) : '0'}</span><span class="pubm-chip-l">Avg level</span></div>
		<div class="pubm-chip"><span class="pubm-chip-v">{fmtNum(summary.maxLevel)}</span><span class="pubm-chip-l">Peak level</span></div>
		<div class="pubm-chip"><span class="pubm-chip-v">{fmtNum(summary.voiceSum)}</span><span class="pubm-chip-l">Voice min</span></div>
		<div class="pubm-chip"><span class="pubm-chip-v">{fmtNum(summary.afkNow)}</span><span class="pubm-chip-l">AFK now</span></div>
	</div>

	<div class="pubm-bar">
		<div class="pubm-search">
			<i class="fas fa-search pubm-search-ic" aria-hidden="true"></i>
			<input
				type="search"
				class="pubm-search-inp"
				placeholder="Search name or ID"
				aria-label="Search members by name or Discord ID"
				bind:value={search}
				oninput={onSearchInput}
				autocomplete="off"
			/>
		</div>
		<div class="pubm-sort">
			<label class="pubm-sr" for="pubm-sort">Sort list</label>
			<select id="pubm-sort" class="pubm-select" bind:value={sortBy} onchange={onSortChange} aria-label="Sort members">
				{#each SORT_OPTIONS as opt}
					<option value={opt.value}>{opt.label}</option>
				{/each}
			</select>
		</div>
		<p class="pubm-count">
			<span>{sorted.length}</span>
			{sorted.length === 1 ? 'member' : 'members'}{#if search}<span class="pubm-count-q"> · “{search}”</span>{/if}{#if sorted.length > PER_PAGE}<span
					class="pubm-count-q"
				>
					· p.{listPage}/{totalPages}</span
				>{/if}
		</p>
	</div>

	{#if paged.length === 0}
		<div class="pubm-empty">
			<i class="fas fa-users" aria-hidden="true"></i>
			<p>No members found</p>
		</div>
	{:else}
		<div class="pubm-sheet">
			<div class="pubm-sheet-hd">
				<span class="pubm-hd-r">#</span>
				<span class="pubm-hd-m">Member</span>
				<span class="pubm-hd-x">XP</span>
			</div>
			<ul class="pubm-list">
				{#each paged as member, i (member.discord_member_id)}
					<li class="pubm-row {rowAccent(member.rank)}" class:pubm-row--in={mounted} style="--pubm-dly:{i * 22}ms">
						<span class="pubm-rank" title="Leaderboard rank">{member.rank != null ? member.rank : '—'}</span>
						<img
							class="pubm-av"
							src={avatarSrc(member)}
							alt=""
							width="40"
							height="40"
							onerror={(e) => ((e.currentTarget as HTMLImageElement).src = 'https://cdn.discordapp.com/embed/avatars/0.png')}
						/>
						<div class="pubm-body">
							<div class="pubm-name-row">
								<span class="pubm-name">{listDisplayName(member)}</span>
								{#if member.is_afk}<span class="pubm-afk"><i class="fas fa-moon" aria-hidden="true"></i> AFK</span>{/if}
							</div>
							<p class="pubm-stats">
								<span>Lv.{member.level ?? 0}</span>
								<span class="pubm-dot">·</span>
								<span title="Experience points">{fmtNum(member.experience ?? 0)} XP</span>
								<span class="pubm-dot">·</span>
								<span title="Messages">{fmtNum(member.chat_total ?? 0)} msgs</span>
								<span class="pubm-dot">·</span>
								<span title="Voice minutes">{fmtNum(member.voice_minutes_active ?? 0)}m act / {fmtNum(member.voice_minutes_afk ?? 0)}m AFK</span>
							</p>
							<p class="pubm-dates">
								<span><span class="pubm-dk">Joined</span> <LocalTime value={member.member_since} fallback="N/A" /></span>
								<span class="pubm-dot">·</span>
								<span><span class="pubm-dk">Account</span> <LocalTime value={member.profile_created_at} fallback="N/A" /></span>
							</p>
							{#if member.roles?.length > 0}
								<div class="pubm-roles">
									{#each member.roles as role}
										<span class="pubm-role" style={rolePillCssVars(role.color)}>
											<i class="fas fa-circle" aria-hidden="true"></i>
											{role.name || 'Role'}
										</span>
									{/each}
								</div>
							{/if}
						</div>
						<span class="pubm-xp" title="Experience points">{fmtNum(member.experience ?? 0)}</span>
					</li>
				{/each}
			</ul>
		</div>

		{#if sorted.length > PER_PAGE}
			<div class="pubm-pager">
				<button type="button" class="pubm-btn" disabled={listPage === 1} onclick={() => (listPage = Math.max(1, listPage - 1))}>
					<i class="fas fa-chevron-left" aria-hidden="true"></i> Prev
				</button>
				<span class="pubm-pg-meta">Page {listPage} / {totalPages}</span>
				<button type="button" class="pubm-btn" disabled={listPage === totalPages} onclick={() => (listPage = Math.min(totalPages, listPage + 1))}>
					Next <i class="fas fa-chevron-right" aria-hidden="true"></i>
				</button>
			</div>
		{/if}
	{/if}
</div>

<style>
	.pubm {
		--pubm-text: var(--lb-text, #1a343f);
		--pubm-muted: var(--lb-text-muted, rgba(26, 52, 63, 0.58));
		--pubm-soft: rgba(26, 52, 63, 0.48);
		--pubm-br: var(--lb-border, rgba(187, 189, 188, 0.55));
		--pubm-br-l: var(--lb-border-light, rgba(187, 189, 188, 0.38));
		--pubm-sh: var(--lb-shadow, rgba(26, 52, 63, 0.07));
		--pubm-teal: var(--chili-hot, #245f73);
		--pubm-brick: var(--chili-brick, #733e24);
	}

	.pubm-sr {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.pubm-kicker {
		margin: 0 0 8px;
		font-size: 12px;
		font-weight: 600;
		color: var(--pubm-muted);
		letter-spacing: 0.02em;
	}

	.pubm-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 10px;
	}

	.pubm-chip {
		display: flex;
		flex-direction: column;
		gap: 1px;
		padding: 6px 10px;
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.88);
		border: 1px solid var(--pubm-br);
		box-shadow: 0 1px 6px var(--pubm-sh);
		min-width: 0;
	}

	.pubm-chip-v {
		font-size: clamp(13px, 3.8vw, 15px);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: var(--pubm-text);
		line-height: 1.15;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 28vw;
	}

	@media (min-width: 480px) {
		.pubm-chip-v {
			max-width: none;
		}
	}

	.pubm-chip-l {
		font-size: 9px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: var(--pubm-soft);
	}

	.pubm-bar {
		display: grid;
		grid-template-columns: 1fr;
		gap: 8px;
		align-items: stretch;
		padding: 8px;
		margin-bottom: 10px;
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.88);
		border: 1px solid var(--pubm-br);
		box-shadow: 0 1px 6px var(--pubm-sh);
	}

	@media (min-width: 720px) {
		.pubm-bar {
			grid-template-columns: 1fr minmax(160px, 220px) auto;
			align-items: center;
		}
	}

	.pubm-search {
		position: relative;
		min-width: 0;
	}

	.pubm-search-ic {
		position: absolute;
		left: 10px;
		top: 50%;
		transform: translateY(-50%);
		font-size: 12px;
		color: var(--pubm-soft);
		pointer-events: none;
	}

	.pubm-search-inp {
		width: 100%;
		box-sizing: border-box;
		padding: 8px 10px 8px 32px;
		border-radius: 8px;
		border: 1px solid var(--pubm-br);
		background: rgba(255, 255, 255, 0.95);
		font-size: 16px;
		color: var(--pubm-text);
		min-height: 42px;
	}

	@media (min-width: 720px) {
		.pubm-search-inp {
			font-size: 13px;
			min-height: 0;
		}
	}

	.pubm-search-inp::placeholder {
		color: var(--pubm-soft);
	}

	.pubm-search-inp:focus {
		outline: none;
		border-color: rgba(36, 95, 115, 0.45);
		box-shadow: 0 0 0 2px rgba(36, 95, 115, 0.12);
	}

	.pubm-select {
		width: 100%;
		box-sizing: border-box;
		padding: 8px 10px;
		border-radius: 8px;
		border: 1px solid var(--pubm-br);
		background: rgba(255, 255, 255, 0.95);
		font-size: 14px;
		font-weight: 600;
		color: var(--pubm-text);
		min-height: 42px;
		cursor: pointer;
	}

	@media (min-width: 720px) {
		.pubm-select {
			font-size: 12px;
			min-height: 0;
		}
	}

	.pubm-count {
		margin: 0;
		font-size: 11px;
		font-weight: 600;
		color: rgba(26, 52, 63, 0.72);
		line-height: 1.35;
	}

	@media (min-width: 720px) {
		.pubm-count {
			text-align: right;
			font-size: 12px;
			justify-self: end;
		}
	}

	.pubm-count span:first-child {
		font-weight: 700;
		color: var(--pubm-text);
	}

	.pubm-count-q {
		font-weight: 600;
		color: var(--pubm-soft);
	}

	.pubm-empty {
		text-align: center;
		padding: 40px 16px;
		color: var(--pubm-muted);
	}

	.pubm-empty i {
		font-size: 40px;
		opacity: 0.18;
		display: block;
		margin-bottom: 10px;
	}

	.pubm-empty p {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
	}

	.pubm-sheet {
		border-radius: 14px;
		overflow: hidden;
		border: 1px solid var(--pubm-br);
		background: rgba(255, 255, 255, 0.9);
		box-shadow: 0 2px 14px var(--pubm-sh);
	}

	.pubm-sheet-hd {
		display: none;
		grid-template-columns: 36px 44px 1fr 88px;
		gap: 10px;
		align-items: center;
		padding: 8px 12px;
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--pubm-soft);
		border-bottom: 1px solid var(--pubm-br-l);
		background: rgba(242, 240, 239, 0.65);
	}

	@media (min-width: 640px) {
		.pubm-sheet-hd {
			display: grid;
		}
	}

	.pubm-hd-x {
		text-align: right;
	}

	.pubm-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.pubm-row {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 8px 10px;
		padding: 12px 12px;
		border-bottom: 1px solid var(--pubm-br-l);
		opacity: 0;
		transform: translateY(8px);
	}

	.pubm-row--in {
		animation: pubm-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards;
		animation-delay: var(--pubm-dly, 0ms);
	}

	@keyframes pubm-in {
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (min-width: 640px) {
		.pubm-row {
			display: grid;
			grid-template-columns: 36px 44px 1fr 88px;
			align-items: center;
			gap: 10px;
		}
	}

	.pubm-row:last-child {
		border-bottom: none;
	}

	.pubm-row:hover {
		background: rgba(36, 95, 115, 0.05);
	}

	.pubm-row--g1 {
		box-shadow: inset 3px 0 0 #e6b800;
	}
	.pubm-row--g2 {
		box-shadow: inset 3px 0 0 #9ca3af;
	}
	.pubm-row--g3 {
		box-shadow: inset 3px 0 0 #c97a3d;
	}

	.pubm-rank {
		flex: 0 0 28px;
		width: 28px;
		font-size: 12px;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		color: var(--pubm-soft);
		text-align: center;
		line-height: 40px;
	}

	@media (min-width: 640px) {
		.pubm-rank {
			flex: none;
			width: auto;
			line-height: 1.2;
		}
	}

	.pubm-av {
		flex-shrink: 0;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		object-fit: cover;
		border: 1px solid var(--pubm-br);
		display: block;
	}

	.pubm-body {
		flex: 1 1 180px;
		min-width: 0;
	}

	@media (min-width: 640px) {
		.pubm-body {
			flex: none;
		}
	}

	.pubm-name-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 10px;
		margin-bottom: 4px;
	}

	.pubm-name {
		font-size: 15px;
		font-weight: 800;
		color: var(--pubm-text);
		letter-spacing: -0.02em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 100%;
	}

	.pubm-afk {
		font-size: 10px;
		font-weight: 700;
		padding: 2px 8px;
		border-radius: 99px;
		background: rgba(115, 62, 36, 0.12);
		color: var(--pubm-brick);
		border: 1px solid rgba(115, 62, 36, 0.22);
		flex-shrink: 0;
	}

	.pubm-stats,
	.pubm-dates {
		margin: 0 0 4px;
		font-size: 11px;
		font-weight: 600;
		color: rgba(26, 52, 63, 0.72);
		line-height: 1.45;
		display: flex;
		flex-wrap: wrap;
		gap: 2px 4px;
		align-items: baseline;
	}

	.pubm-dates {
		margin-bottom: 0;
		font-size: 10px;
		color: var(--pubm-soft);
	}

	.pubm-dot {
		color: rgba(26, 52, 63, 0.35);
		user-select: none;
	}

	.pubm-dk {
		font-weight: 700;
		text-transform: uppercase;
		font-size: 9px;
		letter-spacing: 0.05em;
		color: rgba(26, 52, 63, 0.42);
		margin-right: 2px;
	}

	.pubm-xp {
		display: none;
		font-size: 14px;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		color: var(--pubm-text);
		text-align: right;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@media (min-width: 640px) {
		.pubm-xp {
			display: block;
		}
	}

	.pubm-roles {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		margin-top: 8px;
	}

	.pubm-role {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 2px 8px;
		border-radius: 8px;
		font-size: 10px;
		font-weight: 600;
		line-height: 1.25;
		max-width: 100%;
		border: 1px solid var(--role-bd, rgba(36, 95, 115, 0.38));
		background: var(--role-bg, rgba(36, 95, 115, 0.1));
		color: var(--role-fg, #1a343f);
	}

	.pubm-role i {
		font-size: 5px;
		opacity: 0.95;
		color: var(--role-dot, var(--role-fg, #245f73));
	}

	.pubm-pager {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		margin-top: 12px;
	}

	.pubm-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		border-radius: 10px;
		border: 1px solid var(--pubm-br);
		background: rgba(255, 255, 255, 0.9);
		font-size: 13px;
		font-weight: 600;
		color: var(--pubm-text);
		cursor: pointer;
		box-shadow: 0 1px 6px var(--pubm-sh);
	}

	.pubm-btn:hover:not(:disabled) {
		border-color: rgba(36, 95, 115, 0.3);
		background: #fff;
	}

	.pubm-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.pubm-pg-meta {
		font-size: 12px;
		font-weight: 600;
		color: var(--pubm-muted);
	}

	@media (prefers-reduced-motion: reduce) {
		.pubm-row--in {
			animation: none;
			opacity: 1;
			transform: none;
		}
	}
</style>
