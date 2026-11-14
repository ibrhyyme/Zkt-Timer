import { parseLastCubeXData, parseSemicolonCsv } from '../lastcubex';

const HEADER = 'Puzzle;Session;Time(millis);Date(millis);Scramble;Penalty;Remark;Reconstruction';

function row(...fields: string[]): string {
	return fields.map((f) => `"${f.replace(/"/g, '""')}"`).join(';');
}

function file(...rows: string[]): string {
	return [HEADER, ...rows].join('\r\n') + '\r\n';
}

const S333 = "R2 D2 R F' U' D2 F2 B' R' F2 L2 D2 L2 B' L2 F' B2 R2 L2";

describe('parseLastCubeXData', () => {
	it('groups solves into one session per (puzzle, session) and maps puzzles to WCA buckets', () => {
		const data = parseLastCubeXData(
			file(
				row('3x3x3', '3x3x3', '8554', '1794666144158', S333, '0', '', ''),
				row('2x2x2', '2', '2100', '1794666100000', "R U2 F' R2", '0', '', ''),
				row('3x3x3', '3x3x3', '9000', '1794666000000', S333, '0', '', ''),
				row('7x7x7', '7', '274065', '1758902383585', 'R2 Dw 3Bw', '0', '', '')
			)
		);

		expect(data.sessions.map((s) => s.name)).toEqual(['3x3x3', '2', '7']);
		expect(data.sessions.map((s) => s.order)).toEqual([0, 1, 2]);
		expect(data.solves).toHaveLength(4);

		const [s333, s222, s777] = data.sessions;
		expect(data.solves.filter((s) => s.session_id === s333.id)).toHaveLength(2);
		expect(data.sessionIdCubeTypeMap).toEqual({ [s333.id]: '333', [s222.id]: '222', [s777.id]: '777' });

		const first = data.solves[0];
		expect(first).toMatchObject({
			time: 8.554,
			raw_time: 8.554,
			plus_two: false,
			dnf: false,
			cube_type: 'wca',
			scramble_subset: '333',
			started_at: 1794666144158,
			ended_at: 1794666144158 + 8554,
		});
		expect(data.solves.find((s) => s.session_id === s222.id)).toMatchObject({ cube_type: 'wca', scramble_subset: '222' });
	});

	it('reads penalty 1 as +2 already included in Time and 2 as DNF', () => {
		const data = parseLastCubeXData(
			file(
				row('3x3x3', 'a', '11570', '1714157684052', S333, '1', '', ''),
				row('3x3x3', 'a', '9500', '1714157684053', S333, '2', '', '')
			)
		);
		const [plus, dnf] = data.solves;
		expect(plus).toMatchObject({ plus_two: true, dnf: false, raw_time: 9.57, time: 11.57 });
		expect(dnf).toMatchObject({ plus_two: false, dnf: true, raw_time: 9.5, time: -1 });
	});

	it('puts a one-handed 3x3 session into the OH subset', () => {
		const data = parseLastCubeXData(file(row('3x3x3', 'on hand', '15000', '1794666144158', S333, '0', '', '')));
		expect(data.solves[0]).toMatchObject({ cube_type: '333', scramble_subset: '333oh' });
		expect(data.sessionIdCubeTypeMap[data.sessions[0].id]).toBe('333oh');
	});

	it('keeps remarks, including quotes, semicolons and line breaks', () => {
		const data = parseLastCubeXData(file(row('3x3x3', 'a', '9000', '1', S333, '0', 'pb; "nice"\nsecond line', '')));
		expect(data.solves[0].notes).toBe('pb; "nice"\nsecond line');
	});

	it('skips a puzzle with no WCA bucket and reports it', () => {
		const data = parseLastCubeXData(
			file(
				row('Gear Cube', 'g', '30000', '1', 'xyz', '0', '', ''),
				row('3x3x3', 'a', '9000', '1', S333, '0', '', '')
			)
		);
		expect(data.sessions).toHaveLength(1);
		expect(data.skippedSolveCount).toBe(1);
		expect(data.skippedCubeTypes).toEqual({ 'Gear Cube': 1 });
	});

	it('rejects a file that is not a Last Cube X backup', () => {
		expect(() => parseLastCubeXData('time,comment,scramble,date\n1,,R,1')).toThrow('LASTCUBEX_INVALID_FILE');
	});
});

describe('parseSemicolonCsv', () => {
	it('handles LF and CRLF and ignores blank lines', () => {
		expect(parseSemicolonCsv('"a";"b"\n\r\n"c";"d"\r\n')).toEqual([
			['a', 'b'],
			['c', 'd'],
		]);
	});
});
