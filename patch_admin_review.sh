#!/bin/bash
sed -i '/export const updateReviewStatus = /i \
export const updateAdminResponse = async (req: Request, res: Response, next: NextFunction) => {\n  try {\n    let { response } = req.body;\n    if (response !== null && response !== undefined) {\n      response = String(response).trim();\n      if (response === "") response = null;\n      if (response && response.length > 1000) {\n        throw new AppError("Admin response cannot exceed 1000 characters", 400, "VALIDATION_ERROR");\n      }\n    }\n    const review = await AdminReviewService.updateAdminResponse(req.params.id, response);\n    res.json({ status: "success", data: review, message: "Admin response updated" });\n  } catch (error) {\n    next(error);\n  }\n};\n' src/backend/controllers/review.controller.ts

sed -i 's/export const updateReviewStatus/export const updateAdminResponse = /' src/backend/controllers/review.controller.ts  ## This is a mistake, let's fix it differently.
