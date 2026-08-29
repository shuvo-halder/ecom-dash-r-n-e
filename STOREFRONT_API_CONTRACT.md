# Storefront Customer API Integration Contract (v1)

Base URL: `/api/storefront/v1`

---

## 1. Authentication & Security Architecture

### Authentication Mechanism
- **Bearer JWT Tokens**: Authenticated customer endpoints require the `Authorization: Bearer <accessToken>` header.
- **Refresh Token Lifecycle**: Refresh tokens are returned upon successful login/registration. Clients can exchange a valid refresh token for a new access token via `POST /auth/refresh`.
- **Strict Tenant & Customer Isolation (IDOR Protection)**: Customer identity is derived **exclusively** from the verified JWT payload (`req.customer.id`). Querying or modifying resources belonging to another customer returns an immediate `403 FORBIDDEN` or `404 NOT_FOUND` without leaking data.

---

## 2. API Endpoints

### 🔑 Authentication Endpoints

---

#### 1. `POST /auth/register`
Register a new customer using email and password.

- **Auth Required**: No
- **Headers**: `Content-Type: application/json`
- **Request Body**:
```json
{
  "email": "customer@example.com",
  "password": "StrongPassword123!",
  "firstName": "Jane",
  "lastName": "Doe",
  "phone": "+8801700000000"
}
```
- **Success Response (`201 Created`)**:
```json
{
  "status": "success",
  "data": {
    "customer": {
      "id": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c",
      "email": "customer@example.com",
      "firstName": "Jane",
      "lastName": "Doe",
      "phone": "+8801700000000",
      "emailVerified": false,
      "phoneVerified": false
    },
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi..."
  },
  "message": "Account created successfully"
}
```
- **Error Responses**:
  - `409 Conflict`: `{"status":"error","code":"EMAIL_EXISTS","message":"Email already registered"}`
  - `400 Bad Request`: Validation failure on email format or password complexity.

---

#### 2. `POST /auth/login`
Authenticate with email and password.

- **Auth Required**: No
- **Headers**: `Content-Type: application/json`
- **Request Body**:
```json
{
  "email": "customer@example.com",
  "password": "StrongPassword123!"
}
```
- **Success Response (`200 OK`)**:
```json
{
  "status": "success",
  "data": {
    "customer": {
      "id": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c",
      "email": "customer@example.com",
      "firstName": "Jane",
      "lastName": "Doe"
    },
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi..."
  }
}
```
- **Error Response**: `401 Unauthorized` for invalid credentials or inactive accounts.

---

#### 3. `POST /auth/register-mobile`
Initiate mobile phone registration by generating an SMS OTP.

- **Auth Required**: No
- **Request Body**:
```json
{
  "phone": "+8801711111111"
}
```
- **Success Response (`200 OK`)**:
```json
{
  "status": "success",
  "data": {
    "phone": "+8801711111111",
    "expiresIn": 300
  },
  "message": "Verification code sent via SMS"
}
```

---

#### 4. `POST /auth/verify-mobile-register`
Verify SMS OTP and complete mobile registration.

- **Auth Required**: No
- **Request Body**:
```json
{
  "phone": "+8801711111111",
  "code": "123456",
  "firstName": "Jane",
  "lastName": "Doe",
  "password": "OptionalPassword123!"
}
```
- **Success Response (`201 Created`)**:
```json
{
  "status": "success",
  "data": {
    "customer": {
      "id": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c",
      "phone": "+8801711111111",
      "phoneVerified": true
    },
    "linkedOrdersCount": 3,
    "linkedOrderIds": [
      "ord-1a2b3c4d",
      "ord-5e6f7g8h",
      "ord-9i0j1k2l"
    ],
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi..."
  }
}
```
*Note: `linkedOrdersCount` and `linkedOrderIds` represent historical guest orders successfully linked to the authenticated customer account.*

---

#### 5. `POST /auth/login-mobile`
Request an SMS OTP code for mobile phone login.

- **Auth Required**: No
- **Request Body**:
```json
{
  "phone": "+8801711111111"
}
```
- **Success Response (`200 OK`)**:
```json
{
  "status": "success",
  "message": "OTP code sent to mobile"
}
```

---

