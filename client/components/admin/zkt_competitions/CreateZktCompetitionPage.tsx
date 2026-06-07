import React, {useState, useEffect, useCallback} from 'react';
import './AdminZktCompetitions.scss';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../api';
import {useTranslation} from 'react-i18next';
import {useHistory, useParams} from 'react-router-dom';
import {toastSuccess, toastError} from '../../../util/toast';
import Loading from '../../common/loading/Loading';
import {b, ZKT_WCA_EVENTS} from './shared';
import {Trophy, CaretLeft} from 'phosphor-react';
import SubSection from './SubSection';
import LeafletMapPicker from './LeafletMapPicker';

const CREATE_MUTATION = gql`
	mutation CreateZktCompFull($input: CreateZktCompetitionInput!) {
		createZktCompetition(input: $input) {
			id
		}
	}
`;

const UPDATE_MUTATION = gql`
	mutation UpdateZktCompFull($id: String!, $input: UpdateZktCompetitionInput!) {
		updateZktCompetition(id: $id, input: $input) {
			id
		}
	}
`;

const EDIT_DETAIL_QUERY = gql`
	query ZktCompForEdit($id: String!) {
		zktCompetition(id: $id) {
			id
			name
			short_name
			description
			visibility
			location
			location_address
			latitude
			longitude
			date_start
			date_end
			registration_opens_at
			registration_closes_at
			registration_edit_deadline
			competitor_limit
			on_spot_registration
			cancellation_policy
			guests_enabled
			force_comment
			extra_requirements
			contact
			main_event_id
			events {
				event_id
			}
		}
	}
`;

// Convert an ISO date string to <input type="date"> value (YYYY-MM-DD).
function toDateInput(iso?: string | null): string {
	if (!iso) return '';
	return String(iso).slice(0, 10);
}

