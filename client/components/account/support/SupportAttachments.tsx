import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {X} from 'phosphor-react';
import block from '../../../styles/bem';
import {getStorageURL} from '../../../util/storage';
import './SupportAttachments.scss';

const b = block('support-attachments');

const MIN_SCALE = 0.5;
const MAX_SCALE = 6;
const ZOOM_STEP = 1.15;

export interface AttachmentLike {
	id: string;
	storage_path: string;
	mime_type?: string | null;
	kind: string;
	original_name?: string | null;
}

interface Props {
	attachments: AttachmentLike[];
}

interface DragState {
	startX: number;
	startY: number;
	origX: number;
	origY: number;
	moved: boolean;
}

export default function SupportAttachments({attachments}: Props) {
	const {t} = useTranslation();
	const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
	const [scale, setScale] = useState(1);
	const [pos, setPos] = useState({x: 0, y: 0});
	const lightboxRef = useRef<HTMLDivElement>(null);
	const dragRef = useRef<DragState | null>(null);
	const justDraggedRef = useRef(false);

	const resetView = useCallback(() => {
		setScale(1);
		setPos({x: 0, y: 0});
	}, []);

	const closeLightbox = useCallback(() => {
		setLightboxUrl(null);
		resetView();
	}, [resetView]);

	// Close with Esc
	useEffect(() => {
		if (!lightboxUrl) return;
		function onKey(e: KeyboardEvent) {
			if (e.key === 'Escape') closeLightbox();
		}
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [lightboxUrl, closeLightbox]);

	// Wheel zoom — add with native listener, don't let React's passive handler catch it
	useEffect(() => {
		const el = lightboxRef.current;
		if (!el || !lightboxUrl) return;

		function onWheel(e: WheelEvent) {
			e.preventDefault();
			setScale((prev) => {
				const next = e.deltaY < 0 ? prev * ZOOM_STEP : prev / ZOOM_STEP;
				return Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
			});
		}

		el.addEventListener('wheel', onWheel, {passive: false});
		return () => el.removeEventListener('wheel', onWheel);
	}, [lightboxUrl]);

	// Listen for pointer move/up on document — unified for mouse, touch, and pen
	useEffect(() => {
		if (!lightboxUrl) return;

		function onMove(e: PointerEvent) {
			if (!dragRef.current) return;
			const dx = e.clientX - dragRef.current.startX;
			const dy = e.clientY - dragRef.current.startY;
			if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragRef.current.moved = true;
			setPos({x: dragRef.current.origX + dx, y: dragRef.current.origY + dy});
		}

		function onUp() {
			if (dragRef.current?.moved) {
				justDraggedRef.current = true;
				setTimeout(() => {
					justDraggedRef.current = false;
				}, 0);
			}
			dragRef.current = null;
		}

		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
		window.addEventListener('pointercancel', onUp);
		return () => {
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
			window.removeEventListener('pointercancel', onUp);
		};
	}, [lightboxUrl]);

	function handlePointerDown(e: React.PointerEvent) {
		// Don't count any mouse button other than left (for touch button=0)
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		if ((e.target as HTMLElement).closest(`.${b('lightbox-close')}`)) return;
		dragRef.current = {
			startX: e.clientX,
			startY: e.clientY,
			origX: pos.x,
			origY: pos.y,
			moved: false,
		};
	}

	function handleBackdropClick() {
		if (justDraggedRef.current) return;
		closeLightbox();
	}

	function handleDoubleClick(e: React.MouseEvent) {
		e.stopPropagation();
		resetView();
	}

	if (!attachments || attachments.length === 0) return null;

	const isDragging = !!dragRef.current;
	const cursorClass = isDragging ? 'grabbing' : scale > 1 ? 'grab' : 'zoom-in';

	return (
		<>
			<div className={b()} aria-label={t('support.attachments')}>
				{attachments.map((att) => {
					const url = getStorageURL(att.storage_path);
					if (!url) return null;

					if (att.kind === 'video') {
						return (
							<video
								key={att.id}
								className={b('video')}
								controls
								preload="metadata"
								src={url}
							/>
						);
					}

					return (
						<button
							key={att.id}
							type="button"
							className={b('image-button')}
							onClick={() => setLightboxUrl(url)}
							title={att.original_name || ''}
							aria-label={att.original_name || 'attachment'}
						>
							<img className={b('image')} src={url} alt={att.original_name || 'attachment'} />
						</button>
					);
				})}
			</div>

			{lightboxUrl && (
				<div
					ref={lightboxRef}
					className={b('lightbox', {[cursorClass]: true})}
					role="dialog"
					aria-modal="true"
					onClick={handleBackdropClick}
					onPointerDown={handlePointerDown}
					onDoubleClick={handleDoubleClick}
				>
					<button
						type="button"
						className={b('lightbox-close')}
						onClick={(e) => {
							e.stopPropagation();
							closeLightbox();
						}}
						aria-label={t('support.modal_close')}
					>
						<X weight="bold" />
					</button>
					<img
						className={b('lightbox-image', {dragging: isDragging})}
						src={lightboxUrl}
						alt=""
						style={{
							transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
						}}
						draggable={false}
					/>
					<div className={b('lightbox-hint')}>
						{Math.round(scale * 100)}%
					</div>
				</div>
			)}
		</>
	);
}
