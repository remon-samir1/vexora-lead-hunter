import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
const migrations=readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort();
const sql=[
 '-- VEXORA: first-time installation only. All changes are committed together.',
 '-- Run in the SQL Editor of project hjcasgpxwlizvygsjbth as the postgres role.',
 'BEGIN;',
 "DO $$ BEGIN IF to_regclass('public.lead_records') IS NOT NULL THEN RAISE EXCEPTION 'VEXORA tables already exist. Use versioned migrations instead of running setup again.'; END IF; END $$;",
 ...migrations.map(f=>'\n-- '+f+'\n'+readFileSync('supabase/migrations/'+f,'utf8')),
 'COMMIT;',
 '-- Success: the database is installed. Create an internal Auth user next.',
].join('\n');
writeFileSync('supabase/SETUP_ONCE.sql',sql);
console.log('Prepared supabase/SETUP_ONCE.sql ('+migrations.length+' migrations, one transaction)');
