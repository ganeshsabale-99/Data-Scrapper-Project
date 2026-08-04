import { prismaInstance } from "@repo/db";
import { createVenueController } from "./venueControllerFactory";

const ctrl = createVenueController(prismaInstance.mall, "Mall", "mall");

export const {
  getOverviewData,
  getStateWiseOverview,
  getCityWiseOverview,
  getVenueById,
  addVenue,
  updateVenue,
  deleteVenue,
  changeStatus,
  verifyVenue,
  unverifyVenue,
} = ctrl;
