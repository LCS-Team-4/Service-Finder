import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()


const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl) throw new Error('SUPABASE_URL is not configured')
if (!supabaseKey) throw new Error('SUPABASE_SERVICE_KEY is not configured')

export const supabase = createClient(supabaseUrl, supabaseKey)

