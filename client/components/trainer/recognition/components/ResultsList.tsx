/**
 * ResultsList — sonuc listesi, fadeIn animasyonu (AnimatePresence).
 * Referans `src/components/ResultsList.vue` portu.
 */
import React from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import block from '../../../../styles/bem';
import ResultItem from './ResultItem';
import type {ResultRecord} from '../../../../util/trainer/recognition/evaluation';

const b = block('trainer-recognition');

interface ResultsListProps {
	results: ResultRecord[];
	pictureSize: number;
	showNotes?: boolean;
	showTopPicture?: boolean;
	cardLayout?: boolean;
	onItemPicClick?: (result: ResultRecord) => void;
}

export default function ResultsList({
	results,
	pictureSize,
	showNotes = false,
	showTopPicture = false,
	cardLayout = false,
	onItemPicClick,
}: ResultsListProps) {
	return (
		<div className={b('results-list')} style={{minWidth: 230}}>
			<AnimatePresence initial={false}>
				{results.map((r) => (
					<motion.div
						key={`${r.pllCase.name}-${r.pllCase.rotation}-${new Date(r.started).getTime()}`}
						initial={{opacity: 0, y: -6}}
						animate={{opacity: 1, y: 0}}
						exit={{opacity: 0}}
						transition={{duration: 0.25}}
					>
						<ResultItem
							result={r}
							pictureSize={pictureSize}
							showNotes={showNotes}
							showTopPicture={showTopPicture}
							cardLayout={cardLayout}
							onPicClick={onItemPicClick ? () => onItemPicClick(r) : undefined}
						/>
					</motion.div>
				))}
			</AnimatePresence>
		</div>
	);
}
