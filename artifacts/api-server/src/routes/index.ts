import { Router, type IRouter } from "express";
import healthRouter from "./health";
import schoolsRouter from "./schools";
import profilesRouter from "./profiles";
import booksRouter from "./books";
import studentsRouter from "./students";
import issuesRouter from "./issues";
import dashboardRouter from "./dashboard";
import authRouter from "./auth";
import subscriptionsRouter from "./subscriptions";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(schoolsRouter);
router.use(profilesRouter);
router.use(booksRouter);
router.use(studentsRouter);
router.use(issuesRouter);
router.use(dashboardRouter);
router.use(subscriptionsRouter);

export default router;
