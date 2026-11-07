import React, { useEffect, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { useTranslation, Trans } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { openProOnlyModal } from '../../common/pro_only/openProOnlyModal';
import { CaretDown, CaretUp, DeviceMobileSpeaker, Power, Snowflake, Sun, Thermometer } from 'phosphor-react';
import { climateAt, climateLevel, FriendlyRoomClimateState } from '../../../../shared/friendly_room/climate';
import { FriendlyRoomParticipantData } from '../../../../shared/friendly_room';
import ProTag from '../../common/pro_tag/ProTag';
import Button from '../../common/button/Button';
import Switch from '../../common/switch/Switch';
import { setSetting } from '../../../db/settings/update';
import { useSettings } from '../../../util/hooks/useSettings';
import block from '../../../styles/bem';
import { CLIMATE_LEVEL_KEYS, complaintCounts, formatTemp, nameForms } from './climate_text';
import { RoomClimate } from './useRoomClimate';
import './RoomClimateControl.scss';

const b = block('room-climate');

/** The temperature, re-read twice a second. Only this subtree re-renders for it. */
export function useClimateTemp(state: FriendlyRoomClimateState | null, serverNow: () => number): number {
    const [temp, setTemp] = useState(() => (state ? climateAt(state, serverNow()).temp : 24));
    useEffect(() => {
        if (!state) return;
        const read = () => setTemp(climateAt(state, serverNow()).temp);
        read();
        const id = setInterval(read, 500);
        return () => clearInterval(id);
    }, [state, serverNow]);
    return temp;
}

interface Props {
    climate: RoomClimate;
    participants: FriendlyRoomParticipantData[];
    // The wall unit needs room; on a phone header only the chip fits.
    showUnit: boolean;
}

export default function RoomClimateControl({ climate, participants, showUnit }: Props) {
    const { t, i18n } = useTranslation();
    const dispatch = useDispatch();
    const [open, setOpen] = useState(false);
    const { state, serverNow } = climate;
    // Same gold upsell as the room's music button; the remote closes first.
    const goPro = () => {
        setOpen(false);
        openProOnlyModal(dispatch, t, 'room_climate');
    };
    const temp = useClimateTemp(state, serverNow);
    const level = climateLevel(temp);
    const effectsOn = useSettings('room_climate_effects') !== false;

    if (!state) return null;

    return (
        <div className={b()}>
            {showUnit && (
                <span className={b('unit', { on: state.ac_on })} aria-hidden="true" data-climate-source>
                    <span className={b('brand')}>ZKT</span>
                    <span className={b('led')} />
                    <span className={b('slot')} />
                    <span className={b('flap')} />
                </span>
            )}
            <Popover.Root open={open} onOpenChange={setOpen}>
                <Popover.Trigger asChild>
                    <button
                        type="button"
                        className={b('chip', { level: effectsOn ? level : 'normal', holder: climate.iHold })}
                        title={t('rooms.climate.chip_title')}
                        data-climate-source={showUnit ? undefined : ''}
                        aria-label={`${t('rooms.climate.chip_title')}: ${formatTemp(temp, i18n.language)}`}
                    >
                        {climate.iHold ? <DeviceMobileSpeaker weight="fill" /> : <Thermometer weight="bold" />}
                        <span className={b('temp')}>{formatTemp(temp, i18n.language)}</span>
                        <span className={b('label')}>{t(CLIMATE_LEVEL_KEYS[level])}</span>
                    </button>
                </Popover.Trigger>
                <Popover.Portal>
                    <Popover.Content className={b('panel')} align="center" sideOffset={6} collisionPadding={16}>
                        <RoomClimateRemote climate={climate} participants={participants} temp={temp} onGoPro={goPro} />
                    </Popover.Content>
                </Popover.Portal>
            </Popover.Root>
        </div>
    );
}

interface RemoteProps {
    climate: RoomClimate;
    participants: FriendlyRoomParticipantData[];
    temp: number;
    onGoPro: () => void;
}

function RoomClimateRemote({ climate, participants, temp, onGoPro }: RemoteProps) {
    const { t, i18n } = useTranslation();
    const effectsOn = useSettings('room_climate_effects') !== false;
    const soundOn = useSettings('room_climate_sound') !== false;
    const { state, iHold, iAmPro, anyPro } = climate;
    if (!state) return null;

    const lang = i18n.language;
    const holderName = participants.find((p) => p.user_id === state.holder_id)?.username ?? null;
    const cooling = state.setpoint < temp;
    const complaints = complaintCounts(climate.reactions, Date.now());
    const complaintParts: string[] = [];
    if (complaints.cold) complaintParts.push(t('rooms.climate.complaints_cold', { count: complaints.cold }));
    if (complaints.hot) complaintParts.push(t('rooms.climate.complaints_hot', { count: complaints.hot }));

    let lockText = t('rooms.climate.basic_locked');
    if (climate.basicWinRecent) lockText = t('rooms.climate.basic_won');
    else if (!anyPro) lockText = t('rooms.climate.no_pro');

    return (
        <div className={b('remote')}>
            <div className={b('remote-top')}>
                <span className={b('eyebrow')}>{t('rooms.climate.remote_title')}</span>
                <ProTag />
            </div>

            <div className={b('lcd')}>
                <div className={b('set', { off: !state.ac_on })}>{state.ac_on ? `${state.setpoint}°` : '--°'}</div>
                <div className={b('mode')}>
                    {state.ac_on && (cooling ? <Snowflake weight="bold" className={b('mode-icon', { cool: true })} /> : <Sun weight="bold" className={b('mode-icon', { heat: true })} />)}
                    <span>{state.ac_on ? t(cooling ? 'rooms.climate.mode_cool' : 'rooms.climate.mode_heat') : t('rooms.climate.mode_off')}</span>
                    <span className={b('fan')} aria-label={t('rooms.climate.key_fan')}>
                        {[1, 2, 3].map((n) => (
                            <i key={n} className={b('fan-bar', { on: state.ac_on && n <= state.fan, n: String(n) })} />
                        ))}
                    </span>
                </div>
                <div className={b('lcd-row')}>
                    <span>{t('rooms.climate.room_now')}</span>
                    <b>{formatTemp(temp, lang)}</b>
                </div>
                <div className={b('lcd-row')}>
                    <span>{t('rooms.climate.complaints')}</span>
                    <b>{complaintParts.length ? complaintParts.join(' · ') : t('rooms.climate.complaints_none')}</b>
                </div>
            </div>

            <div className={b('keys')}>
                <button type="button" className={b('key', { power: true, on: state.ac_on })} disabled={!iHold} aria-label={t('rooms.climate.key_power')} onClick={() => climate.press('power')}>
                    <Power weight="bold" />
                </button>
                <button type="button" className={b('key')} disabled={!iHold} aria-label={t('rooms.climate.key_down')} onClick={() => climate.press('down')}>
                    <CaretDown weight="bold" />
                </button>
                <button type="button" className={b('key')} disabled={!iHold} aria-label={t('rooms.climate.key_up')} onClick={() => climate.press('up')}>
                    <CaretUp weight="bold" />
                </button>
                <button type="button" className={b('key', { text: true })} disabled={!iHold} aria-label={t('rooms.climate.key_fan')} onClick={() => climate.press('fan')}>
                    {t('rooms.climate.fan')}
                </button>
            </div>

            <div className={b('meta')}>
                <span>
                    {t('rooms.climate.holder_label')}:{' '}
                    <b>{iHold ? t('rooms.climate.holder_you') : holderName ?? t('rooms.climate.holder_nobody')}</b>
                </span>
                <span>
                    {t('rooms.climate.swaps')}: <b className={b('mono')}>{state.swaps}</b>
                </span>
            </div>

            {iAmPro && !iHold && (
                <div className={b('section')}>
                    <p className={b('text')}>
                        {holderName ? (
                            <Trans
                                i18nKey="rooms.climate.wait_holder"
                                values={nameForms('holder', holderName, lang)}
                                components={{ b: <b className={b('gold')} /> }}
                            />
                        ) : (
                            t('rooms.climate.wait_empty')
                        )}
                    </p>
                </div>
            )}

            {!iAmPro && (
                <div className={b('section')}>
                    <p className={b('text')}>{lockText}</p>
                    {anyPro && (
                        <div className={b('reactions')}>
                            <button type="button" className={b('react')} disabled={climate.reactCoolingDown} onClick={() => climate.react('cold')}>
                                {t('rooms.climate.react_cold')}
                            </button>
                            <button type="button" className={b('react')} disabled={climate.reactCoolingDown} onClick={() => climate.react('hot')}>
                                {t('rooms.climate.react_hot')}
                            </button>
                        </div>
                    )}
                    <Button primary fullWidth noMargin text={t('rooms.climate.go_pro')} onClick={onGoPro} />
                </div>
            )}

            <div className={b('settings')}>
                <label className={b('setting')}>
                    <span>{t('rooms.climate.effects')}</span>
                    <Switch small on={effectsOn} onChange={(v) => setSetting('room_climate_effects', v)} />
                </label>
                <label className={b('setting')}>
                    <span>{t('rooms.climate.sound')}</span>
                    <Switch small on={soundOn} onChange={(v) => setSetting('room_climate_sound', v)} />
                </label>
            </div>
        </div>
    );
}
