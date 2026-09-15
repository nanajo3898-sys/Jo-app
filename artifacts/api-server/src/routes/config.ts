import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/config", (_req, res): void => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    res.status(503).json({ error: "Supabase configuration is unavailable" });
    return;
  }

  res.json({
    supabaseUrl,
    supabaseAnonKey,
  });
});

export default router;