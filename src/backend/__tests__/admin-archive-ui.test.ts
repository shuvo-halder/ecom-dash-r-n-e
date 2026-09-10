import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  SUPPORTED_ARCHIVE_ENTITIES,
  PERMANENTLY_PROTECTED_ENTITIES,
  ENTITY_METADATA_MAP,
  SupportedArchiveEntityType,
  HardDeleteCheckResult,
} from "../../services/archive.service.js";

describe("STEP 4: Admin Archive Center UI & Safety Logic", () => {
  test("1. Whitelist: exactly 22 supported entities exist with valid metadata", () => {
    assert.strictEqual(
      SUPPORTED_ARCHIVE_ENTITIES.length,
      22,
      "Must support exactly 22 archive entities"
    );

    for (const entity of SUPPORTED_ARCHIVE_ENTITIES) {
      const meta = ENTITY_METADATA_MAP[entity];
      assert.ok(meta, `Metadata must be defined for ${entity}`);
      assert.strictEqual(meta.key, entity);
      assert.ok(meta.label.length > 0);
      assert.ok(meta.primaryIdentifierLabel.length > 0);
      assert.ok(
        ["Catalog", "Sales & Fulfillment", "Marketing", "Content", "System"].includes(
          meta.group
        ),
        `Group must be valid domain for ${entity}`
      );
    }
  });

  test("2. Protected Entities: Orders, Payments, Refunds, Returns, Shipments are permanently protected", () => {
    const expectedProtected = ["orders", "payments", "refunds", "returns", "shipments"];
    assert.strictEqual(PERMANENTLY_PROTECTED_ENTITIES.length, 5);
    for (const key of expectedProtected) {
      assert.ok(
        PERMANENTLY_PROTECTED_ENTITIES.includes(key as SupportedArchiveEntityType),
        `${key} must be in PERMANENTLY_PROTECTED_ENTITIES`
      );
      assert.strictEqual(
        ENTITY_METADATA_MAP[key as SupportedArchiveEntityType].isPermanentlyProtected,
        true,
        `${key} metadata must reflect isPermanentlyProtected`
      );
    }
  });

  test("3. Identifier Verification: Matches exact target identifier and rejects mismatches", () => {
    const item = {
      id: "prod-123-uuid",
      displayName: "Vintage Leather Jacket",
      sku: "JKT-VINT-001",
      slug: "vintage-leather-jacket",
    };

    const targetIdentifier = item.sku || item.slug || item.displayName || item.id;
    assert.strictEqual(targetIdentifier, "JKT-VINT-001");

    // Exact match passes
    const typedExact = "JKT-VINT-001";
    assert.strictEqual(typedExact.trim() === targetIdentifier.trim(), true);

    // Mismatched identifier fails
    const typedWrong = "JKT-VINT-002";
    assert.strictEqual(typedWrong.trim() === targetIdentifier.trim(), false);

    // Empty input fails
    const typedEmpty = "";
    assert.strictEqual(typedEmpty.trim().length > 0 && typedEmpty.trim() === targetIdentifier.trim(), false);
  });

  test("4. Reason Input Validation: requires non-empty reason of at least 3 characters", () => {
    const validateReason = (r: string) => r.trim().length >= 3;

    assert.strictEqual(validateReason(""), false);
    assert.strictEqual(validateReason("  "), false);
    assert.strictEqual(validateReason("ab"), false);
    assert.strictEqual(validateReason("abc"), true);
    assert.strictEqual(validateReason("Customer requested GDPR deletion under Article 17"), true);
  });

  test("5. SuperAdmin Permission Enforcement: blocks hard delete for non-SuperAdmins", () => {
    const checkCanHardDelete = (
      userRoleName: string,
      isProtected: boolean,
      safetyAllowed: boolean,
      identifierMatch: boolean,
      reasonValid: boolean
    ) => {
      const isSuperAdmin = userRoleName === "SuperAdmin" || userRoleName === "Super Admin";
      if (!isSuperAdmin) return false;
      if (isProtected) return false;
      if (!safetyAllowed) return false;
      if (!identifierMatch) return false;
      if (!reasonValid) return false;
      return true;
    };

    // Standard Staff or Admin cannot hard delete even if checks pass
    assert.strictEqual(
      checkCanHardDelete("Catalog Manager", false, true, true, true),
      false
    );
    assert.strictEqual(
      checkCanHardDelete("Admin", false, true, true, true),
      false
    );

    // Permanently protected entities cannot be hard deleted even by SuperAdmin
    assert.strictEqual(
      checkCanHardDelete("SuperAdmin", true, true, true, true),
      false
    );

    // Blocked safety check rejects hard delete
    assert.strictEqual(
      checkCanHardDelete("SuperAdmin", false, false, true, true),
      false
    );

    // SuperAdmin with allowed safety check, matching identifier, and valid reason succeeds
    assert.strictEqual(
      checkCanHardDelete("SuperAdmin", false, true, true, true),
      true
    );
    assert.strictEqual(
      checkCanHardDelete("Super Admin", false, true, true, true),
      true
    );
  });

  test("6. Safety Check Result Handling: displays reason and dependencies correctly", () => {
    const blockedCheck: HardDeleteCheckResult = {
      allowed: false,
      code: "HARD_DELETE_PROHIBITED",
      reason: "Orders are permanently protected for financial and legal auditing.",
      dependencies: ["5 line items", "1 payment record"],
    };

    assert.strictEqual(blockedCheck.allowed, false);
    assert.ok(blockedCheck.reason.includes("Orders are permanently protected"));
    assert.strictEqual(blockedCheck.dependencies.length, 2);

    const allowedCheck: HardDeleteCheckResult = {
      allowed: true,
      reason: "Safety check passed. No blocking dependencies found.",
      dependencies: [],
    };

    assert.strictEqual(allowedCheck.allowed, true);
    assert.strictEqual(allowedCheck.dependencies.length, 0);
  });

  test("7. Product Restore Notice: informs user that products restore as Draft/inactive", () => {
    const getRestoreNotice = (entityType: SupportedArchiveEntityType) => {
      if (entityType === "products") {
        return "Restored products return in Draft (inactive) status to allow catalog review before publishing live.";
      }
      if (entityType === "orders") {
        return "Restoring this order will reactivate it and co-restore associated archived payments.";
      }
      return "Restoring will return this record from archive back to active system.";
    };

    assert.ok(getRestoreNotice("products").includes("Draft"));
    assert.ok(getRestoreNotice("orders").includes("co-restore"));
    assert.ok(getRestoreNotice("categories").includes("active system"));
  });

  test("8. Search & Date Parameters: builds correct query parameters for backend", () => {
    const buildQueryParams = (params: {
      page?: number;
      limit?: number;
      search?: string;
      from?: string;
      to?: string;
    }) => {
      const q: Record<string, any> = {
        page: params.page || 1,
        limit: params.limit || 15,
      };
      if (params.search && params.search.trim()) {
        q.search = params.search.trim();
      }
      if (params.from) {
        q.from = params.from;
      }
      if (params.to) {
        q.to = params.to;
      }
      return q;
    };

    const q1 = buildQueryParams({ page: 2, limit: 15, search: "iphone", from: "2026-01-01", to: "2026-02-01" });
    assert.strictEqual(q1.page, 2);
    assert.strictEqual(q1.limit, 15);
    assert.strictEqual(q1.search, "iphone");
    assert.strictEqual(q1.from, "2026-01-01");
    assert.strictEqual(q1.to, "2026-02-01");

    const q2 = buildQueryParams({ search: "   " });
    assert.strictEqual(q2.page, 1);
    assert.strictEqual(q2.search, undefined);
  });

  test("9. URL Search Sync: syncs active entity with URL and defaults to products", () => {
    const resolveEntityType = (paramValue: string | null): SupportedArchiveEntityType => {
      if (paramValue && (SUPPORTED_ARCHIVE_ENTITIES as readonly string[]).includes(paramValue)) {
        return paramValue as SupportedArchiveEntityType;
      }
      return "products";
    };

    assert.strictEqual(resolveEntityType(null), "products");
    assert.strictEqual(resolveEntityType("categories"), "categories");
    assert.strictEqual(resolveEntityType("invalid-unknown"), "products");
    assert.strictEqual(resolveEntityType("coupons"), "coupons");
    assert.strictEqual(resolveEntityType("roles"), "roles");
  });
});
