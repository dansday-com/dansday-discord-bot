<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

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
		member_since?: string | null;
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
	let sparkleCanvas: HTMLCanvasElement | undefined = $state();
	let downloading = $state(false);
	let sparkleRaf: number | null = null;

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

	function fmtJoined(dateStr: string | null | undefined): string {
		if (!dateStr) return 'N/A';
		try {
			const d = new Date(dateStr);
			if (isNaN(d.getTime())) return 'N/A';
			return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
		} catch {
			return 'N/A';
		}
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

	type Sparkle = { x: number; y: number; size: number; opacity: number; speed: number; phase: number };

	let sparkles: Sparkle[] = [];

	function initSparkles(w: number, h: number) {
		sparkles = [];
		const count = 28;
		for (let i = 0; i < count; i++) {
			sparkles.push({
				x: Math.random() * w,
				y: Math.random() * h,
				size: 1.5 + Math.random() * 3,
				opacity: 0.15 + Math.random() * 0.6,
				speed: 0.3 + Math.random() * 0.8,
				phase: Math.random() * Math.PI * 2
			});
		}
	}

	function drawSparkles(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
		ctx.clearRect(0, 0, w, h);
		for (const s of sparkles) {
			const pulse = 0.4 + 0.6 * Math.abs(Math.sin(t * s.speed * 0.002 + s.phase));
			const alpha = s.opacity * pulse;
			const sz = s.size * (0.6 + 0.4 * pulse);

			ctx.save();
			ctx.translate(s.x, s.y);
			ctx.globalAlpha = alpha;

			// four-point star
			ctx.beginPath();
			const arm = sz * 2.2;
			const inner = sz * 0.35;
			for (let i = 0; i < 4; i++) {
				const angle = (Math.PI / 2) * i - Math.PI / 2;
				const nextAngle = angle + Math.PI / 4;
				ctx.lineTo(Math.cos(angle) * arm, Math.sin(angle) * arm);
				ctx.lineTo(Math.cos(nextAngle) * inner, Math.sin(nextAngle) * inner);
			}
			ctx.closePath();

			const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, arm);
			grad.addColorStop(0, 'rgba(255, 223, 100, 0.95)');
			grad.addColorStop(0.5, 'rgba(230, 184, 0, 0.6)');
			grad.addColorStop(1, 'rgba(230, 184, 0, 0)');
			ctx.fillStyle = grad;
			ctx.fill();

			// bright center dot
			ctx.beginPath();
			ctx.arc(0, 0, sz * 0.4, 0, Math.PI * 2);
			ctx.fillStyle = `rgba(255, 248, 220, ${alpha * 0.9})`;
			ctx.fill();

			ctx.restore();
		}
	}

	function animateSparkles() {
		if (!sparkleCanvas) return;
		const ctx = sparkleCanvas.getContext('2d');
		if (!ctx) return;
		const w = sparkleCanvas.width;
		const h = sparkleCanvas.height;

		const tick = (t: number) => {
			drawSparkles(ctx, w, h, t);
			sparkleRaf = requestAnimationFrame(tick);
		};
		sparkleRaf = requestAnimationFrame(tick);
	}

	onMount(() => {
		requestAnimationFrame(() => {
			visible = true;
		});
		if (sparkleCanvas && cardEl) {
			const rect = cardEl.getBoundingClientRect();
			sparkleCanvas.width = rect.width * 2;
			sparkleCanvas.height = rect.height * 2;
			sparkleCanvas.style.width = rect.width + 'px';
			sparkleCanvas.style.height = rect.height + 'px';
			initSparkles(rect.width * 2, rect.height * 2);
			animateSparkles();
		}
	});

	onDestroy(() => {
		if (sparkleRaf) cancelAnimationFrame(sparkleRaf);
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

	function drawSparklesOntoCanvas(ctx: CanvasRenderingContext2D, w: number, h: number) {
		// draw a single frozen frame of sparkles for the download
		const fakeTime = performance.now();
		const saved = [...sparkles];
		if (saved.length === 0) initSparkles(w, h);
		drawSparkles(ctx, w, h, fakeTime);
	}

	async function downloadCard() {
		if (!cardEl || downloading) return;
		downloading = true;
		try {
			const { default: html2canvas } = await import('html2canvas');
			// temporarily hide the sparkle canvas so html2canvas doesn't double-render it
			const sparkleEl = sparkleCanvas;
			if (sparkleEl) sparkleEl.style.visibility = 'hidden';

			const canvas = await html2canvas(cardEl, {
				backgroundColor: null,
				scale: 2,
				useCORS: true,
				allowTaint: true,
				logging: false
			});

			if (sparkleEl) sparkleEl.style.visibility = '';

			// overlay sparkles onto the captured canvas
			const ctx = canvas.getContext('2d');
			if (ctx) {
				drawSparklesOntoCanvas(ctx, canvas.width, canvas.height);
			}

			const link = document.createElement('a');
			link.download = `${memberName(member).replace(/[^a-zA-Z0-9_-]/g, '_')}_card.png`;
			link.href = canvas.toDataURL('image/png');
			link.click();
		} catch {
			// fallback: basic canvas
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

	function shareX() {
		window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(shareText())}&url=${encodeURIComponent(shareUrl())}`, '_blank', 'noopener,noreferrer');
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

		<div class="mc-card" bind:this={cardEl}>
			<canvas class="mc-sparkle-canvas" bind:this={sparkleCanvas}></canvas>

			<div class="mc-card-bg">
				<div class="mc-card-accent" style="background: linear-gradient(135deg, {roleColor}, #245f73);"></div>
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
								crossorigin="anonymous"
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

					<div class="mc-joined">
						<i class="fas fa-calendar-check"></i>
						<span>Joined {fmtJoined(member.member_since)}</span>
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
				<button class="mc-share-btn mc-share-btn--x" onclick={shareX} title="Share on X">
					<i class="fab fa-x-twitter"></i>
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
