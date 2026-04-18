import { Router, type IRouter } from "express";
import sallaWebhookRouter from "./salla";

const router: IRouter = Router();

router.use(sallaWebhookRouter);

export default router;
