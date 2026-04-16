<script lang="ts">
	type Palette = 'light' | 'dark';

	let { palette = 'light' as Palette }: { palette?: Palette } = $props();
</script>

<footer class="m-footer" class:m-footer--dark={palette === 'dark'}>
	<div class="m-footer-inner">
		<p class="m-footer-copy">
			Copyright © {new Date().getFullYear()}
			<a href="https://dansday.com">dansday.com</a>. All rights reserved.
		</p>
		<p class="m-footer-open">
			Free and open source on
			<a href="https://github.com/dansday/dansday-discord-bot">GitHub</a>.
		</p>
	</div>
</footer>
