<script lang="ts">
	import type { LayoutProps } from './$types';
	let { children }: LayoutProps = $props();
</script>

<div class="from-ash-950 to-ash-800 flex min-h-screen items-center justify-center bg-gradient-to-br">
	<div class="mx-3 w-full max-w-md sm:mx-4">
		{@render children()}

		<div class="text-ash-500 mt-4 px-2 text-center text-xs sm:mt-6 sm:text-sm">
			<p>
				Copyright &copy; {new Date().getFullYear()}
				<a href="https://dansday.com" target="_blank" class="text-ash-200 hover:text-ash-300 transition-colors">dansday.com</a>. All rights reserved.
			</p>
		</div>
	</div>
</div>
