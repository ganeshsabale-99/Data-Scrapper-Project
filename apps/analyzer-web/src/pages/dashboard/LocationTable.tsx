import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/search-input";
import {
  Globe,
  Phone,
  Clock,
  MapPin,
  Star,
  MoreVertical,
  Eye,
  Edit,
  Navigation,
  Trash,
  RefreshCw,
  CheckCircle2,
  XCircle,
  UserPlus,
  UserMinus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { statuses } from "@/const/contact-status";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AddressTooltip,
  WebsiteTooltip,
  PhoneTooltip,
  HoursTooltip,
} from "@/components/ui/smart-tooltip";

export type Location = {
  id: string;
  name: string;
  address: string;
  website: string;
  rating: number;
  total_ratings?: number;
  business_status: string;
  phone: string;
  map_url: string;
  lat?: number | null;
  lng?: number | null;
  opening_hours: string;
  status: string;
  isVerified?: boolean;
  reviewStatus?: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  submittedByUserId?: string | null;
  verificationLifecycleStatus?: "PENDING" | "IN_PROGRESS" | "READY_FOR_REVIEW" | "VERIFIED" | "REJECTED";
  isVerificationFormComplete?: boolean;
  hasVerificationProgress?: boolean;
  verifiedAt?: string | null;
  verifiedByName?: string | null;
  ownerId?: string | null;
  ownerName?: string | null;
  serialNumber?: number;
};

interface LocationTableProps {
  data: Location[];
  isLoading?: boolean;
  error?: string | null;
  onViewDetails?: (location: Location) => void;
  onDelete?: (location: Location) => void;
  onEdit?: (location: Location) => void;
  onChangeStatus?: (location: Location, newStatus: string) => void;
  onVerify?: (location: Location) => void;
  onUnverify?: (location: Location) => void;
  onAssign?: (location: Location) => void;
  onUnassign?: (location: Location) => void;
  currentUserId?: string | null;
  canApproveVerification?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canChangeStatus?: boolean;
  nameLabel?: string;
  locationLabel?: string;
  enableSearch?: boolean;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  isSearchLoading?: boolean;
}

const VALID_STATUSES = [
  "NOT_CONTACTED",
  "CONTACTED",
  "INTERESTED",
  "MEETING_SCHEDULED",
  "PROPOSAL_SENT",
  "IN_PROGRESS",
  "CLOSED",
] as const;

