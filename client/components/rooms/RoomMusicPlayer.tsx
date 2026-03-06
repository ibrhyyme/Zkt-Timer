import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { gql, useLazyQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { X, MagnifyingGlass, Play, Pause, Stop, SkipBack, SkipForward } from 'phosphor-react';

const YOUTUBE_SEARCH = gql`
	query YoutubeSearch($input: YouTubeSearchInput!) {
		youtubeSearch(input: $input) {
			videoId
			title
			channelTitle
			thumbnail
		}
	}
`;

interface YouTubeVideoResult {
	videoId: string;
	title: string;
	channelTitle: string;
	thumbnail: string;
}

interface RoomMusicPlayerProps {
	isOpen: boolean;
	onClose: () => void;
}

const STORAGE_KEY = 'zkt_room_music_last_video';
function formatTime(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m}:${s.toString().padStart(2, '0')}`;
}

function decodeHtmlEntities(text: string): string {
	const textarea = document.createElement('textarea');
	textarea.innerHTML = text;
	return textarea.value;
}

export default function RoomMusicPlayer({ isOpen, onClose }: RoomMusicPlayerProps) {
	const { t } = useTranslation();

	const [searchQuery, setSearchQuery] = useState('');
	const [currentVideo, setCurrentVideo] = useState<{ videoId: string; title: string } | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [playlist, setPlaylist] = useState<YouTubeVideoResult[]>([]);
	const [playlistIndex, setPlaylistIndex] = useState(-1);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const seekIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const playerRef = useRef<any>(null);
	const playerContainerRef = useRef<HTMLDivElement>(null);
	const apiLoadedRef = useRef(false);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const [searchYoutube, { data, loading, error }] = useLazyQuery<{ youtubeSearch: YouTubeVideoResult[] }>(YOUTUBE_SEARCH, {
		fetchPolicy: 'no-cache',
	});

	const searchResults = data?.youtubeSearch || [];
	const hasSearched = !!data || !!error;

	// YouTube IFrame API yukleme
	useEffect(() => {
		if (apiLoadedRef.current) return;

		const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
		if (existingScript) {
			apiLoadedRef.current = true;
			return;
		}

		const tag = document.createElement('script');
		tag.src = 'https://www.youtube.com/iframe_api';
		document.head.appendChild(tag);
		apiLoadedRef.current = true;
	}, []);

	// localStorage'dan son videoyu yukle
	useEffect(() => {
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved) {
				const parsed = JSON.parse(saved);
				if (parsed?.videoId && parsed?.title) {
					setCurrentVideo(parsed);
				}
			}
		} catch {
			// Bozuk veri — yoksay
		}
	}, []);

	// Player olustur veya video degistir
	useEffect(() => {
		if (!currentVideo || !playerContainerRef.current) return;

		const initPlayer = () => {
			if (!window.YT?.Player) return;

			if (playerRef.current) {
				playerRef.current.loadVideoById(currentVideo.videoId);
				return;
			}

			playerRef.current = new window.YT.Player(playerContainerRef.current, {
				height: '1',
				width: '1',
				videoId: currentVideo.videoId,
				playerVars: {
					autoplay: 1,
					controls: 0,
					disablekb: 1,
					fs: 0,
					modestbranding: 1,
					rel: 0,
				},
				events: {
					onReady: (event: any) => {
						event.target.playVideo();
						setIsPlaying(true);
					},
					onStateChange: (event: any) => {
						if (event.data === 1) {
							setIsPlaying(true);
						} else if (event.data === 2) {
							setIsPlaying(false);
						} else if (event.data === 0) {
							// Video bitti — sonraki sarki varsa cal
							handleNext();
						}
					},
				},
			});
		};

		if (window.YT?.Player) {
			initPlayer();
		} else {
			const prev = window.onYouTubeIframeAPIReady;
			window.onYouTubeIframeAPIReady = () => {
				if (prev) prev();
				initPlayer();
			};
		}
	}, [currentVideo?.videoId]);

	// Player zaman takibi (her 500ms)
	useEffect(() => {
		if (isPlaying && playerRef.current?.getCurrentTime) {
			seekIntervalRef.current = setInterval(() => {
				setCurrentTime(playerRef.current.getCurrentTime() || 0);
				setDuration(playerRef.current.getDuration?.() || 0);
			}, 500);
		} else if (seekIntervalRef.current) {
			clearInterval(seekIntervalRef.current);
			seekIntervalRef.current = null;
		}
		return () => {
			if (seekIntervalRef.current) {
				clearInterval(seekIntervalRef.current);
			}
		};
	}, [isPlaying]);

	// Debounced arama
	const handleSearchChange = useCallback((value: string) => {
		setSearchQuery(value);

		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
		}

		if (value.trim().length >= 2) {
			debounceRef.current = setTimeout(() => {
				searchYoutube({ variables: { input: { query: value.trim() } } });
			}, 500);
		}
	}, [searchYoutube]);

	// Cleanup
	useEffect(() => {
		return () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}
		};
	}, []);

	const handleSelectVideo = (video: YouTubeVideoResult, index?: number) => {
		const videoData = { videoId: video.videoId, title: video.title };
		setCurrentVideo(videoData);
		setSearchQuery('');

		// Arama sonuclarini playlist olarak kaydet
		if (searchResults.length > 0) {
			setPlaylist(searchResults);
			setPlaylistIndex(index !== undefined ? index : searchResults.findIndex(v => v.videoId === video.videoId));
		}

		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(videoData));
		} catch {
			// localStorage dolu — yoksay
		}
	};

	const handlePlayPause = () => {
		if (!playerRef.current) return;

		if (isPlaying) {
			playerRef.current.pauseVideo();
		} else {
			playerRef.current.playVideo();
		}
	};

	const handleStop = () => {
		if (playerRef.current) {
			playerRef.current.stopVideo();
		}
		setIsPlaying(false);
		setCurrentVideo(null);
		setPlaylist([]);
		setPlaylistIndex(-1);
		localStorage.removeItem(STORAGE_KEY);
	};

	const handleSeek = (value: number) => {
		if (!playerRef.current?.seekTo) return;
		playerRef.current.seekTo(value, true);
		setCurrentTime(value);
	};

	const handlePrev = () => {
		if (playlist.length === 0 || playlistIndex <= 0) return;
		const prevIndex = playlistIndex - 1;
		const prevVideo = playlist[prevIndex];
		setPlaylistIndex(prevIndex);
		setCurrentVideo({ videoId: prevVideo.videoId, title: prevVideo.title });
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify({ videoId: prevVideo.videoId, title: prevVideo.title }));
		} catch {}
	};

	const handleNext = () => {
		if (playlist.length === 0 || playlistIndex >= playlist.length - 1) {
			// Playlist bitti — tekrar bastan
			if (playlist.length > 0) {
				const first = playlist[0];
				setPlaylistIndex(0);
				setCurrentVideo({ videoId: first.videoId, title: first.title });
				try {
					localStorage.setItem(STORAGE_KEY, JSON.stringify({ videoId: first.videoId, title: first.title }));
				} catch {}
			}
			return;
		}
		const nextIndex = playlistIndex + 1;
		const nextVideo = playlist[nextIndex];
		setPlaylistIndex(nextIndex);
		setCurrentVideo({ videoId: nextVideo.videoId, title: nextVideo.title });
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify({ videoId: nextVideo.videoId, title: nextVideo.title }));
		} catch {}
	};

	const hasPrev = playlist.length > 0 && playlistIndex > 0;
	const hasNext = playlist.length > 0;

	const panelContent = (
		<div
			className={`fixed z-[110] transition-all duration-300 ${
				isOpen
					? 'opacity-100 translate-y-0 pointer-events-auto'
					: 'opacity-0 translate-y-4 pointer-events-none'
			} bottom-0 left-0 w-full md:bottom-4 md:right-4 md:left-auto md:w-80`}
		>
			<div className="bg-[#1a1b1f] border border-gray-800 md:rounded-lg shadow-xl overflow-hidden">
				{/* Header */}
				<div className="flex items-center justify-between px-3 py-2 border-b border-gray-800/50 bg-[#15161a]">
					<span className="text-sm font-semibold text-white/90">{t('rooms.music_player')}</span>
					<button
						onClick={onClose}
						className="p-1 text-white/60 hover:text-white transition-colors"
					>
						<X size={16} weight="bold" />
					</button>
				</div>

				{/* Arama */}
				<div className="px-3 py-2">
					<div className="relative">
						<MagnifyingGlass
							size={14}
							className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40"
						/>
						<input
							type="text"
							value={searchQuery}
							onChange={(e) => handleSearchChange(e.target.value)}
							placeholder={t('rooms.music_search_placeholder')}
							className="w-full bg-[#0f1014] border border-gray-800 rounded-md pl-8 pr-3 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50"
						/>
					</div>
				</div>

				{/* Sonuc listesi */}
				{(searchResults.length > 0 || loading || hasSearched) && (
					<div className="max-h-[200px] overflow-y-auto border-t border-gray-800/50">
						{loading ? (
							<div className="px-3 py-4 text-center text-white/40 text-xs">
								{t('rooms.music_searching') || 'Searching...'}
							</div>
						) : error ? (
							<div className="px-3 py-4 text-center text-red-400 text-xs">
								{error.message}
							</div>
						) : searchResults.length > 0 ? (
							searchResults.map((video, idx) => (
								<button
									key={video.videoId}
									onClick={() => handleSelectVideo(video, idx)}
									className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/5 transition-colors text-left"
								>
									<img
										src={video.thumbnail}
										alt=""
										className="w-10 h-10 rounded object-cover shrink-0 bg-gray-800"
									/>
									<div className="min-w-0 flex-1">
										<div className="text-xs text-white/90 truncate" title={decodeHtmlEntities(video.title)}>{decodeHtmlEntities(video.title)}</div>
										<div className="text-[10px] text-white/40 truncate">{video.channelTitle}</div>
									</div>
								</button>
							))
						) : searchQuery.trim().length >= 2 ? (
							<div className="px-3 py-4 text-center text-white/40 text-xs">
								{t('rooms.music_no_results')}
							</div>
						) : null}
					</div>
				)}

				{/* Now Playing */}
				{currentVideo && (
					<div className="px-3 py-2.5 border-t border-gray-800/50">
						<div className="text-[10px] text-white/40 mb-1">{t('rooms.music_now_playing')}</div>
						<div className="text-xs text-white/80 truncate mb-2" title={decodeHtmlEntities(currentVideo.title)}>{decodeHtmlEntities(currentVideo.title)}</div>

						{/* Seek slider */}
						{duration > 0 && (
							<div className="flex items-center gap-1.5 mb-2">
								<span className="text-[10px] text-white/40 w-8 text-right shrink-0">{formatTime(currentTime)}</span>
								<input
									type="range"
									min={0}
									max={Math.floor(duration)}
									value={Math.floor(currentTime)}
									onChange={(e) => handleSeek(Number(e.target.value))}
									className="flex-1 h-1 accent-blue-500 cursor-pointer"
								/>
								<span className="text-[10px] text-white/40 w-8 shrink-0">{formatTime(duration)}</span>
							</div>
						)}

						{/* Kontroller */}
						<div className="flex items-center justify-center gap-1.5">
							<button
								onClick={handlePrev}
								className={`p-1.5 rounded-full transition-colors ${hasPrev ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white/5 text-white/20 cursor-default'}`}
								disabled={!hasPrev}
							>
								<SkipBack size={14} weight="fill" />
							</button>
							<button
								onClick={handlePlayPause}
								className="p-2 rounded-full bg-white/15 hover:bg-white/25 transition-colors text-white"
							>
								{isPlaying ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" />}
							</button>
							<button
								onClick={handleNext}
								className={`p-1.5 rounded-full transition-colors ${hasNext ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white/5 text-white/20 cursor-default'}`}
								disabled={!hasNext}
							>
								<SkipForward size={14} weight="fill" />
							</button>
							<button
								onClick={handleStop}
								className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-red-400 ml-1"
							>
								<Stop size={14} weight="fill" />
							</button>
						</div>
					</div>
				)}
			</div>

			{/* Gizli YouTube iframe container */}
			<div
				ref={playerContainerRef}
				style={{ width: 0, height: 0, overflow: 'hidden', position: 'absolute', pointerEvents: 'none' }}
			/>
		</div>
	);

	return createPortal(panelContent, document.body);
}
