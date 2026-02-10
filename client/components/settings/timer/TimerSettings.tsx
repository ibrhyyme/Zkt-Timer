import React, { useState } from 'react';
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
import Switch from '../../common/switch/Switch';
import Input from '../../common/inputs/input/Input';
import ModalHeader from '../../common/modal/modal_header/ModalHeader';
import Checkbox from '../../common/checkbox/Checkbox';
import { useIsMobile } from '../../../util/hooks/useIsMobile';

export const TIMER_INPUT_TYPE_NAMES = {
	keyboard: 'Klavye',
	stackmat: 'StackMat',
	smart: 'Akıllı Küp',
	gantimer: 'GAN Akıllı Timer',
};

// Uyarı modalı componenti
function AutoInspectionWarningModal({ onComplete }: { onComplete?: () => void }) {
	const [dontShowAgain, setDontShowAgain] = useState(false);

	function handleClose() {
		if (dontShowAgain) {
			setSetting('stackmat_auto_inspection_warning_shown', true);
		}
		if (onComplete) {
			onComplete();
		}
	}

	return (
		<div style={{ maxWidth: '500px' }}>
			<ModalHeader
				title="StackMat Otomatik İnceleme Uyarısı"
				description="Bu özellik hakkında bilmeniz gereken önemli bir bilgi var."
			/>
			<div style={{ marginBottom: '16px', lineHeight: '1.6' }}>
				<p style={{ marginBottom: '12px' }}>
					<strong>Bu özellik nasıl çalışır:</strong>
				</p>
				<ul style={{ paddingLeft: '20px', marginBottom: '12px' }}>
					<li>Çözümünüzü tamamladıktan sonra mat'ta reset tuşuna basın</li>
					<li>Belirlediğiniz süre (varsayılan 2 saniye) sonra inceleme otomatik başlar</li>
					<li>Eğer bu süre içinde timer'ı başlatırsanız, inceleme iptal olur</li>
				</ul>
				<p style={{ marginBottom: '12px', padding: '10px', backgroundColor: 'rgba(255,150,0,0.15)', borderRadius: '8px', border: '1px solid rgba(255,150,0,0.3)' }}>
					<strong>⚠️ Önemli Sınırlama:</strong> ESC tuşu ile incelemeyi iptal ederseniz, mat'tan yeni bir sinyal gelmediği için tekrar reset'e bassanız bile inceleme başlamaz. Bu durumda klavyeden (Space) inceleme başlatmanız gerekir veya yeni bir çözüm yapmanız gerekir.
				</p>
				<p style={{ marginTop: '12px', fontWeight: 'bold' }}>
					Bu sınırlama StackMat protokolünden kaynaklanmaktadır ve yazılımsal olarak çözümü yoktur.
				</p>
				<p style={{ marginTop: '12px', padding: '10px', backgroundColor: 'rgba(255,0,0,0.1)', color: '#d32f2f', borderRadius: '8px', border: '1px solid rgba(255,0,0,0.3)', fontWeight: 'bold' }}>
					⚠️ KRİTİK UYARI: Lütfen StackMat üzerinde çözüm bittikten sonra süre tam duruncaya kadar RESETLEMEYİN. Bu durum StackMat sinyalinin yanlış senkronize olmasına sebep olabilir ve inceleme süresinde bazı hatalara sebebiyet verebilir. Elimizde olmayan bu protokol hatalarından ötürü özür dileriz.
				</p>
			</div>
			<div style={{ marginBottom: '16px' }}>
				<Checkbox
					checked={dontShowAgain}
					onChange={() => setDontShowAgain(!dontShowAgain)}
					text="Bir daha gösterme"
				/>
			</div>
			<Button
				text="Anladım"
				primary
				large
				onClick={handleClose}
			/>
		</div>
	);
}

export default function TimerSettings() {
	const dispatch = useDispatch();

	const timerDecimalPoints = useSettings('timer_decimal_points');
	const inspection = useSettings('inspection');
	const stackMatId = useSettings('stackmat_id');
	const timerType = useSettings('timer_type');
	const stackMatAutoInspection = useSettings('stackmat_auto_inspection');
	const stackMatAutoInspectionWarningShown = useSettings('stackmat_auto_inspection_warning_shown');
	const [autoInspectionDelay, setAutoInspectionDelay] = useState(String(stackMatAutoInspection || 2));
	const isMobile = useIsMobile();

	function updateSetting(name: keyof AllSettings, value: any) {
		setSetting(name, value);
	}

	function handleAutoInspectionToggle(on: boolean) {
		if (on) {
			const delay = parseInt(autoInspectionDelay) || 2;
			setSetting('stackmat_auto_inspection', delay);

			// Uyarı gösterilmediyse göster
			if (!stackMatAutoInspectionWarningShown) {
				dispatch(openModal(<AutoInspectionWarningModal />));
			}
		} else {
			setSetting('stackmat_auto_inspection', 0);
		}
	}

	function toggleCubeTypes() {
		dispatch(
			openModal(<CubeTypes />, {
				title: 'Küp Türlerini Yönet',
				description:
					"Varsayılan olarak listelenmemiş özel etkinlikler için özel karıştırma türleri kullanabilirsiniz. Örneğin 8x8 veya Examinx Ya da aklına ne geliyorsa",
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
					openLeft={isMobile}
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
					openLeft={isMobile}
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
				title="Son çözümü silmek için onay gereksin"
				description="Bir çözümü silmeden önce onay kutusu göster"
				settingName="confirm_delete_solve"
				isSwitch
			/>
			<SettingRow
				title="Sezonu silmek için onay gereksin"
				description="Seçili sezondaki tüm çözümleri silmeden önce onay kutusu göster"
				settingName="confirm_delete_season"
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
				<SettingRow
					sub
					title="Otomatik İnceleme Başlat"
					description="Mat sıfırlandıktan sonra otomatik olarak inceleme süresini başlatır."
				>
					<div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
						<Switch
							on={stackMatAutoInspection > 0}
							onChange={handleAutoInspectionToggle}
						/>
						{stackMatAutoInspection > 0 && (
							<>
								<Input
									type="number"
									value={autoInspectionDelay}
									name="auto_inspection_delay"
									onChange={(e) => setAutoInspectionDelay(e.target.value)}
									style={{ width: '60px' }}
								/>
								<Button
									text="Kaydet"
									gray
									onClick={() => {
										const delay = parseInt(autoInspectionDelay) || 2;
										setSetting('stackmat_auto_inspection', delay);
									}}
								/>
								<span style={{ fontSize: '12px', color: '#888' }}>saniye</span>
							</>
						)}
					</div>
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
