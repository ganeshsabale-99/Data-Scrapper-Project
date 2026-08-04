import { prismaInstance } from "@repo/db";
import { createVenueController } from "./venueControllerFactory";

const ctrl = createVenueController(prismaInstance.airport, "Airport", "airport");

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
