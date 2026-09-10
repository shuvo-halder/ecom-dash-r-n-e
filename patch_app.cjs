const fs = require('fs');
const file = 'src/App.tsx';
let code = fs.readFileSync(file, 'utf8');

const importTarget = `import { ReturnsList } from './pages/admin/returns/ReturnsList';`;
const importReplacement = `import { ReturnsList } from './pages/admin/returns/ReturnsList';
import { ReviewsList } from './pages/admin/reviews/ReviewsList';
import { ReviewDetails } from './pages/admin/reviews/ReviewDetails';`;

const routeTarget = `                  <Route path="admin/returns" element={<RoutePermissionGuard module="Returns" action="read"><ReturnsList /></RoutePermissionGuard>} />`;
const routeReplacement = `                  <Route path="admin/reviews" element={<RoutePermissionGuard module="Products" action="read"><ReviewsList /></RoutePermissionGuard>} />
                  <Route path="admin/reviews/:id" element={<RoutePermissionGuard module="Products" action="read"><ReviewDetails /></RoutePermissionGuard>} />
                  <Route path="admin/returns" element={<RoutePermissionGuard module="Returns" action="read"><ReturnsList /></RoutePermissionGuard>} />`;

code = code.replace(importTarget, importReplacement);
code = code.replace(routeTarget, routeReplacement);
fs.writeFileSync(file, code);
