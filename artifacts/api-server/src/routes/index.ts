import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import webhooksRouter from "./webhooks";
import onboardingRouter from "./onboarding";
import adAccountsRouter from "./adAccounts";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(webhooksRouter);
router.use(onboardingRouter);
router.use(adAccountsRouter);
router.use(dashboardRouter);

export default router;
