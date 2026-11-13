import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import type { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { publicDemoWriteGuard, validateDeploymentEnvironment } from "./common/deployment";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { cors: false });
  validateDeploymentEnvironment(process.env);
  app.enableShutdownHooks();
  const proxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
  if (proxyHops) app.getHttpAdapter().getInstance().set("trust proxy", proxyHops);
  const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
  const apiOrigin =
    process.env.API_ORIGIN ?? (process.env.NODE_ENV === "production" ? webOrigin : `http://localhost:${process.env.API_PORT ?? "4000"}`);
  const allowedMutationOrigins = new Set([webOrigin, apiOrigin]);
  app.use(helmet());
  app.use(cookieParser());
  app.use(publicDemoWriteGuard);
  app.enableCors({ origin: webOrigin, credentials: true, methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"] });
  app.use((request: Request, response: Response, next: NextFunction) => {
    if (["POST", "PATCH", "DELETE"].includes(request.method)) {
      const origin = request.headers.origin;
      if (origin && !allowedMutationOrigins.has(origin)) {
        response.status(403).json({ statusCode: 403, message: "Origin is not allowed" });
        return;
      }
    }
    next();
  });
  app.setGlobalPrefix("api");

  const openApi = new DocumentBuilder()
    .setTitle("BusinessOS API")
    .setDescription("Tenant-scoped ERP API. Demo invoices are not tax or legal documents.")
    .setVersion("0.1.0")
    .addCookieAuth("businessos_session")
    .build();
  const document = SwaggerModule.createDocument(app, openApi);
  SwaggerModule.setup("api/docs", app, document, { jsonDocumentUrl: "api/openapi.json" });

  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
  await app.listen(port, process.env.API_HOST ?? "0.0.0.0");
  console.log(`BusinessOS API listening on http://localhost:${port}/api`);
}

void bootstrap();
