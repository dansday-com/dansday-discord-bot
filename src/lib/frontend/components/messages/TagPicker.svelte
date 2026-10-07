<script lang="ts">
	import { tick } from 'svelte';
	import { showToast } from '$lib/frontend/toast.svelte';
	import { messageEditor } from './editorContext.js';

	type Option = {
		key: string;
		label: string;
		detail: string;
		insert: string;
		color: string | null;
		avatar: string | null;
		icon: string;
		memberId: string | null;
	};

	let {
		target,
		max,
		placement = 'below',
		quiet = false,
		onchange
	}: {
		target: HTMLTextAreaElement | undefined;
		max: number;
		placement?: 'above' | 'below';
		quiet?: boolean;
		onchange: (next: string) => void;
	} = $props();

	const MAX_OPTIONS = 8;
	const SEARCH_DELAY_MS = 180;
	const HEX = /^#[0-9a-f]{6}$/i;

	const editor = messageEditor();

	let open = $state(false);
	let query = $state('');
	let active = $state(0);
	let found = $state<any[]>([]);
	let start = 0;
	let request = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;

	const options = $derived<Option[]>([
		...['everyone', 'here']
			.filter((name) => name.startsWith(query))
			.map((name) => ({ key: name, label: `@${name}`, detail: '', insert: `@${name}`, color: null, avatar: null, icon: 'fa-bullhorn', memberId: null })),
		...editor.roles
			.filter((role) => role.name.toLowerCase().includes(query))
			.slice(0, MAX_OPTIONS)
			.map((role) => ({
				key: `role-${role.id}`,
				label: `@${role.name}`,
				detail: 'Role',
				insert: `<@&${role.id}>`,
				color: role.color && HEX.test(role.color) && role.color !== '#000000' ? role.color : null,
				avatar: null,
				icon: 'fa-shield-halved',
				memberId: null
			})),
		...found.map((member) => {
			const name = String(member.server_display_name || member.display_name || member.username || 'Member');
			return {
				key: `member-${member.discord_member_id}`,
				label: `@${name}`,
				detail: member.username && member.username !== name ? String(member.username) : 'Member',
				insert: `<@${member.discord_member_id}>`,
				color: null,
				avatar: member.avatar ? String(member.avatar) : null,
				icon: 'fa-user',
				memberId: String(member.discord_member_id)
			};
		})
	]);

	function close() {
		open = false;
		request++;
		clearTimeout(timer);
	}

	function search() {
		clearTimeout(timer);
		if (!editor.membersUrl) return;
		const id = ++request;
		timer = setTimeout(async () => {
			try {
				const out = await (await fetch(`${editor.membersUrl}?q=${encodeURIComponent(query)}&limit=${MAX_OPTIONS}`)).json();
				if (id === request) found = Array.isArray(out.members) ? out.members : [];
			} catch (_) {
				if (id === request) found = [];
			}
		}, SEARCH_DELAY_MS);
	}

	function detect() {
		if (!target || target.selectionStart !== target.selectionEnd) return close();
		const caret = target.selectionStart ?? 0;
		const match = target.value.slice(0, caret).match(/(?:^|\s)@([^\s@<>]{0,32})$/);
		if (!match) return close();
		const next = match[1].toLowerCase();
		if (!open || next !== query) active = 0;
		start = caret - match[1].length - 1;
		query = next;
		open = true;
		search();
	}

	async function pick(option: Option) {
		if (!target) return;
		const caret = target.selectionStart ?? start;
		const next = `${target.value.slice(0, start)}${option.insert} ${target.value.slice(caret)}`;
		if (next.length > max) {
			showToast('There is no room left in this text for a tag.', 'error');
			return close();
		}
		if (option.memberId) editor.rememberMember(option.memberId, option.label.slice(1));
		onchange(next);
		close();
		await tick();
		const position = start + option.insert.length + 1;
		target.focus();
		target.setSelectionRange(position, position);
	}

	function onkeydown(event: KeyboardEvent) {
		if (!open || options.length === 0) return;
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			active = (active + (event.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length;
		} else if (event.key === 'Enter' || event.key === 'Tab') {
			event.preventDefault();
			pick(options[Math.min(active, options.length - 1)]);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			close();
		}
	}

	function onkeyup(event: KeyboardEvent) {
		if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) detect();
	}

	$effect(() => {
		const node = target;
		if (!node) return;
		node.addEventListener('input', detect);
		node.addEventListener('click', detect);
		node.addEventListener('keyup', onkeyup);
		node.addEventListener('keydown', onkeydown);
		node.addEventListener('blur', close);
		return () => {
			node.removeEventListener('input', detect);
			node.removeEventListener('click', detect);
			node.removeEventListener('keyup', onkeyup);
			node.removeEventListener('keydown', onkeydown);
			node.removeEventListener('blur', close);
			close();
		};
	});
</script>

{#if open && options.length > 0}
	<div
		role="listbox"
		tabindex="-1"
		aria-label="Tag a role or a member"
		class="bg-ash-800 border-ash-600 absolute right-0 left-0 z-30 max-h-64 overflow-y-auto rounded-lg border p-1 shadow-2xl {placement === 'above'
			? 'bottom-full mb-2'
			: 'top-full mt-1'}"
		onmousedown={(event) => event.preventDefault()}
	>
		{#each options as option, i (option.key)}
			<button
				type="button"
				role="option"
				aria-selected={i === active}
				class="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left {i === active ? 'bg-ash-600' : 'hover:bg-ash-700'}"
				onmouseenter={() => (active = i)}
				onclick={() => pick(option)}
			>
				{#if option.avatar}
					<img src={option.avatar} alt="" class="size-6 shrink-0 rounded-full" />
				{:else}
					<span class="bg-ash-700 grid size-6 shrink-0 place-items-center rounded-full text-[11px]" style={option.color ? `color:${option.color}` : ''}>
						<i class="fas {option.icon}"></i>
					</span>
				{/if}
				<span class="text-ash-100 min-w-0 flex-1 truncate text-sm" style={option.color ? `color:${option.color}` : ''}>{option.label}</span>
				<span class="text-ash-500 shrink-0 truncate text-[11px]">{option.detail}</span>
			</button>
		{/each}
		{#if quiet}
			<p class="text-ash-500 px-2 pt-1 pb-0.5 text-[11px]">A tag inside an embed shows the name but does not notify anyone.</p>
		{/if}
	</div>
{/if}
