const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/settings/Settings.tsx', 'utf-8');

// The user requested to add a Test Connection button to the SMTP settings UI

const targetStr = `
                    <div className="flex items-center gap-6 pt-2">
                      <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                        <input
                          type="checkbox"
`;

const newStr = `
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
                      <div className="flex items-center gap-6">
                        <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                          <input
                            type="checkbox"
`;

content = content.replace(
  targetStr,
  newStr
);

// We need to add the button beside the checkbox

const targetStr2 = `
                        Enable SMTP Email Delivery
                      </label>
                    </div>
                  </div>
`;

const newStr2 = `
                          Enable SMTP Email Delivery
                        </label>
                      </div>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={async () => {
                          try {
                            // First save current settings
                            await adminClient.put("/api/v1/settings/smtp", {
                              ...formData,
                              port: formData.port ? parseInt(formData.port, 10) : undefined
                            });
                            const res = await adminClient.post("/api/v1/settings/smtp/test");
                            notify.success(res.data.message || "Test email sent successfully");
                          } catch (error: any) {
                            notify.error(error.response?.data?.message || "Failed to test SMTP connection");
                          }
                        }}
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        Test Connection
                      </Button>
                    </div>
                  </div>
`;

content = content.replace(
  targetStr2,
  newStr2
);

fs.writeFileSync('src/pages/admin/settings/Settings.tsx', content);
