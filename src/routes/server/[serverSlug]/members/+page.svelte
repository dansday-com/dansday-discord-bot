<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { onDestroy, onMount } from 'svelte';
	import { page } from '$app/state';
	import type { PageProps } from './$types';
	import LocalTime from '$lib/frontend/components/LocalTime.svelte';
	import MemberCard from '$lib/frontend/components/MemberCard.svelte';
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

	let cardMember = $state<(typeof liveMembers)[number] | null>(null);

	function closeCard() {
		cardMember = null;
	}

	let inventoryToken = $state<string>('');
	let inventoryOpen = $state(false);
	let inventoryLoading = $state(false);
	let inventoryItems = $state<any[]>([]);
	let inventoryOwner = $state<string>('');
	let usingItem = $state<number | null>(null);
	let pickingTargetFor = $state<any | null>(null);

	const TARGETED = new Set(['xp_steal', 'xp_bomb', 'leech', 'gift', 'bounty']);

	async function openInventory(token: string) {
		inventoryToken = token;
		inventoryOpen = true;
		inventoryLoading = true;
		try {
			const res = await fetch(`/api/leaderboards/${encodeURIComponent(data.server.slug)}/shop/inventory?card=${encodeURIComponent(token)}`);
			const d = await res.json();
			if (d.success) {
				inventoryItems = d.items ?? [];
				inventoryOwner = d.member?.name ?? '';
			} else {
				inventoryItems = [];
			}
		} finally {
			inventoryLoading = false;
		}
	}

	function closeInventory() {
		inventoryOpen = false;
		pickingTargetFor = null;
	}

	async function useItem(item: any, targetToken?: string) {
		usingItem = item.member_item_id;
		try {
			const res = await fetch(`/api/leaderboards/${encodeURIComponent(data.server.slug)}/shop/use`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ card: inventoryToken, target_card: targetToken, member_item_id: item.member_item_id })
			});
			const d = await res.json();
			if (d.success) {
				const detail = d.result?.xp ? ` (${d.result.xp} XP)` : '';
				alert(`Used ${item.name}!${detail}`);
				pickingTargetFor = null;
				await openInventory(inventoryToken);
			} else {
				alert(d.error || 'Failed to use item');
			}
		} finally {
			usingItem = null;
		}
	}

	function onUseClick(item: any) {
		if (TARGETED.has(item.effect_type)) pickingTargetFor = item;
		else useItem(item);
	}

	function fmtNum(n: number): string {
		if (n == null) return '0';
		return Number(n).toLocaleString();
	}

	onMount(() => {
		const cardId = page.url.searchParams.get('card');
		if (cardId && data.members) {
			const found = data.members.find((m: any) => m.cardToken === cardId);
			if (found) {
				cardMember = found;
			}
		}

		const invId = page.url.searchParams.get('inventory');
		if (invId) {
			openInventory(invId);
		}

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
	<div class="m-leaderboard-subhead m-stats-subhead">
		<p>Members</p>
	</div>

	<div class="m-members-search-bar">
		<div class="m-members-search">
			<i class="fas fa-search m-members-search-ic" aria-hidden="true"></i>
			<input
				type="search"
				class="m-members-search-inp"
				placeholder="Search name or ID"
				aria-label="Search members by name or Discord ID"
				bind:value={search}
				oninput={onSearchInput}
				autocomplete="off"
			/>
		</div>
		{#if sorted.length > PER_PAGE}
			<p class="m-members-page-hint">Page {listPage} / {totalPages}</p>
		{/if}
	</div>

	{#if paged.length === 0}
		<div class="m-members-empty">
			<i class="fas fa-users" aria-hidden="true"></i>
			<p>No members found</p>
		</div>
	{:else}
		<ul class="m-members-grid">
			{#each paged as member, i (member.discord_member_id)}
				<li
					class="m-stat-card m-overview-card m-members-card {podiumCardClass(member.rank)}"
					class:m-members-card--in={mounted}
					style="--pubm-card-dly:{i * 32}ms"
				>
					<div class="m-members-top">
						<div class="m-members-aside">
							<span class="m-members-rank-pill" title="Leaderboard rank">{member.rank != null ? `#${member.rank}` : '—'}</span>
							<div class="m-members-av-ring">
								<img
									class="m-members-av-lg"
									src={avatarSrc(member)}
									alt=""
									width="56"
									height="56"
									onerror={(e) => ((e.currentTarget as HTMLImageElement).src = 'https://cdn.discordapp.com/embed/avatars/0.png')}
								/>
							</div>
						</div>
						<div class="m-members-main">
							<div class="m-members-name-row">
								<span class="m-members-name">{listDisplayName(member)}</span>
								{#if member.is_afk}<span class="m-members-afk"><i class="fas fa-moon" aria-hidden="true"></i> AFK</span>{/if}
							</div>
							<p class="m-members-stats">
								<span>Lv.{member.level ?? 0}</span>
								<span class="m-members-dot">·</span>
								<span title="Messages">{fmtNum(member.chat_total ?? 0)} msgs</span>
								<span class="m-members-dot">·</span>
								<span title="Voice minutes">{fmtNum(member.voice_minutes_active ?? 0)}m act / {fmtNum(member.voice_minutes_afk ?? 0)}m AFK</span>
							</p>
							<p class="m-members-dates">
								<span><span class="m-members-dk">Joined</span> <LocalTime value={member.member_since} fallback="N/A" /></span>
								<span class="m-members-dot">·</span>
								<span><span class="m-members-dk">Discord since</span> <LocalTime value={member.profile_created_at} fallback="N/A" /></span>
							</p>
						</div>
					</div>
					<div class="m-members-xp-band">
						<span class="m-members-xp-band-l"><i class="fas fa-star" aria-hidden="true"></i> Experience</span>
						<span class="m-members-xp-band-v" title="Experience points">{fmtNum(member.experience ?? 0)}</span>
					</div>
					{#if member.roles?.length > 0}
						<div class="m-members-roles">
							{#each member.roles as role}
								<span class="m-members-role" style={rolePillCssVars(role.color)}>
									<i class="fas fa-circle" aria-hidden="true"></i>
									{role.name || 'Role'}
								</span>
							{/each}
						</div>
					{/if}
				</li>
			{/each}
		</ul>

		{#if sorted.length > PER_PAGE}
			<div class="m-members-pager">
				<button type="button" class="m-members-btn" disabled={listPage === 1} onclick={() => (listPage = Math.max(1, listPage - 1))}>
					<i class="fas fa-chevron-left" aria-hidden="true"></i> Prev
				</button>
				<span class="m-members-pg-meta">Page {listPage} / {totalPages}</span>
				<button type="button" class="m-members-btn" disabled={listPage === totalPages} onclick={() => (listPage = Math.min(totalPages, listPage + 1))}>
					Next <i class="fas fa-chevron-right" aria-hidden="true"></i>
				</button>
			</div>
		{/if}
	{/if}
</div>

{#if cardMember}
	<MemberCard member={cardMember} serverName={data.server.name || data.server.slug} serverIcon={data.server.server_icon} onclose={closeCard} />
{/if}

{#if inventoryOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onclick={closeInventory} role="presentation">
		<div
			class="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#10131a] p-5"
			onclick={(e) => e.stopPropagation()}
			role="presentation"
		>
			<div class="mb-4 flex items-center justify-between">
				<h3 class="flex items-center gap-2 text-base font-semibold text-white">
					<i class="fas fa-backpack text-teal-400"></i>Inventory{#if inventoryOwner}<span class="text-white/40">· {inventoryOwner}</span>{/if}
				</h3>
				<button onclick={closeInventory} class="text-white/50 hover:text-white" aria-label="Close"><i class="fas fa-xmark"></i></button>
			</div>

			{#if inventoryLoading}
				<p class="py-8 text-center text-sm text-white/50"><i class="fas fa-spinner fa-spin mr-1"></i>Loading...</p>
			{:else if inventoryItems.length === 0}
				<p class="py-8 text-center text-sm text-white/50">No items. Buy some in the shop!</p>
			{:else if pickingTargetFor}
				<div>
					<button onclick={() => (pickingTargetFor = null)} class="mb-3 text-xs text-white/60 hover:text-white"
						><i class="fas fa-arrow-left mr-1"></i>Back</button
					>
					<p class="mb-2 text-sm text-white">Pick a target for <strong>{pickingTargetFor.name}</strong>:</p>
					<div class="max-h-64 space-y-1 overflow-y-auto">
						{#each members as m}
							{#if m.cardToken !== inventoryToken}
								<button
									onclick={() => useItem(pickingTargetFor, m.cardToken)}
									disabled={usingItem === pickingTargetFor.member_item_id}
									class="flex w-full items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 disabled:opacity-50"
								>
									<span class="truncate">{m.server_display_name || m.display_name || m.username}</span>
								</button>
							{/if}
						{/each}
					</div>
				</div>
			{:else}
				<div class="space-y-2">
					{#each inventoryItems as item (item.member_item_id)}
						<div class="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
							<span class="text-2xl">{item.icon || '🎁'}</span>
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2 text-sm font-medium text-white">
									<span class="truncate">{item.name}</span>
									<span class="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60">×{item.quantity}</span>
								</div>
								{#if item.description}<p class="line-clamp-1 text-xs text-white/50">{item.description}</p>{/if}
							</div>
							<button
								onclick={() => onUseClick(item)}
								disabled={usingItem === item.member_item_id || item.quantity <= 0}
								class="shrink-0 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-500 disabled:opacity-50"
							>
								{#if usingItem === item.member_item_id}<i class="fas fa-spinner fa-spin"></i>{:else}Use{/if}
							</button>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/if}
