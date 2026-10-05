function normalizeWord(input: unknown): string {
	return String(input ?? '')
		.normalize('NFKC')
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ًͯ-ٰٟ]/g, '')
		.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
		.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
		.replace(/[.!?。！？،,]+$/u, '')
		.trim();
}

function wordSet(words: string[]) {
	return new Set(words.map(normalizeWord));
}

const YES_WORDS = wordSet([
	'sì',
	'certo',
	'jazeker',
	'はい',
	'うん',
	'ええ',
	'yes',
	'y',
	'yeah',
	'yep',
	'true',
	'1',
	'ok',
	'okay',
	'ya',
	'iya',
	'iyaa',
	'yoi',
	'boleh',
	'ja',
	'j',
	'jawohl',
	'sí',
	'si',
	's',
	'oui',
	'o',
	'ouais',
	'نعم',
	'ايوه',
	'اي',
	'اجل',
	'是',
	'是的',
	'对',
	'好',
	'要'
]);

const NO_WORDS = wordSet([
	'いいえ',
	'いや',
	'ううん',
	'no',
	'n',
	'nope',
	'false',
	'0',
	'tidak',
	'tdk',
	'gak',
	'ga',
	'nggak',
	'enggak',
	'tak',
	'bukan',
	'jangan',
	'nein',
	'nee',
	'non',
	'nan',
	'لا',
	'كلا',
	'否',
	'不',
	'不是',
	'不要',
	'没有'
]);

export function parseYesNo(input: unknown): boolean | null {
	const word = normalizeWord(input);
	if (!word) return null;
	if (YES_WORDS.has(word)) return true;
	if (NO_WORDS.has(word)) return false;
	return null;
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
		60,
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
		3600,
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
		86400,
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
		604800,
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
	if (!text) return null;
	const re = /(\d+)\s*(\p{L}*)/gu;
	let total = 0;
	let found = false;
	let match: RegExpExecArray | null;
	while ((match = re.exec(text)) !== null) {
		const unit = match[2];
		const seconds = unit ? DURATION_UNIT_SECONDS.get(unit) : 60;
		if (seconds == null) return null;
		found = true;
		total += Number(match[1]) * seconds;
	}
	return found && total > 0 ? total : null;
}

const COLOR_NAMES: [number, string[]][] = [
	[0xff0000, ['red', 'merah', 'rot', 'rojo', 'roja', 'rouge', 'rosso', 'rossa', 'rood', '赤', '赤色', 'احمر', '红', '红色', '紅', '紅色']],
	[0x00ff00, ['green', 'hijau', 'grun', 'gruen', 'verde', 'vert', 'verte', 'groen', '緑', '緑色', 'اخضر', '绿', '绿色', '綠', '綠色']],
	[0x0000ff, ['blue', 'biru', 'blau', 'azul', 'bleu', 'bleue', 'blu', 'blauw', 'ازرق', '蓝', '蓝色', '藍', '藍色']],
	[0xffff00, ['yellow', 'kuning', 'gelb', 'amarillo', 'amarilla', 'jaune', 'giallo', 'gialla', 'geel', 'اصفر', '黄', '黄色', '黃', '黃色']],
	[0xffa500, ['orange', 'oranye', 'oren', 'jingga', 'naranja', 'arancione', 'oranje', 'オレンジ', 'برتقالي', '橙', '橙色']],
	[0x800080, ['purple', 'ungu', 'lila', 'violett', 'morado', 'morada', 'purpura', 'violet', 'violette', 'viola', 'paars', 'بنفسجي', '紫', '紫色']],
	[0xffc0cb, ['pink', 'merah muda', 'merah jambu', 'rosa', 'rose', 'roze', 'ピンク', 'وردي', '粉', '粉色', '粉红', '粉红色', '粉紅', '粉紅色']],
	[0x00ffff, ['cyan', 'sian', 'cian', 'ciano', 'cyaan', '水色', 'سماوي', '青', '青色']],
	[0x000000, ['black', 'hitam', 'schwarz', 'negro', 'negra', 'noir', 'noire', 'nero', 'nera', 'zwart', '黒', '黒色', 'اسود', '黑', '黑色']],
	[0xffffff, ['white', 'putih', 'weiss', 'weiß', 'blanco', 'blanca', 'blanc', 'blanche', 'bianco', 'bianca', 'wit', 'ابيض', '白', '白色']],
	[0x808080, ['gray', 'grey', 'abu-abu', 'abu abu', 'abu', 'kelabu', 'grau', 'gris', 'grise', 'grigio', 'grigia', 'grijs', 'グレー', 'رمادي', '灰', '灰色']]
];

const COLOR_BY_NAME = new Map<string, number>(COLOR_NAMES.flatMap(([value, words]) => words.map((w) => [normalizeWord(w), value] as [string, number])));

const COLOR_BY_LANGUAGE: Record<string, Map<string, number>> = {
	ja: new Map(['青', '青色'].map((w) => [normalizeWord(w), 0x0000ff]))
};

export function parseColorName(input: unknown, lang?: string): number | null {
	const word = normalizeWord(input).replace(/\s+/g, ' ');
	return (lang ? COLOR_BY_LANGUAGE[lang]?.get(word) : undefined) ?? COLOR_BY_NAME.get(word) ?? null;
}
