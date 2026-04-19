import React, {useState} from 'react';
import './AdminZktCompetitions.scss';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../api';
import {useTranslation} from 'react-i18next';
import {toastSuccess, toastError} from '../../../util/toast';
import {IModalProps} from '../../common/modal/Modal';
import {b, ZKT_WCA_EVENTS} from './shared';
import {Trophy, CaretLeft, CaretRight, Check} from 'phosphor-react';
import SubSection from './SubSection';

const CREATE_MUTATION = gql`
	mutation CreateZktComp($input: CreateZktCompetitionInput!) {
		createZktCompetition(input: $input) {
			id
			name
		}
	}
`;

type Step = 1 | 2 | 3;

export default function CreateZktCompetitionModal(props: IModalProps) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});

	const [step, setStep] = useState<Step>(1);
	const [name, setName] = useState('');
	const [description, setDescription] = useState('');
	const [dateStart, setDateStart] = useState('');
	const [dateEnd, setDateEnd] = useState('');
	const [location, setLocation] = useState('');
	const [locationAddress, setLocationAddress] = useState('');
	const [competitorLimit, setCompetitorLimit] = useState('');
	const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
	const [championshipType, setChampionshipType] = useState<
		'NATIONAL' | 'REGIONAL' | 'CITY' | 'INVITATIONAL' | 'YOUTH' | ''
	>('');
	const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set(['333']));
	const [submitting, setSubmitting] = useState(false);

	function toggleEvent(eventId: string) {
		const next = new Set(selectedEvents);
		if (next.has(eventId)) {
			next.delete(eventId);
		} else {
			next.add(eventId);
		}
		setSelectedEvents(next);
	}

	// Validation per step
	const step1Valid = name.trim() && dateStart && dateEnd && location.trim();
	const step3Valid = selectedEvents.size > 0;

	function next() {
		if (step === 1 && !step1Valid) {
			toastError(t('fill_required'));
			return;
		}
		setStep((s) => (s < 3 ? ((s + 1) as Step) : s));
	}

	function back() {
		setStep((s) => (s > 1 ? ((s - 1) as Step) : s));
	}

	async function handleSubmit() {
		if (!step3Valid) {
			toastError(t('fill_required'));
			return;
		}

		setSubmitting(true);
		try {
			const input: any = {
				name: name.trim(),
				description: description.trim() || null,
				dateStart,
				dateEnd,
				location: location.trim(),
				locationAddress: locationAddress.trim() || null,
				competitorLimit: competitorLimit ? parseInt(competitorLimit, 10) : null,
				visibility,
				championshipType: championshipType || null,
				eventIds: Array.from(selectedEvents),
			};
			await gqlMutate(CREATE_MUTATION, {input});
			toastSuccess(t('created'));
			if (props.onComplete) props.onComplete();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		} finally {
			setSubmitting(false);
		}
	}

	const steps: Array<{num: Step; label: string}> = [
		{num: 1, label: t('step_basic')},
		{num: 2, label: t('step_details')},
		{num: 3, label: t('step_events')},
	];

	return (
		<div className={b('create-modal')}>
			<div className={b('modal-header')}>
				<div className={b('modal-icon')}>
					<Trophy weight="fill" />
				</div>
				<h2 className={b('modal-title')}>{t('create_competition')}</h2>
			</div>

			<div className={b('stepper')}>
				{steps.map((s, i) => (
					<React.Fragment key={s.num}>
						<div
							className={b('stepper-item', {
								active: step === s.num,
								done: step > s.num,
							})}
						>
							<span className={b('stepper-number')}>
								{step > s.num ? <Check weight="bold" /> : s.num}
							</span>
							<span>{s.label}</span>
						</div>
						{i < steps.length - 1 && <div className={b('stepper-divider')} />}
					</React.Fragment>
				))}
			</div>

			<div className={b('form')}>
				{step === 1 && (
					<>
						<SubSection title={t('section_basic_info')}>
							<div className={b('field-row')}>
								<div className={b('field')}>
									<label className={b('label')}>{t('competition_name')}</label>
									<input
										className={b('input')}
										value={name}
										onChange={(e) => setName(e.target.value)}
										placeholder={t('name_placeholder')}
									/>
								</div>
								<div className={b('field')}>
									<label className={b('label')}>{t('visibility')}</label>
									<select
										className={b('select')}
										value={visibility}
										onChange={(e) => setVisibility(e.target.value as 'PUBLIC' | 'PRIVATE')}
									>
										<option value="PUBLIC">{t('visibility_public')}</option>
										<option value="PRIVATE">{t('visibility_private')}</option>
									</select>
								</div>
							</div>
							<div className={b('field-row')}>
								<div className={b('field')}>
									<label className={b('label')}>{t('championship_type')}</label>
									<select
										className={b('select')}
										value={championshipType}
										onChange={(e) => setChampionshipType(e.target.value as any)}
									>
										<option value="">{t('championship_none')}</option>
										<option value="NATIONAL">{t('championship_national')}</option>
										<option value="REGIONAL">{t('championship_regional')}</option>
										<option value="CITY">{t('championship_city')}</option>
										<option value="INVITATIONAL">{t('championship_invitational')}</option>
										<option value="YOUTH">{t('championship_youth')}</option>
									</select>
								</div>
							</div>
						</SubSection>

						<SubSection title={t('section_date_location')}>
							<div className={b('field-row')}>
								<div className={b('field')}>
									<label className={b('label')}>{t('date_start')}</label>
									<input
										type="date"
										className={b('input')}
										value={dateStart}
										onChange={(e) => setDateStart(e.target.value)}
									/>
								</div>
								<div className={b('field')}>
									<label className={b('label')}>{t('date_end')}</label>
									<input
										type="date"
										className={b('input')}
										value={dateEnd}
										onChange={(e) => setDateEnd(e.target.value)}
									/>
								</div>
							</div>
							<div className={b('field-row')}>
								<div className={b('field')}>
									<label className={b('label')}>{t('location')}</label>
									<input
										className={b('input')}
										value={location}
										onChange={(e) => setLocation(e.target.value)}
										placeholder={t('location_placeholder')}
									/>
								</div>
								<div className={b('field')}>
									<label className={b('label')}>{t('competitor_limit')}</label>
									<input
										type="number"
										min="1"
										className={b('input')}
										value={competitorLimit}
										onChange={(e) => setCompetitorLimit(e.target.value)}
										placeholder={t('no_limit')}
									/>
								</div>
							</div>
						</SubSection>
					</>
				)}

				{step === 2 && (
					<SubSection title={t('step_details')}>
						<div className={b('field')}>
							<label className={b('label')}>{t('description')}</label>
							<textarea
								className={b('textarea-lg')}
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								placeholder={t('description_placeholder')}
							/>
						</div>
						<div className={b('field')}>
							<label className={b('label')}>{t('location_address')}</label>
							<textarea
								className={b('textarea-lg')}
								value={locationAddress}
								onChange={(e) => setLocationAddress(e.target.value)}
								placeholder={t('location_address_placeholder')}
							/>
						</div>
					</SubSection>
				)}

				{step === 3 && (
					<SubSection title={t('section_events')}>
						<div className={b('event-grid')}>
							{ZKT_WCA_EVENTS.map((ev) => (
								<button
									key={ev.id}
									type="button"
									className={b('event-option', {selected: selectedEvents.has(ev.id)})}
									onClick={() => toggleEvent(ev.id)}
								>
									<span className={`cubing-icon event-${ev.id}`} />
									<span>{ev.name}</span>
								</button>
							))}
						</div>
					</SubSection>
				)}
			</div>

			<div className={b('wizard-nav')}>
				{step > 1 && (
					<button type="button" className={b('wizard-back')} onClick={back}>
						<CaretLeft weight="bold" /> {t('back')}
					</button>
				)}
				{step < 3 && (
					<button type="button" className={b('wizard-next')} onClick={next}>
						{t('next')} <CaretRight weight="bold" />
					</button>
				)}
				{step === 3 && (
					<button
						type="button"
						className={b('wizard-next')}
						onClick={handleSubmit}
						disabled={submitting}
					>
						{submitting ? t('creating') : t('create_submit')}
					</button>
				)}
			</div>
		</div>
	);
}
