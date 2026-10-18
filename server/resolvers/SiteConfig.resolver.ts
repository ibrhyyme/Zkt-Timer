import {Resolver, Query, Mutation, Arg, Ctx, Authorized} from 'type-graphql';
import {SiteConfig, UpdateSiteConfigInput} from '../schemas/SiteConfig.schema';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {Role} from '../middlewares/auth';
import {getSiteConfig, siteConfigForViewer, updateSiteConfig} from '../models/site_config';

@Resolver()
export class SiteConfigResolver {
	// Public — login bile gerekmez. Tum client'lar her sayfada cagrir.
	// Access lists are filtered per viewer (siteConfigForViewer); SSR seeds the same view.
	@Query(() => SiteConfig)
	async siteConfig(@Ctx() ctx?: GraphQLContext): Promise<SiteConfig> {
		return siteConfigForViewer(await getSiteConfig(), ctx?.user) as SiteConfig;
	}

	// Sadece admin
	@Authorized([Role.ADMIN])
	@Mutation(() => SiteConfig)
	async updateSiteConfig(
		@Arg('input') input: UpdateSiteConfigInput,
		@Ctx() ctx: GraphQLContext
	): Promise<SiteConfig> {
		const {featureOverrides, ...rest} = input;

		const updates: any = {...rest};

		if (featureOverrides !== undefined) {
			const current = await getSiteConfig();
			const merged: Record<string, any> = {...current.feature_overrides};
			for (const entry of featureOverrides) {
				if (entry.mode === 'ALL') {
					delete merged[entry.feature];
				} else {
					merged[entry.feature] = {
						mode: entry.mode,
						users: entry.users ?? [],
					};
				}
			}
			updates.feature_overrides = merged;
		}

		const updated = await updateSiteConfig(updates, ctx.user?.id);
		return updated as SiteConfig;
	}
}
