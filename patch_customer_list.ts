import fs from 'fs';
const file = 'src/pages/admin/customers/CustomersList.tsx';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(
  /<td className="px-4 py-3">\s*<p className="text-foreground">\{cust.email\}<\/p>\s*<p className="text-xs text-muted-foreground">\{cust.phone \|\| "No phone"\}<\/p>\s*<\/td>/g,
  `<td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <p className="text-foreground">{cust.email}</p>
                        {cust.emailVerified ? (
                          <CheckCircle className="w-3 h-3 text-emerald-500" title="Email Verified" />
                        ) : (
                          <AlertCircle className="w-3 h-3 text-amber-500" title="Email Unverified" />
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <p>{cust.phone || "No phone"}</p>
                        {cust.phone ? (
                          cust.phoneVerified ? (
                            <CheckCircle className="w-3 h-3 text-emerald-500" title="Mobile Verified" />
                          ) : (
                            <AlertCircle className="w-3 h-3 text-amber-500" title="Mobile Unverified" />
                          )
                        ) : null}
                      </div>
                    </td>`
);

fs.writeFileSync(file, data);
