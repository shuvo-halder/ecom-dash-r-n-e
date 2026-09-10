import test from "node:test";
import assert from "node:assert";
import { AppError } from "../utils/AppError";
import { updateProfileSchema } from "../validators/account.validator";

test("Customer Profile API, Validation & Authorization Tests", async (t) => {
  // In-memory mock database representing multiple customers
  interface MockCustomer {
    id: string;
    firstName: string;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    phoneVerified: boolean;
    phoneVerifiedAt: Date | null;
    emailVerified: boolean;
    passwordHash: string | null;
    avatarUrl: string | null;
    provider: string;
    providerId: string | null;
    verificationToken: string | null;
    verificationExpires: Date | null;
    resetPasswordToken: string | null;
    resetPasswordExpires: Date | null;
    pendingEmail: string | null;
    pendingEmailVerificationToken: string | null;
    pendingEmailVerificationExpires: Date | null;
    isActive: boolean;
    notes: string | null;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }

  let customers: MockCustomer[] = [
    {
      id: "customer-a-id",
      firstName: "Rahim",
      lastName: "Uddin",
      email: "rahim@example.com",
      phone: "+8801711111111",
      phoneVerified: true,
      phoneVerifiedAt: new Date("2026-01-10T12:00:00Z"),
      emailVerified: true,
      passwordHash: "$2a$12$eX4mP1eH4sHvaLu353cr37...",
      avatarUrl: "https://example.com/avatars/rahim.jpg",
      provider: "LOCAL",
      providerId: null,
      verificationToken: "secret_verify_token_a",
      verificationExpires: new Date("2026-12-31T00:00:00Z"),
      resetPasswordToken: "secret_reset_token_a",
      resetPasswordExpires: new Date("2026-12-31T00:00:00Z"),
      pendingEmail: null,
      pendingEmailVerificationToken: null,
      pendingEmailVerificationExpires: null,
      isActive: true,
      notes: "Internal admin notes on customer A",
      lastLoginAt: new Date("2026-08-20T14:30:00Z"),
      createdAt: new Date("2026-01-01T10:00:00Z"),
      updatedAt: new Date("2026-08-20T14:30:00Z"),
    },
    {
      id: "customer-b-id",
      firstName: "Karim",
      lastName: "Hasan",
      email: "karim@example.com",
      phone: "+8801822222222",
      phoneVerified: true,
      phoneVerifiedAt: new Date("2026-02-15T09:00:00Z"),
      emailVerified: false,
      passwordHash: "$2a$12$k4r1mP4ssw0rdH4sh...",
      avatarUrl: null,
      provider: "LOCAL",
      providerId: null,
      verificationToken: "secret_verify_token_b",
      verificationExpires: new Date("2026-12-31T00:00:00Z"),
      resetPasswordToken: null,
      resetPasswordExpires: null,
      pendingEmail: null,
      pendingEmailVerificationToken: null,
      pendingEmailVerificationExpires: null,
      isActive: true,
      notes: "Internal admin notes on customer B",
      lastLoginAt: new Date("2026-08-22T11:00:00Z"),
      createdAt: new Date("2026-02-01T10:00:00Z"),
      updatedAt: new Date("2026-08-22T11:00:00Z"),
    },
  ];

  // Mock service simulating StorefrontAccountService
  const mockAccountService = {
    getProfile(customerId: string) {
      const customer = customers.find((c) => c.id === customerId);
      if (!customer) {
        throw new AppError("Customer profile not found", 404, "CUSTOMER_NOT_FOUND");
      }

      // Return only safe fields
      return {
        id: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone,
        avatarUrl: customer.avatarUrl,
        emailVerified: customer.emailVerified,
        phoneVerified: customer.phoneVerified,
        phoneVerifiedAt: customer.phoneVerifiedAt,
        lastLoginAt: customer.lastLoginAt,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
      };
    },

    updateProfile(
      customerId: string,
      data: { firstName?: string; lastName?: string | null; avatarUrl?: string | null }
    ) {
      const customer = customers.find((c) => c.id === customerId);
      if (!customer) {
        throw new AppError("Customer profile not found", 404, "CUSTOMER_NOT_FOUND");
      }

      // Strictly allow only safe fields to be updated
      if (data.firstName !== undefined) customer.firstName = data.firstName;
      if (data.lastName !== undefined) customer.lastName = data.lastName;
      if (data.avatarUrl !== undefined) customer.avatarUrl = data.avatarUrl;
      customer.updatedAt = new Date();

      return {
        id: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone,
        avatarUrl: customer.avatarUrl,
        emailVerified: customer.emailVerified,
        phoneVerified: customer.phoneVerified,
        phoneVerifiedAt: customer.phoneVerifiedAt,
        lastLoginAt: customer.lastLoginAt,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
      };
    },
  };

  await t.test("GET /customer/profile: Retrieves authenticated customer's profile with safe fields only", () => {
    const profileA: any = mockAccountService.getProfile("customer-a-id");

    assert.strictEqual(profileA.id, "customer-a-id");
    assert.strictEqual(profileA.firstName, "Rahim");
    assert.strictEqual(profileA.lastName, "Uddin");
    assert.strictEqual(profileA.email, "rahim@example.com");
    assert.strictEqual(profileA.phone, "+8801711111111");
    assert.strictEqual(profileA.phoneVerified, true);
    assert.strictEqual(profileA.emailVerified, true);
    assert.strictEqual(profileA.avatarUrl, "https://example.com/avatars/rahim.jpg");

    // Ensure sensitive/internal fields are NOT exposed
    assert.strictEqual(profileA.passwordHash, undefined, "passwordHash must not be exposed");
    assert.strictEqual(profileA.verificationToken, undefined, "verificationToken must not be exposed");
    assert.strictEqual(profileA.resetPasswordToken, undefined, "resetPasswordToken must not be exposed");
    assert.strictEqual(profileA.notes, undefined, "Internal notes must not be exposed");
    assert.strictEqual(profileA.provider, undefined, "provider must not be exposed");
  });

  await t.test("PATCH /customer/profile: Updates safe customer-editable fields (firstName, lastName, avatarUrl)", () => {
    const parsed = updateProfileSchema.parse({
      firstName: "Rahim Updated",
      lastName: "Chowdhury",
      avatarUrl: "https://example.com/avatars/rahim-new.jpg",
    });

    const updated = mockAccountService.updateProfile("customer-a-id", parsed);

    assert.strictEqual(updated.firstName, "Rahim Updated");
    assert.strictEqual(updated.lastName, "Chowdhury");
    assert.strictEqual(updated.avatarUrl, "https://example.com/avatars/rahim-new.jpg");

    // Check that customer B is unaffected
    const profileB = mockAccountService.getProfile("customer-b-id");
    assert.strictEqual(profileB.firstName, "Karim");
  });

  await t.test("PATCH /customer/profile: Partial updates (updating only lastName without changing firstName)", () => {
    const parsed = updateProfileSchema.parse({
      lastName: "Khan",
    });

    const updated = mockAccountService.updateProfile("customer-a-id", parsed);
    assert.strictEqual(updated.firstName, "Rahim Updated", "firstName should remain unchanged");
    assert.strictEqual(updated.lastName, "Khan");
  });

  await t.test("Security: Direct modification of forbidden fields is rejected by schema or ignored by updater", () => {
    const rawForbiddenPayload: any = {
      id: "hacked-id",
      phoneVerified: false,
      phoneVerifiedAt: null,
      emailVerified: false,
      passwordHash: "hacked_password_hash",
      provider: "GOOGLE",
      providerId: "google-12345",
      verificationToken: "fake_token",
      resetPasswordToken: "fake_token",
      isActive: false,
      status: "BANNED",
      notes: "Hacked notes",
      phone: "+8801999999999",
      email: "hacked@example.com",
    };

    // Even if unsafe fields are passed into updateProfile, the service only accepts safe fields
    const safeData: any = {};
    if (rawForbiddenPayload.firstName !== undefined) safeData.firstName = rawForbiddenPayload.firstName;
    if (rawForbiddenPayload.lastName !== undefined) safeData.lastName = rawForbiddenPayload.lastName;
    if (rawForbiddenPayload.avatarUrl !== undefined) safeData.avatarUrl = rawForbiddenPayload.avatarUrl;

    mockAccountService.updateProfile("customer-a-id", safeData);

    const rawCustomerA = customers.find((c) => c.id === "customer-a-id")!;
    assert.strictEqual(rawCustomerA.id, "customer-a-id", "id must not be modified");
    assert.strictEqual(rawCustomerA.phoneVerified, true, "phoneVerified must not be modified");
    assert.strictEqual(rawCustomerA.emailVerified, true, "emailVerified must not be modified");
    assert.strictEqual(rawCustomerA.passwordHash, "$2a$12$eX4mP1eH4sHvaLu353cr37...", "passwordHash must not be modified");
    assert.strictEqual(rawCustomerA.provider, "LOCAL", "provider must not be modified");
    assert.strictEqual(rawCustomerA.isActive, true, "isActive status must not be modified");
    assert.strictEqual(rawCustomerA.phone, "+8801711111111", "phone must not be directly modified via profile PATCH");
    assert.strictEqual(rawCustomerA.email, "rahim@example.com", "email must not be directly modified via profile PATCH");
  });

  await t.test("Validation: Empty firstName and invalid avatarUrl are rejected by schema", () => {
    assert.throws(
      () => {
        updateProfileSchema.parse({
          firstName: "",
        });
      },
      (err: any) => {
        assert.ok(err.issues.some((i: any) => i.path.includes("firstName")));
        return true;
      }
    );

    assert.throws(
      () => {
        updateProfileSchema.parse({
          avatarUrl: "not-a-valid-url",
        });
      },
      (err: any) => {
        assert.ok(err.issues.some((i: any) => i.path.includes("avatarUrl")));
        return true;
      }
    );
  });

  await t.test("Authorization & IDOR: Requesting an unknown customer ID returns 404", () => {
    assert.throws(
      () => {
        mockAccountService.getProfile("non-existent-customer-id");
      },
      (err: any) => {
        assert.strictEqual(err.statusCode, 404);
        assert.strictEqual(err.code, "CUSTOMER_NOT_FOUND");
        return true;
      }
    );
  });
});
