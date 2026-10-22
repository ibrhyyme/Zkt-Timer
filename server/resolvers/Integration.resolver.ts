import {Arg, Authorized, Ctx, FieldResolver, Mutation, Query, Resolver, Root} from 'type-graphql';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {Role} from '../middlewares/auth';
import {Integration, IntegrationTypeSchema} from '../schemas/Integration.schema';
import GraphQLError from '../util/graphql_error';
import {ErrorCode} from '../constants/errors';
import {IntegrationType} from '../../shared/integration';
import {getIntegrationGetMe, linkOAuthAccount, revokeIntegration} from '../integrations/oauth';
import {isZktGrantWithdrawn} from '../integrations/zkt_oauth';
import {WcaAccount} from '../schemas/WcaAccount.schema';
import {getIntegration} from '../models/integration';
import {fetchAndSaveWcaRecords} from '../models/wca_record';

function getIntegrationsByUserId(context: GraphQLContext, userId: string) {
	const {prisma} = context;

	return prisma.integration.findMany({
		where: {
			user_id: userId,
		},
	});
}

function getIntegrationMe(context: GraphQLContext, intType: IntegrationType) {
	const {user} = context;
	return getIntegrationGetMe(intType, user);
}

function deleteIntegrationById(context: GraphQLContext, id: string) {
	const {prisma} = context;

	return prisma.integration.delete({
		where: {
			id,
		},
	});
}

/**
 * The member removed Zkt Timer on the federation: remove the link here too.
 * Kept only when it is their one way in (no password, no other login), the
 * same lockout rule deleteIntegration applies: the stored zkt_user_id is what
 * lets "ZKT ile giriş" find the account, and a new sign-in grants afresh.
 */
async function dropWithdrawnZktLink(context: GraphQLContext, integration: {id: string}) {
	const hasPassword = !!(context.user as any).password;
	const others = (await getIntegrationsByUserId(context, context.user.id)).filter((i) => i.id !== integration.id);
	if (!hasPassword && others.length === 0) return integration;
	await deleteIntegrationById(context, integration.id);
	return null;
}

@Resolver()
export class IntegrationResolver {
	@Authorized([Role.LOGGED_IN])
	@Query(() => Integration)
	async integration(
		@Ctx() context: GraphQLContext,
		@Arg('integrationType', () => IntegrationTypeSchema) integrationType: IntegrationType
	) {
		const integration = await getIntegration(context.user, integrationType);
		// A ZKT link can also be removed on the federation's side (Hesabım >
		// Bağlantılar). This query backs the linked-accounts page, so that is where
		// the timer finds out and drops its half of the link.
		if (integrationType === 'zkt' && integration && (await isZktGrantWithdrawn(integration))) {
			return dropWithdrawnZktLink(context, integration);
		}
		return integration;
	}

	@Authorized([Role.LOGGED_IN])
	@Query(() => WcaAccount)
	async wcaMe(@Ctx() context: GraphQLContext) {
		return getIntegrationMe(context, 'wca');
	}



	@Authorized([Role.LOGGED_IN])
	@Query(() => [Integration])
	async integrations(@Ctx() context: GraphQLContext) {
		return getIntegrationsByUserId(context, context.user.id);
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Integration)
	async createIntegration(
		@Ctx() context: GraphQLContext,
		@Arg('integrationType', () => IntegrationTypeSchema) integrationType: IntegrationType,
		@Arg('code') code: string
	) {
		const {user} = context;
		const integration = await getIntegration(user, integrationType);
		if (integration) {
			throw new GraphQLError(ErrorCode.FORBIDDEN, 'This account is already linked');
		}

		try {
			const result = await linkOAuthAccount(integrationType, user, code);
			console.log('Integration created successfully:', typeof result === 'object' ? result?.id : 'success');

			// WCA baglama sonrasi kayitlari otomatik cek + ranking hesapla
			if (integrationType === 'wca' && typeof result === 'object' && result?.wca_id) {
				fetchAndSaveWcaRecords(user, result).catch((err) => {
					console.error('[Rankings] Auto-fetch WCA records failed:', err?.message);
				});
			}

			return result;
		} catch (e) {
			// Never the error object itself: a failed provider call surfaces here as a raw
			// AxiosError whose `config` carries the Bearer access token (WCA / ZKT /me) or
			// the form body with client_secret and the auth code (WCA token exchange on a
			// network failure), and console.error would print all of it to the logs.
			console.error('createIntegration error:', integrationType, 'status=', e?.response?.status, ':', e?.message);
			throw new GraphQLError(ErrorCode.BAD_INPUT, e?.message || 'Failed to create integration');
		}
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Integration)
	async updateWcaVisibility(
		@Ctx() context: GraphQLContext,
		@Arg('showCompetitions', {nullable: true}) showCompetitions?: boolean,
		@Arg('showMedals', {nullable: true}) showMedals?: boolean,
		@Arg('showRecords', {nullable: true}) showRecords?: boolean,
		@Arg('showRank', {nullable: true}) showRank?: boolean,
		@Arg('showResults', {nullable: true}) showResults?: boolean
	) {
		const {user, prisma} = context;
		const integration = await getIntegration(user, 'wca');
		if (!integration) {
			throw new GraphQLError(ErrorCode.FORBIDDEN, 'WCA account is not linked');
		}

		const data: any = {};
		if (showCompetitions !== undefined) data.wca_show_competitions = showCompetitions;
		if (showMedals !== undefined) data.wca_show_medals = showMedals;
		if (showRecords !== undefined) data.wca_show_records = showRecords;
		if (showRank !== undefined) data.wca_show_rank = showRank;
		if (showResults !== undefined) data.wca_show_results = showResults;

		return prisma.integration.update({
			where: {id: integration.id},
			data,
		});
	}

