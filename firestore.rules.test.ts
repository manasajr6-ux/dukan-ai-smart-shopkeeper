/**
 * Security Rule Test Suite for Dukan AI
 * Validates Dirty Dozen payloads against Firestore security invariants
 */

export const dirtyDozenCases = [
  { id: '1', name: 'Unauthenticated Read on /users/user123', shouldPass: false },
  { id: '2', name: 'Cross-Tenant Product Injection', shouldPass: false },
  { id: '3', name: 'Negative Stock Quantity', shouldPass: false },
  { id: '4', name: 'Negative Price', shouldPass: false },
  { id: '5', name: 'Denial-of-Wallet Payload', shouldPass: false },
  { id: '6', name: 'Cross-Tenant Sale Reading', shouldPass: false },
  { id: '7', name: 'Unverified Auth Write', shouldPass: false },
  { id: '8', name: 'Malicious Document ID', shouldPass: false },
  { id: '9', name: 'Tampering with Sale Owner', shouldPass: false },
  { id: '10', name: 'Blanket Query Scraping', shouldPass: false },
  { id: '11', name: 'Negative Sale Total', shouldPass: false },
  { id: '12', name: 'Arbitrary Field Injection', shouldPass: false },
];
