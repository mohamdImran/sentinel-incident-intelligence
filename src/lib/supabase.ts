import { createClient } from '@supabase/supabase-js';
import { DEMO_CONFIG } from '../config/demo.config';

const supabaseUrl = DEMO_CONFIG.LIVE.SUPABASE_URL;
const supabaseAnonKey = DEMO_CONFIG.LIVE.SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
