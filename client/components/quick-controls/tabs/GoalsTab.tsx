import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useSettings} from '../../../util/hooks/useSettings';
import {getCubeTypeInfoById} from '../../../util/cubes/util';
import {
	getDailyGoalStorage,
	setGoalForCubeType,
	removeGoalForCubeType,
	toggleGoalEnabled,
	setReminderEnabled,
} from '../../daily-goal/helpers/storage';
import {getDailyGoalProgress} from '../../daily-goal/helpers/progress';
import {Trash, Bell, BellSlash, Target} from 'phosphor-react';

export default function GoalsTab() {
	const {t} = useTranslation();
	const cubeType = useSettings('cube_type');
	const [, forceUpdate] = useState(0);

	const storage = getDailyGoalStorage();
	const currentGoal = storage.goals.find((g) => g.cube_type === cubeType);
	const otherGoals = storage.goals.filter((g) => g.cube_type !== cubeType);
	const currentProgress = getDailyGoalProgress(cubeType);

	function refresh() {
		forceUpdate((n) => n + 1);
	}

	return (
		<div className="space-y-3">
			{/* Baslik */}
			<div className="flex items-center space-x-1.5 mb-1">
				<div className="h-1.5 w-1.5 bg-primary rounded-full"></div>
				<p className="text-text/50 text-xs font-medium">{t('quick_controls.goals_description')}</p>
			</div>

			{/* Aktif kup turu icin hedef */}
			<CurrentCubeGoal
				cubeType={cubeType}
				goal={currentGoal}
				progress={currentProgress}
				onSave={(target) => {
					setGoalForCubeType(cubeType, target);
					refresh();
				}}
				onToggle={() => {
					toggleGoalEnabled(cubeType);
					refresh();
				}}
				onRemove={() => {
					removeGoalForCubeType(cubeType);
					refresh();
				}}
				t={t}
			/>

			{/* Diger kup turlerinin hedefleri */}
			{otherGoals.length > 0 && (
				<>
					<div className="flex items-center space-x-2 mt-6 mb-3">
						<div className="h-1.5 w-1.5 bg-text/50 rounded-full"></div>
						<p className="text-text/40 text-xs font-medium uppercase tracking-wider">
							{t('quick_controls.other_goals')}
						</p>
					</div>
					{otherGoals.map((goal) => {
						const info = getCubeTypeInfoById(goal.cube_type);
						const progress = getDailyGoalProgress(goal.cube_type);

						return (
							<OtherGoalRow
								key={goal.cube_type}
								name={info?.name || goal.cube_type}
								goal={goal}
								progress={progress}
								onToggle={() => {
									toggleGoalEnabled(goal.cube_type);
									refresh();
								}}
								onRemove={() => {
									removeGoalForCubeType(goal.cube_type);
									refresh();
								}}
							/>
						);
					})}
				</>
			)}

			{/* Hatirlatma toggle */}
			<div className="mt-4">
				<div className="group flex items-center justify-between py-4 px-4 rounded-xl bg-module border border-text/[0.08] hover:border-text/[0.15] transition-all duration-200">
					<div className="flex items-center space-x-3">
						{storage.reminder_enabled ? (
							<Bell size={18} weight="fill" className="text-primary" />
						) : (
							<BellSlash size={18} className="text-text/30" />
						)}
						<span className="font-medium text-text/80 group-hover:text-text transition-colors">
							{t('quick_controls.reminders')}
						</span>
					</div>
					<button
						type="button"
						className={`relative h-6 w-11 rounded-full border transition-all duration-300 transform hover:scale-105 ${
							storage.reminder_enabled
								? 'bg-primary border-primary shadow-lg shadow-primary/30'
								: 'bg-button border-text/[0.1] hover:bg-button'
						} cursor-pointer`}
						onClick={async () => {
							const newVal = !storage.reminder_enabled;
							if (newVal && typeof Notification !== 'undefined' && Notification.permission === 'default') {
								await Notification.requestPermission();
							}
							setReminderEnabled(newVal);
							refresh();
						}}
					>
						<div
							className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-lg transition-all duration-300 ${
								storage.reminder_enabled ? 'translate-x-5 shadow-white/20' : 'translate-x-0.5'
							}`}
						/>
					</button>
				</div>
			</div>
		</div>
	);
}

interface CurrentCubeGoalProps {
	cubeType: string;
	goal: {cube_type: string; target: number; enabled: boolean} | undefined;
	progress: {current: number; target: number; percentage: number; completed: boolean} | null;
	onSave: (target: number) => void;
	onToggle: () => void;
	onRemove: () => void;
	t: (key: string, opts?: any) => string;
}

function CurrentCubeGoal({cubeType, goal, progress, onSave, onToggle, onRemove, t}: CurrentCubeGoalProps) {
	const cubeInfo = getCubeTypeInfoById(cubeType);
	const [inputValue, setInputValue] = useState(goal?.target?.toString() || '');
	const [editing, setEditing] = useState(!goal);

	function handleSave() {
		const num = parseInt(inputValue, 10);
		if (num > 0) {
			onSave(num);
			setEditing(false);
		}
	}

	return (
		<div className="rounded-xl bg-module border border-text/[0.08] p-4 space-y-3">
			{/* Kup adi + baslik */}
			<div className="flex items-center justify-between">
				<div className="flex items-center space-x-2">
					<Target size={18} weight="bold" className="text-primary" />
					<span className="font-semibold text-text">{cubeInfo?.name || cubeType}</span>
				</div>
				{goal && (
					<div className="flex items-center space-x-2">
						{/* Enable/Disable toggle */}
						<button
							type="button"
							className={`relative h-5 w-9 rounded-full border transition-all duration-300 ${
								goal.enabled
									? 'bg-primary border-primary shadow-sm shadow-primary/30'
									: 'bg-button border-text/[0.1]'
							} cursor-pointer`}
							onClick={onToggle}
						>
							<div
								className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-300 ${
									goal.enabled ? 'translate-x-4' : 'translate-x-0.5'
								}`}
							/>
						</button>
						{/* Sil */}
						<button
							type="button"
							onClick={onRemove}
							className="p-1 rounded-lg text-text/30 hover:text-red-400 hover:bg-red-400/10 transition-all"
						>
							<Trash size={16} />
						</button>
					</div>
				)}
			</div>

			{/* Hedef input veya progress */}
			{editing || !goal ? (
				<div className="flex items-center space-x-2">
					<input
						type="number"
						min="1"
						max="9999"
						value={inputValue}
						onChange={(e) => setInputValue(e.target.value)}
						onKeyDown={(e) => e.key === 'Enter' && handleSave()}
						placeholder={t('quick_controls.target_solves')}
						className="flex-1 bg-button border border-text/[0.1] rounded-lg px-3 py-2 text-text text-sm placeholder-text/30 focus:border-primary/50 focus:outline-none transition-colors"
					/>
					<button
						type="button"
						onClick={handleSave}
						className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/80 transition-colors"
					>
						{t('quick_controls.set_goal')}
					</button>
				</div>
			) : (
				<div className="space-y-2">
					{/* Progress bar */}
					<div className="flex items-center justify-between text-xs text-text/50">
						<span>
							{t('quick_controls.solves_progress', {
								current: progress?.current || 0,
								target: goal.target,
							})}
						</span>
						<span>{progress?.percentage || 0}%</span>
					</div>
					<div className="h-2 w-full bg-button rounded-full overflow-hidden">
						<div
							className={`h-full rounded-full transition-all duration-500 ease-out ${
								progress?.completed ? 'bg-green-500' : 'bg-primary'
							}`}
							style={{width: `${progress?.percentage || 0}%`}}
						/>
					</div>
					{progress?.completed && (
						<p className="text-green-400 text-xs font-medium">{t('quick_controls.goal_reached')}</p>
					)}
					{/* Duzenleme butonu */}
					<button
						type="button"
						onClick={() => {
							setInputValue(goal.target.toString());
							setEditing(true);
						}}
						className="text-primary text-xs hover:underline"
					>
						{t('quick_controls.edit_goal')}
					</button>
				</div>
			)}

			{/* Hedef yoksa mesaj */}
			{!goal && !editing && (
				<p className="text-text/30 text-sm">{t('quick_controls.no_goal_set')}</p>
			)}
		</div>
	);
}

