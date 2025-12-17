import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kpnmthuxxtefmclckhld.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtwbm10aHV4eHRlZm1jbGNraGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MzM1MzEsImV4cCI6MjA3NDMwOTUzMX0.o8otA7C7iBWb2F8jIfx_cbJdleFpxwVQlcAWnQ5UjfY';

const customSupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export default customSupabaseClient;

export { 
    customSupabaseClient,
    customSupabaseClient as supabase,
};
