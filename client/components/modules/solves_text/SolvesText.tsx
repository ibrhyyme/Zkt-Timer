import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './SolvesText.scss';
import block from '../../../styles/bem';
import { Download } from 'phosphor-react';
import Button, { CommonType } from '../../common/button/Button';
import CopyText from '../../common/copy_text/CopyText';
import { getTimeString } from '../../../util/time';
import { generateSolvesStatsText } from '../../../util/average_text';
import Checkbox from '../../common/checkbox/Checkbox';
import fileDownload from 'js-file-download';
import { getCubeTypeName } from '../../../util/cubes/util';
import { Solve } from '../../../../server/schemas/Solve.schema';

const b = block('solves-text');

interface Props {
	time?: number;
	description: string;
	solves: Solve[];
	reverseOrder?: boolean;
}

export default function SolvesText(props: Props) {
	const { solves, reverseOrder, description, time } = props;

	const { t } = useTranslation();
	const isSingle = solves.length === 1;
	// Single solve için tarih varsayılan açık olsun
	const [includeScramble, setIncludeScramble] = useState(true);
	const [wrapText, setWrapText] = useState(false);
	const [includeDate, setIncludeDate] = useState(false);
	const [includeCubeType, setIncludeCubeType] = useState(false);
	const [includeNotes, setIncludeNotes] = useState(false);

	// CSV export only. The plain-text list below comes from generateSolvesStatsText,
	// shared with the solve detail card's native share (see NormalSolveLayout.tsx).
	function getCsvRows() {
		const lines = [];
		for (let i = 0; i < solves.length; i += 1) {
			let index = i;
			let displayIndex = solves.length - i;
			if (reverseOrder) {
				index = solves.length - i - 1;
				displayIndex = i + 1;
			}

			const solve = solves[index];
			const cubeType = getCubeTypeName(solve.cube_type);
			let time = getTimeString(solve);
			if (!solve.dnf && solve.plus_two) {
				time += '+';
			}

			const parts = [displayIndex, time];

			if (includeScramble) parts.push(solve.scramble);
			if (includeCubeType) parts.push(cubeType);
			if (includeDate) parts.push(new Date(solve.ended_at).toLocaleString());
			if (includeNotes) parts.push(solve.notes);

			lines.push(parts.join(','));
		}

		return lines;
	}

	function downloadCsv() {
		const keys = ['Index', 'Time'];
		if (includeScramble) keys.push('Scramble');
		if (includeDate) keys.push('Date');
		if (includeNotes) keys.push('Notes');
		if (includeCubeType) keys.push('Cube Type');

		let fileName = description.replace(/-/g, '');
		fileName = fileName.replace(/[^a-zA-Z\d\s]/g, '');
		fileName = fileName.replace(/\s/g, '-');
		fileName = fileName.toLowerCase();

		const lines = [keys.join(','), ...getCsvRows()];

		const encodedUri = lines.join('\r\n');
		const filename = `zkttimer_${fileName}.csv`;

		fileDownload(encodedUri, filename);
	}

	const solvesText = generateSolvesStatsText(t, description, time, solves, reverseOrder, {
		includeScramble,
		includeCubeType,
		includeDate,
		includeNotes,
	});

	return (
		<div className={b()}>
			<div className={b('top')}>
				{!isSingle && (
					<div className={b('options')}>
						<Checkbox
							text={t('solve_info.add_scramble')}
							onChange={() => setIncludeScramble(!includeScramble)}
							checked={includeScramble}
						/>
						<Checkbox
							text={t('solve_info.add_cube_type')}
							onChange={() => setIncludeCubeType(!includeCubeType)}
							checked={includeCubeType}
						/>
						<Checkbox text={t('solve_info.add_date')} onChange={() => setIncludeDate(!includeDate)} checked={includeDate} />
						<Checkbox
							text={t('solve_info.add_notes')}
							onChange={() => setIncludeNotes(!includeNotes)}
							checked={includeNotes}
						/>
						<Checkbox text={t('solve_info.wrap_text')} onChange={() => setWrapText(!wrapText)} checked={wrapText} />
					</div>
				)}
				<div className={b('text', { wrapText })}>{solvesText}</div>
			</div>
			<div className={b('actions')}>
				<CopyText
					text={solvesText}
					buttonProps={{
						primary: true,
						text: 'Metni kopyala',
					}}
				/>
				<Button
					icon={<Download weight="bold" />}
					theme={CommonType.GRAY}
					onClick={downloadCsv}
					text="CSV olarak indir"
				/>
			</div>
		</div>
	);
}
