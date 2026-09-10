import fs from 'fs';
const file = 'src/pages/admin/customers/CustomerDetail.tsx';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(
  'updateCustomerStatus,',
  'updateCustomerStatus,\n  updateCustomerMobileStatus,'
);

data = data.replace(
  /const handleToggleStatus = async \(\) => \{[\s\S]*?\};/,
  `const handleToggleStatus = async () => {
    if (!id || !customer) return;
    try {
      await updateCustomerStatus(id, !customer.isActive);
      notify.success("Status Updated", \`Customer account \${!customer.isActive ? 'activated' : 'deactivated'} successfully.\`);
      fetchCustomerDetails();
    } catch (err: any) {
      notify.apiError(err, "Failed to update status.");
    }
  };

  const handleToggleMobileVerification = async () => {
    if (!id || !customer) return;
    const isVerified = !customer.phoneVerified;
    if (isVerified && !window.confirm("Are you sure you want to manually mark this mobile number as verified? This action will be recorded in the audit log.")) {
      return;
    }
    try {
      await updateCustomerMobileStatus(id, { phoneVerified: isVerified });
      notify.success("Mobile Status Updated", \`Customer mobile marked as \${isVerified ? 'verified' : 'unverified'}.\`);
      fetchCustomerDetails();
    } catch (err: any) {
      notify.apiError(err, "Failed to update mobile status.");
    }
  };`
);

data = data.replace(
  '<p className="text-xs text-muted-foreground">{customer.email} • {customer.phone || "No phone listed"}</p>',
  `<div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                {customer.email}
                {customer.emailVerified ? (
                  <CheckCircle className="w-3 h-3 text-emerald-500" title="Email Verified" />
                ) : (
                  <AlertCircle className="w-3 h-3 text-amber-500" title="Email Unverified" />
                )}
              </span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                {customer.phone || "No phone listed"}
                {customer.phone && (
                  customer.phoneVerified ? (
                    <CheckCircle className="w-3 h-3 text-emerald-500" title="Mobile Verified" />
                  ) : (
                    <AlertCircle className="w-3 h-3 text-amber-500" title="Mobile Unverified" />
                  )
                )}
              </span>
            </div>`
);

data = data.replace(
  /<div>\s*<span className="text-muted-foreground block font-semibold uppercase">Email<\/span>\s*<span className="font-medium text-foreground">\{customer.email\}<\/span>\s*<\/div>\s*<div>\s*<span className="text-muted-foreground block font-semibold uppercase">Phone<\/span>\s*<span className="font-medium text-foreground">\{customer.phone \|\| "Not provided"\}<\/span>\s*<\/div>/g,
  `<div>
                <span className="text-muted-foreground flex items-center gap-2 font-semibold uppercase">
                  Email
                  {customer.emailVerified ? (
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full flex items-center gap-1 font-bold">
                      <CheckCircle className="w-2.5 h-2.5" /> Verified
                    </span>
                  ) : (
                    <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full flex items-center gap-1 font-bold">
                      <AlertCircle className="w-2.5 h-2.5" /> Unverified
                    </span>
                  )}
                </span>
                <span className="font-medium text-foreground">{customer.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-muted-foreground flex items-center gap-2 font-semibold uppercase">
                    Phone
                    {customer.phone && (
                      customer.phoneVerified ? (
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full flex items-center gap-1 font-bold">
                          <CheckCircle className="w-2.5 h-2.5" /> Verified
                        </span>
                      ) : (
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full flex items-center gap-1 font-bold">
                          <AlertCircle className="w-2.5 h-2.5" /> Unverified
                        </span>
                      )
                    )}
                  </span>
                  <span className="font-medium text-foreground">{customer.phone || "Not provided"}</span>
                  {customer.phoneVerifiedAt && (
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      Verified on: {new Date(customer.phoneVerifiedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
                {customer.phone && hasPermission("Customers", "write") && (
                   <Button variant="ghost" size="sm" onClick={handleToggleMobileVerification} className="h-7 text-xs border">
                     {customer.phoneVerified ? 'Mark Unverified' : 'Mark Verified'}
                   </Button>
                )}
              </div>`
);

fs.writeFileSync(file, data);
