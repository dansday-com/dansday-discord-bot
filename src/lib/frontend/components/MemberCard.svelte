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
	let sharing = $state(false);
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
		const fakeTime = performance.now();
		if (sparkles.length === 0) initSparkles(w, h);
		drawSparkles(ctx, w, h, fakeTime);
	}

	function cardFileName(): string {
		return `${memberName(member).replace(/[^a-zA-Z0-9_-]/g, '_')}_card.png`;
	}

	function shareUrl(): string {
		return typeof window !== 'undefined' ? window.location.href : '';
	}

	function shareText(): string {
		return `Check out ${memberName(member)}'s member card on ${serverName}!`;
	}

	/** Render the card to a PNG blob using html-to-image */
	async function captureCardBlob(): Promise<Blob> {
		if (!cardEl) throw new Error('Card element not ready');
		const { toBlob } = await import('html-to-image');

		const blob = await toBlob(cardEl, {
			pixelRatio: 2,
			cacheBust: true,
			// Include the sparkle overlay by drawing it frozen
			filter: () => true
		});
		if (!blob) throw new Error('Failed to capture card');

		// Composite sparkles on top
		const bmp = await createImageBitmap(blob);
		const canvas = document.createElement('canvas');
		canvas.width = bmp.width;
		canvas.height = bmp.height;
		const ctx = canvas.getContext('2d')!;
		ctx.drawImage(bmp, 0, 0);
		drawSparklesOntoCanvas(ctx, canvas.width, canvas.height);

		return new Promise<Blob>((resolve, reject) => {
			canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
		});
	}

	/** Check if Web Share API supports file sharing */
	function canShareFiles(): boolean {
		return typeof navigator !== 'undefined' && !!navigator.share && !!navigator.canShare;
	}

	/** Build a shareable File from the card blob */
	async function cardFile(): Promise<File> {
		const blob = await captureCardBlob();
		return new File([blob], cardFileName(), { type: 'image/png' });
	}

	/** Try native share with image, returns true if shared */
	async function tryNativeShare(text: string, includeUrl: boolean): Promise<boolean> {
		if (!canShareFiles()) return false;
		try {
			const file = await cardFile();
			const data: ShareData = { text, files: [file] };
			if (includeUrl) data.url = shareUrl();
			if (navigator.canShare(data)) {
				await navigator.share(data);
				return true;
			}
		} catch (e) {
			if (e instanceof Error && e.name === 'AbortError') return true; // user cancelled, still "handled"
		}
		return false;
	}

	async function downloadCard() {
		if (!cardEl || downloading) return;
		downloading = true;
		try {
			const blob = await captureCardBlob();
			const file = new File([blob], cardFileName(), { type: 'image/png' });

			// Mobile: try Web Share API (works reliably on iOS/Android for saving)
			if (canShareFiles()) {
				const data: ShareData = { files: [file] };
				if (navigator.canShare(data)) {
					await navigator.share(data);
					return;
				}
			}

			// Desktop / fallback: blob URL download
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.download = cardFileName();
			link.href = url;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			setTimeout(() => URL.revokeObjectURL(url), 5000);
		} catch (e) {
			if (e instanceof Error && e.name !== 'AbortError') {
				console.error('Download failed:', e);
			}
		} finally {
			downloading = false;
		}
	}

	async function shareInstagram() {
		if (sharing) return;
		sharing = true;
		try {
			// Web Share API triggers the native share sheet – user picks Instagram Stories
			const shared = await tryNativeShare(shareText(), false);
			if (!shared) {
				// Fallback: download the image so user can manually share
				await downloadCard();
			}
		} finally {
			sharing = false;
		}
	}

	async function shareX() {
		if (sharing) return;
		sharing = true;
		try {
			// Try native share with image first (mobile)
			const shared = await tryNativeShare(shareText() + ' ' + shareUrl(), false);
			if (!shared) {
				// Fallback: open X intent (no image, but includes text + URL)
				window.open(
					`https://x.com/intent/tweet?text=${encodeURIComponent(shareText())}&url=${encodeURIComponent(shareUrl())}`,
					'_blank',
					'noopener,noreferrer'
				);
			}
		} finally {
			sharing = false;
		}
	}

	function shareFacebook() {
		window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl())}`, '_blank', 'noopener,noreferrer');
	}

	async function shareDiscord() {
		if (sharing) return;
		sharing = true;
		try {
			// Try native share with image first (mobile)
			const shared = await tryNativeShare(shareText() + '\n' + shareUrl(), false);
			if (!shared) {
				// Fallback: copy text + download image so user can paste both in Discord
				const blob = await captureCardBlob();
				try {
					// Try copying image to clipboard (Chrome/Edge support)
					await navigator.clipboard.write([
						new ClipboardItem({
							'image/png': blob,
							'text/plain': new Blob([`${shareText()} ${shareUrl()}`], { type: 'text/plain' })
						})
					]);
					alert('Card image & text copied to clipboard! Paste it in Discord.');
				} catch {
					// Clipboard image not supported – copy text and download image
					await navigator.clipboard.writeText(`${shareText()} ${shareUrl()}`).catch(() => {});
					const url = URL.createObjectURL(blob);
					const link = document.createElement('a');
					link.download = cardFileName();
					link.href = url;
					document.body.appendChild(link);
					link.click();
					document.body.removeChild(link);
					setTimeout(() => URL.revokeObjectURL(url), 5000);
					alert('Card image downloaded & text copied! Drag the image into Discord.');
				}
			}
		} finally {
			sharing = false;
		}
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
			<button class="mc-action-btn mc-action-btn--download" onclick={downloadCard} disabled={downloading || sharing}>
				<i class="fas fa-download"></i>
				{downloading ? 'Saving...' : 'Download'}
			</button>
			<div class="mc-share-row">
				<button class="mc-share-btn mc-share-btn--instagram" onclick={shareInstagram} disabled={sharing || downloading} title="Share to Instagram">
					<i class="fab fa-instagram"></i>
				</button>
				<button class="mc-share-btn mc-share-btn--x" onclick={shareX} disabled={sharing || downloading} title="Share on X">
					<i class="fab fa-x-twitter"></i>
				</button>
				<button class="mc-share-btn mc-share-btn--facebook" onclick={shareFacebook} title="Share on Facebook">
					<i class="fab fa-facebook-f"></i>
				</button>
				<button class="mc-share-btn mc-share-btn--discord" onclick={shareDiscord} disabled={sharing || downloading} title="Share to Discord">
					<i class="fab fa-discord"></i>
				</button>
			</div>
		</div>
	</div>
</div>
