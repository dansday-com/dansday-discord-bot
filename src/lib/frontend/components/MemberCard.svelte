<script lang="ts">
	import { onMount } from 'svelte';

	type MemberRole = { name: string; color: string | null; position?: number };

	type MemberData = {
		discord_member_id: string;
		username?: string | null;
		display_name?: string | null;
		server_display_name?: string | null;
		avatar?: string | null;
		level?: number | null;
		experience?: number | null;
		rank?: number | null;
		chat_total?: number | null;
		voice_minutes_active?: number | null;
		roles?: MemberRole[];
	};

	type Props = {
		member: MemberData;
		serverName: string;
		serverIcon?: string | null;
		onclose: () => void;
	};

	let { member, serverName, serverIcon, onclose }: Props = $props();

	let visible = $state(false);
	let cardEl: HTMLDivElement | undefined = $state();
	let downloading = $state(false);

	function memberName(m: MemberData): string {
		if (m.server_display_name?.trim()) return m.server_display_name;
		if (m.display_name?.trim()) return m.display_name;
		return m.username ?? 'Unknown';
	}

	function avatarUrl(m: MemberData): string {
		return m.avatar ?? `https://cdn.discordapp.com/embed/avatars/${Number(m.discord_member_id) % 5 || 0}.png`;
	}

	function fmtNum(n: number | null | undefined): string {
		if (n == null) return '0';
		return Number(n).toLocaleString();
	}

	const highestRole = $derived.by(() => {
		if (!member.roles?.length) return null;
		const sorted = [...member.roles].sort((a, b) => (b.position ?? 0) - (a.position ?? 0));
		return sorted[0] ?? null;
	});

	function parseRoleHex(color: string | null | undefined): string {
		if (!color) return '#245f73';
		const s = String(color).trim();
		if (s === '' || s === '0' || s.toLowerCase() === 'null') return '#245f73';
		if (s.startsWith('#')) return s;
		if (/^[0-9A-Fa-f]{6}$/.test(s)) return `#${s}`;
		const n = Number.parseInt(s, 10);
		if (Number.isFinite(n) && n > 0 && n <= 0xffffff) {
			return `#${n.toString(16).padStart(6, '0')}`;
		}
		return '#245f73';
	}

	const roleColor = $derived(parseRoleHex(highestRole?.color));

	onMount(() => {
		requestAnimationFrame(() => {
			visible = true;
		});
	});

	function closeModal() {
		visible = false;
		setTimeout(() => onclose(), 280);
	}

	function handleBackdrop(e: MouseEvent) {
		if (e.target === e.currentTarget) closeModal();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') closeModal();
	}

	async function downloadCard() {
		if (!cardEl || downloading) return;
		downloading = true;
		try {
			const { default: html2canvas } = await import('html2canvas');
			const canvas = await html2canvas(cardEl, {
				backgroundColor: null,
				scale: 2,
				useCORS: true,
				allowTaint: true,
				logging: false
			});
			const link = document.createElement('a');
			link.download = `${memberName(member).replace(/[^a-zA-Z0-9_-]/g, '_')}_card.png`;
			link.href = canvas.toDataURL('image/png');
			link.click();
		} catch {
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');
			if (!ctx || !cardEl) return;
			const rect = cardEl.getBoundingClientRect();
			canvas.width = rect.width * 2;
			canvas.height = rect.height * 2;
			ctx.scale(2, 2);
			ctx.fillStyle = '#1a343f';
			ctx.fillRect(0, 0, rect.width, rect.height);
			ctx.fillStyle = '#ffffff';
			ctx.font = 'bold 20px -apple-system, Inter, sans-serif';
			ctx.textAlign = 'center';
			ctx.fillText(memberName(member), rect.width / 2, rect.height / 2);
			const link = document.createElement('a');
			link.download = `${memberName(member).replace(/[^a-zA-Z0-9_-]/g, '_')}_card.png`;
			link.href = canvas.toDataURL('image/png');
			link.click();
		} finally {
			downloading = false;
		}
	}

	function shareUrl(): string {
		return typeof window !== 'undefined' ? window.location.href : '';
	}

	function shareText(): string {
		return `Check out ${memberName(member)}'s member card on ${serverName}!`;
	}

	function shareTwitter() {
		window.open(
			`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText())}&url=${encodeURIComponent(shareUrl())}`,
			'_blank',
			'noopener,noreferrer'
		);
	}

	function shareFacebook() {
		window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl())}`, '_blank', 'noopener,noreferrer');
	}

	function shareDiscord() {
		navigator.clipboard
			.writeText(`${shareText()} ${shareUrl()}`)
			.then(() => {
				alert('Copied to clipboard! Paste it in Discord.');
			})
			.catch(() => {});
	}

	function shareInstagram() {
		downloadCard();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="mc-overlay" class:mc-overlay--visible={visible} onclick={handleBackdrop}>
	<div class="mc-modal" class:mc-modal--visible={visible}>
		<button class="mc-close" onclick={closeModal} aria-label="Close member card">
			<i class="fas fa-times"></i>
		</button>

		<div class="mc-shimmer"></div>

		<div class="mc-card" bind:this={cardEl}>
			<div class="mc-card-bg">
				<div class="mc-card-accent" style="background: linear-gradient(135deg, {roleColor}, var(--chili-hot));"></div>
			</div>

			<div class="mc-card-inner">
				<div class="mc-card-header">
					<div class="mc-server-badge">
						{#if serverIcon}
							<img src={serverIcon} alt="" class="mc-server-icon" />
						{:else}
							<span class="mc-server-icon-ph"><i class="fas fa-shield-alt"></i></span>
						{/if}
						<span class="mc-server-name">{serverName}</span>
					</div>
					{#if member.rank != null}
						<span class="mc-rank">#{member.rank}</span>
					{/if}
				</div>

				<div class="mc-card-body">
					<div class="mc-avatar-wrap">
						<div class="mc-avatar-ring" style="--mc-ring-color: {roleColor};">
							<img
								class="mc-avatar"
								src={avatarUrl(member)}
								alt=""
								width="88"
								height="88"
								onerror={(e) => ((e.currentTarget as HTMLImageElement).src = 'https://cdn.discordapp.com/embed/avatars/0.png')}
							/>
						</div>
					</div>

					<h2 class="mc-name">{memberName(member)}</h2>

					{#if highestRole}
						<div class="mc-role-badge" style="--mc-role-c: {roleColor};">
							<i class="fas fa-circle"></i>
							{highestRole.name}
						</div>
					{/if}

					<div class="mc-level-block">
						<span class="mc-level-label">Level</span>
						<span class="mc-level-value">{member.level ?? 0}</span>
					</div>

					<div class="mc-stats-row">
						<div class="mc-stat">
							<i class="fas fa-star"></i>
							<span class="mc-stat-val">{fmtNum(member.experience)}</span>
							<span class="mc-stat-lbl">XP</span>
						</div>
						<div class="mc-stat">
							<i class="fas fa-comments"></i>
							<span class="mc-stat-val">{fmtNum(member.chat_total)}</span>
							<span class="mc-stat-lbl">Messages</span>
						</div>
						<div class="mc-stat">
							<i class="fas fa-microphone"></i>
							<span class="mc-stat-val">{fmtNum(member.voice_minutes_active)}</span>
							<span class="mc-stat-lbl">Voice min</span>
						</div>
					</div>
				</div>

				<div class="mc-card-footer">
					<span class="mc-watermark">Dansday Bot</span>
				</div>
			</div>
		</div>

		<div class="mc-actions">
			<button class="mc-action-btn mc-action-btn--download" onclick={downloadCard} disabled={downloading}>
				<i class="fas fa-download"></i>
				{downloading ? 'Saving...' : 'Download'}
			</button>
			<div class="mc-share-row">
				<button class="mc-share-btn mc-share-btn--instagram" onclick={shareInstagram} title="Save for Instagram">
					<i class="fab fa-instagram"></i>
				</button>
				<button class="mc-share-btn mc-share-btn--twitter" onclick={shareTwitter} title="Share on Twitter">
					<i class="fab fa-twitter"></i>
				</button>
				<button class="mc-share-btn mc-share-btn--facebook" onclick={shareFacebook} title="Share on Facebook">
					<i class="fab fa-facebook-f"></i>
				</button>
				<button class="mc-share-btn mc-share-btn--discord" onclick={shareDiscord} title="Copy for Discord">
					<i class="fab fa-discord"></i>
				</button>
			</div>
		</div>
	</div>
</div>
