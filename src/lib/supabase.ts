import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/**
 * Supabase client, or null when no project is configured (demo mode).
 * Only the PUBLISHABLE key belongs here. It is public; Row Level Security protects the data.
 */
export const supabase =
  url && key ? createClient(url, key, { auth: { flowType: 'pkce' } }) : null
