import {InternalUserAccount} from '../schemas/UserAccount.schema';
import Stripe from 'stripe';
import {
	cancelAllStripeSubscriptions,
	getStripeCustomerById,
	getStripeCustomerId,
	getStripeCustomerSubscriptions,
	SubscriptionStatus,
} from '../services/stripe';
import {updateUserAccountWithParams} from '../models/user_account';
import {setSetting} from '../models/settings';
import {isProEnabled} from '../lib/pro';

type SubscriptionData = {
	status: SubscriptionStatus;
	subscription: Stripe.Subscription;
	price: Stripe.Price;
	subscriptionItem: Stripe.SubscriptionItem;
	product: string;
};

const proProductId = process.env.STRIPE_PRO_PRODUCT_ID;

export async function getProSubscriptionAndUpdateUserProStatus(user: InternalUserAccount): Promise<SubscriptionData> {
	// When Pro is disabled, return null subscription data
	if (!isProEnabled()) {
		return null;
	}

	const customerId = await getStripeCustomerId(user);
	const subs = await getStripeCustomerSubscriptions(customerId);

	let isPro = false;
	let activeSubscription: SubscriptionData = null;

	subLoop: for (const sub of subs) {
		if (!sub.items || !sub.items.data.length) {
			continue;
		}

		for (const item of sub.items.data) {
			if (!item.price.active || item.price.product !== proProductId) {
				continue;
			}

			const subStatus = sub.status.toUpperCase();
			const status = SubscriptionStatus[subStatus];

			isPro = status === SubscriptionStatus.ACTIVE;
			activeSubscription = {
				status: SubscriptionStatus[subStatus],
				subscription: sub,
				price: item.price,
				subscriptionItem: item,
				product: item.price.product,
			};

			break subLoop;
		}
	}

	if (user.is_pro !== isPro) {
		// Turn off
		await updateUserAccountWithParams(user.id, {
			is_pro: isPro,
		});

		user.is_pro = isPro;

		if (isPro) {
			// Went from free to Pro
			await handleStartPro(user);
		} else {
			// Went from Pro to free
			await handleCancelPro(user);

			// Beta tester is a Pro-only feature. Needs to be turned off in case its on
			await setSetting(user, 'beta_tester', false);
		}
	}

	return activeSubscription;
}

export async function cancelProSubscription(user: InternalUserAccount) {
	// When Pro is disabled, no-op
	if (!isProEnabled()) {
		return;
	}

	await getProSubscriptionAndUpdateUserProStatus(user);

	if (!user.is_pro) {
		throw new Error('You do not have a pro subscription');
	}

	await cancelAllStripeSubscriptions(user);
	await getProSubscriptionAndUpdateUserProStatus(user);
}

async function handleStartPro(user: InternalUserAccount) {
	// Pro başlangıç işlemleri
}

async function handleCancelPro(user: InternalUserAccount) {
	// Pro iptal işlemleri
}
