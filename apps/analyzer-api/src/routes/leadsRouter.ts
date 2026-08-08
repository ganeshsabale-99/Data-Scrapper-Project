import { Router } from "express";
import { createLead } from "../controller/leadController";

export const leadsRouter: Router = Router();

leadsRouter.post("/", createLead);
