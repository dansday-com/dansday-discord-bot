<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { onDestroy, onMount } from 'svelte';
	import type { PageProps } from './$types';
	import LocalTime from '$lib/frontend/components/LocalTime.svelte';
	import { EmptyState, RankAvatar, rankStyle } from '$lib/frontend/components/public';
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

	function rolePillStyle(color: string | null | undefined): string {
		const rgb = parseRoleColorRaw(color);
		const fallback = `--role-fg: #1a343f; --role-bg: rgba(36, 95, 115, 0.1); --role-bd: rgba(36, 95, 115, 0.38); --role-dot: #245f73;`;
		if (!rgb) return fallback;
		const L = roleColorLuminance(rgb);
		const nearWhite = L >= 0.78 || (rgb.r >= 248 && rgb.g >= 248 && rgb.b >= 248);
		if (nearWhite) return fallback;
		const hex = rgbToHex(rgb);
		const softText = L > 0.52;
		return [
			`--role-fg: ${softText ? '#1a343f' : hex}`,
			`--role-bg: rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.13)`,
			`--role-bd: rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.45)`,
			`--role-dot: ${hex}`
		].join('; ');
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
</script>

<svelte:head>
	<title>{data.server.name || data.server.slug} Members | {APP_NAME} Discord Bot</title>
	<meta name="description" content="Members, ranks, XP, and voice stats for {data.server.name || data.server.slug}." />
	<meta name="theme-color" content="#245f73" />
	<meta property="og:title" content="{data.server.name || data.server.slug} Members | {APP_NAME} Discord Bot" />
	<meta property="og:description" content="Explore members, ranks, XP, and voice activity for this community." />
</svelte:head>

<div class="m-leaderboard-subhead m-stats-subhead">
	<p>Members</p>
</div>

<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
	<label class="input border-base-300 bg-base-100 flex w-full max-w-sm items-center gap-2">
		<i class="fas fa-search text-base-content/40 text-sm" aria-hidden="true"></i>
		<input
			type="search"
			class="grow"
			placeholder="Search name or ID"
			aria-label="Search members by name or Discord ID"
			bind:value={search}
			oninput={onSearchInput}
			autocomplete="off"
		/>
	</label>
	{#if sorted.length > PER_PAGE}
		<p class="text-base-content/50 text-xs font-semibold">Page {listPage} / {totalPages}</p>
	{/if}
</div>

{#if paged.length === 0}
	<EmptyState icon="fa-users" message="No members found" />
{:else}
	<ul class="grid list-none grid-cols-1 gap-3.5 p-0 min-[600px]:grid-cols-2 min-[600px]:gap-4">
		{#each paged as member, i (member.discord_member_id)}
			{@const rs = rankStyle(member.rank)}
			<li
				class="card border-base-300 bg-base-100 overflow-hidden border shadow-sm transition-all duration-500 ease-out {mounted
					? 'translate-y-0 opacity-100'
					: 'translate-y-3 opacity-0'} {rs ? 'border-l-4' : ''}"
				style="transition-delay: {i * 32}ms;{rs ? ` border-left-color: ${rs.bar};` : ''}"
			>
				<div class="card-body gap-0 p-4">
					<div class="flex items-start gap-3.5">
						<div class="flex shrink-0 flex-col items-center gap-2">
							<span
								class="badge badge-sm border-base-content/20 h-auto px-2.5 py-[3px] text-[11px] font-extrabold tabular-nums shadow-sm"
								title="Leaderboard rank"
								style={rs
									? `background: ${rs.pill}; color: ${rs.pillText};`
									: 'background: linear-gradient(135deg, var(--color-secondary), var(--color-primary)); color: #fff;'}
							>
								{member.rank != null ? `#${member.rank}` : '—'}
							</span>
							<RankAvatar src={avatarSrc(member)} name={listDisplayName(member)} size={56} />
						</div>

						<div class="min-w-0 flex-1">
							<div class="mb-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
								<span class="text-base-content truncate text-[clamp(15px,3.8vw,17px)] font-extrabold tracking-tight">{listDisplayName(member)}</span>
								{#if member.is_afk}
									<span class="badge badge-sm bg-secondary/12 border-secondary/22 text-secondary shrink-0 gap-1 text-[10px] font-bold">
										<i class="fas fa-moon" aria-hidden="true"></i> AFK
									</span>
								{/if}
							</div>

							<p class="text-base-content/70 m-0 mb-1.5 flex flex-wrap items-baseline gap-x-1 gap-y-0.5 text-[11px] font-semibold">
								<span>Lv.{member.level ?? 0}</span>
								<span class="text-base-content/35 select-none">·</span>
								<span title="Messages">{fmtNum(member.chat_total ?? 0)} msgs</span>
								<span class="text-base-content/35 select-none">·</span>
								<span title="Voice minutes">{fmtNum(member.voice_minutes_active ?? 0)}m act / {fmtNum(member.voice_minutes_afk ?? 0)}m AFK</span>
							</p>

							<p class="text-base-content/45 m-0 flex flex-wrap items-baseline gap-x-1 gap-y-0.5 text-[10px] font-semibold">
								<span>
									<span class="text-base-content/40 mr-0.5 text-[9px] font-bold tracking-[0.05em] uppercase">Joined</span>
									<LocalTime value={member.member_since} fallback="N/A" />
								</span>
								<span class="text-base-content/35 select-none">·</span>
								<span>
									<span class="text-base-content/40 mr-0.5 text-[9px] font-bold tracking-[0.05em] uppercase">Discord since</span>
									<LocalTime value={member.profile_created_at} fallback="N/A" />
								</span>
							</p>
						</div>
					</div>

					<div
						class="from-primary/10 to-secondary/6 border-primary/15 mt-3 flex items-center justify-between gap-2.5 rounded-xl border bg-linear-to-br px-3 py-2.5"
					>
						<span class="text-base-content/55 inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.07em] uppercase">
							<i class="fas fa-star text-accent text-[11px]" aria-hidden="true"></i> XP
						</span>
						<span class="text-base-content text-[17px] font-extrabold tracking-tight tabular-nums" title="XP">{fmtNum(member.xp ?? 0)}</span>
					</div>

					{#if member.roles?.[0]}
						<div class="border-base-300 mt-3 flex flex-wrap gap-1.5 border-t pt-3">
							<span
								class="badge badge-sm h-auto max-w-full gap-1.5 px-2.5 py-[3px] text-[10px] font-semibold"
								style="{rolePillStyle(member.roles[0].color)}; border-color: var(--role-bd); background: var(--role-bg); color: var(--role-fg);"
							>
								<i class="fas fa-circle text-[5px]" style="color: var(--role-dot);" aria-hidden="true"></i>
								{member.roles[0].name || 'Role'}
							</span>
						</div>
					{/if}
				</div>
			</li>
		{/each}
	</ul>

	{#if sorted.length > PER_PAGE}
		<div class="mt-4 flex items-center justify-between gap-2.5">
			<button type="button" class="btn btn-sm sm:btn-md" disabled={listPage === 1} onclick={() => (listPage = Math.max(1, listPage - 1))}>
				<i class="fas fa-chevron-left" aria-hidden="true"></i> Prev
			</button>
			<span class="text-base-content/60 text-xs font-semibold">Page {listPage} / {totalPages}</span>
			<button type="button" class="btn btn-sm sm:btn-md" disabled={listPage === totalPages} onclick={() => (listPage = Math.min(totalPages, listPage + 1))}>
				Next <i class="fas fa-chevron-right" aria-hidden="true"></i>
			</button>
		</div>
	{/if}
{/if}