// Convert an ISO datetime to <input type="datetime-local"> value (local time).
function toDateTimeInput(iso?: string | null): string {
	if (!iso) return '';
	const d = new Date(iso);
	if (isNaN(d.getTime())) return '';
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CreateZktCompetitionPage() {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const history = useHistory();
	const {competitionId} = useParams<{competitionId?: string}>();
	const isEdit = !!competitionId;

	const [loading, setLoading] = useState(isEdit);
	const [submitting, setSubmitting] = useState(false);

	// Basic
	const [name, setName] = useState('');
	const [shortName, setShortName] = useState('');
	const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
	// Venue
	const [location, setLocation] = useState('');
	const [locationAddress, setLocationAddress] = useState('');
	const [latitude, setLatitude] = useState('');
	const [longitude, setLongitude] = useState('');
	// Dates
	const [dateStart, setDateStart] = useState('');
	const [dateEnd, setDateEnd] = useState('');
	const [registrationOpensAt, setRegistrationOpensAt] = useState('');
	const [registrationClosesAt, setRegistrationClosesAt] = useState('');
	// Info
	const [description, setDescription] = useState('');
	// Registration
	const [competitorLimit, setCompetitorLimit] = useState('');
	const [registrationEditDeadline, setRegistrationEditDeadline] = useState('');
	const [onSpotRegistration, setOnSpotRegistration] = useState(false);
	const [cancellationPolicy, setCancellationPolicy] = useState('');
	const [guestsEnabled, setGuestsEnabled] = useState(true);
	const [forceComment, setForceComment] = useState(false);
	const [extraRequirements, setExtraRequirements] = useState('');
	// Staff
	const [contact, setContact] = useState('');
	// Events
	const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set(['333']));
	const [mainEventId, setMainEventId] = useState('');

	const loadForEdit = useCallback(async () => {
		if (!competitionId) return;
		try {
			const res: any = await gqlMutate(EDIT_DETAIL_QUERY, {id: competitionId});
			const c = res?.data?.zktCompetition;
			if (!c) {
				toastError(t('not_found'));
				return;
			}
			setName(c.name || '');
			setShortName(c.short_name || '');
			setVisibility(c.visibility || 'PUBLIC');
			setLocation(c.location || '');
			setLocationAddress(c.location_address || '');
			setLatitude(c.latitude != null ? String(c.latitude) : '');
			setLongitude(c.longitude != null ? String(c.longitude) : '');
			setDateStart(toDateInput(c.date_start));
			setDateEnd(toDateInput(c.date_end));
			setRegistrationOpensAt(toDateTimeInput(c.registration_opens_at));
			setRegistrationClosesAt(toDateTimeInput(c.registration_closes_at));
			setDescription(c.description || '');
			setCompetitorLimit(c.competitor_limit != null ? String(c.competitor_limit) : '');
			setRegistrationEditDeadline(toDateTimeInput(c.registration_edit_deadline));
			setOnSpotRegistration(!!c.on_spot_registration);
			setCancellationPolicy(c.cancellation_policy || '');
			setGuestsEnabled(c.guests_enabled !== false);
			setForceComment(!!c.force_comment);
			setExtraRequirements(c.extra_requirements || '');
			setContact(c.contact || '');
			setSelectedEvents(new Set((c.events || []).map((e: any) => e.event_id)));
			setMainEventId(c.main_event_id || '');
		} catch (e: any) {
			toastError(e?.message || t('error'));
		} finally {
			setLoading(false);
		}
	}, [competitionId, t]);

	useEffect(() => {
		if (isEdit) loadForEdit();
	}, [isEdit, loadForEdit]);

	function toggleEvent(eventId: string) {
		const next = new Set(selectedEvents);
		if (next.has(eventId)) {
			next.delete(eventId);
			if (mainEventId === eventId) setMainEventId('');
		} else {
			next.add(eventId);
		}
		setSelectedEvents(next);
	}

	const lat = parseFloat(latitude);
	const lng = parseFloat(longitude);
	const hasCoords = !isNaN(lat) && !isNaN(lng) && latitude !== '' && longitude !== '';

	async function handleSubmit() {
		if (!name.trim() || !dateStart || !dateEnd || !location.trim()) {
			toastError(t('fill_required'));
			return;
		}
		if (selectedEvents.size === 0) {
			toastError(t('fill_required'));
			return;
		}
		const input: any = {
			name: name.trim(),
			shortName: shortName.trim() || null,
			description: description.trim() || null,
			visibility,
			location: location.trim(),
			locationAddress: locationAddress.trim() || null,
			latitude: latitude !== '' && !isNaN(lat) ? lat : null,
			longitude: longitude !== '' && !isNaN(lng) ? lng : null,
			dateStart,
			dateEnd,
			registrationOpensAt: registrationOpensAt || null,
			registrationClosesAt: registrationClosesAt || null,
			registrationEditDeadline: registrationEditDeadline || null,
			competitorLimit: competitorLimit ? parseInt(competitorLimit, 10) : null,
			onSpotRegistration,
			cancellationPolicy: cancellationPolicy.trim() || null,
			guestsEnabled,
			forceComment,
			extraRequirements: extraRequirements.trim() || null,
			contact: contact.trim() || null,
			mainEventId: mainEventId || null,
			eventIds: Array.from(selectedEvents),
		};

		setSubmitting(true);
		try {
			if (isEdit) {
				await gqlMutate(UPDATE_MUTATION, {id: competitionId, input});
				toastSuccess(t('saved'));
				history.push(`/admin/competitions/${competitionId}`);
			} else {
				const res: any = await gqlMutate(CREATE_MUTATION, {input});
				const newId = res?.data?.createZktCompetition?.id;
				toastSuccess(t('created'));
				history.push(newId ? `/admin/competitions/${newId}` : '/admin/competitions');
			}
		} catch (e: any) {
			toastError(e?.message || t('error'));
		} finally {
			setSubmitting(false);
		}
	}

	if (loading) return <Loading />;

	return (
		<div className={b('create-page')}>
			<div className={b('create-page-head')}>
				<button
					type="button"
					className={b('back-btn')}
					onClick={() => history.push('/admin/competitions')}
				>
					<CaretLeft weight="bold" /> {t('back')}
				</button>
				<div className={b('modal-icon')}>
					<Trophy weight="fill" />
				</div>
				<h1 className={b('create-page-title')}>
					{isEdit ? t('edit_competition') : t('create_competition')}
				</h1>
			</div>

			<div className={b('create-page-form')}>
				{/* Basic */}
				<SubSection title={t('section_basic_info')}>
					<div className={b('field')}>
						<label className={b('label')}>{t('competition_name')}</label>
						<input
							className={b('input')}
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder={t('name_placeholder')}
						/>
						<div className={b('field-hint')}>{t('hint_name')}</div>
					</div>
					<div className={b('field-row')}>
						<div className={b('field')}>
							<label className={b('label')}>{t('short_name')}</label>
							<input
								className={b('input')}
								value={shortName}
								onChange={(e) => setShortName(e.target.value)}
							/>
							<div className={b('field-hint')}>{t('hint_short_name')}</div>
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
							<div className={b('field-hint')}>{t('hint_visibility')}</div>
						</div>
					</div>
				</SubSection>

				{/* Venue */}
				<SubSection title={t('section_venue')}>
					<div className={b('field')}>
						<label className={b('label')}>{t('location')}</label>
						<input
							className={b('input')}
							value={location}
							onChange={(e) => setLocation(e.target.value)}
							placeholder={t('location_placeholder')}
						/>
						<div className={b('field-hint')}>{t('hint_location')}</div>
					</div>
					<div className={b('field')}>
						<label className={b('label')}>{t('location_address')}</label>
						<textarea
							className={b('textarea-lg')}
							value={locationAddress}
							onChange={(e) => setLocationAddress(e.target.value)}
							placeholder={t('location_address_placeholder')}
						/>
						<div className={b('field-hint')}>{t('hint_address')}</div>
					</div>
					<div className={b('field-hint')}>{t('hint_coordinates')}</div>
					<LeafletMapPicker
						lat={hasCoords ? lat : null}
						lng={hasCoords ? lng : null}
						onChange={(la, lo) => {
							setLatitude(String(la));
							setLongitude(String(lo));
						}}
					/>
					<div className={b('field-row')}>
						<div className={b('field')}>
							<label className={b('label')}>{t('latitude')}</label>
							<input
								type="number"
								step="0.000001"
								className={b('input')}
								value={latitude}
								onChange={(e) => setLatitude(e.target.value)}
								placeholder="40.207422"
							/>
						</div>
						<div className={b('field')}>
							<label className={b('label')}>{t('longitude')}</label>
							<input
								type="number"
								step="0.000001"
								className={b('input')}
								value={longitude}
								onChange={(e) => setLongitude(e.target.value)}
								placeholder="28.997479"
							/>
						</div>
					</div>
				</SubSection>

				{/* Dates */}
				<SubSection title={t('section_dates')}>
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
							<label className={b('label')}>{t('registration_opens')}</label>
							<input
								type="datetime-local"
								className={b('input')}
								value={registrationOpensAt}
								onChange={(e) => setRegistrationOpensAt(e.target.value)}
							/>
						</div>
						<div className={b('field')}>
							<label className={b('label')}>{t('registration_closes')}</label>
							<input
								type="datetime-local"
								className={b('input')}
								value={registrationClosesAt}
								onChange={(e) => setRegistrationClosesAt(e.target.value)}
							/>
						</div>
					</div>
					<div className={b('field-hint')}>{t('hint_registration_dates')}</div>
				</SubSection>

				{/* Information */}
				<SubSection title={t('section_information')}>
					<div className={b('field')}>
						<label className={b('label')}>{t('description')}</label>
						<textarea
							className={b('textarea-lg')}
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder={t('description_placeholder')}
						/>
						<div className={b('field-hint')}>{t('hint_information')}</div>
					</div>
				</SubSection>

				{/* Registration details */}
				<SubSection title={t('section_registration')}>
					<div className={b('field-row')}>
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
							<div className={b('field-hint')}>{t('hint_competitor_limit')}</div>
						</div>
						<div className={b('field')}>
							<label className={b('label')}>{t('registration_edit_deadline')}</label>
							<input
								type="datetime-local"
								className={b('input')}
								value={registrationEditDeadline}
								onChange={(e) => setRegistrationEditDeadline(e.target.value)}
							/>
							<div className={b('field-hint')}>{t('hint_edit_deadline')}</div>
						</div>
					</div>
					<div className={b('field')}>
						<label className={b('label')}>{t('cancellation_policy')}</label>
						<textarea
							className={b('textarea-lg')}
							value={cancellationPolicy}
							onChange={(e) => setCancellationPolicy(e.target.value)}
						/>
						<div className={b('field-hint')}>{t('hint_cancellation')}</div>
					</div>
					<label className={b('checkbox-row')}>
						<input
							type="checkbox"
							checked={onSpotRegistration}
							onChange={(e) => setOnSpotRegistration(e.target.checked)}
						/>
						<span>{t('on_spot_registration')}</span>
					</label>
					<div className={b('field-hint')}>{t('hint_on_spot')}</div>
					<label className={b('checkbox-row')}>
						<input
							type="checkbox"
							checked={guestsEnabled}
							onChange={(e) => setGuestsEnabled(e.target.checked)}
						/>
						<span>{t('guests_enabled')}</span>
					</label>
					<div className={b('field-hint')}>{t('hint_guests')}</div>
					<label className={b('checkbox-row')}>
						<input
							type="checkbox"
							checked={forceComment}
							onChange={(e) => setForceComment(e.target.checked)}
						/>
						<span>{t('force_comment')}</span>
					</label>
					<div className={b('field-hint')}>{t('hint_force_comment')}</div>
					<div className={b('field')}>
						<label className={b('label')}>{t('extra_requirements')}</label>
						<textarea
							className={b('textarea-lg')}
							value={extraRequirements}
							onChange={(e) => setExtraRequirements(e.target.value)}
						/>
						<div className={b('field-hint')}>{t('hint_extra_requirements')}</div>
					</div>
				</SubSection>

				{/* Staff / contact */}
				<SubSection title={t('section_contact')}>
					<div className={b('field')}>
						<label className={b('label')}>{t('contact')}</label>
						<input
							className={b('input')}
							value={contact}
							onChange={(e) => setContact(e.target.value)}
							placeholder={t('contact_placeholder')}
						/>
						<div className={b('field-hint')}>{t('hint_contact')}</div>
					</div>
				</SubSection>

				{/* Events */}
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
					<div className={b('field')} style={{marginTop: '1rem'}}>
						<label className={b('label')}>{t('main_event')}</label>
						<select
							className={b('select')}
							value={mainEventId}
							onChange={(e) => setMainEventId(e.target.value)}
						>
							<option value="">{t('main_event_none')}</option>
							{ZKT_WCA_EVENTS.filter((ev) => selectedEvents.has(ev.id)).map((ev) => (
								<option key={ev.id} value={ev.id}>
									{ev.name}
								</option>
							))}
						</select>
						<div className={b('field-hint')}>{t('hint_main_event')}</div>
					</div>
				</SubSection>

				<div className={b('create-page-actions')}>
					<button
						type="button"
						className={b('wizard-next')}
						onClick={handleSubmit}
						disabled={submitting}
					>
						{submitting ? t('creating') : isEdit ? t('save') : t('create_submit')}
					</button>
				</div>
			</div>
		</div>
	);
}
