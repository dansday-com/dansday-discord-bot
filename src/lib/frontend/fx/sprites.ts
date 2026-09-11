export type Mask = { w: number; h: number; bits: Uint8Array };

function mask(rows: string[]): Mask {
	const w = rows[0].length;
	const h = rows.length;
	const bits = new Uint8Array(w * h);
	for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) bits[y * w + x] = rows[y][x] === '#' ? 1 : 0;
	return { w, h, bits };
}

export const HEART = mask(['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...']);

export const LEAF = mask(['...#...', '.#.#.#.', '.#####.', '#######', '.#####.', '...#...', '...#...']);

export const BLOSSOM = mask(['.#.#.', '#####', '.###.', '#####', '.#.#.']);

export const FLAKE = mask(['..#..', '#.#.#', '.###.', '#.#.#', '..#..']);

export const BUBBLE = mask(['.###.', '#...#', '#...#', '#...#', '.###.']);

export const STAR = mask(['..#..', '..#..', '#####', '..#..', '..#..']);

export const SHARD = mask(['..#..', '.###.', '#####', '.###.', '..#..']);
