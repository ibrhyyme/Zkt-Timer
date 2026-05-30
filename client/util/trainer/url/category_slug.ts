/**
 * Kategori adi ↔ URL slug. Kategori adlari i18n-bagimsiz sabit anahtarlar (orn "PLL",
 * "2x2 L3C", "F2L") oldugu icin slug stabil. Built-in kategorilerde cakisma yok; custom
 * kategoride cakisma olursa slugToCategory ilk eslesmeyi doner (cozulemeyen slug → null,
 * cagiran taraf guard ile selection'a redirect eder).
 */

export function categoryToSlug(category: string): string {
	return category
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

export function slugToCategory(slug: string, categories: string[]): string | null {
	const target = slug.toLowerCase();
	for (const c of categories) {
		if (categoryToSlug(c) === target) return c;
	}
	return null;
}
