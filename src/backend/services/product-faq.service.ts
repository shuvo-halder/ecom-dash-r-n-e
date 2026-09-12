import { prisma } from "../config/db";
import { AppError } from "../utils/AppError";
import { AuditService } from "./audit.service";
import { AssignProductFaqInput } from "../validators/product-faq.validator";

export interface FormattedProductFaqItem {
  id: string;
  question: string;
  answer: string;
  category: {
    id: string;
    name: string;
  } | null;
  sortOrder: number;
  isActive: boolean;
}

export interface FormattedProductFaqsResponse {
  productId: string;
  faqs: FormattedProductFaqItem[];
}

export class ProductFaqService {
  /**
   * List all FAQs assigned to a product, ordered by sortOrder ASC, then createdAt ASC, id ASC.
   * Soft-deleted FAQs are excluded from the usable assigned list.
   */
  static async getProductFaqs(productId: string): Promise<FormattedProductFaqsResponse> {
    const product = await prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: { id: true },
    });

    if (!product) {
      throw new AppError("Product not found", 404, "NOT_FOUND");
    }

    const productFaqs = await prisma.productFaq.findMany({
      where: {
        productId,
        faq: {
          deletedAt: null,
        },
      },
      include: {
        faq: {
          include: {
            category: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: [
        { sortOrder: "asc" },
        { createdAt: "asc" },
        { id: "asc" },
      ],
    });

    return {
      productId,
      faqs: productFaqs.map((pf) => ({
        id: pf.faq.id,
        question: pf.faq.question,
        answer: pf.faq.answer,
        category: pf.faq.category
          ? {
              id: pf.faq.category.id,
              name: pf.faq.category.name,
            }
          : null,
        sortOrder: pf.sortOrder,
        isActive: pf.faq.isActive,
      })),
    };
  }

  /**
   * Assign an existing active FAQ to a product.
   * Rejects archived or inactive FAQs, nonexistent products/FAQs, and duplicate assignments.
   */
  static async assignFaqToProduct(
    productId: string,
    input: AssignProductFaqInput,
    actorUserId?: string | null,
    req?: any
  ) {
    // 1. Product validation
    const product = await prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: { id: true },
    });

    if (!product) {
      throw new AppError("Product not found", 404, "NOT_FOUND");
    }

    // 2. FAQ validation
    const faq = await prisma.fAQ.findUnique({
      where: { id: input.faqId },
      include: {
        category: {
          select: { id: true, name: true },
        },
      },
    });

    if (!faq) {
      throw new AppError("FAQ not found", 404, "NOT_FOUND");
    }

    if (faq.deletedAt !== null) {
      throw new AppError("Cannot assign an archived FAQ", 400, "BAD_REQUEST");
    }

    if (!faq.isActive) {
      throw new AppError("Cannot assign an inactive FAQ", 400, "BAD_REQUEST");
    }

    // 3. Duplicate protection
    const existing = await prisma.productFaq.findUnique({
      where: {
        productId_faqId: {
          productId,
          faqId: input.faqId,
        },
      },
    });

    if (existing) {
      throw new AppError("FAQ is already assigned to this product", 409, "DUPLICATE_ASSIGNMENT");
    }

    // 4. Calculate sortOrder if not explicitly provided
    let targetSortOrder = input.sortOrder;
    if (targetSortOrder === undefined || targetSortOrder === null) {
      const lastFaq = await prisma.productFaq.findFirst({
        where: { productId },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      targetSortOrder = lastFaq ? lastFaq.sortOrder + 1 : 0;
    }

    // 5. Create atomic assignment
    let created;
    try {
      created = await prisma.productFaq.create({
        data: {
          productId,
          faqId: input.faqId,
          sortOrder: targetSortOrder,
        },
        include: {
          faq: {
            include: {
              category: {
                select: { id: true, name: true },
              },
            },
          },
        },
      });
    } catch (err: any) {
      if (err.code === "P2002") {
        throw new AppError("FAQ is already assigned to this product", 409, "DUPLICATE_ASSIGNMENT");
      }
      throw err;
    }

    // 6. Audit logging
    await AuditService.createLog(
      actorUserId || null,
      "PRODUCT_FAQ_ASSIGNED",
      "Product",
      productId,
      null,
      { faqId: input.faqId, sortOrder: targetSortOrder },
      req
    );

    return {
      id: created.id,
      productId: created.productId,
      faqId: created.faqId,
      sortOrder: created.sortOrder,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
      faq: {
        id: created.faq.id,
        question: created.faq.question,
        answer: created.faq.answer,
        category: created.faq.category
          ? {
              id: created.faq.category.id,
              name: created.faq.category.name,
            }
          : null,
        isActive: created.faq.isActive,
      },
    };
  }

  /**
   * Unlink an FAQ from a product.
   * Removes ONLY the ProductFaq join row; the FAQ master record remains untouched.
   */
  static async removeFaqFromProduct(
    productId: string,
    faqId: string,
    actorUserId?: string | null,
    req?: any
  ) {
    // 1. Product validation
    const product = await prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: { id: true },
    });

    if (!product) {
      throw new AppError("Product not found", 404, "NOT_FOUND");
    }

    // 2. Validate mapping existence
    const existing = await prisma.productFaq.findUnique({
      where: {
        productId_faqId: {
          productId,
          faqId,
        },
      },
    });

    if (!existing) {
      throw new AppError("FAQ is not assigned to this product", 404, "NOT_FOUND");
    }

    // 3. Delete ONLY the join row
    await prisma.productFaq.delete({
      where: {
        productId_faqId: {
          productId,
          faqId,
        },
      },
    });

    // 4. Audit logging
    await AuditService.createLog(
      actorUserId || null,
      "PRODUCT_FAQ_UNLINKED",
      "Product",
      productId,
      null,
      { faqId },
      req
    );

    return {
      success: true,
      message: "FAQ unlinked from product successfully",
    };
  }

  /**
   * Atomically reorder FAQs assigned to a product.
   * Validates that all IDs are unique and belong to this product.
   */
  static async reorderProductFaqs(
    productId: string,
    faqIds: string[],
    actorUserId?: string | null,
    req?: any
  ): Promise<FormattedProductFaqsResponse> {
    // 1. Product validation
    const product = await prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: { id: true },
    });

    if (!product) {
      throw new AppError("Product not found", 404, "NOT_FOUND");
    }

    // 2. Duplicate validation
    const uniqueIds = new Set(faqIds);
    if (uniqueIds.size !== faqIds.length) {
      throw new AppError("Duplicate FAQ IDs are not allowed in reorder", 400, "VALIDATION_ERROR");
    }

    // 3. Verify all FAQs belong to this product
    const currentMappings = await prisma.productFaq.findMany({
      where: { productId },
      select: { faqId: true },
    });

    const assignedIds = new Set(currentMappings.map((m) => m.faqId));
    for (const id of faqIds) {
      if (!assignedIds.has(id)) {
        throw new AppError(`FAQ '${id}' is not assigned to this product`, 400, "BAD_REQUEST");
      }
    }

    // 4. Atomic sortOrder update within transaction
    await prisma.$transaction(
      faqIds.map((faqId, index) =>
        prisma.productFaq.update({
          where: {
            productId_faqId: {
              productId,
              faqId,
            },
          },
          data: { sortOrder: index },
        })
      )
    );

    // 5. Audit logging
    await AuditService.createLog(
      actorUserId || null,
      "PRODUCT_FAQS_REORDERED",
      "Product",
      productId,
      null,
      { faqIds },
      req
    );

    // 6. Return fresh ordered list
    return await this.getProductFaqs(productId);
  }
}
