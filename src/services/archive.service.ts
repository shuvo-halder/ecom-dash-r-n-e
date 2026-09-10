import { api } from "../lib/api";

export const SUPPORTED_ARCHIVE_ENTITIES = [
  "products",
  "variants",
  "product-images",
  "categories",
  "brands",
  "orders",
  "payments",
  "refunds",
  "returns",
  "shipments",
  "coupons",
  "promotions",
  "marketing-campaigns",
  "banners",
  "popups",
  "pages",
  "landing-pages",
  "blog-posts",
  "faqs",
  "reviews",
  "users",
  "roles",
] as const;

export type SupportedArchiveEntityType = (typeof SUPPORTED_ARCHIVE_ENTITIES)[number];

export const PERMANENTLY_PROTECTED_ENTITIES: readonly SupportedArchiveEntityType[] = [
  "orders",
  "payments",
  "refunds",
  "returns",
  "shipments",
] as const;

export interface ArchiveListItem {
  id: string;
  entityType: SupportedArchiveEntityType;
  displayName: string;
  deletedAt: string;
  status?: string | null;
  slug?: string | null;
  sku?: string | null;
  counts?: Record<string, number>;
  metadata?: Record<string, any>;
  raw: any;
}

export interface ArchiveListPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ArchiveListResponse {
  success: boolean;
  data: ArchiveListItem[];
  pagination: ArchiveListPagination;
}

export interface ArchiveListParams {
  page?: number;
  limit?: number;
  search?: string;
  from?: string;
  to?: string;
}

export interface HardDeleteCheckResult {
  allowed: boolean;
  code?: string;
  reason: string;
  dependencies: string[];
  entity?: {
    id: string;
    displayName: string;
    entityType: SupportedArchiveEntityType;
    deletedAt?: string | null;
  };
}

export interface HardDeleteExecutionResult {
  id: string;
  entityType: SupportedArchiveEntityType;
  displayName: string;
  deletedAt?: string | null;
  mediaEvaluatedCount?: number;
  mediaDeletedCount?: number;
  auditLogId?: string | null;
}

export interface EntityMetadata {
  key: SupportedArchiveEntityType;
  label: string;
  group: "Catalog" | "Sales & Fulfillment" | "Marketing" | "Content" | "System";
  primaryIdentifierLabel: string;
  isPermanentlyProtected?: boolean;
  module: string;
}

