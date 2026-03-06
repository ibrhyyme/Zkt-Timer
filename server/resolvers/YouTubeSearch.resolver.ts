import { Resolver, Query, Arg, Ctx, Authorized } from 'type-graphql';
import { GraphQLContext } from '../@types/interfaces/server.interface';
import { YouTubeVideoResult, YouTubeSearchInput } from '../schemas/YouTubeSearch.schema';
import GraphQLError from '../util/graphql_error';
import { ErrorCode } from '../constants/errors';
import { Role } from '../middlewares/auth';
import axios from 'axios';

// Kullanici bazli basit rate limit (2 saniye aralik)
const lastSearchMap = new Map<string, number>();
const THROTTLE_MS = 2000;

// Bellek sizmesini onlemek icin eski kayitlari temizle (her 10 dakikada)
setInterval(() => {
	const now = Date.now();
	for (const [key, timestamp] of lastSearchMap) {
		if (now - timestamp > 60000) {
			lastSearchMap.delete(key);
		}
	}
}, 600000);

@Resolver()
export class YouTubeSearchResolver {
	@Authorized([Role.LOGGED_IN])
	@Query(() => [YouTubeVideoResult])
	async youtubeSearch(
		@Ctx() context: GraphQLContext,
		@Arg('input') input: YouTubeSearchInput
	): Promise<YouTubeVideoResult[]> {
		const userId = context.user.id;
		const query = input.query.trim();

		// Rate limit kontrolu
		const now = Date.now();
		const lastSearch = lastSearchMap.get(userId) || 0;
		if (now - lastSearch < THROTTLE_MS) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Too many requests. Please wait.');
		}
		lastSearchMap.set(userId, now);

		if (query.length < 2 || query.length > 100) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Query must be 2-100 characters');
		}

		const apiKey = process.env.YOUTUBE_API_KEY;
		if (!apiKey) {
			throw new GraphQLError(ErrorCode.INTERNAL_SERVER_ERROR, 'YouTube API not configured');
		}

		try {
			const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
				params: {
					part: 'snippet',
					type: 'video',
					videoCategoryId: '10',
					maxResults: 8,
					q: query,
					key: apiKey,
				},
			});

			return response.data.items.map((item: any) => ({
				videoId: item.id.videoId,
				title: item.snippet.title,
				channelTitle: item.snippet.channelTitle,
				thumbnail: item.snippet.thumbnails?.default?.url || '',
			}));
		} catch (error: any) {
			if (error.response?.status === 403) {
				throw new GraphQLError(ErrorCode.INTERNAL_SERVER_ERROR, 'YouTube API quota exceeded');
			}
			throw new GraphQLError(ErrorCode.INTERNAL_SERVER_ERROR, 'YouTube search failed');
		}
	}
}
