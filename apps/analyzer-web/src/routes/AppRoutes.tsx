import { lazy, Suspense, type ReactNode } from "react";
import { MainLayout } from "@/layout/main-layout";

import { Login } from "@/pages/Login";
import { Register } from "@/pages/Register";
import { VerifyOTP } from "@/pages/VerifyOTP";
import { ForgotPassword } from "@/pages/ForgotPassword";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GupioOverlayLoader } from "@/components/ui/gupio-loader";

import type { RouteObject } from "react-router";
import { RoleBasedRedirect } from "@/components/auth/RoleBasedRedirect";
import { StateBasedRedirect } from "@/components/auth/StateBasedRedirect";
import { CityBasedRedirect } from "@/components/auth/CityBasedRedirect";
import { RequirePermission } from "@/components/auth/RoleGuard";
import { preloadMockTechParkDashboard } from "@/lib/dashboard-preload";

import LandingPage from "@/pages/LandingPage";

const MockTechParkDashboard = lazy(preloadMockTechParkDashboard);
const TechParkDetailsPage = lazy(() => import("@/pages/dashboard/TechParkDetailsPage"));
const CoworkingSpaceDetailsPage = lazy(
  () => import("@/pages/dashboard/CoworkingSpaceDetailsPage"),
);
const CompanyDetailsPage = lazy(() =>
  import("@/pages/dashboard/CompanyDetailsPage").then((module) => ({
    default: module.CompanyDetailsPage,
  })),
);
const CoworkingCompanyDetailsPage = lazy(() =>
  import("@/pages/dashboard/CoworkingCompanyDetailsPage").then((module) => ({
    default: module.CoworkingCompanyDetailsPage,
  })),
);
const FundingNewsPage = lazy(() => import("@/pages/dashboard/FundingNewsPage"));
const FundingNewsDetailsPage = lazy(() => import("@/pages/dashboard/FundingNewsDetailsPage"));
const ExternalApiPage = lazy(() => import("@/pages/dashboard/ExternalApiPage"));
const LeadsPage = lazy(() => import("@/pages/dashboard/LeadsPage"));
const UsersPage = lazy(() => import("@/pages/dashboard/UsersPage"));
const CoworkingSpacesPage = lazy(() => import("@/pages/dashboard/CoworkingSpacesPage"));
const AccessControlPage = lazy(() => import("@/pages/dashboard/AccessControlPage"));
const DepartmentsPage = lazy(() => import("@/pages/dashboard/DepartmentsPage"));
const RolesPage = lazy(() => import("@/pages/dashboard/RolesPage"));
const ReportsPage = lazy(() => import("@/pages/dashboard/ReportsPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const ClientDetailsPage = lazy(() =>
  import("@/pages/dashboard/ClientDetailsPage").then((module) => ({
    default: module.ClientDetailsPage,
  })),
);

function LazyRoute({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<GupioOverlayLoader text="Loading dashboard..." />}>
      {children}
    </Suspense>
  );
}

