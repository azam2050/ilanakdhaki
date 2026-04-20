import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import webhooksRouter from "./webhooks";
import onboardingRouter from "./onboarding";
import adAccountsRouter from "./adAccounts";
import dashboardRouter from "./dashboard";
import debugRouter from "./debug";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(webhooksRouter);
router.use(onboardingRouter);
router.use(adAccountsRouter);
router.use(dashboardRouter);
router.use(debugRouter);
router.use(adminRouter);

export default router;
