const fs = require('fs');

// 1. Update review.service.ts
const serviceFile = 'src/services/review.service.ts';
let serviceContent = fs.readFileSync(serviceFile, 'utf8');
serviceContent += `\nexport const updateAdminResponse = async (id: string, response: string) => {\n  const { data } = await api.put(\`/reviews/\${id}/response\`, { response });\n  return data.data;\n};\n`;
fs.writeFileSync(serviceFile, serviceContent);
console.log("Updated review.service.ts");

// 2. Update ReviewDetails.tsx
const detailsFile = 'src/pages/admin/reviews/ReviewDetails.tsx';
let detailsContent = fs.readFileSync(detailsFile, 'utf8');

// Add import
detailsContent = detailsContent.replace('updateReviewStatus,', 'updateReviewStatus,\n  updateAdminResponse,');

// Add Textarea import
detailsContent = detailsContent.replace('import { Button } from "../../../components/ui/button";', 'import { Button } from "../../../components/ui/button";\nimport { Textarea } from "../../../components/ui/textarea";');
detailsContent = detailsContent.replace('MessageSquare,', 'MessageSquare,\n  Save,');

// Add state for admin response
detailsContent = detailsContent.replace('const queryClient = useQueryClient();', 'const queryClient = useQueryClient();\n  const [adminResponse, setAdminResponse] = useState<string>("");');

// Add useEffect to populate admin response
detailsContent = detailsContent.replace('const { data: review, isLoading } = useQuery({', `
  const { data: review, isLoading } = useQuery({`);

detailsContent = detailsContent.replace(/enabled: !!id,\n  }\);/g, `enabled: !!id,\n  });\n\n  React.useEffect(() => {\n    if (review && review.adminResponse !== undefined) {\n      setAdminResponse(review.adminResponse || "");\n    }\n  }, [review]);`);

// Add mutation
detailsContent = detailsContent.replace('const updateStatusMutation = useMutation({', `
  const updateResponseMutation = useMutation({
    mutationFn: (response: string) => updateAdminResponse(id as string, response),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-review", id] });
      notify.success("Admin response updated successfully");
    },
    onError: (err: any) => {
      notify.error(err.message || "Failed to update response");
    },
  });\n\n  const updateStatusMutation = useMutation({`);

// Add Admin Response UI
const adminResponseUI = `
              {/* Admin Response */}
              <div className="pt-6 border-t mt-6">
                <h4 className="text-sm font-medium text-gray-900 mb-4 flex items-center">
                  <MessageSquare className="w-4 h-4 mr-2 text-gray-500" /> Admin Response
                </h4>
                {canWrite ? (
                  <div className="space-y-4">
                    <Textarea 
                      value={adminResponse}
                      onChange={(e) => setAdminResponse(e.target.value)}
                      placeholder="Write a public response to this review..."
                      className="min-h-[120px] resize-none"
                      maxLength={1000}
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {adminResponse.length}/1000 characters
                      </span>
                      <Button 
                        onClick={() => updateResponseMutation.mutate(adminResponse)}
                        disabled={updateResponseMutation.isPending || adminResponse === (review.adminResponse || "")}
                        size="sm"
                      >
                        {updateResponseMutation.isPending ? "Saving..." : <><Save className="w-4 h-4 mr-2"/> Save Response</>}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-muted p-4 rounded-md">
                    {review.adminResponse ? (
                      <p className="text-sm whitespace-pre-wrap">{review.adminResponse}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No response provided.</p>
                    )}
                  </div>
                )}
              </div>
`;

detailsContent = detailsContent.replace('</CardContent>\n          </Card>\n        </div>\n      </div>', adminResponseUI + '\n            </CardContent>\n          </Card>\n        </div>\n      </div>');

detailsContent = detailsContent.replace('import {  ArrowLeft,', 'import {  ArrowLeft, MessageSquare, Save,');

fs.writeFileSync(detailsFile, detailsContent);
console.log("Updated ReviewDetails.tsx");

