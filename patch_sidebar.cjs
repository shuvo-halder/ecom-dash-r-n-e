const fs = require('fs');
const file = 'src/components/layout/Sidebar.tsx';
let code = fs.readFileSync(file, 'utf8');

const target = `{ label: 'Products', href: '/products', module: 'Products', requiredPermission: 'Products.read', icon: Package },`;
const replacement = `{ label: 'Products', href: '/products', module: 'Products', requiredPermission: 'Products.read', icon: Package },
          { label: 'Reviews', href: '/admin/reviews', module: 'Products', requiredPermission: 'Products.read', icon: Star },`;

code = code.replace(target, replacement);

if (code.includes('import {') && code.includes('Star') === false) {
    code = code.replace('import {', 'import { Star,');
}

fs.writeFileSync(file, code);
