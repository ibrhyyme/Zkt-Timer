import {Resolver, Query, Mutation, Arg, Ctx, Authorized} from 'type-graphql';
import {SiteConfig, UpdateSiteConfigInput} from '../schemas/SiteConfig.schema';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {Role} from '../middlewares/auth';
import {getSiteConfig, updateSiteConfig} from '../models/site_config';

@Resolver()
export class SiteConfigResolver {
	// Public — login bile gerekmez. Tum client'lar her sayfada cagrir.
	@Query(() => SiteConfig)
	async siteConfig(): Promise<SiteConfig> {
		const config = await getSiteConfig();
		return config as SiteConfig;
	}

	// Sadece admin
	@Authorized([Role.ADMIN])
	@Mutation(() => SiteConfig)
	async updateSiteConfig(
		@Arg('input') input: UpdateSiteConfigInput,
		@Ctx() ctx: GraphQLContext
	): Promise<SiteConfig> {
		const updated = await updateSiteConfig(input, ctx.user?.id);
		return updated as SiteConfig;
	}
}