export const ENTITY_METADATA_MAP: Record<SupportedArchiveEntityType, EntityMetadata> = {
  products: {
    key: "products",
    label: "Products",
    group: "Catalog",
    primaryIdentifierLabel: "SKU / Slug",
    module: "Products",
  },
  variants: {
    key: "variants",
    label: "Product Variants",
    group: "Catalog",
    primaryIdentifierLabel: "SKU / Barcode",
    module: "Products",
  },
  "product-images": {
    key: "product-images",
    label: "Product Images",
    group: "Catalog",
    primaryIdentifierLabel: "Filename / Alt",
    module: "Products",
  },
  categories: {
    key: "categories",
    label: "Categories",
    group: "Catalog",
    primaryIdentifierLabel: "Slug",
    module: "Categories",
  },
  brands: {
    key: "brands",
    label: "Brands",
    group: "Catalog",
    primaryIdentifierLabel: "Slug",
    module: "Brands",
  },
  orders: {
    key: "orders",
    label: "Orders",
    group: "Sales & Fulfillment",
    primaryIdentifierLabel: "Order Number",
    isPermanentlyProtected: true,
    module: "Orders",
  },
  payments: {
    key: "payments",
    label: "Payments",
    group: "Sales & Fulfillment",
    primaryIdentifierLabel: "Transaction Ref",
    isPermanentlyProtected: true,
    module: "Payments",
  },
  refunds: {
    key: "refunds",
    label: "Refunds",
    group: "Sales & Fulfillment",
    primaryIdentifierLabel: "Transaction Ref",
    isPermanentlyProtected: true,
    module: "Orders",
  },
  returns: {
    key: "returns",
    label: "Returns",
    group: "Sales & Fulfillment",
    primaryIdentifierLabel: "Order Number / ID",
    isPermanentlyProtected: true,
    module: "Orders",
  },
  shipments: {
    key: "shipments",
    label: "Shipments",
    group: "Sales & Fulfillment",
    primaryIdentifierLabel: "Tracking / Consignment #",
    isPermanentlyProtected: true,
    module: "Shipments",
  },
  coupons: {
    key: "coupons",
    label: "Coupons",
    group: "Marketing",
    primaryIdentifierLabel: "Coupon Code",
    module: "Coupons",
  },
  promotions: {
    key: "promotions",
    label: "Promotions",
    group: "Marketing",
    primaryIdentifierLabel: "Promotion Name",
    module: "Promotions",
  },
  "marketing-campaigns": {
    key: "marketing-campaigns",
    label: "Marketing Campaigns",
    group: "Marketing",
    primaryIdentifierLabel: "Campaign Name",
    module: "Marketing",
  },
  banners: {
    key: "banners",
    label: "Banners",
    group: "Marketing",
    primaryIdentifierLabel: "Banner Title",
    module: "Banners",
  },
  popups: {
    key: "popups",
    label: "Popups",
    group: "Marketing",
    primaryIdentifierLabel: "Popup Title",
    module: "Popups",
  },
  pages: {
    key: "pages",
    label: "CMS Pages",
    group: "Content",
    primaryIdentifierLabel: "Slug / Title",
    module: "CMS",
  },
  "landing-pages": {
    key: "landing-pages",
    label: "Landing Pages",
    group: "Content",
    primaryIdentifierLabel: "Slug / Name",
    module: "LandingPages",
  },
  "blog-posts": {
    key: "blog-posts",
    label: "Blog Posts",
    group: "Content",
    primaryIdentifierLabel: "Slug / Title",
    module: "Blog",
  },
  faqs: {
    key: "faqs",
    label: "FAQs",
    group: "Content",
    primaryIdentifierLabel: "Question",
    module: "FAQ",
  },
  reviews: {
    key: "reviews",
    label: "Reviews",
    group: "Content",
    primaryIdentifierLabel: "Customer / Headline",
    module: "Products",
  },
  users: {
    key: "users",
    label: "Users",
    group: "System",
    primaryIdentifierLabel: "Email",
    module: "Users",
  },
  roles: {
    key: "roles",
    label: "Roles",
    group: "System",
    primaryIdentifierLabel: "Role Name",
    module: "Roles",
  },
};

export const archiveService = {
  /**
   * Fetch paginated list of archived records for an entity type
   */
  async listArchived(
    entityType: SupportedArchiveEntityType,
    params?: ArchiveListParams
  ): Promise<ArchiveListResponse> {
    const { data } = await api.get(`/archive/${entityType}`, { params });
    return data;
  },

  /**
   * Safe restore of an archived entity
   */
  async restoreEntity(
    entityType: SupportedArchiveEntityType,
    id: string
  ): Promise<{ success: boolean; message: string; data: any }> {
    const { data } = await api.post(`/archive/${entityType}/${id}/restore`);
    return data;
  },

  /**
   * Pre-flight safety check before attempting hard delete
   */
  async checkHardDeleteSafety(
    entityType: SupportedArchiveEntityType,
    id: string
  ): Promise<HardDeleteCheckResult> {
    const { data } = await api.get(`/archive/${entityType}/${id}/hard-delete-check`);
    return data.data;
  },

  /**
   * Controlled hard delete with required reason
   */
  async hardDeleteEntity(
    entityType: SupportedArchiveEntityType,
    id: string,
    reason: string
  ): Promise<{ success: boolean; message: string; data: HardDeleteExecutionResult }> {
    const { data } = await api.delete(`/archive/${entityType}/${id}/hard-delete`, {
      data: { reason },
    });
    return data;
  },
};
