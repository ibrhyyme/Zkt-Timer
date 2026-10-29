import React, {useMemo, useState} from 'react';
import './TimeDistro.scss';
import {CaretDown} from 'phosphor-react';
import {ParentSize} from '@visx/responsive';
import {FilterSolvesOptions} from '../../../db/solves/query';
import jsonStr from 'json-stable-stringify';
import {useSolveDb} from '../../../util/hooks/useSolveDb';
import {getTimeDistro} from '../../../db/solves/stats/time_distro';
import block from '../../../styles/bem';
import Dropdown from '../../common/inputs/dropdown/Dropdown';
import BarGraph from '../bar_graph/BarGraph';
import dummyData from './dummy_data';
import {useTranslation} from 'react-i18next';
import {maxBarsForWidth} from '../../../util/chart_axis';

const b = block('time-distro');

const DEFAULT_BUCKET_SIZE = 10;
const BUCKET_OPTIONS = [4, 5, 6, 7, 8, 9, 10];

interface Props {
	dummy?: boolean;
	filterOptions: FilterSolvesOptions;
}

export default function TimeDistro(props: Props) {
	const [bucketCount, setBucketCount] = useState(DEFAULT_BUCKET_SIZE);

	return (
		<div className={b()}>
			<ParentSize>
				{({width}) =>
					width > 0 ? (
						<TimeDistroChart {...props} width={width} bucketCount={bucketCount} onBucketCount={setBucketCount} />
					) : null
				}
			</ParentSize>
		</div>
	);
}

interface ChartProps extends Props {
	width: number;
	bucketCount: number;
	onBucketCount: (count: number) => void;
}

function TimeDistroChart(props: ChartProps) {
	const {t} = useTranslation();
	const {filterOptions, dummy, width, bucketCount, onBucketCount} = props;
	const filterStr = jsonStr(filterOptions);
	const solveUpdate = useSolveDb();

	// No more buckets than the card has room for. BarGraph keeps only the bars that fit,
	// which for a distribution cut off the fastest buckets: on a phone nearly every solve
	// vanished and the one slow outlier filled the chart on its own.
	const fit = maxBarsForWidth(width);
	const buckets = Math.min(bucketCount, fit);
	const options = BUCKET_OPTIONS.filter((count) => count <= fit);

	const memoData = useMemo(() => {
		return getTimeDistro(filterOptions, buckets);
	}, [filterStr, buckets, solveUpdate]);

	let data = [...memoData];

	const isDummy = dummy || !data || !data.length;
	if (isDummy) {
		data = dummyData;
	}

	return (
		<BarGraph data={data} dummy={isDummy}>
			<div className={b('buckets')}>
				<Dropdown
					text={t('stats_page.distro_columns', {count: buckets})}
					icon={<CaretDown />}
					dropdownMaxHeight={150}
					options={(options.length ? options : [buckets]).map((bucket) => ({
						value: bucket,
						text: t('stats_page.distro_columns', {count: bucket}),
						disabled: bucket === buckets,
						onClick: () => onBucketCount(bucket),
					}))}
				/>
			</div>
		</BarGraph>
	);
}