interface OtherGoalRowProps {
	name: string;
	goal: {cube_type: string; target: number; enabled: boolean};
	progress: {current: number; target: number; percentage: number; completed: boolean} | null;
	onToggle: () => void;
	onRemove: () => void;
}

function OtherGoalRow({name, goal, progress, onToggle, onRemove}: OtherGoalRowProps) {
	return (
		<div className="group flex items-center justify-between py-3 px-4 rounded-xl bg-module border border-text/[0.08] hover:border-text/[0.15] transition-all duration-200">
			<div className="flex items-center space-x-3 flex-1 min-w-0">
				<span className={`font-medium text-sm ${goal.enabled ? 'text-text/80' : 'text-text/30'}`}>{name}</span>
				{progress && (
					<span className="text-xs text-text/40">
						{progress.current}/{goal.target}
					</span>
				)}
				{/* Mini progress bar */}
				{progress && (
					<div className="h-1 w-16 bg-button rounded-full overflow-hidden">
						<div
							className={`h-full rounded-full ${progress.completed ? 'bg-green-500' : 'bg-primary'}`}
							style={{width: `${progress.percentage}%`}}
						/>
					</div>
				)}
			</div>
			<div className="flex items-center space-x-2">
				<button
					type="button"
					className={`relative h-5 w-9 rounded-full border transition-all duration-300 ${
						goal.enabled
							? 'bg-primary border-primary shadow-sm shadow-primary/30'
							: 'bg-button border-text/[0.1]'
					} cursor-pointer`}
					onClick={onToggle}
				>
					<div
						className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-300 ${
							goal.enabled ? 'translate-x-4' : 'translate-x-0.5'
						}`}
					/>
				</button>
				<button
					type="button"
					onClick={onRemove}
					className="p-1 rounded-lg text-text/30 hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100"
				>
					<Trash size={14} />
				</button>
			</div>
		</div>
	);
}
