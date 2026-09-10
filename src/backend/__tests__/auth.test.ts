import test from "node:test";
import assert from "node:assert";
import jwt from "jsonwebtoken";
import { generateCustomerAccessToken, generateCustomerRefreshToken, verifyCustomerToken } from "../utils/customerJwt";
import { normalizePhone } from "../utils/phone";
import { requireCustomerAuth, CustomerAuthRequest } from "../middlewares/customerAuth";
import { StorefrontAuthService } from "../services/storefront/auth.service";
import { env } from "../config/env";
import { AppError } from "../utils/AppError";

test("Customer Auth & Security Test Suite", async (t) => {
  await t.test("Phone Normalization for Bangladesh Mobile Numbers", () => {
    // Basic formats
    assert.strictEqual(normalizePhone("01712345678"), "+8801712345678");
    assert.strictEqual(normalizePhone("8801712345678"), "+8801712345678");
    assert.strictEqual(normalizePhone("+8801712345678"), "+8801712345678");
    assert.strictEqual(normalizePhone("01811223344"), "+8801811223344");
    assert.strictEqual(normalizePhone("01311223344"), "+8801311223344");
    
    // Whitespace and dash formatting
    assert.strictEqual(normalizePhone("  +880 1712 345678  "), "+8801712345678");
    assert.strictEqual(normalizePhone(" 017-1234-5678 "), "+8801712345678");
    assert.strictEqual(normalizePhone("(017) 1234-5678"), "+8801712345678");

    // Repeated formatting attempts (idempotency)
    const firstPass = normalizePhone("01712345678");
    assert.strictEqual(firstPass, "+8801712345678");
    assert.strictEqual(normalizePhone(firstPass), "+8801712345678");
    assert.strictEqual(normalizePhone(normalizePhone("+8801712345678")), "+8801712345678");

    // Invalid numbers
    assert.strictEqual(normalizePhone("12345"), null);
    assert.strictEqual(normalizePhone("01212345678"), null); // 012 is not valid BD operator
    assert.strictEqual(normalizePhone("0171234567"), null); // too short
    assert.strictEqual(normalizePhone("017123456789"), null); // too long
    assert.strictEqual(normalizePhone(""), null);
    assert.strictEqual(normalizePhone("   "), null);
    assert.strictEqual(normalizePhone(null), null);
    assert.strictEqual(normalizePhone(undefined), null);
  });

  await t.test("JWT Generation and Verification", () => {
    const customerId = "test-cust-123";
    const email = "test@example.com";

    const accessToken = generateCustomerAccessToken(customerId, email);
    const decoded = verifyCustomerToken(accessToken);

    assert.strictEqual(decoded.id, customerId);
    assert.strictEqual(decoded.email, email);
    assert.strictEqual(decoded.tokenType, "access");

    const refreshToken = generateCustomerRefreshToken(customerId, email);
    const decodedRefresh = verifyCustomerToken(refreshToken);

    assert.strictEqual(decodedRefresh.id, customerId);
    assert.strictEqual(decodedRefresh.email, email);
    assert.strictEqual(decodedRefresh.tokenType, "refresh");
  });

  await t.test("Expired JWT surface behavior", () => {
    const expiredToken = jwt.sign(
      { id: "cust-123", email: "expired@example.com", tokenType: "access" },
      env.JWT_SECRET,
      { expiresIn: "-1s", issuer: "vyzobd-storefront", audience: "customer" }
    );

    let errorCaught: any = null;
    try {
      verifyCustomerToken(expiredToken);
    } catch (err: any) {
      errorCaught = err;
    }

    assert.ok(errorCaught, "Should throw error on expired token");
    assert.strictEqual(errorCaught.statusCode, 401);
    assert.strictEqual(errorCaught.message, "jwt expired");
  });

  await t.test("Malformed JWT surface behavior", () => {
    const malformedToken = "invalid.jwt.signature";

    let errorCaught: any = null;
    try {
      verifyCustomerToken(malformedToken);
    } catch (err: any) {
      errorCaught = err;
    }

    assert.ok(errorCaught, "Should throw error on malformed token");
    assert.strictEqual(errorCaught.statusCode, 401);
    assert.strictEqual(errorCaught.message, "Invalid or expired customer token");
  });

  await t.test("requireCustomerAuth distinguishes expired vs malformed tokens", async () => {
    const expiredToken = jwt.sign(
      { id: "cust-123", email: "expired@example.com", tokenType: "access" },
      env.JWT_SECRET,
      { expiresIn: "-1s", issuer: "vyzobd-storefront", audience: "customer" }
    );

    const req = {
      headers: { authorization: `Bearer ${expiredToken}` },
      ip: "127.0.0.1",
    } as any;

    let nextError: any = null;
    await requireCustomerAuth(req, {} as any, (err?: any) => {
      nextError = err;
    });

    assert.ok(nextError);
    assert.strictEqual(nextError.statusCode, 401);
    assert.strictEqual(nextError.message, "Token expired");
  });

  await t.test("StorefrontAuthService.linkHistoricalGuestOrders handles empty/null inputs safely", async () => {
    const res1 = await StorefrontAuthService.linkHistoricalGuestOrders("", "+8801700000000", "test@example.com");
    assert.strictEqual(res1.linkedOrdersCount, 0);

    const res2 = await StorefrontAuthService.linkHistoricalGuestOrders("cust-123", null, null);
    assert.strictEqual(res2.linkedOrdersCount, 0);
  });
});
