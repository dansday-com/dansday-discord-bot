<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { onDestroy, onMount } from 'svelte';
	import type { PageProps } from './$types';
	import LocalTime from '$lib/frontend/components/LocalTime.svelte';
	import type { PublicMembersStreamPayload } from '$lib/frontend/public/members/index.js';

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

	function fmtNum(n: number): string {
		if (n == null) return '0';
		return Number(n).toLocaleString();
	}

	onMount(() => {
		const url = `/api/public-statistics/${encodeURIComponent(data.server.slug)}/members-stream`;
		const source = new EventSource(url);
		es = source;
		source.onmessage = (e) => {
			try {
				const payload = JSON.parse(e.data) as PublicMembersStreamPayload;
				if (payload?.members && Array.isArray(payload.members)) liveMembers = payload.members.filter((m: any) => !m.isDisguised);
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

	const PER_PAGE = 100;

	let search = $state('');
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

	const sorted = $derived([...filtered].sort((a, b) => listDisplayName(a).localeCompare(listDisplayName(b), undefined, { sensitivity: 'base' })));

	const totalPages = $derived(Math.max(1, Math.ceil(sorted.length / PER_PAGE)));

	$effect(() => {
		const tp = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
		if (listPage > tp) listPage = tp;
	});

	const paged = $derived(sorted.slice((listPage - 1) * PER_PAGE, listPage * PER_PAGE));

	function onSearchInput() {
		listPage = 1;
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

	function podiumCardClass(rank: number | null | undefined): string {
		if (rank === 1) return 'm-members-card--p1';
		if (rank === 2) return 'm-members-card--p2';
		if (rank === 3) return 'm-members-card--p3';
		return '';
	}
</script>

<svelte:head>
	<title>{data.server.name || data.server.slug} Members | {APP_NAME} Discord Bot</title>
	<meta name="description" content="Members, ranks, XP, and voice stats for {data.server.name || data.server.slug}." />
	<meta name="theme-color" content="#245f73" />
	<meta property="og:title" content="{data.server.name || data.server.slug} Members | {APP_NAME} Discord Bot" />
	<meta property="og:description" content="Explore members, ranks, XP, and voice activity for this community." />
</svelte:head>

<div class="m-members">
	<div class="m-leaderboard-subhead m-stats-subhead mb-3 mb-4">
		<p>Members</p>
	</div>

	<div class="m-members-search-bar mb-4 flex flex-col flex-row items-center gap-2 gap-3 rounded-2xl px-4 py-3">
		<div class="m-members-search relative min-w-0 flex-1">
			<i class="fas fa-search m-members-search-ic pointer-events-none text-base" aria-hidden="true"></i>
			<input
				type="search"
				class="m-members-search-inp box-border min-h-10 w-full rounded-lg pt-2 pr-2 pb-2 pl-8 text-base"
				placeholder="Search name or ID"
				aria-label="Search members by name or Discord ID"
				bind:value={search}
				oninput={onSearchInput}
				autocomplete="off"
			/>
		</div>
		{#if sorted.length > PER_PAGE}
			<p class="m-members-page-hint m-0 ml-auto shrink-0 text-right text-base font-bold whitespace-nowrap tabular-nums">Page {listPage} / {totalPages}</p>
		{/if}
	</div>

	{#if paged.length === 0}
		<div class="m-members-empty px-4 py-12 text-center">
			<i class="fas fa-users" aria-hidden="true"></i>
			<p>No members found</p>
		</div>
	{:else}
		<ul class="m-members-grid m-0 grid gap-4 p-0">
			{#each paged as member, i (member.discord_member_id)}
				<li
					class="m-stat-card m-overview-card m-members-card {podiumCardClass(
						member.rank
					)} relative overflow-hidden rounded-2xl px-4 py-4 pt-4 pb-4 opacity-0 opacity-100"
					class:m-members-card--in={mounted}
					style="--pubm-card-dly:{i * 32}ms"
				>
					<div class="m-members-top flex items-start gap-4">
						<div class="m-members-aside flex shrink-0 flex-col items-center gap-2">
							<span class="m-members-rank-pill rounded-lg px-2 py-1 text-xs font-extrabold whitespace-nowrap text-white tabular-nums" title="Leaderboard rank"
								>{member.rank != null ? `#${member.rank}` : '—'}</span
							>
							<div class="m-members-av-ring shrink-0 rounded-full p-1">
								<img
									class="m-members-av-lg block h-14 w-14 rounded-full object-cover"
									src={avatarSrc(member)}
									alt=""
									width="56"
									height="56"
									onerror={(e) => ((e.currentTarget as HTMLImageElement).src = 'https://cdn.discordapp.com/embed/avatars/0.png')}
								/>
							</div>
						</div>
						<div class="m-members-main min-w-0 flex-1">
							<div class="m-members-name-row mb-2 flex flex-wrap items-center gap-x-2 gap-y-2">
								<span class="m-members-name max-w-full overflow-hidden font-extrabold text-ellipsis whitespace-nowrap">{listDisplayName(member)}</span>
								{#if member.is_afk}<span class="m-members-afk shrink-0 rounded-[100px] px-2 py-1 text-xs font-bold"
										><i class="fas fa-moon" aria-hidden="true"></i> AFK</span
									>{/if}
							</div>
							<p class="m-members-stats">
								<span>Lv.{member.level ?? 0}</span>
								<span class="m-members-dot text-[rgba(26,52,63,0.35)]">·</span>
								<span title="Messages">{fmtNum(member.chat_total ?? 0)} msgs</span>
								<span class="m-members-dot text-[rgba(26,52,63,0.35)]">·</span>
								<span title="Voice minutes">{fmtNum(member.voice_minutes_active ?? 0)}m act / {fmtNum(member.voice_minutes_afk ?? 0)}m AFK</span>
							</p>
							<p class="m-members-dates mx-0 mt-0 mb-0 mb-2 flex flex-wrap items-baseline gap-x-1 gap-y-1 text-xs font-semibold text-[rgba(26,52,63,0.72)]">
								<span
									><span class="m-members-dk mr-1 text-xs font-bold text-[rgba(26,52,63,0.42)] uppercase">Joined</span>
									<LocalTime value={member.member_since} fallback="N/A" /></span
								>
								<span class="m-members-dot text-[rgba(26,52,63,0.35)]">·</span>
								<span
									><span class="m-members-dk mr-1 text-xs font-bold text-[rgba(26,52,63,0.42)] uppercase">Discord since</span>
									<LocalTime value={member.profile_created_at} fallback="N/A" /></span
								>
							</p>
						</div>
					</div>
					<div class="m-members-xp-band mt-3 flex items-center justify-between gap-2 rounded-xl px-3 py-2">
						<span class="m-members-xp-band-l inline-flex items-center gap-2 text-xs font-bold text-[rgba(26,52,63,0.55)] uppercase"
							><i class="fas fa-star" aria-hidden="true"></i> Experience</span
						>
						<span class="m-members-xp-band-v text-lb-text text-base font-extrabold tabular-nums" title="Experience points"
							>{fmtNum(member.experience ?? 0)}</span
						>
					</div>
					{#if member.roles?.[0]}
						<div class="m-members-roles mt-3 flex flex-wrap gap-2 pt-3">
							<span
								class="m-members-role inline-flex max-w-full items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold"
								style={rolePillCssVars(member.roles[0].color)}
							>
								<i class="fas fa-circle" aria-hidden="true"></i>
								{member.roles[0].name || 'Role'}
							</span>
						</div>
					{/if}
				</li>
			{/each}
		</ul>

		{#if sorted.length > PER_PAGE}
			<div class="m-members-pager mt-4 flex items-center justify-between gap-2">
				<button
					type="button"
					class="m-members-btn inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-base font-semibold"
					disabled={listPage === 1}
					onclick={() => (listPage = Math.max(1, listPage - 1))}
				>
					<i class="fas fa-chevron-left" aria-hidden="true"></i> Prev
				</button>
				<span class="m-members-pg-meta text-base font-semibold">Page {listPage} / {totalPages}</span>
				<button
					type="button"
					class="m-members-btn inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-base font-semibold"
					disabled={listPage === totalPages}
					onclick={() => (listPage = Math.min(totalPages, listPage + 1))}
				>
					Next <i class="fas fa-chevron-right" aria-hidden="true"></i>
				</button>
			</div>
		{/if}
	{/if}
</div>
