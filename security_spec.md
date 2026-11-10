# Security Specification for Dukan AI

## 1. Data Invariants
1. A user profile document `/users/{userId}` can only be read, created, or updated by the authenticated user whose `request.auth.uid == userId`.
2. Products in `/products/{productId}` must belong to the authenticated store owner (`request.auth.uid == resource.data.userId` or `incoming().userId == request.auth.uid`).
3. Product stockQuantity cannot be negative, and prices (costPrice, sellingPrice) must be non-negative numbers.
4. Sales transactions in `/sales/{saleId}` must have `userId == request.auth.uid` and valid positive totalAmount.
5. Deletion of sales records is prohibited for financial audit integrity or restricted only to the shop owner.
6. Only authenticated users can access their own shop data; no cross-tenant read or writes are permitted.

## 2. The Dirty Dozen Payloads
1. **Unauthenticated Read on /users/user123**: Attempting to read profile without auth token -> EXPECTED: PERMISSION_DENIED.
2. **Cross-Tenant Product Injection**: User A attempts to write a product with `userId: "userB"` into `/products/prod1` -> EXPECTED: PERMISSION_DENIED.
3. **Negative Stock Quantity**: Attempting to save a product with `stockQuantity: -5` -> EXPECTED: PERMISSION_DENIED.
4. **Negative Price**: Attempting to set `sellingPrice: -100` -> EXPECTED: PERMISSION_DENIED.
5. **Denial-of-Wallet Payload**: Product name length exceeding 150 characters -> EXPECTED: PERMISSION_DENIED.
6. **Cross-Tenant Sale Reading**: User A listing or querying sales where `userId == 'userB'` -> EXPECTED: PERMISSION_DENIED.
7. **Unverified Auth Write**: Client with `email_verified == false` attempting write if email auth is enforced -> EXPECTED: PERMISSION_DENIED.
8. **Malicious Document ID**: Attempting to create a product document with non-alphanumeric or path-traversal ID `../../etc/passwd` -> EXPECTED: PERMISSION_DENIED.
9. **Tampering with Sale Owner**: Updating an existing sale record to change `userId` -> EXPECTED: PERMISSION_DENIED.
10. **Blanket Query Scraping**: Attempting a query on `/products` without `userId == request.auth.uid` filter -> EXPECTED: PERMISSION_DENIED.
11. **Negative Sale Total**: Creating a sale transaction with `totalAmount: -500` -> EXPECTED: PERMISSION_DENIED.
12. **Arbitrary Field Injection**: Writing shadow keys not declared in schema into a product document -> EXPECTED: PERMISSION_DENIED.

## 3. Test Runner
See `firestore.rules.test.ts`.
