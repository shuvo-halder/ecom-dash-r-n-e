import assert from "node:assert";

function checkThreshold(previousAvailable: number, quantity: number, threshold: number) {
  if (previousAvailable > threshold && (previousAvailable - quantity) <= threshold) {
    return true; // Send alert
  }
  return false;
}

assert.strictEqual(checkThreshold(10, 1, 10), false, "10 -> 9 should NOT alert, because it was already NOT > 10. Wait, threshold is 10. If it was 10, it's not > 10, so NO alert?");
console.log("Passed!");
