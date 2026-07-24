<script lang="ts">
	import { getContext } from 'svelte';
	import { effectLabel, effectIcon } from '$lib/items.js';
	import { publicServerPath } from '$lib/url.js';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const ctx = getContext('items') as any;
	const { fmt } = ctx;

	const base = $derived(`${publicServerPath(data.server.slug)}/account/history/${data.tab}/${data.hash}`);

	const LEVEL_SOURCE: Record<string, { label: string; icon: string }> = {
		chat: { label: 'Chat', icon: 'fa-message' },
		voice: { label: 'Voice', icon: 'fa-microphone' },
		voice_afk: { label: 'AFK Voice', icon: 'fa-moon' },
		video: { label: 'Video', icon: 'fa-video' },
		stream: { label: 'Streaming', icon: 'fa-tower-broadcast' },
		leech: { label: 'Leech', icon: 'fa-droplet' }
	};

	type Badge = { icon: string; text: string };

	function levelLine(h: any): { icon: string; title: string; tone: string; deltaLabel: string; badges: Badge[] } {
		const src = LEVEL_SOURCE[h.source] ?? { label: h.source ?? 'Level', icon: 'fa-star' };
		const badges: Badge[] = [];
		if (h.level != null) badges.push({ icon: 'fa-arrow-up-right-dots', text: `Lv ${h.level}` });
		if (h.rank != null) badges.push({ icon: 'fa-ranking-star', text: `#${h.rank}` });
		if (h.totalXp != null) badges.push({ icon: 'fa-star', text: `${fmt(h.totalXp)} total` });
		if (h.multiplier) badges.push({ icon: 'fa-bolt', text: `${h.multiplier}× Boost` });
		if (h.friendPercent) badges.push({ icon: 'fa-handshake', text: `+${h.friendPercent}% Friend boost` });
		if (h.skimPercent) {
			const total = Number(h.skimPercent) || 0;
			const luck = Number(h.luckPercent) || 0;
			const val = luck > 0 ? `${fmtRate(total)}% (${fmtRate(total - luck)} +${fmtRate(luck)} 🍀)` : `${fmtRate(total)}%`;
			badges.push({ icon: 'fa-droplet', text: h.source === 'leech' ? `${val} Siphoned` : `−${val} Leech` });
		}
		return {
			icon: src.icon,
			title: `${src.label} XP`,
			tone: 'win',
			deltaLabel: `+${fmt(h.xpAmount)} XP`,
			badges
		};
	}

	function fmtIdr(n: number): string {
		const v = Number(n) || 0;
		if (v >= 100) return `Rp${Math.round(v).toLocaleString('id-ID')}`;
		if (v >= 1) return `Rp${v.toLocaleString('id-ID', { maximumFractionDigits: 2 })}`;
		return `Rp${v.toLocaleString('id-ID', { maximumFractionDigits: 6 })}`;
	}
	function fmtUnits(qty: number): string {
		const v = Number(qty) || 0;
		if (v <= 0) return '0';
		if (v >= 1) return v.toLocaleString('en-US', { maximumFractionDigits: 4 });
		if (v >= 0.0001) return v.toFixed(6);
		return v.toFixed(8);
	}

	function assetLine(h: any): { icon: string; title: string; tone: string; deltaLabel: string; badges: Badge[] } {
		const units = Number(h.price) > 0 ? Number(h.xpAmount) / Number(h.price) : 0;
		const badges: Badge[] = [{ icon: 'fa-coins', text: `${fmtUnits(units)} ${h.symbol}` }];
		if (h.action === 'buy') {
			return { icon: 'fa-arrow-trend-up', title: `Bought ${h.symbol}`, tone: 'spend', deltaLabel: `−${fmt(h.xpAmount)} XP`, badges };
		}
		const net = Number(h.net) || 0;
		const won = net >= 0;
		return {
			icon: 'fa-hand-holding-dollar',
			title: `Sold ${h.symbol}`,
			tone: won ? 'win' : 'lose',
			deltaLabel: `+${fmt(h.xpAmount)} XP`,
			badges: [...badges, { icon: won ? 'fa-arrow-up' : 'fa-arrow-down', text: `${net >= 0 ? '+' : '−'}${fmt(Math.abs(net))} XP` }]
		};
	}

	function minigameLine(h: any): { icon: string; title: string; tone: string; deltaLabel: string; badges: Badge[] } {
		const won = h.outcome === 'win';
		const net = Number(h.xpAmount) || 0;
		const badges: Badge[] = [{ icon: 'fa-dice', text: `${Number(h.multiplier).toFixed(2)}×` }];
		if (h.chance != null) {
			const total = Number(h.chance) || 0;
			const luck = Number(h.luckPercent) || 0;
			const val = luck > 0 ? `${fmtRate(total)}% (${fmtRate(total - luck)} +${fmtRate(luck)} 🍀) chance` : `${fmtRate(total)}% chance`;
			badges.push({ icon: luck > 0 ? 'fa-clover' : 'fa-percent', text: val });
		}
		return {
			icon: won ? 'fa-sack-dollar' : 'fa-skull',
			title: won ? 'Gamble — Won' : 'Gamble — Lost',
			tone: won ? 'win' : 'lose',
			deltaLabel: `${net >= 0 ? '+' : '−'}${fmt(Math.abs(net))} XP`,
			badges
		};
	}

	function ago(ms: number): string {
		const s = Math.max(0, Math.floor((ctx.now - ms) / 1000));
		const m = Math.floor(s / 60);
		const h = Math.floor(m / 60);
		const d = Math.floor(h / 24);
		if (d > 0) return `${d}d ago`;
		if (h > 0) return `${h}h ago`;
		if (m > 0) return `${m}m ago`;
		return `${s}s ago`;
	}

	function luckBadges(h: any, suffix?: string): Badge[] {
		if (h.ratePercent == null) return [];
		const total = Number(h.ratePercent) || 0;
		const luck = Number(h.luckPercent) || 0;
		const base = total - luck;
		const text = luck > 0 ? `${fmtRate(total)}% (${fmtRate(base)} +${fmtRate(luck)} 🍀)` : `${fmtRate(total)}%`;
		return [{ icon: h.luckPercent ? 'fa-clover' : 'fa-percent', text: suffix ? `${text} ${suffix}` : text }];
	}
	function fmtRate(n: number): string {
		return Number.isInteger(n) ? `${n}` : n.toFixed(1);
	}

	function line(h: any): { icon: string; title: string; tone: string; deltaLabel: string; badges?: Badge[] } {
		if (h.action === 'gift' && h.outcome === 'admin')
			return { icon: effectIcon('gift'), title: `Gift from admin — ${h.itemName ?? 'item'}`, tone: 'win', deltaLabel: 'Received' };
		if (h.action === 'buy') return { icon: 'fa-cart-shopping', title: `Bought ${h.itemName ?? 'item'}`, tone: 'spend', deltaLabel: `−${fmt(h.xpAmount)} XP` };
		if (h.action === 'discard') return { icon: 'fa-trash-can', title: `Removed ${h.itemName ?? 'item'}`, tone: 'neutral', deltaLabel: 'Discarded' };
		if (h.action === 'bounty_collected') {
			if (h.direction === 'incoming') {
				const from = h.actorName ? ` ← ${h.actorName}` : '';
				return { icon: effectIcon('bounty'), title: `Bounty on you claimed${from}`, tone: 'neutral', deltaLabel: '' };
			}
			const on = h.targetName ? ` ← ${h.targetName}` : '';
			return { icon: effectIcon('bounty'), title: `Bounty collected${on}`, tone: 'win', deltaLabel: h.xpAmount > 0 ? `+${fmt(h.xpAmount)} XP` : '' };
		}

		if (h.direction === 'incoming') return incomingLine(h);

		const PAST_TITLE: Record<string, string> = {
			steal: 'Robbed',
			bomb: 'Bombed',
			leech: 'Leeched',
			gift: 'Gifted',
			bounty: 'Bounty placed',
			boost: 'Boost activated',
			shield: 'Shield activated',
			reflect: 'Reflect activated',
			insurance: 'Insurance activated',
			luck: 'Luck activated'
		};
		if (h.action === 'insurance' && h.outcome === 'refunded') {
			const from = h.targetName ? ` ← ${h.targetName}` : '';
			return { icon: 'fa-money-bill-transfer', title: `Insurance refund${from}`, tone: 'win', deltaLabel: h.xpAmount > 0 ? `+${fmt(h.xpAmount)} XP` : '' };
		}
		if (h.action === 'insurance') {
			return {
				icon: effectIcon('insurance'),
				title: 'Insurance activated',
				tone: 'neutral',
				deltaLabel: '',
				badges: luckBadges(h, 'Refund')
			};
		}
		if (h.action === 'luck') {
			return {
				icon: effectIcon('luck'),
				title: 'Luck activated',
				tone: 'win',
				deltaLabel: '',
				badges: [{ icon: 'fa-clover', text: `+${h.ratePercent ?? 0}%` }]
			};
		}
		const target = h.targetName ? ` → ${h.targetName}` : '';
		if (h.action === 'spy') {
			if (h.outcome === 'caught') return { icon: 'fa-triangle-exclamation', title: `Spy caught${target}`, tone: 'lose', deltaLabel: 'Caught' };
			return { icon: effectIcon('spy'), title: `Spied${target}`, tone: 'neutral', deltaLabel: '', badges: luckBadges(h, 'Chance') };
		}
		if (h.action === 'leech') {
			return { icon: effectIcon('leech'), title: `Leeched${target}`, tone: 'neutral', deltaLabel: '', badges: luckBadges(h, 'Skim') };
		}
		const title = PAST_TITLE[h.action] ?? effectLabel(h.action);
		let tone = 'neutral';
		let deltaLabel = '';
		if (h.outcome === 'blocked' || h.outcome === 'reflected' || h.outcome === 'immune') {
			tone = 'lose';
			deltaLabel = h.outcome === 'reflected' ? 'Reflected' : h.outcome === 'immune' ? 'Immune' : 'Blocked';
		} else if (h.action === 'steal' && h.xpAmount > 0) {
			tone = 'win';
			deltaLabel = `+${fmt(h.xpAmount)} XP`;
		} else if (h.action === 'bomb' && h.xpAmount > 0) {
			deltaLabel = `${fmt(h.xpAmount)} XP destroyed`;
		} else if (h.action === 'gift' && h.xpAmount > 0) {
			deltaLabel = `${fmt(h.xpAmount)} XP sent`;
		} else if (h.action === 'bounty' && h.xpAmount > 0) {
			tone = 'spend';
			deltaLabel = `−${fmt(h.xpAmount)} XP`;
		}
		if (h.action === 'gift' && (h.ratePercent || h.luckPercent)) {
			return { icon: effectIcon(h.action), title: `${title}${target}`, tone, deltaLabel, badges: luckBadges(h, 'Tax') };
		}
		return { icon: effectIcon(h.action), title: `${title}${target}`, tone, deltaLabel };
	}

	function incomingLine(h: any): { icon: string; title: string; tone: string; deltaLabel: string; badges?: Badge[] } {
		const by = h.actorName ? ` ← ${h.actorName}` : h.actorDisguised ? ` ← an unknown member 🎭` : '';
		const icon = effectIcon(h.action);

		if (h.action === 'spy' && h.outcome === 'caught') {
			const caughtBy = h.actorName ? ` ← ${h.actorName}` : '';
			return { icon: 'fa-magnifying-glass', title: `Caught a spy${caughtBy}`, tone: 'win', deltaLabel: 'Caught' };
		}

		if (h.outcome === 'blocked') return { icon: 'fa-shield-halved', title: `Blocked ${h.action}${by}`, tone: 'win', deltaLabel: 'Defended' };
		if (h.outcome === 'immune') return { icon: 'fa-shield-halved', title: `Immune to ${h.action}${by}`, tone: 'win', deltaLabel: 'Defended' };
		if (h.outcome === 'reflected') return { icon: 'fa-arrows-rotate', title: `Reflected ${h.action}${by}`, tone: 'win', deltaLabel: 'Reflected' };

		if (h.action === 'gift') {
			return {
				icon,
				title: `Received gift${by}`,
				tone: 'win',
				deltaLabel: h.xpAmount > 0 ? `+${fmt(h.xpAmount)} XP` : '',
				badges: luckBadges(h, 'Tax')
			};
		}
		if (h.action === 'steal') {
			return { icon, title: `Robbed${by}`, tone: 'lose', deltaLabel: h.xpAmount > 0 ? `−${fmt(h.xpAmount)} XP` : '' };
		}
		if (h.action === 'bomb') {
			return { icon, title: `Bombed${by}`, tone: 'lose', deltaLabel: h.xpAmount > 0 ? `−${fmt(h.xpAmount)} XP` : '' };
		}
		if (h.action === 'leech') {
			return { icon, title: `Leeched${by}`, tone: 'lose', deltaLabel: '', badges: luckBadges(h, 'Skimmed') };
		}
		if (h.action === 'bounty') {
			return { icon, title: `Bounty on you${by}`, tone: 'lose', deltaLabel: '' };
		}
		return { icon, title: `${effectLabel(h.action)}${by}`, tone: 'neutral', deltaLabel: '' };
	}