	/**
	 * Which parts of the member's ZKT career their profile shows. Same shape as
	 * updateWcaVisibility; there is no ZKT "rank" switch because a world ranking
	 * is a WCA fact.
	 */
	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Integration)
	async updateZktVisibility(
		@Ctx() context: GraphQLContext,
		@Arg('showCompetitions', {nullable: true}) showCompetitions?: boolean,
		@Arg('showMedals', {nullable: true}) showMedals?: boolean,
		@Arg('showRecords', {nullable: true}) showRecords?: boolean,
		@Arg('showPbs', {nullable: true}) showPbs?: boolean
	) {
		const {user, prisma} = context;
		const integration = await getIntegration(user, 'zkt');
		if (!integration) {
			throw new GraphQLError(ErrorCode.FORBIDDEN, 'ZKT account is not linked');
		}

		const data: any = {};
		if (showCompetitions !== undefined) data.zkt_show_competitions = showCompetitions;
		if (showMedals !== undefined) data.zkt_show_medals = showMedals;
		if (showRecords !== undefined) data.zkt_show_records = showRecords;
		if (showPbs !== undefined) data.zkt_show_pbs = showPbs;

		return prisma.integration.update({
			where: {id: integration.id},
			data,
		});
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Integration)
	async deleteIntegration(
		@Ctx() context: GraphQLContext,
		@Arg('integrationType', () => IntegrationTypeSchema) integrationType: IntegrationType
	) {
		const {user} = context;
		const integration = await getIntegration(user, integrationType);
		if (!integration) {
			throw new GraphQLError(ErrorCode.FORBIDDEN, 'This account is not linked');
		}

		// Lockout guard: a user with no password must keep at least one OAuth login.
		// The client hides the unlink button in this case, but a direct mutation would bypass it.
		const hasPassword = !!(user as any).password;
		if (!hasPassword) {
			const allIntegrations = await getIntegrationsByUserId(context, user.id);
			const remaining = allIntegrations.filter((i) => i.id !== integration.id);
			if (remaining.length === 0) {
				throw new GraphQLError(ErrorCode.FORBIDDEN, 'Bu hesabin tek giris yontemini kaldiramazsiniz. Once bir sifre belirleyin.');
			}
		}

		// Best-effort: telling the provider is courtesy, removing the link is the
		// thing the member asked for. A provider that is down, or an access token
		// that already expired (the ZKT one lives an hour), must not leave them
		// stuck with a connection they cannot drop.
		try {
			await revokeIntegration(integrationType, user);
		} catch (err: any) {
			console.warn(`[Integration] remote revoke failed for ${integrationType}:`, err?.message);
		}
		return deleteIntegrationById(context, integration.id);
	}
}

/**
 * Whether a viewer may see one of an integration's WCA counts. The `wca_show_*` switches used
 * to apply only to `publicWcaProfile`; the same numbers were readable unmasked from every
 * public path that carries a user's integrations (profiles, rankings, shared solves). The owner
 * and admins see their real values, everyone else gets null where the owner switched it off.
 */
export function wcaCountVisible(
	integration: Pick<Integration, 'user_id' | 'wca_show_competitions' | 'wca_show_medals' | 'wca_show_records'>,
	viewer: {id?: string; admin?: boolean} | null | undefined,
	group: 'competitions' | 'medals' | 'records'
): boolean {
	if (viewer?.admin || (viewer?.id && viewer.id === integration?.user_id)) return true;
	const toggle = {
		competitions: integration?.wca_show_competitions,
		medals: integration?.wca_show_medals,
		records: integration?.wca_show_records,
	}[group];
	return toggle !== false;
}

@Resolver(() => Integration)
export class IntegrationVisibilityResolver {
	private gated(root: Integration, ctx: GraphQLContext, group: 'competitions' | 'medals' | 'records', key: keyof Integration) {
		return wcaCountVisible(root, ctx?.user, group) ? (root[key] as number) ?? null : null;
	}

	@FieldResolver(() => Number, {nullable: true})
	wca_competition_count(@Root() root: Integration, @Ctx() ctx: GraphQLContext) {
		return this.gated(root, ctx, 'competitions', 'wca_competition_count');
	}

	@FieldResolver(() => Number, {nullable: true})
	wca_medal_gold(@Root() root: Integration, @Ctx() ctx: GraphQLContext) {
		return this.gated(root, ctx, 'medals', 'wca_medal_gold');
	}

	@FieldResolver(() => Number, {nullable: true})
	wca_medal_silver(@Root() root: Integration, @Ctx() ctx: GraphQLContext) {
		return this.gated(root, ctx, 'medals', 'wca_medal_silver');
	}

	@FieldResolver(() => Number, {nullable: true})
	wca_medal_bronze(@Root() root: Integration, @Ctx() ctx: GraphQLContext) {
		return this.gated(root, ctx, 'medals', 'wca_medal_bronze');
	}

	@FieldResolver(() => Number, {nullable: true})
	wca_record_nr(@Root() root: Integration, @Ctx() ctx: GraphQLContext) {
		return this.gated(root, ctx, 'records', 'wca_record_nr');
	}

	@FieldResolver(() => Number, {nullable: true})
	wca_record_cr(@Root() root: Integration, @Ctx() ctx: GraphQLContext) {
		return this.gated(root, ctx, 'records', 'wca_record_cr');
	}

	@FieldResolver(() => Number, {nullable: true})
	wca_record_wr(@Root() root: Integration, @Ctx() ctx: GraphQLContext) {
		return this.gated(root, ctx, 'records', 'wca_record_wr');
	}
}
