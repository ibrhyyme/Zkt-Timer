import React from 'react';
import { getTimeString } from '../../../util/time';
import Slider from '../../common/slider/Slider';
import LayoutSelector from './layout_selector/LayoutSelector';
import TimerBackground from './timer_background/TimerBackground';
import SettingRow from '../setting/row/SettingRow';
import Dropdown from '../../common/inputs/dropdown/Dropdown';
import SettingSection from '../setting/section/SettingSection';
import { setSetting } from '../../../db/settings/update';
import { useSettings } from '../../../util/hooks/useSettings';
import Button from '../../common/button/Button';
import ThemeOptions from './theme_options/ThemeOptions';
import { AllSettings, getDefaultSetting } from '../../../db/settings/query';
import { CaretDown } from 'phosphor-react';
import { useIsMobile } from '../../../util/hooks/useIsMobile';
import { useGeneral } from '../../../util/hooks/useGeneral';

const DEFAULT_FONT_FAMILY = 'Roboto Mono';

const FONT_FAMILIES = [
	DEFAULT_FONT_FAMILY,
	'Fira Sans',
	'Fira Mono',
	'Kiwi Maru',
	'JetBrains Mono',
	'Poppins',
	'Montserrat',
	'Space Mono',
	'Arial',
	'monospace',
];

export default function Appearance() {
	const timerTimeSize = useSettings('timer_time_size');
	const timerScrambleSize = useSettings('timer_scramble_size');
	const timerDecimalPoints = useSettings('timer_decimal_points');
	const timerFontFamily = useSettings('timer_font_family');
	const timerModuleCount = useSettings('timer_module_count');
	const smartCubeSize = useSettings('smart_cube_size');
	const isMobile = useIsMobile();
	const mobileMode = useGeneral('mobile_mode');

	function updateSetting(name: keyof AllSettings, value: any) {
		setSetting(name, value);
	}

	return (
		<>
			<ThemeOptions />
			{!mobileMode && (
				<SettingRow
					title="Timer modülleri"
					description="Timer sayfasında gösterilen modül sayısını değiştirin. Bunun gösterilen *maksimum* modül sayısı olduğunu unutmayın (pencere boyutunuza göre)."
				>
					<Dropdown
						openLeft={isMobile}
						text={String(timerModuleCount)}
						noMargin
						icon={<CaretDown />}
						options={[1, 2, 3, 4, 5, 6].map((count) => ({
							text: String(count) + (count === 3 ? ' (Varsayılan)' : ''),
							onClick: () => updateSetting('timer_module_count', count),
						}))}
					/>
				</SettingRow>
			)}
			{!mobileMode && (
				<SettingRow
					title="Timer düzeni"
					description="Timernızın görünümünü değiştirin. Daha küçük ekranınız varsa, modülleri sola veya sağa koymak isteyebilirsiniz."
				>
					<LayoutSelector />
				</SettingRow>
			)}
			<SettingRow title="Timer arka planı" description="Timernın arka plan rengini veya resmini değiştirin.">
				<TimerBackground />
			</SettingRow>
			<SettingRow title="Timer yazı tipi" description="Timer sayfasında gördüğünüz büyük Timernın yazı tipi">
				<Dropdown
					openLeft={isMobile}
					text={timerFontFamily}
					noMargin
					icon={<CaretDown />}
					options={FONT_FAMILIES.map((ff) => ({
						text: ff,
						onClick: () => updateSetting('timer_font_family', ff),
					}))}
				/>
				<Button
					hidden={timerFontFamily === DEFAULT_FONT_FAMILY}
					text="Sıfırla"
					warning
					flat
					onClick={() => updateSetting('timer_font_family', DEFAULT_FONT_FAMILY)}
				/>
			</SettingRow>
			{!mobileMode && (
				<SettingSection>
					<SettingRow title="Timer yazı boyutu" description="Timer sayfasında gördüğünüz büyük sürenin yazı boyutu">
						<Slider
							min={35}
							value={String(timerTimeSize)}
							max={150}
							onChange={(e) => updateSetting('timer_time_size', parseInt(e.target.value, 10))}
						/>
						<Button
							hidden={timerTimeSize === getDefaultSetting('timer_time_size')}
							text="Sıfırla"
							warning
							flat
							onClick={() => updateSetting('timer_time_size', getDefaultSetting('timer_time_size'))}
						/>
					</SettingRow>
					<div className="cd-settings__text-size">
						<h1
							style={{
								fontWeight: '500',
								fontFamily: timerFontFamily,
								fontSize: `${timerTimeSize}px`,
							}}
						>
							{getTimeString(23.074, timerDecimalPoints)}
						</h1>
					</div>
				</SettingSection>
			)}
			{!mobileMode && (
				<SettingSection>
					<SettingRow
						title="Karıştırma yazı boyutu"
						description="Timer sayfasında gördüğünüz karıştırmanın yazı boyutu"
					>
						<Slider
							min={10}
							value={String(timerScrambleSize)}
							max={40}
							onChange={(e) => updateSetting('timer_scramble_size', parseInt(e.target.value, 10))}
						/>
						<Button
							hidden={timerScrambleSize === getDefaultSetting('timer_scramble_size')}
							text="Sıfırla"
							warning
							flat
							onClick={() => updateSetting('timer_scramble_size', getDefaultSetting('timer_scramble_size'))}
						/>
					</SettingRow>
					<div className="cd-settings__text-size">
						<h3
							style={{
								fontSize: `${timerScrambleSize}px`,
							}}
						>
							D' R2 B2 R2 U' F2 R2 U' L2 U2 L2 R2 F' D' L D' F' D' F D' R' U
						</h3>
					</div>
				</SettingSection>
			)}
			{!mobileMode && (
				<SettingSection>
					<SettingRow
						title="Akıllı Küp Boyutu"
						description="Anasayfadaki akıllı küpün boyutunu ayarlayın."
					>
						<Slider
							min={100}
							value={String(smartCubeSize)}
							max={600}
							onChange={(e) => updateSetting('smart_cube_size', parseInt(e.target.value, 10))}
						/>
						<Button
							hidden={smartCubeSize === getDefaultSetting('smart_cube_size')}
							text="Sıfırla"
							warning
							flat
							onClick={() => updateSetting('smart_cube_size', getDefaultSetting('smart_cube_size'))}
						/>
					</SettingRow>
				</SettingSection>
			)}
		</>
	);
}