#### 6. `POST /auth/verify-mobile-login`
Complete mobile phone login with SMS OTP.

- **Auth Required**: No
- **Request Body**:
```json
{
  "phone": "+8801711111111",
  "code": "123456"
}
```
- **Success Response (`200 OK`)**:
```json
{
  "status": "success",
  "data": {
    "customer": {
      "id": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c",
      "phone": "+8801711111111"
    },
    "linkedOrdersCount": 3,
    "linkedOrderIds": [
      "ord-1a2b3c4d",
      "ord-5e6f7g8h",
      "ord-9i0j1k2l"
    ],
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi..."
  }
}
```
*Note: `linkedOrdersCount` and `linkedOrderIds` represent historical guest orders successfully linked to the authenticated customer account.*

---

#### 7. `POST /auth/refresh`
Exchange a refresh token for a new access token.

- **Auth Required**: No
- **Request Body**:
```json
{
  "refreshToken": "eyJhbGciOi..."
}
```
- **Success Response (`200 OK`)**:
```json
{
  "status": "success",
  "data": {
    "accessToken": "eyJhbGciOi..."
  }
}
```
- **Error Response**: `401 Unauthorized` if refresh token is expired or revoked.

---

#### 8. `GET /auth/me`
Retrieve currently authenticated session data.

- **Auth Required**: Yes (`Bearer <token>`)
- **Success Response (`200 OK`)**:
```json
{
  "status": "success",
  "data": {
    "customer": {
      "id": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c",
      "firstName": "Jane",
      "lastName": "Doe",
      "email": "customer@example.com",
      "phone": "+8801700000000",
      "emailVerified": true,
      "phoneVerified": true
    }
  }
}
```

---

### 👤 Customer Profile & Dashboard

---

#### 9. `GET /customer/dashboard`
Aggregated customer portal summary (counts, recent orders, metrics).

- **Auth Required**: Yes (`Bearer <token>`)
- **Success Response (`200 OK`)**:
```json
{
  "status": "success",
  "data": {
    "customer": {
      "id": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c",
      "firstName": "Jane",
      "lastName": "Doe",
      "email": "customer@example.com"
    },
    "metrics": {
      "totalOrders": 12,
      "pendingOrders": 1,
      "completedOrders": 10,
      "totalSpent": 24500.50,
      "unreadNotifications": 3,
      "eligibleReviews": 2
    },
    "recentOrders": []
  }
}
```

---

#### 10. `GET /customer/profile`
Retrieve detailed profile for the authenticated customer.

- **Auth Required**: Yes (`Bearer <token>`)
- **Success Response (`200 OK`)**:
```json
{
  "status": "success",
  "data": {
    "profile": {
      "id": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c",
      "firstName": "Jane",
      "lastName": "Doe",
      "email": "customer@example.com",
      "phone": "+8801700000000",
      "avatarUrl": "https://example.com/avatar.jpg",
      "emailVerified": true,
      "phoneVerified": true,
      "phoneVerifiedAt": "2026-01-10T12:00:00.000Z",
      "lastLoginAt": "2026-08-25T14:00:00.000Z",
      "createdAt": "2026-01-01T10:00:00.000Z",
      "updatedAt": "2026-08-25T14:00:00.000Z"
    }
  }
}
```

---

#### 11. `PATCH /customer/profile`
Update safe customer profile details.

