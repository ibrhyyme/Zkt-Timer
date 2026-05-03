import { ObjectType, Field } from 'type-graphql';

@ObjectType()
export class TranslatedText {
	@Field()
	en: string;

	@Field()
	es: string;

	@Field()
	ru: string;

	@Field()
	zh: string;
}

@ObjectType()
export class TranslateAnnouncementResult {
	@Field(() => TranslatedText)
	title: TranslatedText;

	@Field(() => TranslatedText)
	content: TranslatedText;
}
