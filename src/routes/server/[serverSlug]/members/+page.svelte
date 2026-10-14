<script lang="ts">
	import { legacyDefaultAvatarUrl } from '$lib/discordAvatars.js';
	import { APP_NAME } from '$lib/backend/panelServer.js';
	import { onDestroy, onMount } from 'svelte';
	import { onFirstInteraction } from '$lib/frontend/firstInteraction.js';
	import '../../../../server.css';
	import type { PageProps } from './$types';
	import LocalTime from '$lib/frontend/components/LocalTime.svelte';
	import { EmptyState, RankAvatar, rankStyle } from '$lib/frontend/components/public';
	import { normalizeAccent } from '$lib/themes.js';
	import ThemeEffect from '$lib/frontend/components/ThemeEffect.svelte';
	import EffectName from '$lib/frontend/components/EffectName.svelte';
	import type { PublicMembersStreamPayload } from '$lib/frontend/public/members/index.js';
	import { compact, md, serverLinkEmbed } from '$lib/frontend/public/linkEmbed.js';
	import { HEX_RADIX, RGB_MAX } from '$lib/utils/numbers.js';
	import { relativeLuminance } from '$lib/utils/rgb.js';

	const SHORT_HEX_LENGTH = 3;
	const HEX_COLOR_LENGTH = 6;
	const BLUE_HEX_OFFSET = 4;
	const COLOR_INT_MAX = 0xffffff;
	const RED_SHIFT_BITS = 16;
	const GREEN_SHIFT_BITS = 8;
	const NEAR_WHITE_LUMINANCE = 0.78;
	const NEAR_WHITE_CHANNEL = 248;
	const SOFT_TEXT_LUMINANCE = 0.52;
	const NEWEST_MEMBERS_SHOWN = 3;
	const ROW_STAGGER_MS = 32;
	const RANK_AVATAR_PX = 56;

	let { data }: PageProps = $props();

	const serverName = $derived(data.server.name || data.server.slug);
	const metaDescription = $derived(
		`Member directory for ${serverName} on Discord: ${(data.members ?? []).length.toLocaleString('en-US')} members with their rank, level, XP, messages, voice time and top role.`
	);

	type RoleRgb = { r: number; g: number; b: number };

	function parseRoleColorRaw(raw: string | null | undefined): RoleRgb | null {
		if (raw == null) {
			return null;
		}
		const s = String(raw).trim();
		if (s === '' || s.toLowerCase() === 'null' || s === 'undefined' || s === '0') {
			return null;
		}
		if (s.startsWith('#')) {
			let h = s.slice(1);
			if (h.length === SHORT_HEX_LENGTH) {
				h = h
					.split('')
					.map((c) => c + c)
					.join('');
			}
			if (h.length === HEX_COLOR_LENGTH && /^[0-9a-fA-F]+$/.test(h)) {
				return {
					r: parseInt(h.slice(0, 2), 16),
					g: parseInt(h.slice(2, BLUE_HEX_OFFSET), 16),
					b: parseInt(h.slice(BLUE_HEX_OFFSET, HEX_COLOR_LENGTH), 16)
				};
			}
			return null;
		}
		if (/^[0-9A-Fa-f]{6}$/.test(s)) {
			return {
				r: parseInt(s.slice(0, 2), 16),
				g: parseInt(s.slice(2, BLUE_HEX_OFFSET), 16),
				b: parseInt(s.slice(BLUE_HEX_OFFSET, HEX_COLOR_LENGTH), 16)
			};
		}
		const n = Number.parseInt(s, 10);
		if (Number.isFinite(n) && n >= 0 && n <= COLOR_INT_MAX) {
			return { r: (n >> RED_SHIFT_BITS) & RGB_MAX, g: (n >> GREEN_SHIFT_BITS) & RGB_MAX, b: n & RGB_MAX };
		}
		return null;
	}

	function rgbToHex({ r, g, b }: RoleRgb): string {
		return `#${[r, g, b].map((x) => Math.max(0, Math.min(RGB_MAX, x)).toString(HEX_RADIX).padStart(2, '0')).join('')}`;
	}

	function roleColorLuminance({ r, g, b }: RoleRgb): number {
		return relativeLuminance([r, g, b]);
	}

	function rolePillStyle(color: string | null | undefined): string {
		const rgb = parseRoleColorRaw(color);
		const fallback = `--role-fg: #2e211b; --role-bg: color-mix(in srgb, var(--color-primary) 10%, transparent); --role-bd: color-mix(in srgb, var(--color-primary) 38%, transparent); --role-dot: var(--color-primary);`;
		if (!rgb) {
			return fallback;
		}
		const L = roleColorLuminance(rgb);
		const nearWhite = L >= NEAR_WHITE_LUMINANCE || (rgb.r >= NEAR_WHITE_CHANNEL && rgb.g >= NEAR_WHITE_CHANNEL && rgb.b >= NEAR_WHITE_CHANNEL);
		if (nearWhite) {
			return fallback;
		}
		const hex = rgbToHex(rgb);
		const softText = L > SOFT_TEXT_LUMINANCE;
		return [
			`--role-fg: ${softText ? '#2e211b' : hex}`,
			`--role-bg: rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.13)`,
			`--role-bd: rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.45)`,
			`--role-dot: ${hex}`
		].join('; ');
	}

	let liveMembers = $state([...(data.members ?? [])]);
	let es: EventSource | null = null;
	let isMounted = $state(false);

	$effect(() => {
		liveMembers = [...(data.members ?? [])];
	});

	const members = $derived(liveMembers);

	function fmtNum(n: number): string {
		if (n == null) {
			return '0';
		}
		return Number(n).toLocaleString();
	}

	onMount(() => {
		requestAnimationFrame(() => {
			isMounted = true;
		});
		return onFirstInteraction(() => {
			const url = `/api/public-statistics/${encodeURIComponent(data.server.slug)}/members-stream`;
			const source = new EventSource(url);
			es = source;
			source.onmessage = (e) => {
				try {
					const payload = JSON.parse(e.data) as PublicMembersStreamPayload;
					if (payload?.members && Array.isArray(payload.members)) {
						liveMembers = payload.members;
					}
				} catch (_) {}
			};
			source.onerror = () => {};
		});
	});

	onDestroy(() => {
		es?.close();
	});

	const PER_PAGE = 50;

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
		if (listPage > tp) {
			listPage = tp;
		}
	});

	const paged = $derived(sorted.slice((listPage - 1) * PER_PAGE, listPage * PER_PAGE));

	function onSearchInput() {
		listPage = 1;
	}

	function displayName(m: (typeof members)[number]): string {
		if (m.server_display_name?.trim()) {
			return m.server_display_name;
		}
		if (m.display_name?.trim()) {
			return m.display_name;
		}
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
		return m.avatar ?? legacyDefaultAvatarUrl(m.discord_member_id);
	}

	function highestRole(m: (typeof members)[number]) {
		return (m.roles ?? []).reduce<(typeof m.roles)[number] | null>((top, r) => (top == null || (r.position ?? 0) > (top.position ?? 0) ? r : top), null);
	}

	const linkEmbed = $derived.by(() => {
		const all = data.members ?? [];
		const boosters = all.filter((m) => m.is_booster).length;
		const newest = [...all]
			.filter((m) => m.member_since)
			.sort((a, b) => new Date(b.member_since!).getTime() - new Date(a.member_since!).getTime())
			.slice(0, NEWEST_MEMBERS_SHOWN)
			.map((m) => `**${md(listDisplayName(m))}**`);
		const lines = [
			`**${compact(all.length)}** members${boosters > 0 ? ` · **${compact(boosters)}** boosters` : ''}`,
			...(newest.length ? [`Newest: ${newest.join(', ')}`] : [])
		];
		return serverLinkEmbed({ ...data.server, name: serverName }, { url: data.canonicalUrl, subtitle: 'Member directory', lines });
	});
