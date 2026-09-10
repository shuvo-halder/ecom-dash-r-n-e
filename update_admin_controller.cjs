const fs = require('fs');
const file = 'src/backend/controllers/review.controller.ts';
let content = fs.readFileSync(file, 'utf8');

const newCode = `
export const updateAdminResponse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let { response } = req.body;
    
    if (response !== null && response !== undefined) {
      response = String(response).trim();
      if (response === "") {
        response = null;
      } else if (response.length > 1000) {
        throw new AppError("Admin response cannot exceed 1000 characters", 400, "VALIDATION_ERROR");
      }
    }

    const review = await AdminReviewService.updateAdminResponse(req.params.id, response);
    res.json({ status: "success", data: review, message: "Admin response updated" });
  } catch (error) {
    next(error);
  }
};
`;

content = content.replace('export const deleteReview', newCode + '\nexport const deleteReview');
fs.writeFileSync(file, content);
console.log("Updated review.controller.ts");
