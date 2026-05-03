import React, {ReactNode, useEffect} from 'react';
import HeaderNav from '../header_nav/HeaderNav';
import './Wrapper.scss';
import {ToastContainer} from 'react-toastify';
import block, {blockNamespace} from '../../../styles/bem';
import {useGeneral} from '../../../util/hooks/useGeneral';
import {useSettings} from '../../../util/hooks/useSettings';
import {updateThemeColors} from '../themes';
import ScrollReset from '../scroll_reset/ScrollReset';

const b = block('body');

interface Props {
	noPadding?: boolean;
	hideTopNav?: boolean;
	children: ReactNode;
}

export default function Wrapper(props: Props) {
	const {hideTopNav, noPadding} = props;

	const appLoaded = useGeneral('app_loaded');
	const mobileMode = useGeneral('mobile_mode');
	const primaryColor = useSettings('primary_color');
	const secondaryColor = useSettings('secondary_color');
	const backgroundColor = useSettings('background_color');
	const moduleColor = useSettings('module_color');
	const buttonColor = useSettings('button_color');
	const textColor = useSettings('text_color');

	useEffect(() => {
		if (!appLoaded || typeof document === 'undefined') {
			return;
		}

		updateThemeColors();
	}, [appLoaded, buttonColor, primaryColor, secondaryColor, backgroundColor, moduleColor, textColor]);

	let headerNav = <HeaderNav />;
	if (hideTopNav) {
		headerNav = null;
	}

	return (
		<div className={blockNamespace}>
			<ToastContainer />
			<ScrollReset />
			{headerNav}
			<div
				className={b({
					mobile: mobileMode,
					noPadding,
				})}
			>
				<div className={b('content')}>
					{props.children}
				</div>
			</div>
		</div>
	);
}
