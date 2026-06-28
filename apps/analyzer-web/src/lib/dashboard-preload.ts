let mockTechParkDashboardPromise:
  | Promise<typeof import("@/mock-demo/MockTechParkDashboard")>
  | null = null;

export const preloadMockTechParkDashboard = () => {
  if (!mockTechParkDashboardPromise) {
    mockTechParkDashboardPromise = import("@/mock-demo/MockTechParkDashboard");
  }

  return mockTechParkDashboardPromise;
};
