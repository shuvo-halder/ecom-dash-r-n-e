const fs = require('fs');
const file = 'src/components/layout/Sidebar.tsx';
let code = fs.readFileSync(file, 'utf8');
code = code.replace("import { Star, NavLink, useLocation } from 'react-router-dom';", "import { NavLink, useLocation } from 'react-router-dom';");
code = code.replace("import { \n  LayoutDashboard,", "import { \n  Star,\n  LayoutDashboard,");
fs.writeFileSync(file, code);
