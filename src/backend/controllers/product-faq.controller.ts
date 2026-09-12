import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { AuthRequest } from "../middlewares/auth";
import { ProductFaqService } from "../services/product-faq.service";

export const getProductFaqs = asyncHandler(async (req: Request, res: Response) => {
  const { productId } = req.params;
  const result = await ProductFaqService.getProductFaqs(productId);
  res.status(200).json({ success: true, data: result, ...result });
});

export const assignProductFaq = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { productId } = req.params;
  const result = await ProductFaqService.assignFaqToProduct(
    productId,
    req.body,
    req.user?.id,
    req
  );
  res.status(201).json({ success: true, data: result, ...result });
});

export const reorderProductFaqs = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { productId } = req.params;
  const result = await ProductFaqService.reorderProductFaqs(
    productId,
    req.body.faqIds,
    req.user?.id,
    req
  );
  res.status(200).json({ success: true, data: result, ...result });
});

export const removeProductFaq = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { productId, faqId } = req.params;
  const result = await ProductFaqService.removeFaqFromProduct(
    productId,
    faqId,
    req.user?.id,
    req
  );
  res.status(200).json(result);
});
