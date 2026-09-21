import { supabase } from '../config/supabase'

interface CategoryRow {
	id: string
	name: string
	slug: string
	parent_id: string | null
}

const categoryDefinitions = [
	{ name: 'Home Affairs', slug: 'home-affairs', parent: null },
	{ name: 'Public service office', slug: 'public-service-office', parent: null },
	{ name: 'Emergency services', slug: 'emergency-services', parent: null },
	{ name: 'Healthcare', slug: 'healthcare', parent: null },
	{ name: 'Education', slug: 'education', parent: null },
	{ name: 'Police station', slug: 'police-station', parent: 'emergency-services' },
	{ name: 'Fire station', slug: 'fire-station', parent: 'emergency-services' },
	{ name: 'Shelter', slug: 'shelter', parent: 'emergency-services' },
	{ name: 'Hospital', slug: 'hospital', parent: 'healthcare' },
	{ name: 'Clinic', slug: 'clinic', parent: 'healthcare' },
	{ name: 'Pharmacy', slug: 'pharmacy', parent: 'healthcare' },
	{ name: 'Dentist', slug: 'dentist', parent: 'healthcare' },
	{ name: 'Library', slug: 'library', parent: 'education' },
	{ name: 'School', slug: 'school', parent: 'education' },
] as const

//mkaes the categories more readible
const geoapifyCategorySlugs: Record<string, string> = {
	'office.government.migration': 'home-affairs',
	'office.government.public_service': 'public-service-office',
	'service.police': 'police-station',
	'service.fire_station': 'fire-station',
	'service.social_facility.shelter': 'shelter',
	'healthcare.hospital': 'hospital',
	'healthcare.clinic_or_praxis': 'clinic',
	'healthcare.pharmacy': 'pharmacy',
	'healthcare.dentist': 'dentist',
	'education.library': 'library',
	'education.school': 'school',
}

export async function ensureServiceCategories(): Promise<Map<string, CategoryRow>> {
	const parentIds = new Map<string, string>()

	for (const definition of categoryDefinitions.filter(({ parent }) => parent === null)) {
		const { data, error } = await supabase
			.from('service_categories')
			.upsert({ name: definition.name, slug: definition.slug }, { onConflict: 'slug' })
			.select('id,name,slug,parent_id')
			.single()

		if (error) throw error
		parentIds.set(definition.slug, data.id)
	}

	for (const definition of categoryDefinitions.filter(({ parent }) => parent !== null)) {
		if (!definition.parent) continue

		const { data, error } = await supabase
			.from('service_categories')
			.upsert({
				name: definition.name,
				slug: definition.slug,
				parent_id: parentIds.get(definition.parent),
			}, { onConflict: 'slug' })
			.select('id,name,slug,parent_id')
			.single()

		if (error) throw error
		parentIds.set(definition.slug, data.id)
	}

	const categories = new Map<string, CategoryRow>()
	for (const [slug, id] of parentIds) {
		const definition = categoryDefinitions.find((category) => category.slug === slug)
		if (definition) categories.set(slug, {
			id,
			name: definition.name,
			slug,
			parent_id: definition.parent ? parentIds.get(definition.parent) ?? null : null,
		})
	}

	return categories
}

export async function backfillServiceCategories(): Promise<number> {
	const categories = await ensureServiceCategories()
	let updated = 0

	for (const [type, slug] of Object.entries({
		'Home Affairs': 'home-affairs',
		'Public service office': 'public-service-office',
		'Police station': 'police-station',
		'Fire station': 'fire-station',
		Shelter: 'shelter',
		Hospital: 'hospital',
		Clinic: 'clinic',
		Pharmacy: 'pharmacy',
		Dentist: 'dentist',
		Library: 'library',
		School: 'school',
	})) {
		const category = categories.get(slug)
		if (!category) continue

		const { data, error } = await supabase
			.from('services')
			.update({ category_id: category.id })
			.eq('type', type)
			.is('category_id', null)
			.select('id')

		if (error) throw error
		updated += data?.length ?? 0
	}

	return updated
}

export function resolveCategorySlug(categories: unknown, name: string, address: string): string | null {
	if (Array.isArray(categories)) {
		const matchingCategory = categories
			.filter((category): category is string => typeof category === 'string')
			.sort((first, second) => second.length - first.length)
			.find((category) => geoapifyCategorySlugs[category])

		if (matchingCategory) return geoapifyCategorySlugs[matchingCategory]
	}

	const text = `${name} ${address}`.toLowerCase()
	const nameMatches: Array<[string, string]> = [
		['fire station', 'fire-station'],
		['police station', 'police-station'],
		['police', 'police-station'],
		['shelter', 'shelter'],
		['pharmacy', 'pharmacy'],
		['chemist', 'pharmacy'],
		['dentist', 'dentist'],
		['library', 'library'],
		['school', 'school'],
		['home affairs', 'home-affairs'],
	]

	return nameMatches.find(([term]) => text.includes(term))?.[1] ?? null
}