import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scoreReviewIssues } from "./reviewIssuePriority";

describe("scoreReviewIssues", () => {
  it("raises priority for repeated severe recent complaints", () => {
    const now = Date.UTC(2026, 8, 3);
    const result = scoreReviewIssues([
      { text: "No parking and the entrance has a severe traffic jam.", rating: 1, time: now / 1000 },
      { text: "Parking problem again; security issue at night.", rating: 2, time: now / 1000 },
      { text: "Lift not working and poor maintenance.", rating: 1, time: now / 1000 },
    ], now);
    assert.equal(result.priority, "P1_CRITICAL");
    assert.ok(result.categories.includes("PARKING"));
    assert.equal(result.issueReviewCount, 3);
    assert.equal(result.parkingReviewCount, 2);
  });

  it("does not treat explicit negation as a complaint", () => {
    const result = scoreReviewIssues([{ text: "There is no parking problem. Good security.", rating: 5 }]);
    assert.equal(result.score, 0);
    assert.equal(result.priority, "P4_LOW");
  });

  it("keeps one mild complaint below critical", () => {
    const result = scoreReviewIssues([{ text: "The waiting time was long but otherwise okay.", rating: 3 }]);
    assert.notEqual(result.priority, "P1_CRITICAL");
  });
});