</script>

<svelte:head><title>{data.server.name || data.server.slug} Level History | {APP_NAME} Discord Bot</title></svelte:head>

{#if data.historyTotal === 0}
	<div class="m-members-empty px-4 py-12 text-center">
		{#if data.tab === 'level'}No level XP earned yet. Chat or join voice to start earning.{:else if data.tab === 'items'}No item activity yet. Buy or use an
			item to start.{:else if data.tab === 'assets'}No asset trades yet. Invest XP from the Assets tab to start.{:else}No activity yet.{/if}
	</div>
{:else}
	<ul class="m-hist flex flex-col gap-2 p-0">
		{#each data.pagedHistory as h (h.id)}
			{@const l = h.kind === 'level' ? levelLine(h) : h.kind === 'asset' ? assetLine(h) : h.kind === 'minigame' ? minigameLine(h) : line(h)}
			<li class="m-hist-row m-hist-row--{l.tone} flex items-center gap-3 rounded-xl px-3 py-2">
				<span class="m-hist-icon flex h-8 w-8 flex-none items-center justify-center rounded-lg text-base"><i class="fas {l.icon}"></i></span>
				<span class="m-hist-body flex min-w-0 flex-auto flex-col gap-1">
					<span class="m-hist-title text-lb-text overflow-hidden text-base font-semibold text-ellipsis whitespace-nowrap">{l.title}</span>
					{#if (l as any).badges?.length}
						<span class="m-hist-badges mx-0 mt-1 mb-1 flex flex-wrap gap-1">
							{#each (l as any).badges as b}
								<span class="m-hist-badge text-lb-text-muted inline-flex items-center gap-1 rounded-[999px] px-2 py-1 text-base font-bold"
									><i class="fas {b.icon}"></i>{b.text}</span
								>
							{/each}
						</span>
					{/if}
					<span class="m-hist-time text-lb-text-muted text-base">{h.at ? ago(h.at) : ''}</span>
				</span>
				{#if l.deltaLabel}<span class="m-hist-delta m-hist-delta--{l.tone} flex-none text-base font-extrabold whitespace-nowrap tabular-nums"
						>{l.deltaLabel}</span
					>{/if}
			</li>
		{/each}
	</ul>
	{#if data.totalPages > 1}
		<div class="m-hist-pager mt-4 flex items-center justify-center gap-4">
			{#if data.historyPage > 1}
				<a
					class="m-hist-page-btn text-lb-text flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg"
					href="{base}?page={data.historyPage - 1}"
					data-sveltekit-preload-data="hover"><i class="fas fa-chevron-left"></i></a
				>
			{:else}
				<span class="m-hist-page-btn m-hist-page-btn--off text-lb-text flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg"
					><i class="fas fa-chevron-left"></i></span
				>
			{/if}
			<span class="m-hist-page-info text-lb-text-muted text-base font-bold tabular-nums">{data.historyPage} / {data.totalPages}</span>
			{#if data.historyPage < data.totalPages}
				<a
					class="m-hist-page-btn text-lb-text flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg"
					href="{base}?page={data.historyPage + 1}"
					data-sveltekit-preload-data="hover"><i class="fas fa-chevron-right"></i></a
				>
			{:else}
				<span class="m-hist-page-btn m-hist-page-btn--off text-lb-text flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg"
					><i class="fas fa-chevron-right"></i></span
				>
			{/if}
		</div>
	{/if}
{/if}
