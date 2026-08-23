<script lang="ts">
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

<div class="m-empty">
	<i class="fas {icon}" style="font-size: 48px; opacity: 0.2;"></i>
	<p>{title}</p>
	<span class="m-disabled-note">{message}</span>
</div>

<style>
	.m-disabled-note {
		max-width: 420px;
		font-size: 13px;
		line-height: 1.5;
		opacity: 0.75;
	}
</style>
