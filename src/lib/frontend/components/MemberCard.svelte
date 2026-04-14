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
	let downloading = $state(false);
	let sharing = $state(false);

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

	onMount(() => {
		requestAnimationFrame(() => {
			visible = true;
		});
	});

	onDestroy(() => {});

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

	function cardFileName(): string {
		return `${memberName(member).replace(/[^a-zA-Z0-9_-]/g, '_')}_card.png`;
	}

	function shareUrl(): string {
		return typeof window !== 'undefined' ? window.location.href : '';
	}

	function shareText(): string {
		return `Check out ${memberName(member)}'s member card on ${serverName}!`;
	}

	// --- Canvas 2D card renderer (works on all devices, no CORS/font issues) ---

	const S = 2; // render scale
	const CW = 340; // card width at 1x
	const PAD_X = 22;
	const PAD_TOP = 20;
	const PAD_BOT = 16;
	const RADIUS = 20;

	// Theme colors (from CSS variables)
	const C = {
		text: '#1a343f',
		textMuted: 'rgba(26,52,63,0.58)',
		textSubtle: 'rgba(26,52,63,0.45)',
		textFaint: 'rgba(26,52,63,0.32)',
		brick: '#733e24',
		hot: '#245f73',
		peach: '#3a6d82',
		cardBg1: 'rgba(255,255,255,0.97)',
		cardBg2: 'rgba(242,240,239,0.95)',
		statBg: 'rgba(36,95,115,0.06)',
		statBorder: 'rgba(36,95,115,0.1)',
		border: 'rgba(187,189,188,0.55)',
		footerLine: 'rgba(187,189,188,0.35)'
	};

	function loadImg(src: string): Promise<HTMLImageElement> {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.crossOrigin = 'anonymous';
			img.onload = () => resolve(img);
			img.onerror = () => reject(new Error('Image load failed'));
			img.src = src;
		});
	}

	function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
		ctx.beginPath();
		ctx.moveTo(x + r, y);
		ctx.lineTo(x + w - r, y);
		ctx.arcTo(x + w, y, x + w, y + r, r);
		ctx.lineTo(x + w, y + h - r);
		ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
		ctx.lineTo(x + r, y + h);
		ctx.arcTo(x, y + h, x, y + h - r, r);
		ctx.lineTo(x, y + r);
		ctx.arcTo(x, y, x + r, y, r);
		ctx.closePath();
	}

	function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
		ctx.beginPath();
		for (let i = 0; i < 5; i++) {
			const a = (Math.PI / 2.5) * i - Math.PI / 2;
			const ax = (i === 0 ? 'moveTo' : 'lineTo') as 'moveTo' | 'lineTo';
			ctx[ax](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
			const b = a + Math.PI / 5;
			ctx.lineTo(cx + Math.cos(b) * r * 0.4, cy + Math.sin(b) * r * 0.4);
		}
		ctx.closePath();
		ctx.fill();
	}

	function drawComment(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
		ctx.beginPath();
		ctx.moveTo(cx - r, cy - r * 0.5);
		roundRect(ctx, cx - r, cy - r, r * 2, r * 1.5, r * 0.3);
		ctx.fill();
		// tail
		ctx.beginPath();
		ctx.moveTo(cx - r * 0.3, cy + r * 0.5);
		ctx.lineTo(cx - r * 0.7, cy + r);
		ctx.lineTo(cx + r * 0.1, cy + r * 0.5);
		ctx.fill();
	}

	function drawMic(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
		// mic head
		ctx.beginPath();
		ctx.ellipse(cx, cy - r * 0.2, r * 0.35, r * 0.55, 0, 0, Math.PI * 2);
		ctx.fill();
		// stand
		ctx.fillRect(cx - r * 0.08, cy + r * 0.35, r * 0.16, r * 0.4);
		// base
		ctx.fillRect(cx - r * 0.3, cy + r * 0.7, r * 0.6, r * 0.12);
		// arc
		ctx.beginPath();
		ctx.arc(cx, cy + r * 0.05, r * 0.5, 0, Math.PI);
		ctx.lineWidth = r * 0.12;
		ctx.stroke();
	}

	function drawCalendar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
		const x = cx - r,
			y = cy - r,
			w = r * 2,
			h = r * 2;
		roundRect(ctx, x, y + r * 0.3, w, h - r * 0.3, r * 0.2);
		ctx.fill();
		// top bar
		ctx.fillRect(x + r * 0.15, y, r * 0.15, r * 0.5);
		ctx.fillRect(x + w - r * 0.3, y, r * 0.15, r * 0.5);
		// line
		ctx.save();
		ctx.fillStyle = 'rgba(255,255,255,0.6)';
		ctx.fillRect(x + r * 0.15, y + r * 0.7, w - r * 0.3, r * 0.1);
		// checkmark
		ctx.strokeStyle = 'rgba(255,255,255,0.8)';
		ctx.lineWidth = r * 0.15;
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.moveTo(cx - r * 0.3, cy + r * 0.2);
		ctx.lineTo(cx - r * 0.05, cy + r * 0.5);
		ctx.lineTo(cx + r * 0.4, cy - r * 0.1);
		ctx.stroke();
		ctx.restore();
	}

	function hexToRgb(hex: string): [number, number, number] {
		const h = hex.replace('#', '');
		return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
	}

	function colorMix(hex: string, pct: number): string {
		const [r, g, b] = hexToRgb(hex);
		return `rgba(${r},${g},${b},${pct})`;
	}

	function clamp(n: number, min: number, max: number): number {
		return Math.max(min, Math.min(max, n));
	}

	async function captureCardBlob(): Promise<Blob> {
		const rc = roleColor;
		const name = memberName(member);
		const role = highestRole;
		const level = String(member.level ?? 0);
		const xp = fmtNum(member.experience);
		const msgs = fmtNum(member.chat_total);
		const voice = fmtNum(member.voice_minutes_active);
		const joined = fmtJoined(member.member_since);
		const rank = member.rank != null ? `#${member.rank}` : null;
		const fontBase = "-apple-system, 'Inter', 'Segoe UI', sans-serif";

		// Pre-load images
		let avatarImg: HTMLImageElement | null = null;
		try {
			avatarImg = await loadImg(avatarUrl(member));
		} catch {
			try {
				avatarImg = await loadImg('https://cdn.discordapp.com/embed/avatars/0.png');
			} catch {
				/* skip */
			}
		}
		let serverImg: HTMLImageElement | null = null;
		if (serverIcon) {
			try {
				serverImg = await loadImg(serverIcon);
			} catch {
				/* skip */
			}
		}

		// Calculate card height
		const headerH = 24;
		const avatarSize = 88;
		const ringPad = 4;
		const avatarBlockH = avatarSize + ringPad * 2;
		const nameH = 24;
		const roleH = role ? 22 : 0;
		const roleGap = role ? 16 : 8;
		const levelLabelH = 12;
		const levelValueH = 36;
		const statBoxH = 60;
		const joinedH = 16;
		const footerH = 12;

		let CH = PAD_TOP + headerH + 18 + avatarBlockH + 14 + nameH + 8;
		if (role) CH += roleH + roleGap;
		else CH += 8;
		CH += levelLabelH + 2 + levelValueH + 18 + statBoxH + 6 + joinedH + 10 + 1 + 10 + footerH + PAD_BOT;

		// Render the card at a stable internal size first.
		const cardCanvas = document.createElement('canvas');
		cardCanvas.width = CW * S;
		cardCanvas.height = CH * S;
		const ctx = cardCanvas.getContext('2d')!;
		ctx.scale(S, S);

		// --- Card background ---
		const bgGrad = ctx.createLinearGradient(0, 0, CW * 0.3, CH);
		bgGrad.addColorStop(0, C.cardBg1);
		bgGrad.addColorStop(1, C.cardBg2);
		roundRect(ctx, 0, 0, CW, CH, RADIUS);
		ctx.fillStyle = bgGrad;
		ctx.fill();

		// Accent glow
		ctx.save();
		roundRect(ctx, 0, 0, CW, CH, RADIUS);
		ctx.clip();
		const accentGrad = ctx.createLinearGradient(0, 0, CW, CH * 0.4);
		accentGrad.addColorStop(0, rc);
		accentGrad.addColorStop(1, C.hot);
		ctx.globalAlpha = 0.08;
		ctx.filter = 'blur(40px)';
		ctx.fillStyle = accentGrad;
		ctx.beginPath();
		ctx.ellipse(CW * 0.5, -CH * 0.1, CW * 0.7, CH * 0.4, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();

		// Border
		roundRect(ctx, 0, 0, CW, CH, RADIUS);
		ctx.strokeStyle = C.border;
		ctx.lineWidth = 1;
		ctx.stroke();

		let y = PAD_TOP;
		const cx = CW / 2;
		const contentW = CW - PAD_X * 2;

		// --- Header: server badge + rank ---
		if (serverImg) {
			ctx.save();
			roundRect(ctx, PAD_X, y, 24, 24, 6);
			ctx.clip();
			ctx.drawImage(serverImg, PAD_X, y, 24, 24);
			ctx.restore();
			ctx.strokeStyle = 'rgba(187,189,188,0.4)';
			ctx.lineWidth = 1;
			roundRect(ctx, PAD_X, y, 24, 24, 6);
			ctx.stroke();
		} else {
			// Shield placeholder
			ctx.fillStyle = 'rgba(36,95,115,0.12)';
			roundRect(ctx, PAD_X, y, 24, 24, 6);
			ctx.fill();
			ctx.fillStyle = C.hot;
			ctx.font = `700 11px ${fontBase}`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText('\u{1F6E1}', PAD_X + 12, y + 12); // shield emoji fallback
		}

		// Server name
		ctx.font = `700 11px ${fontBase}`;
		ctx.fillStyle = C.textMuted;
		ctx.textAlign = 'left';
		ctx.textBaseline = 'middle';
		const sNameX = PAD_X + 32;
		const maxNameW = rank ? contentW - 32 - 60 : contentW - 32;
		ctx.save();
		ctx.beginPath();
		ctx.rect(sNameX, y, maxNameW, 24);
		ctx.clip();
		ctx.fillText(serverName.toUpperCase(), sNameX, y + 12);
		ctx.restore();

		// Rank badge
		if (rank) {
			ctx.font = `800 12px ${fontBase}`;
			const rankW = ctx.measureText(rank).width + 20;
			const rankX = CW - PAD_X - rankW;
			const rankGrad = ctx.createLinearGradient(rankX, y, rankX + rankW, y + 24);
			rankGrad.addColorStop(0, C.brick);
			rankGrad.addColorStop(1, C.hot);
			roundRect(ctx, rankX, y + 1, rankW, 22, 8);
			ctx.fillStyle = rankGrad;
			ctx.fill();
			ctx.fillStyle = '#fff';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(rank, rankX + rankW / 2, y + 12);
		}

		y += headerH + 18;

		// --- Avatar with conic-gradient ring ---
		const ringR = (avatarSize + ringPad * 2) / 2;
		const avatarR = avatarSize / 2;

		// Draw ring as segmented arc
		const ringColors = [rc, C.hot, '#5a9eb4', rc];
		const segCount = 60;
		for (let i = 0; i < segCount; i++) {
			const t = i / segCount;
			const startAngle = (220 / 360) * Math.PI * 2 + t * Math.PI * 2;
			const endAngle = startAngle + (Math.PI * 2) / segCount + 0.02;
			// Interpolate color
			const pos = t * (ringColors.length - 1);
			const ci = Math.floor(pos);
			const cf = pos - ci;
			const c1 = hexToRgb(ringColors[Math.min(ci, ringColors.length - 1)]);
			const c2 = hexToRgb(ringColors[Math.min(ci + 1, ringColors.length - 1)]);
			const r = Math.round(c1[0] + (c2[0] - c1[0]) * cf);
			const g = Math.round(c1[1] + (c2[1] - c1[1]) * cf);
			const b = Math.round(c1[2] + (c2[2] - c1[2]) * cf);
			ctx.beginPath();
			ctx.arc(cx, y + ringR, ringR, startAngle, endAngle);
			ctx.arc(cx, y + ringR, avatarR + 3, endAngle, startAngle, true);
			ctx.closePath();
			ctx.fillStyle = `rgb(${r},${g},${b})`;
			ctx.fill();
		}

		// White inner circle (border around avatar)
		ctx.beginPath();
		ctx.arc(cx, y + ringR, avatarR + 3, 0, Math.PI * 2);
		ctx.fillStyle = 'rgba(255,255,255,0.97)';
		ctx.fill();

		// Avatar image
		if (avatarImg) {
			ctx.save();
			ctx.beginPath();
			ctx.arc(cx, y + ringR, avatarR, 0, Math.PI * 2);
			ctx.clip();
			ctx.drawImage(avatarImg, cx - avatarR, y + ringR - avatarR, avatarSize, avatarSize);
			ctx.restore();
		}

		y += avatarBlockH + 14;

		// --- Name ---
		ctx.font = `800 20px ${fontBase}`;
		ctx.fillStyle = C.text;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'top';
		// Truncate if too wide
		let displayName = name;
		while (ctx.measureText(displayName).width > contentW && displayName.length > 1) {
			displayName = displayName.slice(0, -1);
		}
		if (displayName !== name) displayName += '...';
		ctx.fillText(displayName, cx, y);
		y += nameH + 8;

		// --- Role badge ---
		if (role) {
			ctx.font = `700 11px ${fontBase}`;
			const roleText = role.name;
			const dotR = 3;
			const roleTW = ctx.measureText(roleText).width;
			const badgeW = dotR * 2 + 6 + roleTW + 28;
			const badgeX = cx - badgeW / 2;
			const badgeH = 22;

			// Badge background
			roundRect(ctx, badgeX, y, badgeW, badgeH, 99);
			ctx.fillStyle = colorMix(rc, 0.1);
			ctx.fill();
			ctx.strokeStyle = colorMix(rc, 0.35);
			ctx.lineWidth = 1;
			roundRect(ctx, badgeX, y, badgeW, badgeH, 99);
			ctx.stroke();

			// Dot
			ctx.beginPath();
			ctx.arc(badgeX + 14, y + badgeH / 2, dotR, 0, Math.PI * 2);
			ctx.fillStyle = rc;
			ctx.fill();

			// Role text
			ctx.fillStyle = rc;
			ctx.textAlign = 'left';
			ctx.textBaseline = 'middle';
			ctx.fillText(roleText, badgeX + 14 + dotR + 6, y + badgeH / 2);

			y += roleH + roleGap;
		} else {
			y += 8;
		}

		// --- Level block ---
		ctx.font = `700 9px ${fontBase}`;
		ctx.fillStyle = C.textSubtle;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'top';
		ctx.fillText('LEVEL', cx, y);
		y += levelLabelH + 2;

		// Level value with gradient text
		ctx.font = `900 36px ${fontBase}`;
		const levelGrad = ctx.createLinearGradient(cx - 30, y, cx + 30, y + 36);
		levelGrad.addColorStop(0, C.hot);
		levelGrad.addColorStop(1, C.peach);
		ctx.fillStyle = levelGrad;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'top';
		ctx.fillText(level, cx, y);
		y += levelValueH + 18;

		// --- Stats row ---
		const gap = 6;
		const statW = (contentW - gap * 2) / 3;
		const statItems = [
			{ icon: 'star', val: xp, lbl: 'XP' },
			{ icon: 'comment', val: msgs, lbl: 'Messages' },
			{ icon: 'mic', val: voice, lbl: 'Voice min' }
		];

		for (let i = 0; i < 3; i++) {
			const sx = PAD_X + i * (statW + gap);
			const si = statItems[i];

			// Stat box bg
			roundRect(ctx, sx, y, statW, statBoxH, 12);
			ctx.fillStyle = C.statBg;
			ctx.fill();
			ctx.strokeStyle = C.statBorder;
			ctx.lineWidth = 1;
			roundRect(ctx, sx, y, statW, statBoxH, 12);
			ctx.stroke();

			// Icon
			ctx.fillStyle = C.peach;
			ctx.strokeStyle = C.peach;
			const iconCx = sx + statW / 2;
			const iconY = y + 12;
			if (si.icon === 'star') drawStar(ctx, iconCx, iconY, 6);
			else if (si.icon === 'comment') drawComment(ctx, iconCx, iconY, 5);
			else if (si.icon === 'mic') drawMic(ctx, iconCx, iconY, 6);

			// Value
			ctx.font = `800 14px ${fontBase}`;
			ctx.fillStyle = C.text;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'top';
			ctx.fillText(si.val, sx + statW / 2, y + 24);

			// Label
			ctx.font = `600 9px ${fontBase}`;
			ctx.fillStyle = C.textSubtle;
			ctx.fillText(si.lbl.toUpperCase(), sx + statW / 2, y + 42);
		}

		y += statBoxH + 6;

		// --- Joined date ---
		ctx.fillStyle = C.peach;
		drawCalendar(ctx, PAD_X + 6, y + joinedH / 2, 6);

		ctx.font = `600 11px ${fontBase}`;
		ctx.fillStyle = C.textMuted;
		ctx.textAlign = 'left';
		ctx.textBaseline = 'middle';
		ctx.fillText(`Joined ${joined}`, PAD_X + 18, y + joinedH / 2);
		y += joinedH + 10;

		// --- Footer ---
		ctx.strokeStyle = C.footerLine;
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(PAD_X, y);
		ctx.lineTo(CW - PAD_X, y);
		ctx.stroke();
		y += 11;

		ctx.font = `700 9px ${fontBase}`;
		ctx.fillStyle = C.textFaint;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'top';
		ctx.letterSpacing = '1px';
		ctx.fillText('DANSDAY BOT', cx, y);

		// Compose into a 9:16 export (1080x1920), centered + scaled, with opaque background.
		const OUT_W = 1080;
		const OUT_H = 1920;
		const outCanvas = document.createElement('canvas');
		outCanvas.width = OUT_W;
		outCanvas.height = OUT_H;
		const out = outCanvas.getContext('2d')!;

		// Background similar to modal backdrop
		const bg = out.createLinearGradient(0, 0, 0, OUT_H);
		bg.addColorStop(0, '#73858c');
		bg.addColorStop(1, '#6a7b82');
		out.fillStyle = bg;
		out.fillRect(0, 0, OUT_W, OUT_H);

		// Subtle accent glow behind card
		out.save();
		out.globalAlpha = 0.22;
		out.filter = 'blur(42px)';
		const glow = out.createRadialGradient(OUT_W * 0.5, OUT_H * 0.34, 40, OUT_W * 0.5, OUT_H * 0.34, OUT_W * 0.48);
		glow.addColorStop(0, rc);
		glow.addColorStop(1, 'rgba(36,95,115,0)');
		out.fillStyle = glow;
		out.beginPath();
		out.ellipse(OUT_W * 0.5, OUT_H * 0.34, OUT_W * 0.46, OUT_W * 0.32, 0, 0, Math.PI * 2);
		out.fill();
		out.restore();

		// Fit card into output with safe margins
		const maxW = OUT_W * 0.86;
		const maxH = OUT_H * 0.82;
		const scale = clamp(Math.min(maxW / cardCanvas.width, maxH / cardCanvas.height), 0.1, 10);
		const drawW = cardCanvas.width * scale;
		const drawH = cardCanvas.height * scale;
		const dx = (OUT_W - drawW) / 2;
		const dy = (OUT_H - drawH) / 2;

		out.imageSmoothingEnabled = true;
		out.imageSmoothingQuality = 'high';
		out.drawImage(cardCanvas, dx, dy, drawW, drawH);

		return new Promise<Blob>((resolve, reject) => {
			outCanvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
		});
	}

	/** Check if Web Share API supports file sharing */
	function canShareFiles(): boolean {
		return typeof navigator !== 'undefined' && !!navigator.share && !!navigator.canShare;
	}

	function isIOS(): boolean {
		if (typeof navigator === 'undefined') return false;
		const ua = navigator.userAgent || '';
		// iPadOS 13+ reports as Mac; detect via touch points.
		return /iPad|iPhone|iPod/i.test(ua) || (/\bMacintosh\b/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 1);
	}

	function isProbablyMobile(): boolean {
		if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
		if (isIOS()) return true;
		if ((navigator.maxTouchPoints ?? 0) > 1 && window.matchMedia?.('(pointer: coarse)')?.matches) return true;
		const ua = navigator.userAgent || '';
		return /Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
	}

	/**
	 * Only use native "share/save image" flows on mobile.
	 * Desktop Chrome can support file sharing too, but for "Download" we want a real download.
	 */
	function shouldUseNativeShareForDownload(): boolean {
		return isProbablyMobile() && canShareFiles();
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
			if (shouldUseNativeShareForDownload()) {
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