</script>

<svelte:head>
	<title>{serverName} Members | {APP_NAME} Discord Bot</title>
	<meta name="description" content={metaDescription} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={APP_NAME} />
	<meta property="og:url" content={data.canonicalUrl} />
	<meta property="og:title" content="{serverName} Members | {APP_NAME} Discord Bot" />
	<meta property="og:description" content={metaDescription} />
	<link rel="canonical" href={data.canonicalUrl} />
	{@html linkEmbed}
</svelte:head>

<div class="text-base-content/70 mb-3 flex flex-wrap items-center gap-1.5 text-xs">
	<p class="m-0 flex flex-wrap items-center gap-1.5">Members</p>
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
			{@const topRole = highestRole(member)}
			{@const memberAccent = normalizeAccent(member.theme_accent)}
			{@const memberImage = member.theme_image ?? null}
			<li
				class="card border-base-300 bg-base-100 relative isolate overflow-hidden border shadow-sm transition-all duration-500 ease-out {isMounted
					? 'translate-y-0 opacity-100'
					: 'translate-y-3 opacity-0'} {rs ? 'border-l-4' : ''}"
				style="transition-delay: {i * ROW_STAGGER_MS}ms;{rs ? ` border-left-color: ${rs.bar};` : ''}{memberAccent ? ` --row-accent: ${memberAccent};` : ''}"
			>
				{#if memberAccent}
					{#if memberImage}
						<div
							class="pointer-events-none absolute inset-0 -z-20 bg-cover bg-center opacity-18"
							style="background-image: url('{memberImage}')"
							aria-hidden="true"
						></div>
					{/if}
					<div
						class="pointer-events-none absolute inset-0 -z-10 bg-linear-to-r from-[color-mix(in_srgb,var(--row-accent)_22%,transparent)] to-transparent"
						aria-hidden="true"
					></div>
					<ThemeEffect effect={member.theme_effect} seed={member.theme_effect_seed} accent={member.theme_accent} />
				{/if}
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
							<RankAvatar src={avatarSrc(member)} name={listDisplayName(member)} size={RANK_AVATAR_PX} />
						</div>

						<div class="min-w-0 flex-1">
							<div class="mb-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
								<EffectName
									name={listDisplayName(member)}
									effect={member.theme_effect}
									seed={member.theme_effect_seed}
									accent={member.theme_accent}
									class="text-base-content truncate text-[clamp(15px,3.8vw,17px)] font-extrabold tracking-tight"
								/>
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

					{#if topRole}
						<div class="border-base-300 mt-3 flex flex-wrap gap-1.5 border-t pt-3">
							<span
								class="badge badge-sm h-auto max-w-full gap-1.5 px-2.5 py-[3px] text-[10px] font-semibold"
								style="{rolePillStyle(topRole.color)}; border-color: var(--role-bd); background: var(--role-bg); color: var(--role-fg);"
							>
								<i class="fas fa-circle text-[5px]" style="color: var(--role-dot);" aria-hidden="true"></i>
								{topRole.name || 'Role'}
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
