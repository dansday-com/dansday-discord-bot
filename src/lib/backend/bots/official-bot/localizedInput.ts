import { DAY_SECONDS, DAYS_PER_WEEK, HOUR_SECONDS, MINUTE_SECONDS } from '../../../utils/time.js';

const ARABIC_INDIC_DIGIT_ZERO = 0x0660;
const EXTENDED_ARABIC_INDIC_DIGIT_ZERO = 0x06f0;
const BARE_NUMBER_UNIT_SECONDS = MINUTE_SECONDS;

function normalizeWord(input: unknown): string {
	return String(input ?? '')
		.normalize('NFKC')
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f\u064b-\u065f\u0670]/g, '')
		.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - ARABIC_INDIC_DIGIT_ZERO))
		.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - EXTENDED_ARABIC_INDIC_DIGIT_ZERO))
		.replace(/[.!?。！？،,]+$/u, '')
		.trim();
}

const DURATION_UNITS: [number, string[]][] = [
	[
		1,
		[
			's',
			'sec',
			'secs',
			'second',
			'seconds',
			'detik',
			'dtk',
			'saat',
			'sekunde',
			'sekunden',
			'sek',
			'seg',
			'segundo',
			'segundos',
			'seconde',
			'secondes',
			'secondo',
			'secondi',
			'seconden',
			'秒間',
			'ثانية',
			'ثواني',
			'ث',
			'秒',
			'秒钟'
		]
	],
	[
		MINUTE_SECONDS,
		[
			'm',
			'min',
			'mins',
			'minute',
			'minutes',
			'menit',
			'mnt',
			'minit',
			'minuten',
			'minuto',
			'minutos',
			'minuti',
			'minuut',
			'minuten',
			'分間',
			'دقيقة',
			'دقائق',
			'د',
			'分',
			'分钟',
			'分鐘'
		]
	],
	[
		HOUR_SECONDS,
		[
			'h',
			'hr',
			'hrs',
			'hour',
			'hours',
			'jam',
			'std',
			'stunde',
			'stunden',
			'hora',
			'horas',
			'heure',
			'heures',
			'ora',
			'ore',
			'uur',
			'uren',
			'u',
			'時間',
			'ساعة',
			'ساعات',
			'س',
			'小时',
			'小時',
			'时',
			'時',
			'钟头'
		]
	],
	[
		DAY_SECONDS,
		[
			'd',
			'day',
			'days',
			'hari',
			't',
			'tag',
			'tage',
			'tagen',
			'dia',
			'dias',
			'j',
			'jour',
			'jours',
			'g',
			'giorno',
			'giorni',
			'dag',
			'dagen',
			'日間',
			'يوم',
			'ايام',
			'ي',
			'天',
			'日'
		]
	],
	[
		DAYS_PER_WEEK * DAY_SECONDS,
		[
			'w',
			'wk',
			'wks',
			'week',
			'weeks',
			'minggu',
			'mgg',
			'woche',
			'wochen',
			'semana',
			'semanas',
			'sem',
			'semaine',
			'semaines',
			'settimana',
			'settimane',
			'sett',
			'weken',
			'週間',
			'اسبوع',
			'اسابيع',
			'周',
			'週',
			'星期',
			'礼拜'
		]
	]
];

const DURATION_UNIT_SECONDS = new Map<string, number>(
	DURATION_UNITS.flatMap(([seconds, words]) => words.map((w) => [normalizeWord(w), seconds] as [string, number]))
);

export function parseLocalizedDuration(input: unknown): number | null {
	const text = normalizeWord(input);
	if (!text) {
		return null;
	}
	const re = /(\d+)\s*(\p{L}*)/gu;
	let total = 0;
	let wasFound = false;
	for (const match of text.matchAll(re)) {
		const unit = match[2];
		const seconds = unit ? DURATION_UNIT_SECONDS.get(unit) : BARE_NUMBER_UNIT_SECONDS;
		if (seconds == null) {
			return null;
		}
		wasFound = true;
		total += Number(match[1]) * seconds;
	}
	return wasFound && total > 0 ? total : null;
}