export const LocationTable: React.FC<LocationTableProps> = ({
  data,
  isLoading,
  error,
  onViewDetails,
  onDelete,
  onEdit,
  onChangeStatus,
  onVerify,
  onUnverify,
  onAssign,
  onUnassign,
  currentUserId,
  canApproveVerification = false,
  canEdit = true,
  canDelete = true,
  canChangeStatus = true,
  nameLabel = "Name",
  locationLabel = "Location",
  enableSearch = true,
  searchTerm: externalSearchTerm,
  onSearchChange,
  isSearchLoading = false,
}) => {
  const [internalSearchTerm, setInternalSearchTerm] = useState("");

  // Use external search term if provided, otherwise use internal state
  const searchTerm = externalSearchTerm !== undefined ? externalSearchTerm : internalSearchTerm;
  const setSearchTerm = onSearchChange || setInternalSearchTerm;

  // Filter data based on search term (only if search is enabled)
  const filteredData = useMemo(() => {
    if (!enableSearch || !searchTerm.trim() || externalSearchTerm !== undefined) return data;

    const term = searchTerm.toLowerCase();
    return data.filter((item) =>
      item.name.toLowerCase().includes(term) ||
      item.address.toLowerCase().includes(term) ||
      item.website?.toLowerCase().includes(term) ||
      item.phone?.toLowerCase().includes(term) ||
      item.status.toLowerCase().includes(term)
    );
  }, [data, searchTerm, enableSearch, externalSearchTerm]);

  const formatVerifiedDate = (value?: string | null) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleDateString();
  };

  type WorkflowStatus = "PENDING" | "IN_PROGRESS" | "READY_FOR_REVIEW" | "VERIFIED" | "REJECTED";
  const normalizeReviewStatus = (value?: string) => String(value || "").trim().toUpperCase();
  const normalizeLifecycleStatus = (value?: string) => String(value || "").trim().toUpperCase();

  const getWorkflowStatus = (park: Location): WorkflowStatus => {
    const explicit = normalizeLifecycleStatus(park.verificationLifecycleStatus);
    if (
      explicit === "PENDING" ||
      explicit === "IN_PROGRESS" ||
      explicit === "READY_FOR_REVIEW" ||
      explicit === "VERIFIED" ||
      explicit === "REJECTED"
    ) {
      return explicit as WorkflowStatus;
    }

    if (park.isVerified) return "VERIFIED";
    if (normalizeReviewStatus(park.reviewStatus) === "REJECTED") return "REJECTED";
    if (
      normalizeReviewStatus(park.reviewStatus) === "PENDING_REVIEW" &&
      Boolean(park.submittedByUserId || park.verifiedByName)
    ) {
      return "READY_FOR_REVIEW";
    }
    if (park.hasVerificationProgress) return "IN_PROGRESS";
    return "PENDING";
  };

  const getWorkflowBadgeClass = (status: WorkflowStatus) => {
    switch (status) {
      case "VERIFIED":
        return "bg-emerald-100 text-emerald-700 border border-emerald-200";
      case "READY_FOR_REVIEW":
        return "bg-blue-100 text-blue-700 border border-blue-200";
      case "IN_PROGRESS":
        return "bg-amber-100 text-amber-700 border border-amber-200";
      case "REJECTED":
        return "bg-red-100 text-red-700 border border-red-200";
      case "PENDING":
      default:
        return "bg-slate-100 text-slate-600 border border-slate-200";
    }
  };

  const getWorkflowBadgeLabel = (status: WorkflowStatus) => {
    switch (status) {
      case "READY_FOR_REVIEW":
        return "READY FOR REVIEW";
      case "IN_PROGRESS":
        return "IN PROGRESS";
      default:
        return status;
    }
  };

  const renderVerificationAction = (park: Location) => {
    if (typeof park.isVerified !== "boolean") return null;
    const workflowStatus = getWorkflowStatus(park);
    const isFormComplete =
      typeof park.isVerificationFormComplete === "boolean"
        ? park.isVerificationFormComplete
        : workflowStatus === "READY_FOR_REVIEW";

    if (park.isVerified) {
      if (!onUnverify) {
        return (
          <DropdownMenuItem disabled>
            <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-600" />
            Already Verified
          </DropdownMenuItem>
        );
      }
      return (
        <DropdownMenuItem onClick={() => onUnverify(park)}>
          <XCircle className="h-4 w-4 mr-2 text-amber-600" />
          Mark as Unverified
        </DropdownMenuItem>
      );
    }

    if (canApproveVerification) {
      if (workflowStatus === "READY_FOR_REVIEW") {
        return (
          <DropdownMenuItem onClick={() => onVerify?.(park)}>
            <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-600" />
            Verify
          </DropdownMenuItem>
        );
      }
      return (
        <DropdownMenuItem disabled>
          <CheckCircle2 className="h-4 w-4 mr-2 text-slate-400" />
          Awaiting Submission
        </DropdownMenuItem>
      );
    }

    if (workflowStatus === "READY_FOR_REVIEW") {
      return (
        <DropdownMenuItem disabled>
          <CheckCircle2 className="h-4 w-4 mr-2 text-blue-600" />
          Submitted for Review
        </DropdownMenuItem>
      );
    }

    if (isFormComplete) {
      return (
        <DropdownMenuItem onClick={() => onVerify?.(park)}>
          <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-600" />
          Submit for Review
        </DropdownMenuItem>
      );
    }

    return (
      <DropdownMenuItem disabled>
        <CheckCircle2 className="h-4 w-4 mr-2 text-amber-600" />
        {workflowStatus === "IN_PROGRESS" ? "In Progress" : "Pending"}
      </DropdownMenuItem>
    );
  };

  const renderAssignmentAction = (park: Location) => {
    if (!onAssign && !onUnassign) return null;

    if (park.ownerId && park.ownerId !== currentUserId) {
      return (
        <DropdownMenuItem disabled>
          <UserPlus className="h-4 w-4 mr-2 text-slate-400" />
          Assigned to {park.ownerName || "another user"}
        </DropdownMenuItem>
      );
    }

    if (park.ownerId) {
      return onUnassign ? (
        <DropdownMenuItem onClick={() => onUnassign(park)}>
          <UserMinus className="h-4 w-4 mr-2 text-amber-600" />
          Unassign from me
        </DropdownMenuItem>
      ) : null;
    }

    return onAssign ? (
      <DropdownMenuItem onClick={() => onAssign(park)}>
        <UserPlus className="h-4 w-4 mr-2 text-emerald-600" />
        Assign to me
      </DropdownMenuItem>
    ) : null;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to load data</h3>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button
                variant="outline"
                onClick={() => {
                  // Clear any stored city and reload
                  sessionStorage.removeItem('currentCity');
                  window.location.reload();
                }}
                className="mt-2"
              >
                Try Again
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <p className="text-muted-foreground">No locations found matching your filters.</p>
        </CardContent>
      </Card>
    );
  }

  if (filteredData.length === 0 && searchTerm) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <p className="text-muted-foreground">No locations found matching "{searchTerm}".</p>
          <Button
            variant="outline"
            onClick={() => setSearchTerm("")}
            className="mt-4"
          >
            Clear search
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Search Input */}
        {enableSearch && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <SearchInput
              placeholder={`Search ${nameLabel.toLowerCase()}s...`}
              value={searchTerm}
              onChange={setSearchTerm}
              className="w-full sm:max-w-md"
              isLoading={isSearchLoading}
            />
            {searchTerm && (
              <div className="text-sm text-muted-foreground text-center sm:text-right">
                {filteredData.length} of {data.length} results
              </div>
            )}
          </div>
        )}

        {/* Desktop Table */}
        <div className="hidden md:block">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-right p-4 font-medium w-12">#</th>
                      <th className="text-left p-4 font-medium">{nameLabel}</th>
                      <th className="text-left p-4 font-medium">{locationLabel}</th>
                      <th className="text-left p-4 font-medium">Contact</th>
                      <th className="text-left p-4 font-medium">Status</th>
                      <th className="text-left p-4 font-medium">Rating</th>
                      <th className="text-left p-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((park, index) => (
                      <motion.tr
                        key={park.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="border-b hover:bg-muted/30 group"
                      >
                        <td className="p-4 text-right text-muted-foreground">{park.serialNumber || index + 1}</td>
                        {/* Name & Website */}
                        <td className="p-4">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="font-medium">{park.name}</div>
                              {typeof park.isVerified === "boolean" ? (
                                <Badge className={getWorkflowBadgeClass(getWorkflowStatus(park))}>
                                  {getWorkflowBadgeLabel(getWorkflowStatus(park))}
                                </Badge>
                              ) : null}
                            </div>
                            {park.isVerified && (park.verifiedByName || park.verifiedAt) ? (
                              <div className="text-xs text-emerald-700 mt-1">
                                Verified
                                {park.verifiedByName ? ` by ${park.verifiedByName}` : ""}
                                {formatVerifiedDate(park.verifiedAt)
                                  ? ` on ${formatVerifiedDate(park.verifiedAt)}`
                                  : ""}
                              </div>
                            ) : null}
                            {(onAssign || onUnassign) && park.ownerName ? (
                              <div className="text-xs text-blue-700 mt-1">
                                Assigned to {park.ownerName}
                              </div>
                            ) : null}
                            <div className="flex items-center mt-1 text-sm text-muted-foreground">
                              <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-gradient-to-tr from-blue-500 via-cyan-400 to-green-400 shadow-md mr-2">
                                <Globe className="h-3 w-3 text-white" />
                              </span>
                              {park.website ? (
                                <WebsiteTooltip content={park.website}>
                                  <a
                                    href={park.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:underline text-blue-700 font-semibold truncate block max-w-[200px]"
                                  >
                                    {park.website.replace(/^https?:\/\//, "")}
                                  </a>
                                </WebsiteTooltip>
                              ) : (
                                <span className="italic text-gray-400">No website</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Address */}
                        <td className="p-4">
                          <div className="flex items-start">
                            <MapPin className="h-4 w-4 mt-1 mr-2 text-muted flex-shrink-0" />
                            {park.address ? (
                              <AddressTooltip content={park.address}>
                                <div className="text-sm text-muted-foreground leading-snug max-w-[200px] truncate">
                                  {park.address}
                                </div>
                              </AddressTooltip>
                            ) : (
                              <span className="italic text-gray-400 text-sm">Unknown</span>
                            )}
                          </div>
                        </td>

                        {/* Contact + Hours */}
                        <td className="p-4">
                          <div className="space-y-2">
                            <div className="flex items-center">
                              <Phone className="h-4 w-4 mr-2 text-muted flex-shrink-0" />
                              <PhoneTooltip content={park.phone}>
                                <span className="text-sm text-muted-foreground truncate block max-w-[150px]">
                                  {park.phone}
                                </span>
                              </PhoneTooltip>
                            </div>
                            <div className="flex items-center">
                              <Clock className="h-4 w-4 mr-2 text-muted flex-shrink-0" />
                              <HoursTooltip content={park.opening_hours}>
                                <span className="text-sm text-muted-foreground truncate block max-w-[150px]">
                                  {park.opening_hours}
                                </span>
                              </HoursTooltip>
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Badge
                              className={`${statuses[park.status as keyof typeof statuses]} capitalize`}
                            >
                              {park.status.toLowerCase()}
                            </Badge>
                          </div>
                        </td>

                        {/* Rating */}
                        <td className="p-4">
                          <div className="flex flex-col">
                            {park.rating ? (
                              <div className="flex items-center">
                                <Star className="h-4 w-4 text-yellow-400 fill-yellow-400 mr-2" />
                                <span className="font-medium">{park.rating}</span>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">Not Available</span>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="p-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            {(() => {
                              const hasUrl = Boolean(park.map_url?.trim());
                              const hasCoords = park.lat != null && park.lng != null && !isNaN(Number(park.lat)) && !isNaN(Number(park.lng));
                              const canMap = hasUrl || hasCoords;
                              const mapHref = hasUrl ? park.map_url : (hasCoords ? `https://www.google.com/maps/search/?api=1&query=${park.lat},${park.lng}` : undefined);

                              return (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className={`h-8 px-2 transition-colors ${canMap
                                        ? 'text-muted-foreground hover:text-blue-600 hover:bg-blue-50'
                                        : 'text-gray-400 cursor-not-allowed opacity-50'
                                        }`}
                                      disabled={!canMap}
                                      asChild={canMap}
                                    >
                                      {canMap ? (
                                        <a
                                          href={mapHref}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-1"
                                        >
                                          <Navigation className="h-3 w-3" />
                                          <span className="text-xs font-medium">Map</span>
                                        </a>
                                      ) : (
                                        <div className="flex items-center gap-1">
                                          <Navigation className="h-3 w-3" />
                                          <span className="text-xs font-medium">Map</span>
                                        </div>
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    <div className="flex items-center gap-2">
                                      <MapPin className="h-4 w-4" />
                                      <span>
                                        {canMap ? 'View on Google Maps' : 'Location not available'}
                                      </span>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })()}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => {
                                  onViewDetails?.(park);
                                }}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                {canEdit && onEdit ? (
                                  <DropdownMenuItem onClick={() => {
                                    onEdit(park);
                                  }}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                ) : null}
                                {renderVerificationAction(park)}
                                {renderAssignmentAction(park)}
                                {canChangeStatus && onChangeStatus ? (
                                  <DropdownMenuSub>
                                    <DropdownMenuSubTrigger className="flex items-center">
                                      <RefreshCw className="h-4 w-4 mr-2" />
                                      Change Status
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent>
                                      {VALID_STATUSES.map((s) => (
                                        <DropdownMenuItem key={s} onClick={() => {
                                          onChangeStatus(park, s);
                                        }}>
                                          {s.replace(/_/g, ' ').toLowerCase()}
                                        </DropdownMenuItem>
                                      ))}
                                    </DropdownMenuSubContent>
                                  </DropdownMenuSub>
                                ) : null}
                                {canDelete && onDelete ? (
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => {
                                      onDelete(park);
                                    }}
                                  >
                                    <Trash className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                ) : null}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-4">
          {filteredData.map((park, index) => (
            <motion.div
              key={park.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card
                className="hover:shadow-md transition-shadow"
              >
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold break-words">{park.name}</h3>
                        {typeof park.isVerified === "boolean" ? (
                          <Badge className={getWorkflowBadgeClass(getWorkflowStatus(park))}>
                            {getWorkflowBadgeLabel(getWorkflowStatus(park))}
                          </Badge>
                        ) : null}
                      </div>
                      {park.isVerified && (park.verifiedByName || park.verifiedAt) ? (
                        <div className="text-xs text-emerald-700 mt-1">
                          Verified
                          {park.verifiedByName ? ` by ${park.verifiedByName}` : ""}
                          {formatVerifiedDate(park.verifiedAt)
                            ? ` on ${formatVerifiedDate(park.verifiedAt)}`
                            : ""}
                        </div>
                      ) : null}
                      {(onAssign || onUnassign) && park.ownerName ? (
                        <div className="text-xs text-blue-700 mt-1">
                          Assigned to {park.ownerName}
                        </div>
                      ) : null}
                      <div className="flex items-start mt-1 text-sm text-muted-foreground">
                        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-gradient-to-tr from-blue-500 via-cyan-400 to-green-400 shadow-md mr-2 flex-shrink-0 mt-0.5">
                          <Globe className="h-3 w-3 text-white" />
                        </span>
                        <div className="min-w-0 flex-1">
                          {park.website ? (
                            <WebsiteTooltip content={park.website}>
                              <a
                                href={park.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline text-blue-700 font-semibold break-words block"
                              >
                                {park.website.replace(/^https?:\/\//, "")}
                              </a>
                            </WebsiteTooltip>
                          ) : (
                            <span className="italic text-gray-400">No website</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0 justify-end" onClick={(e) => e.stopPropagation()}>
                      {(() => {
                        const hasUrl = Boolean(park.map_url?.trim());
                        const hasCoords = park.lat != null && park.lng != null && !isNaN(Number(park.lat)) && !isNaN(Number(park.lng));
                        const canMap = hasUrl || hasCoords;
                        const mapHref = hasUrl ? park.map_url : (hasCoords ? `https://www.google.com/maps/search/?api=1&query=${park.lat},${park.lng}` : undefined);

                        return (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-8 px-2 transition-colors flex-shrink-0 ${canMap
                                  ? 'text-muted-foreground hover:text-blue-600 hover:bg-blue-50'
                                  : 'text-gray-400 cursor-not-allowed opacity-50'
                                  }`}
                                disabled={!canMap}
                                asChild={canMap}
                              >
                                {canMap ? (
                                  <a
                                    href={mapHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1"
                                  >
                                    <Navigation className="h-3 w-3" />
                                    <span className="text-xs font-medium">Map</span>
                                  </a>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <Navigation className="h-3 w-3" />
                                    <span className="text-xs font-medium">Map</span>
                                  </div>
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4" />
                                <span>
                                  {canMap ? 'View on Google Maps' : 'Location not available'}
                                </span>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })()}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground flex-shrink-0"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            onViewDetails?.(park);
                          }}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          {canEdit && onEdit ? (
                            <DropdownMenuItem onClick={() => {
                              onEdit(park);
                            }}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                          ) : null}
                          {renderVerificationAction(park)}
                                {renderAssignmentAction(park)}
                          {canChangeStatus && onChangeStatus ? (
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger className="flex items-center">
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Change Status
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                {VALID_STATUSES.map((s) => (
                                  <DropdownMenuItem key={s} onClick={() => {
                                    onChangeStatus(park, s);
                                  }}>
                                    {s.replace(/_/g, ' ').toLowerCase()}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                          ) : null}
                          {canDelete && onDelete ? (
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => {
                                onDelete(park);
                              }}
                            >
                              <Trash className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-start">
                      <MapPin className="h-4 w-4 mt-1 mr-2 text-muted flex-shrink-0" />
                      {park.address ? (
                        <AddressTooltip content={park.address}>
                          <div className="text-sm text-muted-foreground leading-snug flex-1 break-words">
                            {park.address}
                          </div>
                        </AddressTooltip>
                      ) : (
                        <span className="italic text-gray-400 text-sm">Unknown address</span>
                      )}
                    </div>
                    <div className="flex items-center">
                      <Phone className="h-4 w-4 mr-2 text-muted flex-shrink-0" />
                      <PhoneTooltip content={park.phone}>
                        <span className="text-sm text-muted-foreground break-words flex-1">
                          {park.phone}
                        </span>
                      </PhoneTooltip>
                    </div>
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-2 text-muted flex-shrink-0" />
                      <HoursTooltip content={park.opening_hours}>
                        <span className="text-sm text-muted-foreground break-words flex-1">
                          {park.opening_hours}
                        </span>
                      </HoursTooltip>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Status:</span>
                      <Badge
                        className={`${statuses[park.status as keyof typeof statuses]} capitalize`}
                      >
                        {park.status.toLowerCase()}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Rating:</span>
                      <div className="flex flex-col items-end">
                        {park.rating ? (
                          <div className="flex items-center">
                            <Star className="h-4 w-4 text-yellow-400 fill-yellow-400 mr-1" />
                            <span className="font-medium">{park.rating}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Not Available</span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
};
