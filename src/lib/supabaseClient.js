import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://buaywcxkuahhotschdfv.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1YXl3Y3hrdWFoaG90c2NoZGZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxODA3NjUsImV4cCI6MjA4Nzc1Njc2NX0.2b8xl5AnGH6z-9c2tBeNKGhGltJpBgVl5dnMaMbZC7I'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
