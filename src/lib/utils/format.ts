const FINE_UNITS_THRESHOLD = 0.0001;
const UNIT_FRACTION_DIGITS = 4;
const FINE_UNITS_DECIMALS = 6;
const TINY_UNITS_DECIMALS = 8;

export function formatPercentValue(n: number): string {
	return Number.isInteger(n) ? `${n}` : n.toFixed(1);
}

export function formatUnits(qty: number): string {
	const v = Number(qty) || 0;
	if (v <= 0) {
		return '0';
	}
	if (v >= 1) {
		return v.toLocaleString('en-US', { maximumFractionDigits: UNIT_FRACTION_DIGITS });
	}
	if (v >= FINE_UNITS_THRESHOLD) {
		return v.toFixed(FINE_UNITS_DECIMALS);
	}
	return v.toFixed(TINY_UNITS_DECIMALS);
}

export function escapeHtml(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
