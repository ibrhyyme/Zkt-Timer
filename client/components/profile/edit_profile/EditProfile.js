import React from 'react';
import './EditProfile.scss';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../api';
import Input from '../../common/inputs/input/Input';
import TextArea from '../../common/inputs/textarea/TextArea';
import Button from '../../common/button/Button';

export default class EditProfile extends React.Component {
	constructor(props) {
		super(props);

		const profile = this.props.profile;

		this.state = {
			error: '',
			loading: false,
			bio: profile.bio,
			threeMethod: profile.three_method,
			threeGoal: profile.three_goal,
			mainThreeCube: profile.main_three_cube,
			favoriteEvent: profile.favorite_event,
			twitchLink: profile.twitch_link,
			youtubeLink: profile.youtube_link,
			twitterLink: profile.twitter_link,
			wcaProfileLink: profile.reddit_link,
		};
	}

	handleChange = (e) => {
		this.setState({
			error: '',
			[e.target.name]: e.target.value,
		});
	};

	updateProfile = async () => {
		const {
			loading,
			bio,
			youtubeLink,
			wcaProfileLink,
			twitterLink,
			twitchLink,
			threeMethod,
			threeGoal,
			mainThreeCube,
			favoriteEvent,
		} = this.state;

		if (loading) {
			return;
		}

		if (twitchLink && !/https:\/\/(www\.)?twitch\.tv.+/.test(twitchLink)) {
			this.setState({
				error: 'Geçersiz Twitch linki',
			});
			return;
		}

		if (youtubeLink && (!/https:\/\/(www\.)?youtube\.com\/(user|channel|u|c)\/.+/.test(youtubeLink)
		   		&& !/https:\/\/(www\.)?youtube\.com\/@.+/.test(youtubeLink))) {
			this.setState({
				error: 'Geçersiz YouTube linki',
			});
			return;
		}

		if (wcaProfileLink && !/https:\/\/(www\.)?worldcubeassociation\.org\/persons\/.+/.test(wcaProfileLink)) {
			this.setState({
				error: 'Geçersiz WCA Profil linki',
			});
			return;
		}

		if (twitterLink && (!/https:\/\/(www\.)?twitter\.com\/.+/.test(twitterLink)
				&& !/https:\/\/(www\.)?x\.com\/.+/.test(twitterLink))) {
			this.setState({
				error: 'Geçersiz X (Twitter) Profil linki',
			});
			return;
		}

		this.setState({
			loading: true,
		});

		const input = {
			bio,
			three_method: threeMethod,
			three_goal: threeGoal,
			main_three_cube: mainThreeCube,
			favorite_event: favoriteEvent,
			twitch_link: twitchLink,
			youtube_link: youtubeLink,
			reddit_link: wcaProfileLink,
			twitter_link: twitterLink,
		};

		const query = gql`
			mutation Mutate($input: ProfileInput) {
				updateProfile(input: $input) {
					bio
					id
					three_method
				}
			}
		`;

		try {
			await gqlMutate(query, {
				input,
			});

			window.location.reload();
		} catch (e) {
			this.setState({
				error: e.message,
			});
		}
	};

	render() {
		const {
			bio,
			loading,
			threeMethod,
			youtubeLink,
			twitchLink,
			twitterLink,
			wcaProfileLink,
			favoriteEvent,
			mainThreeCube,
			threeGoal,
			error,
		} = this.state;

		return (
			<div className="cd-profile__edit">
				<div className="cd-profile__edit__grid">
					<div className="cd-profile__edit__bio">
						<TextArea
							maxLength={250}
							fullWidth
							legend="Biyografi"
							value={bio}
							onChange={this.handleChange}
							name="bio"
						/>
					</div>
					<Input
						legend="YouTube Kanalı"
						placeholder="https://www.youtube.com/@ibrhyyme"
						name="youtubeLink"
						value={youtubeLink}
						onChange={this.handleChange}
					/>
					<Input
						legend="Twitch Kanalı"
						placeholder="https://www.twitch.tv/ishowspeed"
						name="twitchLink"
						value={twitchLink}
						onChange={this.handleChange}
					/>
					<Input
						legend="X (Twitter) Profili"
						placeholder="https://x.com/nezevanun"
						name="twitterLink"
						value={twitterLink}
						onChange={this.handleChange}
					/>
					<Input
						legend="WCA Profili"
						placeholder="https://www.worldcubeassociation.org/persons/xxxx"
						name="wcaProfileLink"
						value={wcaProfileLink}
						onChange={this.handleChange}
					/>
					<Input
						legend="3x3 Yöntemi"
						info="Örn: CFOP, ROUX"
						name="threeMethod"
						value={threeMethod}
						onChange={this.handleChange}
					/>
					<Input
						legend="3x3 Hedefi"
						info="Örn: Sub 10"
						name="threeGoal"
						value={threeGoal}
						onChange={this.handleChange}
					/>
					<Input
						legend="Ana 3x3 Küpü"
						info="Örn: GAN 11 M Pro 3x3"
						name="mainThreeCube"
						value={mainThreeCube}
						onChange={this.handleChange}
					/>
					<Input
						legend="Favori Etkinlik"
						info="Örn: Pyraminx"
						name="favoriteEvent"
						value={favoriteEvent}
						onChange={this.handleChange}
					/>
				</div>
				<Button
					text="Profili Güncelle"
					primary
					glow
					large
					loading={loading}
					error={error}
					onClick={this.updateProfile}
				/>
			</div>
		);
	}
}
