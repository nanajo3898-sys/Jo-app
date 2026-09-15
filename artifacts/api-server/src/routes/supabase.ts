import { Router, type IRouter } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";

const router: IRouter = Router();
const connectors = new ReplitConnectors();

router.use(async (req, res): Promise<void> => {
  try {
    const headers: Record<string, string> = {};
    const contentType = req.get("content-type");
    const authorization = req.get("authorization");

    if (contentType) headers["Content-Type"] = contentType;
    if (authorization) headers.Authorization = authorization;

    const body =
      req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS"
        ? undefined
        : JSON.stringify(req.body ?? {});

    const response = await connectors.proxy("supabase", req.url, {
      method: req.method,
      headers,
      body,
    });

    const responseContentType = response.headers.get("content-type");
    if (responseContentType) res.setHeader("content-type", responseContentType);

    const contentRange = response.headers.get("content-range");
    if (contentRange) res.setHeader("content-range", contentRange);

    res.status(response.status).send(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    req.log.error({ err: error }, "Supabase proxy request failed");
    res.status(502).json({ error: "تعذر الاتصال بقاعدة البيانات حالياً" });
  }
});

export default router;