export const Routes = [
  {
    path: "/",
    element: <LandingPage />,
  },
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/signup",
    element: <Register />,
  },
  {
    path: "/verify-otp",
    element: <VerifyOTP />,
  },
  {
    path: "/forgot-password",
    element: <ForgotPassword />,
  },
  {
    path: "/dashboard",
    element: <MainLayout />,
    errorElement: <ErrorBoundary />,
    children: [
      {
        index: true,
        element: <RoleBasedRedirect />,
      },
      {
        path: "national/:state?/:city?",
        element: (
          <RequirePermission permission="national" fallbackPath="/dashboard">
            <LazyRoute>
              <MockTechParkDashboard />
            </LazyRoute>
          </RequirePermission>
        ),
      },
      {
        path: "national/:state/:city/:id",
        element: (
          <RequirePermission permission="national" fallbackPath="/dashboard">
            <LazyRoute>
              <TechParkDetailsPage />
            </LazyRoute>
          </RequirePermission>
        ),
      },
      {
        path: "state",
        element: (
          <RequirePermission permission="state" fallbackPath="/dashboard">
            <StateBasedRedirect />
          </RequirePermission>
        ),
      },
      {
        path: "state/:state?/:city?",
        element: (
          <RequirePermission permission="state" fallbackPath="/dashboard">
            <LazyRoute>
              <MockTechParkDashboard />
            </LazyRoute>
          </RequirePermission>
        ),
      },
      {
        path: "state/:state/:city/:id",
        element: (
          <RequirePermission permission="state" fallbackPath="/dashboard">
            <LazyRoute>
              <TechParkDetailsPage />
            </LazyRoute>
          </RequirePermission>
        ),
      },
      {
        path: "external-api",
        element: (
          <RequirePermission permission="SYSTEM.SUPER_ADMIN" fallbackPath="/dashboard">
            <LazyRoute>
              <ExternalApiPage />
            </LazyRoute>
          </RequirePermission>
        ),
      },
      {
        path: "leads",
        element: (
          <RequirePermission permission="LEADS.VIEW" fallbackPath="/dashboard">
            <LazyRoute>
              <LeadsPage />
            </LazyRoute>
          </RequirePermission>
        ),
      },
      {
        path: "city",
        element: (
          <RequirePermission permission="city" fallbackPath="/dashboard">
            <CityBasedRedirect />
          </RequirePermission>
        ),
      },
      {
        path: "city/:state/:city/:id",
        element: (
          <RequirePermission permission="city" fallbackPath="/dashboard">
            <LazyRoute>
              <TechParkDetailsPage />
            </LazyRoute>
          </RequirePermission>
        ),
      },
      {
        path: "city/:state?/:city?",
        element: (
          <RequirePermission permission="city" fallbackPath="/dashboard">
            <LazyRoute>
              <MockTechParkDashboard />
            </LazyRoute>
          </RequirePermission>
        ),
      },
      {
        path: "company/:companyId",
        element: (
          <RequirePermission permission="techParks" fallbackPath="/dashboard">
            <LazyRoute>
              <CompanyDetailsPage />
            </LazyRoute>
          </RequirePermission>
        ),
      },
      {
        path: "coworking-company/:companyId",
        element: (
          <RequirePermission permission="coworkingSpaces" fallbackPath="/dashboard">
            <LazyRoute>
              <CoworkingCompanyDetailsPage />
            </LazyRoute>
          </RequirePermission>
        ),
      },
      {
        path: "recommendations",
        element: (
          <RequirePermission permission="analytics" fallbackPath="/dashboard">
            <LazyRoute>
              <MockTechParkDashboard />
            </LazyRoute>
          </RequirePermission>
        ),
      },
      {
        path: "client/:clientId",
        element: (
          <RequirePermission permission="analytics" fallbackPath="/dashboard">
            <LazyRoute>
              <ClientDetailsPage />
            </LazyRoute>
          </RequirePermission>
        ),
      },
      {
        path: "funding-news",
        element: (
          <RequirePermission permission="fundingNews" fallbackPath="/dashboard">
            <LazyRoute>
              <FundingNewsPage />
            </LazyRoute>
          </RequirePermission>
        ),
      },
      {
        path: "funding-news/:newsId/details",
        element: (
          <RequirePermission permission="fundingNews" fallbackPath="/dashboard">
            <LazyRoute>
              <FundingNewsDetailsPage />
            </LazyRoute>
          </RequirePermission>
        ),
      },
      {
        path: "users",
        element: (
          <RequirePermission permission="users" fallbackPath="/dashboard">
            <LazyRoute>
              <UsersPage />
            </LazyRoute>
          </RequirePermission>
        ),
      },

      {
        path: "permissions",
        element: (
          <RequirePermission permission="rbac" fallbackPath="/dashboard">
            <LazyRoute>
              <AccessControlPage />
            </LazyRoute>
          </RequirePermission>
        ),
      },
      {
        path: "departments",
        element: (
          <RequirePermission permission="rbac" fallbackPath="/dashboard">
            <LazyRoute>
              <DepartmentsPage />
            </LazyRoute>
          </RequirePermission>
        ),
      },
      {
        path: "roles",
        element: (
          <RequirePermission permission="rbac" fallbackPath="/dashboard">
            <LazyRoute>
              <RolesPage />
            </LazyRoute>
          </RequirePermission>
        ),
      },
      {
        path: "reports",
        element: (
          <RequirePermission permission="techParks" fallbackPath="/dashboard">
            <LazyRoute>
              <ReportsPage />
            </LazyRoute>
          </RequirePermission>
        ),
      },


      // Profile
      {
        path: "profile",
        element: (
          <LazyRoute>
            <ProfilePage />
          </LazyRoute>
        ),
      },

      // Coworking Spaces Routes
      {
        path: "coworking-spaces",
        element: (
          <RequirePermission permission="coworkingSpaces" fallbackPath="/dashboard">
            <LazyRoute>
              <CoworkingSpacesPage />
            </LazyRoute>
          </RequirePermission>
        ),
      },
      {
        path: "coworking-spaces/state/:state",
        element: (
          <RequirePermission permission="coworkingSpaces" fallbackPath="/dashboard">
            <LazyRoute>
              <CoworkingSpacesPage />
            </LazyRoute>
          </RequirePermission>
        ),
      },
      {
        path: "coworking-spaces/city/:state/:city",
        element: (
          <RequirePermission permission="coworkingSpaces" fallbackPath="/dashboard">
            <LazyRoute>
              <CoworkingSpacesPage />
            </LazyRoute>
          </RequirePermission>
        ),
      },
      {
        path: "coworking-spaces/:id",
        element: (
          <RequirePermission permission="coworkingSpaces" fallbackPath="/dashboard">
            <LazyRoute>
              <CoworkingSpaceDetailsPage />
            </LazyRoute>
          </RequirePermission>
        ),
      },
    ],
  },
] satisfies RouteObject[];
