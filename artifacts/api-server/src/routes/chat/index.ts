import { Router, type IRouter } from "express";
import salesChatRouter from "./salesChat";

const router: IRouter = Router();

router.use(salesChatRouter);

export default router;
