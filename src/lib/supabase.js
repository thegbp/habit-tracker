import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseMisconfigured = !url || !key

// Use placeholder values so createClient doesn't throw — real calls will
// fail gracefully and AuthContext will catch them.
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  key || 'placeholder-key'
)
