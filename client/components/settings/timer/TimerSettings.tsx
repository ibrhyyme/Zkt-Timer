import React from 'react';
import MicAccess from '../mic_access/MicAccess';
import StackMatPicker from '../stackmat_picker/StackMatPicker';
import { openModal } from '../../../actions/general';
import CubeTypes from '../cube_types/CubeTypes';
import SettingRow from '../setting/row/SettingRow';
import Dropdown from '../../common/inputs/dropdown/Dropdown';
import { useDispatch } from 'react-redux';
import SettingSection from '../setting/section/SettingSection';
import Button, { CommonType } from '../../common/button/Button';
import { setSetting } from '../../../db/settings/update';
import { useSettings } from '../../../util/hooks/useSettings';
import { AllSettings } from '../../../db/settings/query';

export const TIMER_INPUT_TYPE_NAMES = {
	keyboard: 'Klavye',
	stackmat: 'StackMat',
	smart: 'Akıllı Küp',
	gantimer: 'GAN Akıllı Timer',
};

export default function TimerSettings() {
	const dispatch = useDispatch();

	const timerDecimalPoints = useSettings('timer_decimal_points');
	const inspection = useSettings('inspection');
	const stackMatId = useSettings('stackmat_id');
	const timerType = useSettings('timer_type');

	function updateSetting(name: keyof AllSettings, value: any) {
		setSetting(name, value);
	}

	function toggleCubeTypes() {
		dispatch(
			openModal(<CubeTypes />, {
				title: 'Küp Türlerini Yönet',
				description:
					"Varsayılan olarak listelenmemiş özel etkinlikler için özel karıştırma türleri kullanabilirsiniz. Örneğin 8x8 veya Examinx.",
			})
		);
	}

	function openStackMatPicker() {
		dispatch(openModal(<StackMatPicker />));
	}

	function getTimerTypeName(tt: string) {
		return TIMER_INPUT_TYPE_NAMES[tt];
	}

	let inspectionBody = null;
	if (inspection) {
		inspectionBody = (
			<>
				<SettingRow title="İnceleme süresi (sn)" settingName="inspection_delay" isNumberInput />
				<SettingRow
					title="Ses çal"
					description="8 ve 12 saniye geçtiğinde sesli uyarı ver"
					settingName="play_inspection_sound"
					isSwitch
				/>
				<SettingRow
					title="İnceleme otomatik başlat"
					description="İnceleme süresi bittiğinde otomatik başlat"
					settingName="inspection_auto_start"
					isSwitch
				/>
			</>
		);
	}

	return (
		<>
			<SettingRow title="Timer ondalık basamakları" description="Timer sayfasında kaç ondalık basamak gösterileceği">
				<Dropdown
					icon={null}
					text={`${timerDecimalPoints} ondalık basamak`}
					options={[0, 1, 2, 3].map((c) => ({
						text: String(c),
						onClick: () => updateSetting('timer_decimal_points', c),
					}))}
				/>
			</SettingRow>
			<SettingRow
				title="Timer giriş türü"
				description="Timeryı başlatmak için klavyeniz (boşluk tuşu), StackMat veya Akıllı Küp kullanımı arasında seçim yapın."
			>
				<Dropdown
					icon={null}
					text={getTimerTypeName(timerType)}
					options={['keyboard', 'stackmat', 'smart', 'gantimer'].map((c) => ({
						text: getTimerTypeName(c),
						onClick: () => updateSetting('timer_type', c),
					}))}
				/>
			</SettingRow>
			<SettingRow
				title="Dondurma süresi (sn)"
				description="Timer başlamadan önce boşluk tuşunu kaç saniye basılı tutacağınız."
				settingName="freeze_time"
				isNumberInput
				step={0.1}
			/>
			<SettingRow loggedInOnly title="Küp Türleri" description="Karıştırmalı veya karıştırmasız özel küp türleri ekleyin">
				<Button theme={CommonType.GRAY} text="Küp Türlerini Yönet" onClick={toggleCubeTypes} />
			</SettingRow>
			<SettingRow
				title="Akıllı küplerle boşluk tuşu kullan"
				description="Akıllı küp hareketleriyle çözümün ne süre başladığını/bittiğini algılamak yerine, normal küpler gibi boşluk tuşunu kullanın."
				settingName="use_space_with_smart_cube"
				isSwitch
			/>
			<SettingRow title="Çözerken süreyi gizle" settingName="hide_time_when_solving" isSwitch />
			<SettingRow
				title="Çözümden sonra süreyi sıfırla"
				description="Son çözümünüzün süresini göstermek yerine, timer çözümden sonra 0.00 olarak güncellenir."
				settingName="zero_out_time_after_solve"
				isSwitch
			/>
			<SettingRow
				title="Manuel girişte nokta gerektir"
				description="Manuel olarak girdiğiniz sürelerin otomatik olarak 100'e bölünmesini istiyorsanız bunu kapatın"
				settingName="require_period_in_manual_time_entry"
				isSwitch
			/>
			<SettingRow
				title="Çözüm silmeyi onayla"
				description="Bir çözümü silmeden önce onay kutusu alın"
				settingName="confirm_delete_solve"
				isSwitch
			/>
			<SettingRow
				title="Kişisel rekor konfetisi"
				description="Kişisel rekor kırdığınızda konfeti göster"
				settingName="pb_confetti"
				isSwitch
			/>
			<SettingSection>
				<SettingRow
					parent
					title="İnceleme"
					description="İnceleme süresini sınırla. Yarışmalara hazırlanmak için iyidir."
					settingName="inspection"
					isSwitch
				/>
				{inspectionBody}
			</SettingSection>
			<SettingSection>
				<SettingRow
					parent
					title="StackMat Seçenekleri"
					description="Bu seçenekler Timer giriş türünüz StackMat olarak ayarlandığında kullanılacaktır"
				/>
				<SettingRow sub title="Mikrofona erişime izin ver (StackMat'ın veri iletim yöntemi)">
					<MicAccess />
				</SettingRow>
				<SettingRow sub title={`StackMat cihazınızı seçin. Genellikle "USB Audio Device" olarak adlandırılır`}>
					<Button
						gray
						primary={!stackMatId}
						text={stackMatId ? `Seçildi - Giriş Cihazını Değiştir` : 'StackMat Seç'}
						onClick={openStackMatPicker}
					/>
				</SettingRow>
			</SettingSection>
			<SettingRow
				title="Beta test kullanıcısı"
				description="Hâlâ beta aşamasındaki özellikleri açın. UYARI: Bu verilerinizle sorun yaratabilir. Bunu sadece bazı şeylerin bozulmasıyla sorun yaşamayacaksanız açın."
				settingName="beta_tester"
				isSwitch
			/>
		</>
	);
}
