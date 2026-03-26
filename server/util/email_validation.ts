import dns from 'dns';

export async function validateEmailMx(email: string, timeoutMs: number = 5000): Promise<boolean> {
	const parts = email.split('@');
	if (parts.length !== 2 || !parts[1]) {
		return false;
	}

	const domain = parts[1].toLowerCase().trim();

	if (!domain.includes('.') || domain.length < 3) {
		return false;
	}

	return new Promise<boolean>((resolve) => {
		const timer = setTimeout(() => {
			resolve(true);
		}, timeoutMs);

		dns.resolveMx(domain, (err, addresses) => {
			clearTimeout(timer);

			if (err) {
				if (err.code === 'ENOTFOUND' || err.code === 'ENODATA') {
					resolve(false);
				} else {
					resolve(true);
				}
				return;
			}

			resolve(addresses && addresses.length > 0);
		});
	});
}
