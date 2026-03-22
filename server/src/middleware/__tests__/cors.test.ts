import { afterEach, describe, expect, it, vi } from "vitest";
import { getAllowedBrowserOrigins, isDevLanCompanionOrigin } from "../cors.js";

describe("isDevLanCompanionOrigin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows private IPv4 on same port as APP_URL in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_URL", "http://localhost:5173");
    vi.stubEnv("DEV_CLIENT_PORT", "");
    expect(isDevLanCompanionOrigin("http://172.26.32.84:5173")).toBe(true);
  });

  it("rejects the same origin in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "http://localhost:5173");
    expect(isDevLanCompanionOrigin("http://172.26.32.84:5173")).toBe(false);
  });

  it("rejects public IPs in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_URL", "http://localhost:5173");
    expect(isDevLanCompanionOrigin("http://203.0.113.1:5173")).toBe(false);
  });

  it("uses DEV_CLIENT_PORT when set", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_URL", "http://localhost:5173");
    vi.stubEnv("DEV_CLIENT_PORT", "5180");
    expect(isDevLanCompanionOrigin("http://172.26.32.84:5180")).toBe(true);
    expect(isDevLanCompanionOrigin("http://172.26.32.84:5173")).toBe(false);
  });
});

describe("getAllowedBrowserOrigins", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns empty set when neither APP_URL nor CORS_ALLOWED_ORIGINS is set", () => {
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("CORS_ALLOWED_ORIGINS", "");
    expect(getAllowedBrowserOrigins().size).toBe(0);
  });

  it("adds origin from APP_URL", () => {
    vi.stubEnv("APP_URL", "http://localhost:5173");
    vi.stubEnv("CORS_ALLOWED_ORIGINS", "");
    expect(getAllowedBrowserOrigins()).toEqual(new Set(["http://localhost:5173"]));
  });

  it("strips path from APP_URL", () => {
    vi.stubEnv("APP_URL", "http://localhost:5173/app/");
    vi.stubEnv("CORS_ALLOWED_ORIGINS", "");
    expect(getAllowedBrowserOrigins()).toEqual(new Set(["http://localhost:5173"]));
  });

  it("merges comma-separated CORS_ALLOWED_ORIGINS", () => {
    vi.stubEnv("APP_URL", "http://localhost:5173");
    vi.stubEnv(
      "CORS_ALLOWED_ORIGINS",
      "http://172.26.32.84:5173, http://127.0.0.1:5173",
    );
    expect(getAllowedBrowserOrigins()).toEqual(
      new Set([
        "http://localhost:5173",
        "http://172.26.32.84:5173",
        "http://127.0.0.1:5173",
      ]),
    );
  });

  it("allows CORS_ALLOWED_ORIGINS without APP_URL", () => {
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("CORS_ALLOWED_ORIGINS", "http://10.0.0.5:5180");
    expect(getAllowedBrowserOrigins()).toEqual(new Set(["http://10.0.0.5:5180"]));
  });
});
