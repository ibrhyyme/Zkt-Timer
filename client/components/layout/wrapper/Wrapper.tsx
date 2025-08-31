import React, {ReactNode, useEffect} from 'react';
import HeaderNav from '../header_nav/HeaderNav';
import {NAV_LINKS} from '../nav/Nav';
import './Wrapper.scss';
import {ToastContainer} from 'react-toastify';
import block, {blockNamespace} from '../../../styles/bem';
import {useGeneral} from '../../../util/hooks/useGeneral';
import {useSettings} from '../../../util/hooks/useSettings';
import {updateThemeColors} from '../themes';
import {useMe} from '../../../util/hooks/useMe';
import DemoWarning from './DemoWarning';
import {useRouteMatch} from 'react-router-dom';
import DemoRestricted from './DemoRestricted';
import ScrollReset from '../scroll_reset/ScrollReset';

const b = block('body');

interface Props {
	noPadding?: boolean;
	hideTopNav?: boolean;
	children: ReactNode;
}

export default function Wrapper(props: Props) {
	const {hideTopNav, noPadding} = props;

	const me = useMe();
	const match = useRouteMatch();

	const appLoaded = useGeneral('app_loaded');
	const focusMode = useSettings('focus_mode');
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

	function isPageAuthBlocked() {
		if (me) {
			return false;
		}

		for (const navLink of NAV_LINKS) {
			if (navLink.loginRequired && match.path.match(navLink.match)) {
				return true;
			}
		}

		return false;
	}

	let body = props.children;
	if (isPageAuthBlocked()) {
		body = <DemoRestricted />;
	}

	return (
		<div className={blockNamespace}>
			<ToastContainer />
			<ScrollReset />
			{headerNav}
			<div
				className={b({
					full: focusMode,
					mobile: mobileMode,
					noPadding,
				})}
			>
				<div className={b('content')}>
					<DemoWarning />
					{body}
				</div>
			</div>
		</div>
	);
}
