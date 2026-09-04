<script lang="ts">
	import { EmptyState } from '$lib/frontend/components/public';

	let {
		title = 'This feature is turned off',
		message = 'An administrator can enable it in the bot configuration panel.',
		icon = 'fa-lock'
	}: {
		title?: string;
		message?: string;
		icon?: string;
	} = $props();
</script>

<EmptyState {icon} message={title} hint={message} boxed />
