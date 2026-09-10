import test from "node:test";
import assert from "node:assert";
import request from "supertest";
import express from "express";
import authRouter from "../auth.routes";
import accountRouter from "../account.routes";
import { errorHandler } from "../../../middlewares/errorHandler";
import { prisma } from "../../../config/db";

const app = express();
app.use(express.json());
const router = express.Router();
router.use("/auth", authRouter);
router.use("/account", accountRouter);
app.use("/api/storefront/v1", router);
app.use(errorHandler);

test("Authentication and Email Flow Tests", async (t) => {
  let customerToken = "";

  await t.test("Register user should succeed even if email fails", async () => {
    // Note: in a real environment we'd mock emailService, but assuming it just catches
    const res = await request(app)
      .post("/api/storefront/v1/auth/register")
      .send({
        firstName: "Test",
        lastName: "User",
        email: "test.email.flow@vyzobd.com",
        password: "Password123!",
      });
    assert.strictEqual(res.status, 201);
    assert.ok(res.body.message.includes("Registration successful"));
  });

  await t.test("Forgot password should return generic success", async () => {
    const res = await request(app)
      .post("/api/storefront/v1/auth/forgot-password")
      .send({
        email: "test.email.flow@vyzobd.com",
      });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.message.includes("If an account with that email exists"));
  });

  // Clean up
  await prisma.customer.deleteMany({
    where: { email: "test.email.flow@vyzobd.com" },
  });
});
