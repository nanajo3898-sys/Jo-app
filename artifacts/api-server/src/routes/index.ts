import { Router, type IRouter } from "express";
import configRouter from "./config";
import healthRouter from "./health";
import adminRouter from "./admin";
import supabaseRouter from "./supabase";

const router: IRouter = Router();

router.use(healthRouter);
router.use(configRouter);
router.use("/supabase", supabaseRouter);
router.use(adminRouter);
export default router;
