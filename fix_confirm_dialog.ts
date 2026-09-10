import fs from 'fs';

const fixDialog = (file: string) => {
  let data = fs.readFileSync(file, 'utf8');
  data = data.replace(
    /<ConfirmDialog\s+isOpen={!!customerToReset}/,
    '<ConfirmDialog\n        title="Reset Customer Password"\n        isOpen={!!customerToReset}'
  );
  data = data.replace(
    /<ConfirmDialog\s+isOpen={showResetConfirm}/,
    '<ConfirmDialog\n        title="Reset Customer Password"\n        isOpen={showResetConfirm}'
  );
  fs.writeFileSync(file, data);
};

fixDialog('src/pages/admin/customers/CustomersList.tsx');
fixDialog('src/pages/admin/customers/CustomerDetail.tsx');
