import React, {useState} from 'react';
import './SolvesText.scss';
import block from '../../../styles/bem';
import {Download} from 'phosphor-react';
import Button, {CommonType} from '../../common/button/Button';
import CopyText from '../../common/copy_text/CopyText';
import dayjs from 'dayjs';
import {getTimeString} from '../../../util/time';
import Checkbox from '../../common/checkbox/Checkbox';
import fileDownload from 'js-file-download';
import {getCubeTypeName} from '../../../util/cubes/util';
import {Solve} from '../../../../server/schemas/Solve.schema';

const b = block('solves-text');

interface Props {
	time?: number;
	description: string;
	solves: Solve[];
	reverseOrder?: boolean;
}

export default function SolvesText(props: Props) {
	const {solves, reverseOrder, description, time} = props;

	const [includeScramble, setIncludeScramble] = useState(true);
	const [wrapText, setWrapText] = useState(false);
	const [includeDate, setIncludeDate] = useState(false);
	const [includeCubeType, setIncludeCubeType] = useState(false);
	const [includeNotes, setIncludeNotes] = useState(false);

	function getSolveRows(csv?: boolean) {
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

			const parts = [];
			if (csv) {
				parts.push(displayIndex);
			} else {
				parts.push(displayIndex + '.');
			}

			parts.push(time);

			const add = [];
			if (includeScramble) add.push(solve.scramble);
			if (includeCubeType) add.push(cubeType);
			if (includeDate) add.push(new Date(solve.ended_at).toLocaleString());
			if (includeNotes) add.push(solve.notes);

			for (const a of add) {
				if (!csv) {
					parts.push('  ');
				}
				parts.push(a);
			}

			const dec = csv ? ',' : ' ';
			lines.push(parts.join(dec));
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

		const lines = [keys.join(','), ...getSolveRows(true)];

		const encodedUri = lines.join('\r\n');
		const filename = `cubedesk_${fileName}.csv`;

		fileDownload(encodedUri, filename);
	}

	function getSolvesText() {
		const lines = [];
		lines.push('ZKT-Timer tarafından ' + dayjs().format('YYYY-MM-DD') + ' tarihinde oluşturuldu');

		let desc = description;
		if (time && getTimeString(time)) {
			desc += `: ${getTimeString(time)}`;
		}

		lines.push(desc);
		lines.push('');
		lines.push('Çözümler:');
		lines.push(...getSolveRows());

		return lines.join('\n');
	}

	const solvesText = getSolvesText();

	return (
		<div className={b()}>
			<div className={b('top')}>
				<div className={b('options')}>
					<Checkbox
						text="Karıştırmayı ekle"
						onChange={() => setIncludeScramble(!includeScramble)}
						checked={includeScramble}
					/>
					<Checkbox
						text="Küp türünü ekle"
						onChange={() => setIncludeCubeType(!includeCubeType)}
						checked={includeCubeType}
					/>
					<Checkbox text="Tarihi ekle" onChange={() => setIncludeDate(!includeDate)} checked={includeDate} />
					<Checkbox
						text="Notları ekle"
						onChange={() => setIncludeNotes(!includeNotes)}
						checked={includeNotes}
					/>
					<Checkbox text="Metni kaydır" onChange={() => setWrapText(!wrapText)} checked={wrapText} />
				</div>
				<div className={b('text', {wrapText})}>{solvesText}</div>
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
