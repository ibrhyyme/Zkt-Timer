// Who may see the registration watch: an admin whose user id is listed in the
// REGISTRATION_WATCH_VIEWERS env var (comma separated). Being admin alone is not
// enough, so a future admin does not inherit the page. An empty or missing list
// means nobody.

export function registrationWatchViewerIds(): string[] {
	return (process.env.REGISTRATION_WATCH_VIEWERS || '')
		.split(',')
		.map((id) => id.trim())
		.filter(Boolean);
}

export function canViewRegistrationWatch(user: {id?: string; admin?: boolean} | null | undefined): boolean {
	if (!user?.id || !user.admin) return false;
	return registrationWatchViewerIds().includes(user.id);
}
