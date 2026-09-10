import fs from 'fs';
const file = 'src/pages/admin/customers/CustomerDetail.tsx';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(
  '<div>\n                <span className="text-muted-foreground block font-semibold uppercase">Member Since</span>\n                <span className="font-medium text-foreground">{new Date(customer.createdAt).toLocaleDateString()}</span>\n              </div>',
  `<div>
                <span className="text-muted-foreground block font-semibold uppercase">Member Since</span>
                <span className="font-medium text-foreground">{new Date(customer.createdAt).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="text-muted-foreground block font-semibold uppercase">Last Login</span>
                <span className="font-medium text-foreground">
                  {customer.lastLoginAt ? new Date(customer.lastLoginAt).toLocaleString() : "Never logged in"}
                </span>
              </div>`
);

fs.writeFileSync(file, data);
