<script lang="ts">
	/**
	 * One footer for marketing + panel: identical structure and spacing;
	 * `palette` only toggles `.m-footer--dark` (see app.css `.m-footer`).
	 */
	type Palette = 'light' | 'dark';

	let { palette = 'light' as Palette }: { palette?: Palette } = $props();
</script>

<footer class="m-footer" class:m-footer--dark={palette === 'dark'}>
	<div class="m-footer-inner">
		<p class="m-footer-copy">
			Copyright © {new Date().getFullYear()}
			<a href="https://dansday.com">dansday.com</a>. All rights reserved.
		</p>
		<p class="m-footer-legal">
			<a href="/privacy-policy">Privacy Policy</a>
			<span class="m-footer-legal-sep" aria-hidden="true">·</span>
			<a href="/terms-of-service">Terms of Service</a>
		</p>
		<p class="m-footer-open">
			Free and open source on
			<a href="https://github.com/dansday/dansday-discord-bot">GitHub</a>.
		</p>
	</div>
</footer>
