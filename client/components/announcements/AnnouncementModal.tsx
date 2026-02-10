import React from 'react';
import { createPortal } from 'react-dom';
import { X, CaretRight } from 'phosphor-react';
import { Announcement } from '../../@types/generated/graphql';

interface AnnouncementModalProps {
	announcement: Announcement;
	onClose: () => void;
	onNext?: () => void;
	isCarousel?: boolean;
	currentIndex?: number;
	totalCount?: number;
	isClosing?: boolean;
}

interface CategoryConfig {
	bg: string;
	text: string;
	border: string;
	headerBg: string;
	label: string;
	accent: string;
}

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
	FEATURE: {
		bg: 'bg-indigo-500/15',
		text: 'text-indigo-300',
		border: 'border-indigo-400/30',
		headerBg: 'from-indigo-600/30 via-purple-600/15 to-zinc-900',
		label: '🎉 Yenilik',
		accent: 'bg-indigo-500'
	},
	BUGFIX: {
		bg: 'bg-emerald-500/15',
		text: 'text-emerald-300',
		border: 'border-emerald-400/30',
		headerBg: 'from-emerald-600/30 via-emerald-600/10 to-zinc-900',
		label: '🔧 Düzeltme',
		accent: 'bg-emerald-500'
	},
	IMPORTANT: {
		bg: 'bg-amber-500/15',
		text: 'text-amber-300',
		border: 'border-amber-400/30',
		headerBg: 'from-amber-600/30 via-amber-600/10 to-zinc-900',
		label: '⚠️ Önemli',
		accent: 'bg-amber-500'
	},
	INFO: {
		bg: 'bg-sky-500/15',
		text: 'text-sky-300',
		border: 'border-sky-400/30',
		headerBg: 'from-sky-600/30 via-sky-600/10 to-zinc-900',
		label: 'ℹ️ Bilgi',
		accent: 'bg-sky-500'
	}
};

export default function AnnouncementModal(props: AnnouncementModalProps) {
	const {
		announcement,
		onClose,
		onNext,
		isCarousel = false,
		currentIndex = 0,
		totalCount = 1,
		isClosing = false
	} = props;

	const config = CATEGORY_CONFIG[announcement.category] || CATEGORY_CONFIG.INFO;

	const modal = (
		<div
			className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
			onClick={onClose}
		>
			<div
				className={`
					bg-zinc-900 border border-zinc-700/80 rounded-2xl
					max-w-2xl w-full max-h-[90vh] overflow-hidden
					shadow-[0_25px_60px_-12px_rgba(0,0,0,0.6)] transition-all duration-300
					${isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}
				`}
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div className={`relative bg-gradient-to-b ${config.headerBg} px-7 pt-7 pb-5`}>
					{/* Accent line */}
					<div className={`absolute top-0 left-0 right-0 h-1 ${config.accent} rounded-t-2xl`} />

					{/* Close button */}
					<button
						onClick={onClose}
						className="absolute top-5 right-5 p-2 hover:bg-white/10 rounded-lg transition text-zinc-400 hover:text-white"
					>
						<X size={20} weight="bold" />
					</button>

					{/* Category badge */}
					<div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${config.bg} ${config.text} ${config.border} mb-4`}>
						<span className="text-xs font-semibold tracking-wide uppercase">{config.label}</span>
					</div>

					{/* Title */}
					<h2 className="text-xl font-bold text-white leading-tight pr-8">{announcement.title}</h2>

					{/* Carousel indicator */}
					{isCarousel && (
						<div className="flex items-center gap-2 mt-3">
							{Array.from({ length: totalCount }).map((_, i) => (
								<div
									key={i}
									className={`h-1.5 rounded-full transition-all ${
										i === currentIndex
											? `w-6 ${config.accent}`
											: 'w-1.5 bg-zinc-600'
									}`}
								/>
							))}
						</div>
					)}

					{/* Optional header image */}
					{announcement.imageUrl && (
						<img
							src={announcement.imageUrl}
							alt={announcement.title}
							className="mt-5 rounded-xl w-full object-cover max-h-56 border border-zinc-700/50"
						/>
					)}
				</div>

				{/* Content */}
				<div className="px-7 py-6 overflow-y-auto max-h-[55vh]">
					<div className="text-[15px] leading-relaxed text-zinc-300 whitespace-pre-wrap space-y-1">
						{announcement.content}
					</div>
				</div>

				{/* Footer */}
				<div className="px-7 py-5 border-t border-zinc-800 flex justify-between items-center">
					<span className="text-xs text-zinc-500">
						{announcement.createdAt && new Date(announcement.createdAt).toLocaleDateString('tr-TR', {
							day: 'numeric',
							month: 'long',
							year: 'numeric'
						})}
					</span>
					<div className="flex gap-3">
						{onNext ? (
							<>
								<button
									onClick={onClose}
									className="px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
								>
									Kapat
								</button>
								<button
									onClick={onNext}
									className="px-5 py-2.5 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center gap-2 shadow-lg shadow-indigo-500/20"
								>
									Sonraki
									<CaretRight size={16} weight="bold" />
								</button>
							</>
						) : (
							<button
								onClick={onClose}
								className="px-6 py-2.5 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-lg shadow-indigo-500/20"
							>
								Anladım
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	);

	return createPortal(modal, document.body);
}
