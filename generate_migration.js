const fs = require('fs');
const current = fs.readFileSync('/tmp/current.sql', 'utf8');
const old = fs.readFileSync('prisma/migration.sql', 'utf8');

// We need the SQL to add the missing columns/tables.
