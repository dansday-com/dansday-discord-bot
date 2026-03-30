<script lang="ts">
	import { goto } from '$app/navigation';
	import { showToast } from '$lib/stores/toast.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let loading = $state(false);
	let otpCode = $state('');

	async function handleSubmit() {
		if (!otpCode || otpCode.length !== 6) {
			showToast('Please enter a valid 6-digit code', 'error');
			return;
		}

		loading = true;
		try {
			const res = await fetch('/api/panel/verify-otp', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ account_id: data.accountId, otp_code: otpCode })
			});

			if (!res.ok) {
				const err = await res.json().catch(() => ({ error: 'Verification failed' }));
				showToast(err.error || 'OTP verification failed', 'error');
				return;
			}

			const d = await res.json();
			if (d.success) {
				showToast(d.message || 'Email verified! Please login.', 'success');
				setTimeout(() => goto('/login'), 1000);
			} else {
				showToast(d.error || 'OTP verification failed', 'error');
			}
		} catch {
			showToast('Verification failed. Please try again.', 'error');
		} finally {
			loading = false;
		}
	}

	async function resendOtp() {
		try {
			const res = await fetch('/api/panel/resend-otp', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ account_id: data.accountId })
			});
			const d = await res.json().catch(() => ({}));
			showToast(d.message || d.error || 'Code resent', d.success ? 'success' : 'error');
		} catch {
			showToast('Failed to resend code', 'error');
		}
	}
</script>

<svelte:head>
	<title>Verify Email | Dansday</title>
</svelte:head>

<div class="bg-ash-800 rounded-2xl shadow-2xl border border-ash-700 p-6 sm:p-8">
			<div class="text-center mb-6 sm:mb-8">
				<div class="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-ash-400 rounded-full mb-3 sm:mb-4">
					<i class="fas fa-envelope-open-text text-xl sm:text-2xl text-ash-100"></i>
				</div>
				<h1 class="text-2xl sm:text-3xl font-bold text-ash-100 mb-2">Verify Email</h1>
				<p class="text-ash-400 text-xs sm:text-sm">Enter the 6-digit code sent to your email</p>
			</div>

			<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4 sm:space-y-6">
				<div>
					<label for="otp_code" class="block text-xs sm:text-sm font-medium text-ash-300 mb-2">
						<i class="fas fa-key mr-2"></i>Verification Code <span class="text-ash-200">*</span>
					</label>
					<input
						id="otp_code"
						type="text"
						bind:value={otpCode}
						maxlength="6"
						pattern="[0-9]{6}"
						placeholder="000000"
						autocomplete="one-time-code"
						oninput={(e) => {
							const t = e.currentTarget as HTMLInputElement;
							t.value = t.value.replace(/[^0-9]/g, '');
							otpCode = t.value;
						}}
						class="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-ash-700 border border-ash-600 rounded-lg text-ash-100 placeholder-ash-500 focus:outline-none focus:ring-2 focus:ring-ash-500 focus:border-transparent transition-all text-center text-2xl tracking-widest"
					/>
					<p class="mt-2 text-xs text-ash-400 text-center">
						<button
							type="button"
							onclick={resendOtp}
							class="text-ash-200 hover:text-ash-300 underline"
						>
							Resend code
						</button>
					</p>
				</div>

				<button
					type="submit"
					disabled={loading}
					class="w-full bg-ash-400 hover:bg-ash-500 text-ash-100 font-semibold py-2.5 sm:py-3 px-4 rounded-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm sm:text-base"
				>
					{#if loading}<i class="fas fa-spinner fa-spin"></i>{/if}
					{loading ? 'Verifying...' : 'Verify'}
				</button>

				<div class="text-center">
					<a href="/login" class="text-xs sm:text-sm text-ash-400 hover:text-ash-300">
						&larr; Back to login
					</a>
				</div>
	</form>
</div>
