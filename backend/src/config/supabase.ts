import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl) throw new Error('SUPABASE_URL is not configured')
if (!supabaseKey) throw new Error('SUPABASE_SERVICE_KEY is not configured')

export const supabaseAuthConfig = { url: supabaseUrl, key: supabaseKey }

// Service-role client — used for all database queries.
// persistSession: false ensures it will NEVER attach a user session.
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storageKey: 'sb-service-role-no-session', // unique key to prevent shared state
  },
})

export const supabaseAdmin = supabase