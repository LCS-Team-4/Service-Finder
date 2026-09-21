import { supabase } from '../config/supabase.js'
import type { Profile } from '../types/profile.types.js'
import { generatePassword } from '../utils/generatePassword.js'
import type { ApiResponse } from '../types/index.js'


//fetch profiles
export const getProfilesDb = async (): Promise<ApiResponse<Profile[]>> => {
const { data, error } = await supabase
.from('profiles')
.select('*')

if (error) return { success: false, error: error.message }

return { success: true, data }
}

