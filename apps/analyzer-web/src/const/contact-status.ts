// Map both enum-like backend statuses and human-readable variants
// Colors match chart series colors in AnalyticsChart
export const statuses = {
  // Enum-style keys used in analytics and some API responses
  IN_PROGRESS: "bg-sky-100 text-sky-800",
  NOT_CONTACTED: "bg-blue-100 text-blue-800",
  CONTACTED: "bg-yellow-100 text-yellow-800",
  INTERESTED: "bg-purple-100 text-purple-800",
  MEETING_SCHEDULED: "bg-orange-100 text-orange-800",
  PROPOSAL_SENT: "bg-green-100 text-green-800",
  CLOSED: "bg-red-100 text-red-800",

  // Human-readable variants that may appear in normalized UI data
  "In Progress": "bg-sky-100 text-sky-800",
  "Not Contacted": "bg-blue-100 text-blue-800",
  "Contacted": "bg-yellow-100 text-yellow-800",
  "Meeting Scheduled": "bg-orange-100 text-orange-800",
  "Follow Up": "bg-purple-100 text-purple-800",
  "Converted": "bg-green-100 text-green-800",
};
