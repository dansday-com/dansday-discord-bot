<script lang="ts">
	import LegalDocPage from '$lib/frontend/components/LegalDocPage.svelte';
	import { PRIVACY_PATH, privacy } from '$lib/legal.js';
</script>

<LegalDocPage doc={privacy} path={PRIVACY_PATH} />
