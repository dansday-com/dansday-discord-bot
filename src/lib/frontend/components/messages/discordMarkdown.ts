export type MarkdownContext = {
	roles: Map<string, { name: string; color: string | null }>;
	channels: Map<string, string>;
	members: Map<string, string>;
};

const HEX = /^#[0-9a-f]{6}$/i;

function escapeHtml(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function inline(value: string): string {
	return value
		.replace(/\*\*([^\n]+?)\*\*/g, '<strong>$1</strong>')
		.replace(/__([^\n]+?)__/g, '<u>$1</u>')
		.replace(/~~([^\n]+?)~~/g, '<s>$1</s>')
		.replace(/\|\|([^\n]+?)\|\|/g, '<span class="dc-spoiler">$1</span>')
		.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>')
		.replace(/(^|[^\w])_([^_\n]+?)_(?!\w)/g, '$1<em>$2</em>')
		.replace(/@(everyone|here)\b/g, '<span class="dc-mention">@$1</span>');
}

export function discordMarkdown(source: string, ctx: MarkdownContext): string {
	const stash: string[] = [];
	const keep = (html: string) => `\u0000${stash.push(html) - 1}\u0000`;
	const link = (url: string, label: string) => `<a class="dc-link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${label}</a>`;

	let text = String(source ?? '')
		.replace(/\u0000/g, '')
		.replace(/\r\n?/g, '\n');

	text = text.replace(/```(?:[a-z0-9+#-]*\n)?([\s\S]*?)```/gi, (_, code) =>
		keep(`<pre class="dc-codeblock">${escapeHtml(String(code).replace(/\n$/, ''))}</pre>`)
	);
	text = text.replace(/`([^`\n]+)`/g, (_, code) => keep(`<code class="dc-code">${escapeHtml(code)}</code>`));
	text = text.replace(/<(a?):([A-Za-z0-9_]{2,32}):(\d{5,25})>/g, (_, animated, name, id) =>
		keep(`<img class="dc-emoji" src="https://cdn.discordapp.com/emojis/${id}.${animated ? 'gif' : 'webp'}?size=48" alt=":${name}:" />`)
	);
	text = text.replace(/<@&(\d{5,25})>/g, (_, id) => {
		const role = ctx.roles.get(id);
		const color = role?.color && HEX.test(role.color) && role.color !== '#000000' ? role.color : null;
		return keep(`<span class="dc-mention"${color ? ` style="color:${color};background:${color}26"` : ''}>@${escapeHtml(role?.name ?? 'deleted-role')}</span>`);
	});
	text = text.replace(/<@!?(\d{5,25})>/g, (_, id) => keep(`<span class="dc-mention">@${escapeHtml(ctx.members.get(id) ?? 'member')}</span>`));
	text = text.replace(/<#(\d{5,25})>/g, (_, id) => keep(`<span class="dc-mention">#${escapeHtml(ctx.channels.get(id) ?? 'deleted-channel')}</span>`));
	text = text.replace(/<t:(\d{1,13})(?::[tTdDfFR])?>/g, (_, unix) =>
		keep(`<span class="dc-time">${escapeHtml(new Date(Number(unix) * 1000).toLocaleString())}</span>`)
	);
	text = text.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => keep(link(url, escapeHtml(label))));
	text = text.replace(/https?:\/\/[^\s<]*[^\s<.,:;"')\]]/g, (url) => keep(link(url, escapeHtml(url))));

	const lines = text.split('\n').map((raw) => {
		const heading = raw.match(/^(#{1,3}) +(\S.*)$/);
		if (heading) return `<div class="dc-h${heading[1].length}">${inline(escapeHtml(heading[2]))}</div>`;
		const subtext = raw.match(/^-# +(\S.*)$/);
		if (subtext) return `<div class="dc-subtext">${inline(escapeHtml(subtext[1]))}</div>`;
		const quote = raw.match(/^> ?(.*)$/);
		if (quote) return `<div class="dc-quote">${inline(escapeHtml(quote[1])) || '&nbsp;'}</div>`;
		const bullet = raw.match(/^(\s*)[-*] +(\S.*)$/);
		if (bullet)
			return `<div class="dc-li" style="margin-left:${Math.min(bullet[1].length, 8) * 8}px"><span>•</span><span>${inline(escapeHtml(bullet[2]))}</span></div>`;
		const numbered = raw.match(/^(\s*)(\d{1,3})\. +(\S.*)$/);
		if (numbered) {
			return `<div class="dc-li" style="margin-left:${Math.min(numbered[1].length, 8) * 8}px"><span>${numbered[2]}.</span><span>${inline(escapeHtml(numbered[3]))}</span></div>`;
		}
		return raw.trim() ? `<div class="dc-line">${inline(escapeHtml(raw))}</div>` : '<div class="dc-blank"></div>';
	});

	return lines.join('').replace(/\u0000(\d+)\u0000/g, (_, index) => stash[Number(index)] ?? '');
}
