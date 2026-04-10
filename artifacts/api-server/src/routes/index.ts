import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sessionsRouter from "./sessions";
import notifyRouter from "./notify";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sessionsRouter);
router.use(notifyRouter);

export default router;
