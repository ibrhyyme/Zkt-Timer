import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import './ScrambleVisual.scss';
import { layoutScramble } from '../../../util/vendor/scramble_layout';
import Face from './face/Face';
import block from '../../../styles/bem';
import { getCubeTypeInfoById, getScrambleTypeById } from '../../../util/cubes/util';
import { useGeneral } from '../../../util/hooks/useGeneral';

const b = block('scramble-visual');

export const COLOR_MAP = {
	O: '#FF9826',
	G: '#43FF43',
	R: '#FF4343',
	B: '#246BFD',
	Y: '#FFFF49',
	W: '#FFFFFF',
	D: '#3F464F',
};

interface Props {
	cubeType: string;
	scramble: string;
	width?: string;
	frontFace?: boolean;
}

export default function ScrambleVisual(props: Props) {
	const { cubeType, scramble, frontFace } = props;
	const [isExpanded, setIsExpanded] = useState(false);
	const mobileMode = useGeneral('mobile_mode');

	const width = props.width || '100%';

	function scrambleIsSupported(scrambleType) {
		return ['222', '333', '333bl', '444', '555', '666', '777'].indexOf(scrambleType) > -1;
	}

	const ct = getCubeTypeInfoById(cubeType);
	const cubeScramble = getScrambleTypeById(ct?.scramble);

	const visual = useMemo(() => {
		if (!cubeType || !scramble) {
			return;
		}

		if (!scrambleIsSupported(cubeScramble.id)) {
			return;
		}

		if (scramble) {
			return layoutScramble(scramble, cubeScramble.size);
		}
	}, [cubeType, scramble]);

	const cubeSize = cubeScramble?.size;

	const supported = scrambleIsSupported(cubeScramble?.id);
	if (!supported) {
		return <div className={b('invalid')}>No visual</div>;
	}

	if (!visual) {
		return null;
	}

	// Mobilde tıklama işlevi
	const handleClick = () => {
		if (mobileMode) {
			setIsExpanded(true);
		}
	};

	const closeModal = (e: React.MouseEvent) => {
		e.stopPropagation();
		setIsExpanded(false);
	};

	// Büyük modal görünümü - Portal ile body'e render edilir
	const expandedModalContent = isExpanded && mobileMode ? (
		<div className={b('expanded-overlay')} onClick={closeModal}>
			<div className={b('expanded-content')} onClick={(e) => e.stopPropagation()}>
				<div className={b('expanded-close')} onClick={closeModal}>✕</div>
				<div className={b()} key={`expanded-${cubeSize}`}>
					<Face width="100%" key={`e1-${cubeSize}`} />
					<Face width="100%" key={`e2-${cubeSize}`} size={cubeSize} data={visual.U} />
					<Face width="100%" key={`e3-${cubeSize}`} />
					<Face width="100%" key={`e4-${cubeSize}`} />
					<Face width="100%" key={`e5-${cubeSize}`} size={cubeSize} data={visual.L} />
					<Face width="100%" key={`e6-${cubeSize}`} size={cubeSize} data={visual.F} />
					<Face width="100%" key={`e7-${cubeSize}`} size={cubeSize} data={visual.R} />
					<Face width="100%" key={`e8-${cubeSize}`} size={cubeSize} data={visual.B} />
					<Face width="100%" key={`e9-${cubeSize}`} />
					<Face width="100%" key={`e10-${cubeSize}`} size={cubeSize} data={visual.D} />
					<Face width="100%" key={`e11-${cubeSize}`} />
					<Face width="100%" key={`e12-${cubeSize}`} />
				</div>
			</div>
		</div>
	) : null;

	// Portal kullanarak modal'ı document.body'e render et
	const expandedModal = expandedModalContent && typeof document !== 'undefined'
		? ReactDOM.createPortal(expandedModalContent, document.body)
		: null;

	if (frontFace) {
		return (
			<>
				<div className={b('wrapper', { clickable: mobileMode })} onClick={handleClick}>
					<Face width={width} key={`6-${cubeSize}`} size={cubeSize} data={visual.F} />
				</div>
				{expandedModal}
			</>
		);
	}

	return (
		<>
			<div className={b('wrapper', { clickable: mobileMode })} onClick={handleClick}>
				<div className={b()} key={`body-${cubeSize}`}>
					<Face width={width} key={`1-${cubeSize}`} />
					<Face width={width} key={`2-${cubeSize}`} size={cubeSize} data={visual.U} />
					<Face width={width} key={`3-${cubeSize}`} />
					<Face width={width} key={`4-${cubeSize}`} />
					<Face width={width} key={`5-${cubeSize}`} size={cubeSize} data={visual.L} />
					<Face width={width} key={`6-${cubeSize}`} size={cubeSize} data={visual.F} />
					<Face width={width} key={`7-${cubeSize}`} size={cubeSize} data={visual.R} />
					<Face width={width} key={`8-${cubeSize}`} size={cubeSize} data={visual.B} />
					<Face width={width} key={`9-${cubeSize}`} />
					<Face width={width} key={`10-${cubeSize}`} size={cubeSize} data={visual.D} />
					<Face width={width} key={`11-${cubeSize}`} />
					<Face width={width} key={`12-${cubeSize}`} />
				</div>
			</div>
			{expandedModal}
		</>
	);
}


