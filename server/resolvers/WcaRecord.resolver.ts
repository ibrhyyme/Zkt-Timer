import {Resolver, Query, Mutation, Arg, Ctx, Authorized} from 'type-graphql';
import {WcaRecord} from '../schemas/WcaRecord.schema';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {
	fetchAndSaveWcaRecords,
	getWcaRecords,
	getPublishedWcaRecords,
	publishWcaRecord,
	unpublishWcaRecord
} from '../models/wca_record';
import {getIntegration} from '../models/integration';

@Resolver(() => WcaRecord)
export class WcaRecordResolver {
	
	/**
	 * Get WCA records for a specific user (public)
	 */
	@Query(() => [WcaRecord])
	async wcaRecords(@Arg('userId', {nullable: true}) userId?: string): Promise<WcaRecord[]> {
		if (!userId) {
			return [];
		}

		return getPublishedWcaRecords(userId);
	}

	/**
	 * Get current user's WCA records (including unpublished)
	 */
	@Authorized()
	@Query(() => [WcaRecord])
	async myWcaRecords(@Ctx() ctx: GraphQLContext): Promise<WcaRecord[]> {
		return getWcaRecords(ctx.user.id);
	}

	/**
	 * Fetch fresh WCA records from WCA API and save to database
	 */
	@Authorized()
	@Mutation(() => [WcaRecord])
	async fetchWcaRecords(@Ctx() ctx: GraphQLContext): Promise<WcaRecord[]> {
		// Get user's WCA integration
		const integration = await getIntegration(ctx.user, 'wca');
		
		if (!integration) {
			throw new Error('WCA hesabı bulunamadı. Lütfen önce WCA hesabınızı bağlayın..');
		}

		if (!integration.wca_id) {
			throw new Error('WCA hesabı bulunamadı. Lütfen önce WCA hesabınızı bağlayın..');
		}

		// Fetch and save records
		return fetchAndSaveWcaRecords(ctx.user, integration);
	}

	/**
	 * Publish a WCA record to profile
	 */
	@Authorized()
	@Mutation(() => WcaRecord)
	async publishWcaRecord(
		@Arg('recordId') recordId: string,
		@Ctx() ctx: GraphQLContext
	): Promise<WcaRecord> {
		return publishWcaRecord(recordId, ctx.user.id);
	}

	/**
	 * Unpublish a WCA record from profile
	 */
	@Authorized()
	@Mutation(() => WcaRecord)
	async unpublishWcaRecord(
		@Arg('recordId') recordId: string,
		@Ctx() ctx: GraphQLContext
	): Promise<WcaRecord> {
		return unpublishWcaRecord(recordId, ctx.user.id);
	}
}
