import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl) throw new Error('SUPABASE_URL is not configured')
if (!supabaseKey) throw new Error('SUPABASE_SERVICE_KEY is not configured')

export const supabaseAuthConfig = { url: supabaseUrl, key: supabaseKey }
export const supabase = createClient(supabaseUrl, supabaseKey)

// A publishable key (sb_publishable_...) is fine for the public auth endpoints and for the
// password reset flow, which authenticates with the user's own reset token. The admin API
// (auth.admin.createUser / deleteUser / updateUserById) needs the project secret key
// (sb_secret_...) and otherwise fails with 'This endpoint requires a valid Bearer token'.
if (supabaseKey.startsWith('sb_publishable_')) {
	console.warn(
		'[config] SUPABASE_SERVICE_KEY is a publishable key. Supabase admin auth calls need the ' +
		'project secret key (sb_secret_...). Password reset is unaffected because it uses the ' +
		'reset token from the email link.',
	)
}