- **Auth Required**: Yes (`Bearer <token>`)
- **Request Body** (Safe fields only):
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "avatarUrl": "https://example.com/new-avatar.jpg"
}
```
- **Business Rules**:
  - Direct modifications of `id`, `email`, `phone`, `emailVerified`, `phoneVerified`, `passwordHash`, or security tokens are strictly forbidden.
  - To change email, use `PUT /customer/email` + OTP verification.
  - To change mobile, use `POST /customer/mobile` + OTP verification.
- **Success Response (`200 OK`)**:
```json
{
  "status": "success",
  "data": {
    "profile": {
      "id": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c",
      "firstName": "Jane",
      "lastName": "Smith",
      "avatarUrl": "https://example.com/new-avatar.jpg"
    }
  }
}
```

---

### 📦 Orders

---

#### 12. `POST /customer/orders/claim-guest-orders`
On-demand endpoint to synchronize and claim historical guest orders placed using the customer's verified phone number or email.
- **Auth Required**: Yes (`Bearer <token>`)
- **Security**: Derives customer ID exclusively from the token. Ignores any request body parameters.
- **Idempotency**: Safe to call multiple times. Returns `0` if all matching orders are already claimed.
- **Cascade**: Automatically links associated Payments, Refunds, Return Requests, and Reviews.

**Request**
```json
{}
```

**Response (Success - Orders found)**
```json
{
  "success": true,
  "message": "Guest orders synchronized successfully.",
  "data": {
    "linkedOrdersCount": 3,
    "linkedOrderIds": [
      "ord-1a2b3c4d",
      "ord-5e6f7g8h",
      "ord-9i0j1k2l"
    ]
  }
}
```

**Response (Success - No new orders found)**
```json
{
  "success": true,
  "message": "No new guest orders were found.",
  "data": {
    "linkedOrdersCount": 0,
    "linkedOrderIds": []
  }
}
```

> **Client Integration Note (Next.js Storefront):**
> When users navigate to **Customer Portal → Account Settings → Sync Historical Orders**, the frontend should call this endpoint without any payload. After a successful synchronization (where `linkedOrdersCount > 0`), the frontend must refresh the Customer Dashboard, Orders, Payments, Refunds, Returns, Shipments, Tracking, and Review eligibility contexts to reflect the newly claimed history.

#### 13. `GET /customer/orders`
List orders belonging strictly to the authenticated customer.

- **Auth Required**: Yes (`Bearer <token>`)
- **Query Parameters**:
  - `page`: Integer (default: `1`)
  - `limit`: Integer (default: `10`, max: `50`)
  - `status`: Filter by `OrderPlacementStatus` (e.g., `PENDING`, `PROCESSING`, `DELIVERED`, `CANCELLED`)
  - `search`: Search order number
- **Success Response (`200 OK`)**:
```json
{
  "status": "success",
  "data": {
    "orders": [
      {
        "id": "ord-1111",
        "orderNumber": "ORD-202608-0001",
        "status": "DELIVERED",
        "paymentStatus": "PAID",
        "total": 3500.00,
        "itemCount": 2,
        "createdAt": "2026-08-15T10:30:00.000Z",
        "items": []
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

---

#### 14. `GET /customer/orders/:orderId`
Get full details of a specific customer order.

- **Auth Required**: Yes (`Bearer <token>`)
- **Path Parameters**: `orderId` (UUID)
- **IDOR Protection**: If `orderId` belongs to another customer or does not exist, returns `404 ORDER_NOT_FOUND`.
- **Success Response (`200 OK`)**: Returns full order tree including line items, shipping address, financial breakdown, shipment summary, and timelines.

---

### 💳 Payments

---

#### 15. `GET /customer/payments`
List all payments made across all orders of the authenticated customer.

- **Auth Required**: Yes (`Bearer <token>`)
- **Query Parameters**: `page`, `limit`, `status`
- **Success Response (`200 OK`)**: Returns paginated list of customer transactions.

---

#### 16. `GET /customer/orders/:orderId/payments`
Get payment transactions and financial summary for a specific order.

- **Auth Required**: Yes (`Bearer <token>`)
- **IDOR Protection**: If order is not owned by authenticated customer, returns `404 ORDER_NOT_FOUND`.
- **Success Response (`200 OK`)**:
```json
{
  "status": "success",
  "data": {
    "orderId": "ord-1111",
    "orderNumber": "ORD-202608-0001",
    "orderTotal": 3500.00,
    "paidAmount": 3500.00,
    "dueAmount": 0.00,
    "refundedAmount": 0.00,
    "payments": [
      {
        "id": "pay-1234",
        "transactionId": "TRX-BKASH-9988",
        "gateway": "BKASH",
        "amount": 3500.00,
        "currency": "BDT",
        "status": "SUCCESS",
        "createdAt": "2026-08-15T10:32:00.000Z"
      }
    ]
  }
}
```

---

### 🚚 Shipments & Tracking

---

#### 17. `GET /customer/shipments`
List all shipments associated with authenticated customer's orders.

- **Auth Required**: Yes (`Bearer <token>`)
- **Query Parameters**: `page`, `limit`, `status`
- **Success Response (`200 OK`)**: Paginated list of shipments with tracking numbers and carrier details.

---

#### 18. `GET /customer/orders/:orderId/shipments`
Get shipment packages and item dispatch statuses for a specific order.

- **Auth Required**: Yes (`Bearer <token>`)
- **IDOR Protection**: Returns `404 ORDER_NOT_FOUND` if order is not owned by the customer.

---

#### 19. `GET /customer/orders/:orderId/tracking`
Consolidated tracking timeline, courier link, and delivery status milestones for an order.

- **Auth Required**: Yes (`Bearer <token>`)
- **Success Response (`200 OK`)**:
```json
{
  "status": "success",
  "data": {
    "orderId": "ord-1111",
    "orderNumber": "ORD-202608-0001",
    "shipments": [
      {
        "id": "shp-5555",
        "carrier": "Steadfast",
        "trackingNumber": "ST-998877",
        "trackingUrl": "https://steadfast.com.bd/t/ST-998877",
        "status": "DELIVERED",
        "events": [
          { "status": "INFO_RECEIVED", "timestamp": "2026-08-16T08:00:00Z", "location": "Dhaka Hub" },
          { "status": "OUT_FOR_DELIVERY", "timestamp": "2026-08-17T09:00:00Z", "location": "Gulshan" },
          { "status": "DELIVERED", "timestamp": "2026-08-17T14:30:00Z", "location": "Customer Address" }
        ]
      }
    ]
  }
}
```

---

### 🔄 Refunds & Returns

---

#### 20. `GET /customer/refunds`
List all refund requests/records for the customer.

- **Auth Required**: Yes (`Bearer <token>`)

#### 21. `GET /customer/orders/:orderId/refunds`
Get refund records and adjustment history for a specific order (with IDOR protection).

- **Auth Required**: Yes (`Bearer <token>`)

#### 22. `GET /customer/returns`
List return requests initiated by the authenticated customer.

- **Auth Required**: Yes (`Bearer <token>`)

#### 23. `GET /customer/orders/:orderId/returns`
Get return requests for a specific order (with IDOR protection).

- **Auth Required**: Yes (`Bearer <token>`)

---

### ⭐ Reviews & Eligibility

---

#### 24. `GET /customer/reviews`
List all product reviews submitted by the authenticated customer.

- **Auth Required**: Yes (`Bearer <token>`)
- **Query Parameters**: `page`, `limit`
- **Success Response (`200 OK`)**:
```json
{
  "status": "success",
  "data": {
    "reviews": [
      {
        "id": "rev-1234",
        "productId": "prod-1111",
        "productName": "Wireless Headphones",
        "productSlug": "wireless-headphones",
        "orderItemId": "item-2222",
        "rating": 5,
        "headline": "Great Sound",
        "comment": "Very comfortable for long hours.",
        "status": "APPROVED",
        "isVerifiedPurchase": true,
        "images": ["https://example.com/rev1.jpg"]
      }
    ],
    "pagination": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
  }
}
```

---

#### 25. `GET /customer/reviews/eligible`
Get all unreviewed `OrderItem` purchases eligible for review.

- **Auth Required**: Yes (`Bearer <token>`)
- **Business Rule**: Every delivered purchase (`DELIVERED` or `COMPLETED` order) has an independent entitlement. Multiple separate purchases of the same product yield separate reviewable entitlements.
- **Success Response (`200 OK`)**:
```json
{
  "status": "success",
  "data": [
    {
      "orderItemId": "item-3333",
      "orderId": "ord-2222",
      "orderNumber": "ORD-202608-0002",
      "productId": "prod-1111",
      "productName": "Wireless Headphones",
      "productSlug": "wireless-headphones",
      "productImage": "https://example.com/prod.jpg",
      "purchaseDate": "2026-08-10T10:00:00.000Z",
      "price": 1500.00
    }
  ]
}
```

---

#### 26. `POST /customer/reviews`
Submit a verified purchase review.

- **Auth Required**: Yes (`Bearer <token>`)
- **Request Body**:
```json
{
  "orderItemId": "item-3333",
  "productId": "prod-1111",
  "rating": 5,
  "headline": "Superb Quality",
  "comment": "Sound is rich and battery lasts over 30 hours.",
  "images": ["https://example.com/rev-img.jpg"]
}
```
- **Validation & Business Rules**:
  1. Authenticated customer must own the `OrderItem`.
  2. Order status must be `DELIVERED` or `COMPLETED`.
  3. `productId` must match the `OrderItem`.
  4. Entitlement cannot be consumed twice (subsequent attempts return `409 ALREADY_REVIEWED`).
  5. Review is created with `status: "PENDING"`, `isApproved: false`, and `isVerifiedPurchase: true`.

---

### 🔔 Notifications

---

#### 27. `GET /customer/notifications`
List in-app notifications for authenticated customer with unread count.

- **Auth Required**: Yes (`Bearer <token>`)
- **Query Parameters**:
  - `page`: Integer (default `1`)
  - `limit`: Integer (default `10`)
  - `unreadOnly`: Boolean (`true`/`false`)
- **Success Response (`200 OK`)**:
```json
{
  "status": "success",
  "data": {
    "notifications": [
      {
        "id": "notif-1234",
        "type": "ORDER_SHIPPED",
        "title": "Order Shipped",
        "message": "Your package is on its way!",
        "status": "SENT",
        "isRead": false,
        "orderId": "ord-1111",
        "createdAt": "2026-08-20T10:00:00.000Z"
      }
    ],
    "unreadCount": 1,
    "pagination": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
  }
}
```

---

#### 28. `PATCH /customer/notifications/:id/read`
Mark a single notification as read.

- **Auth Required**: Yes (`Bearer <token>`)
- **IDOR Protection**: If notification belongs to another customer, returns `404 NOT_FOUND`.
- **Success Response (`200 OK`)**:
```json
{
  "status": "success",
  "data": { "status": "READ" }
}
```

---

#### 29. `PATCH /customer/notifications/read-all`
Mark all unread in-app notifications for the customer as read.

- **Auth Required**: Yes (`Bearer <token>`)
- **Success Response (`200 OK`)**:
```json
{
  "status": "success",
  "message": "All notifications marked as read"
}
```

---

## 3. Next.js Integration Guide

### Recommended Next.js API Client (TypeScript)

```typescript
// lib/api-client.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/storefront/v1';

class StorefrontApiClient {
  private getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('customer_access_token');
  }

  private getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('customer_refresh_token');
  }

  private setTokens(accessToken: string, refreshToken?: string) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('customer_access_token', accessToken);
    if (refreshToken) {
      localStorage.setItem('customer_refresh_token', refreshToken);
    }
  }

  private clearTokens() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('customer_access_token');
    localStorage.removeItem('customer_refresh_token');
  }

  public async fetchWithAuth<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ data?: T; error?: string }> {
    let token = this.getAccessToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    // Handle 401 Unauthorized with Refresh Token Workflow
    if (response.status === 401 && this.getRefreshToken()) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        token = this.getAccessToken();
        headers['Authorization'] = `Bearer ${token}`;
        response = await fetch(`${API_BASE_URL}${endpoint}`, {
          ...options,
          headers,
        });
      } else {
        this.clearTokens();
        if (typeof window !== 'undefined') {
          window.location.href = '/login?session_expired=true';
        }
        return { error: 'SESSION_EXPIRED' };
      }
    }

    const payload = await response.json();
    if (!response.ok) {
      return { error: payload.message || payload.code || 'REQUEST_FAILED' };
    }

    return { data: payload.data };
  }

  private async refreshAccessToken(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) return false;
      const data = await res.json();
      if (data.data?.accessToken) {
        this.setTokens(data.data.accessToken);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}

export const storefrontClient = new StorefrontApiClient();
```

---

## 4. Frontend Integration Best Practices

### 1. Dashboard Data-Loading Strategy
- Fetch `GET /customer/dashboard` on the initial customer portal load.
- Avoid redundant parallel fetches for counts: the dashboard endpoint consolidates orders, payments, unread notifications, and review eligibility metrics into a single response.
- Use SWR or React Query with `revalidateOnFocus: true` and 1-minute `staleTime` for smooth portal navigation.

### 2. Pagination Strategy
- Use query params `?page=1&limit=10` across all list endpoints (`orders`, `payments`, `shipments`, `refunds`, `returns`, `notifications`, `reviews`).
- Bind controls directly to the returned `pagination` object (`{ page, limit, total, totalPages }`).

### 3. Error Handling Architecture
- All API errors adhere to the unified format:
```json
{
  "status": "error",
  "code": "ALREADY_REVIEWED",
  "message": "This purchase has already been reviewed"
}
```
- Match error codes in the UI to display localized, user-friendly toast messages.

---

## 25. Analytics Configuration API

### 📊 Analytics Endpoints

#### 1. `GET /analytics/config`
Retrieves the safe, public analytics tracking configuration intended for the frontend Next.js Storefront. This endpoint strips out any server-side secrets (like `ga4ApiSecret`).

- **Auth Required**: No (Public)
- **Response Caching**: Yes (30 seconds TTL via `StorefrontSettingService`)
- **Success Response (`200 OK`)**:
```json
{
  "status": "success",
  "data": {
    "ga4MeasurementId": "G-XXXXXXXXXX",
    "googleAnalyticsId": "G-XXXXXXXXXX",
    "gtmContainerId": "GTM-XXXXXXX",
    "googleTagManagerId": "GTM-XXXXXXX",
    "metaPixelId": "1234567890",
    "facebookPixelId": "1234567890",
    "googleAdsId": "AW-XXXXXXXXX",
    "googleAdsConversionId": "AW-XXXXXXXXX",
    "googleAdsConversionLabel": "AbCdEfG",
    "tiktokPixelId": null,
    "hotjarId": null,
    "enableAnalytics": true
  }
}
```

### Next.js Storefront Integration Requirements
- **Initialization**: The Storefront should check the `enableAnalytics` flag. If `false`, do not inject any tags or fire any analytics events.
- **Provider Skipping**: If an ID (e.g. `tiktokPixelId`) is `null`, the Storefront must bypass initializing that specific provider's tracking script. Analytics failures or unconfigured providers must **never** block the core Storefront commerce functionality (Cart, Checkout).
- **Security**: The backend explicitly prevents sending the `ga4ApiSecret`. Do not attempt to read or proxy this value on the frontend. The backend will autonomously push server-side `purchase` events to GA4's Measurement Protocol using the secret.

---

## 26. Order Archival & Historical Data Ownership

### 🗄️ Archival Independence
- **Admin Workspace vs Customer History**: The system strictly separates Admin workspace visibility from Customer data ownership. When an admin archives an order (setting `deletedAt`), it is hidden from the Admin's active workspace, but **it is never hidden from the authenticated customer's Storefront history.**
- **Historical Immutability**: Archiving an order by an admin does **not** destroy or hide the customer's historical records. Archived orders will continue to appear in `GET /customer/orders`.
- **Financial & Logistics Transparency**: Archived orders fully retain visibility of their associated `payments`, `refunds`, `returns`, `shipments`, and `tracking` via the customer portal.
- **Review Eligibility**: Archived orders that are `DELIVERED` or `COMPLETED` retain their review eligibility, provided they have not already been reviewed. Admin moderation of a review (soft-deletion) does not destroy the Cloudinary image assets or the underlying review record for the customer, maintaining the customer's personal history.

### 🧾 Financial Semantics (dueAmount)
- The outstanding customer balance (`dueAmount`) on any order is strictly defined as `Math.max(0, totalAmount - paidSum)`.
- **Refunds do not reopen debt**: When a customer is refunded (e.g. for a return or discount), the business is returning settled funds. The `dueAmount` calculation does **not** add `refundSum` back into the amount owed, as standard B2C eCommerce financial models consider refunded amounts as resolved balance, not newly owed debt.

### 🛡️ Guest Claiming & Concurrency Protection
- **Archived Guest Orders**: If a guest places an order and an admin archives it before the guest creates a verified account, the order **can still be claimed** by the customer when they successfully verify the matching phone number or email.
- **Ownership Inviolability**: An order is strictly protected once claimed. A guest order with a non-null `customerId` can **never** be reassigned to another customer, preventing IDOR and cross-account data leaks.
