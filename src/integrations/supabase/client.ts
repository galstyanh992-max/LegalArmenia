import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { rewriteFunctionUrlForDev } from '@/lib/supabase-functions-url';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables');
}

const supabaseFetch: typeof fetch = (input, init) => {
  return fetch(rewriteFunctionUrlForDev(input), init);
};

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: {
    fetch: supabaseFetch,
  },
});
