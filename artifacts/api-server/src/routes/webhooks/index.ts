import { Router, type IRouter } from "express";
import sallaWebhookRouter from "./salla";
import manusWebhookRouter from "./manus";

const router: IRouter = Router();

router.use(sallaWebhookRouter);
router.use(manusWebhookRouter);

export default router;
