/**
 * TrainerLandingCoverflow — mobil mod secici (Claude Design "Coverflow / 3D Fan").
 * Kartlar 3D yelpazede; yana surukle, ortadaki secili mod, altta dots. Smart/PRO ortada baslar.
 * Transform'lar drag'e bagli → inline; gorunum SCSS. Metinler i18n; Pro mantigi parent'tan.
 */
import React, {useRef, useState} from 'react';
import {Check, Lock, Cube} from 'phosphor-react';
import {useTranslation} from 'react-i18next';
import block from '../../../styles/bem';
import './TrainerLandingCoverflow.scss';
import type {TrainerMode} from '../types';
import type {ModeConfig} from '../landing_modes';

const b = block('trainer-cf');
const STEP = 200;
// Tap toleransi: parmak dogal olarak biraz kayar; bu esigin altinda kalan hareket
// "tap" sayilir (mod acilir), ustu "drag" (kart degisir). Cok dusuk olursa hafif kavisli
// dokunus bile drag sanilir.
const TAP_SLOP = 14;

interface Props {
	modes: ModeConfig[];
	smartLocked: boolean;
	onSelect: (mode: TrainerMode, locked: boolean) => void;
}

export default function TrainerLandingCoverflow({modes, smartLocked, onSelect}: Props) {
	const {t} = useTranslation();
	// Smart/PRO ortada baslar (design); mod sayisi azsa clamp.
	const [active, setActive] = useState(Math.min(1, modes.length - 1));
	const [dx, setDx] = useState(0);
	const drag = useRef<{x: number; moved: boolean} | null>(null);
	// Son jest drag miydi? Kart onClick'i tap (drag degil) iken acsin diye.
	const movedRef = useRef(false);

	const onDown = (e: React.PointerEvent) => {
		drag.current = {x: e.clientX, moved: false};
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	};
	const onMove = (e: React.PointerEvent) => {
		if (!drag.current) return;
		const d = e.clientX - drag.current.x;
		if (Math.abs(d) > TAP_SLOP) drag.current.moved = true;
		setDx(d);
	};
	const onUp = () => {
		if (!drag.current) return;
		const wasMoved = drag.current.moved;
		movedRef.current = wasMoved;
		drag.current = null;
		if (wasMoved) {
			const na = Math.max(0, Math.min(modes.length - 1, active - Math.round(dx / STEP)));
			setActive(na);
		}
		setDx(0);
	};

	const dragging = drag.current !== null;

	return (
		<div className={b()}>
			<div
				className={b('stage')}
				onPointerDown={onDown}
				onPointerMove={onMove}
				onPointerUp={onUp}
				onPointerCancel={onUp}
			>
				<div className={b('deck')}>
					{modes.map((mode, i) => {
						const pro = !!mode.pro;
						const locked = pro && smartLocked;
						const pos = i - active + dx / STEP; // 0 = merkez
						const a = Math.abs(pos);
						const tx = pos * 132;
						const ry = Math.max(-52, Math.min(52, -pos * 44));
						const tz = -a * 160;
						const sc = Math.max(0.68, 1 - a * 0.13);
						const center = a < 0.5;
						const num = String(i + 1).padStart(2, '0');
						return (
							<div
								key={mode.id}
								className={b('slot')}
								style={{
									transform: `translateX(${tx}px) translateZ(${tz}px) rotateY(${ry}deg) scale(${sc})`,
									opacity: a > 2.3 ? 0 : 1,
									zIndex: 100 - Math.round(a * 10),
									transition: dragging ? 'none' : 'transform .42s cubic-bezier(.3,.7,.3,1), opacity .42s',
									pointerEvents: center ? 'auto' : 'none',
								}}
							>
								<div
									className={b('card', {[mode.accent]: true, pro, center})}
									onClick={() => {
										// Sadece tap (drag degil) ise moda gir. Merkez-disi kartlar zaten pointer-events:none.
										if (!movedRef.current) onSelect(mode.id, locked);
									}}
								>
									{!center && (
										<div className={b('dim')} style={{background: `rgba(0, 0, 0, ${Math.min(0.5, a * 0.3)})`}} />
									)}
									<span className={b('watermark')} aria-hidden="true">
										<Cube size={150} weight="thin" />
									</span>

									<div className={b('eyebrow-row')}>
										<span className={b('eyebrow')}>
											{pro ? 'PRO · ' : ''}
											{t('trainer.landing_eyebrow', {defaultValue: 'MOD'})} {num}
										</span>
										<span className={b('icon')}>
											<mode.Icon size={23} />
										</span>
									</div>

									<h2 className={b('name')}>{t(mode.titleKey)}</h2>
									<p className={b('desc')}>{t(mode.descKey)}</p>

									<div className={b('groups')}>
										{mode.groups.map((g, gi) => (
											<div key={gi} className={b('group')}>
												<span className={b('group-label')}>{t(g.labelKey)}</span>
												{g.itemKeys.map((ik) => (
													<div key={ik} className={b('feature')}>
														<span className={b('check')}>
															<Check size={14} weight="bold" />
														</span>
														<span>{t(ik)}</span>
													</div>
												))}
											</div>
										))}
									</div>

									<button type="button" className={b('cta', {pro})} tabIndex={-1}>
										{locked && <Lock size={13} />}
										{locked ? t('trainer.landing_pro_required') : t(mode.titleKey)}
									</button>
								</div>
							</div>
						);
					})}
				</div>

				<div className={b('dots')}>
					{modes.map((mode, i) => (
						<span
							key={mode.id}
							className={b('dot', {[mode.accent]: true, active: i === active})}
							onClick={() => setActive(i)}
							role="button"
							aria-label={t(mode.titleKey)}
						/>
					))}
				</div>
			</div>
		</div>
	);
}
