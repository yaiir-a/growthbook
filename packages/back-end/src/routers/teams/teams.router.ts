import express from "express";
import z from "zod";
import { wrapController } from "../wrapController";
import { validateRequestMiddleware } from "../utils/validateRequestMiddleware";
import * as rawTeamController from "./teams.controller";

const router = express.Router();

const teamController = wrapController(rawTeamController);

const PermissionZodObject = z.object({
  role: z.string(),
  limitAccessByEnvironment: z.boolean(),
  environments: z.string().array(),
});

router.get("/:id", teamController.getTeamById);

router.get("/", teamController.getTeams);

router.post(
  "/",
  validateRequestMiddleware({
    body: z
      .object({
        name: z.string(),
        description: z.string(),
        permissions: PermissionZodObject.extend({
          projectRoles: PermissionZodObject.extend({
            project: z.string(),
          }).array(),
        }),
      })
      .strict(),
  }),
  teamController.postTeam
);

router.put(
  "/:id",
  validateRequestMiddleware({
    body: z
      .object({
        name: z.string(),
        description: z.string(),
        permissions: PermissionZodObject.extend({
          projectRoles: PermissionZodObject.extend({
            project: z.string(),
          }).array(),
        }),
        members: z.string().array().optional(),
      })
      .strict(),
  }),
  teamController.updateTeam
);

router.delete("/:id", teamController.deleteTeamById);

export { router as teamRouter };
