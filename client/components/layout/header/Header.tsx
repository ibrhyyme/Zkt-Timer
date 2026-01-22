import React, { ReactNode } from 'react';
import Helmet from 'react-helmet';
import { resourceUri } from '../../../util/storage';
// process.env variables are defined by esbuild, no need to import process

interface Props {
	path: string;
	title?: string;
	description?: string;
	featuredImage?: string;
	children?: ReactNode;
}

const DEFAULT_TITLE = 'Zkt-Timer | Profesyonel Zeka Küpü Timer';
const DEFAULT_DESCRIPTION =
	"Türkiye'nin en gelişmiş zeka küpü timer sitesi! Canlı mücadele odalarında yarış, Türkiye rekorlarını takip et ve algoritma öğreticisi ile yeni teknikler öğren. %100 Türkçe.";
const DEFAULT_FEATURED_IMAGE = resourceUri('/public/images/zkt-logo.png');

export default function Header(props: Props) {
	const url = process.env.BASE_URI + props.path;
	const description = props.description || DEFAULT_DESCRIPTION;
	const title = props.title || DEFAULT_TITLE;
	const secureImage = props.featuredImage || DEFAULT_FEATURED_IMAGE;

	return (
		<Helmet>
			<title>{title}</title>
			<link rel="canonical" href={process.env.BASE_URI + props.path} />
			<link rel="icon" type="image/png" href="/public/images/zkt-logo.png" />
			<meta name="description" content={description} />
			<meta name="twitter:title" content={title} />
			<meta name="twitter:description" content={description} />
			<meta name="twitter:url" content={url} />
			<meta name="twitter:image" content={secureImage} />
			<meta property="og:title" content={title} />
			<meta property="og:description" content={description} />
			<meta property="og:url" content={url} />
			<meta property="og:image" content={secureImage} />
			<meta property="og:image:secure_url" content={secureImage} />
			{props.children}
		</Helmet>
	);
}
