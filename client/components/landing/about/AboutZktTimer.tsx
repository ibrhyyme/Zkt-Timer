import React from 'react';
import LandingInfo from '../info/LandingInfo';
import { resourceUri } from '../../../util/storage';

export default function AboutZktTimer() {
	return (
		<LandingInfo>
			<div>
				<h1>About Zkt-Timer</h1>
				<h3>Zkt-Timer started as an advanced speedcubing timer for the community.</h3>
				<p>
					While we were all in lockdown, I (
					<a target="_blank" href="/user/">
						@ibrhyyme
					</a>
					) decided to pick up cubing. It had been several years since I had picked up a cube, but I could
					still figure out how to solve one, albeit not as fast as I used to.
				</p>
				<p>
					The speedcubing community needed a modern, robust timer application. After analyzing existing solutions,
					we realized there was an opportunity to create something better. Zkt-Timer was built from the ground up
					to be the ultimate speedcubing timer - combining modern design with powerful features that cubers actually need.
				</p>
				<hr />
				<p>
					After a few weeks of adding some more features that I personally wanted, I decided to make a post on{' '}
					<a target="_blank" href="https://reddit.com/r/Cubers">
						r/Cubers
					</a>
					. Little did I know that this post would lead to over a year of development, multiple iterations of
					the app, the accumulation of tens of thousands of users, and lots of plans on the horizon.
				</p>
				<p>
					The post that I made on Reddit showed a very basic timer with 3 static modules. It wasn’t much, and
					definitely lacked a ton of the features that other established timers had, but Reddit loved it and
					asked if I could make it public for download.
				</p>
				<img src={resourceUri('/images/landing/about/about_desktop_v1.png')} alt="Zkt-Timer interface" />
				<p>
					Zkt-Timer was designed with user experience at its core. Every feature has been carefully crafted
					to provide speedcubers with the tools they need without unnecessary complexity. The clean, modern
					interface ensures that users can focus on what matters most - improving their solving times.
				</p>
				<p>
					From the initial launch, Zkt-Timer has gained recognition in the speedcubing community for its
					reliability, feature set, and user-friendly design. The active community provides feedback
					that continues to drive development and new features.
				</p>
				<hr />
				<p>
					Zkt-Timer was built as a web-based application from the start, bringing several advantages: seamless updates,
					cross-platform compatibility, real-time multiplayer capabilities, and instant access without downloads.
					This modern approach ensures that users always have access to the latest features and improvements.
				</p>
				<img src={resourceUri('/images/landing/about/about_web_today.png')} alt="Zkt-Timer today" />
				<hr />
				<p>
					Today, Zkt-Timer isn't just a timer — it's a comprehensive speedcubing platform. With competitive features,
					detailed statistics, training modules, and community interactions, Zkt-Timer aims to be the go-to platform
					for speedcubers worldwide. The future holds exciting possibilities for competitive cubing and community growth.
				</p>
			</div>
		</LandingInfo>
	);
}
