import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

export const tokenSchema = z.string().uuid();

export const COTACAO_MAX_ATTEMPTS = 5;
export const COTACAO_WINDOW_MINUTES = 60;

export function extractClientInfo() {
  const request = getRequest();
  const headers = request.headers;
  const fwd = headers.get("x-forwarded-for") ?? "";
  const ip =
    headers.get("cf-connecting-ip") ||
    fwd.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    null;
  const ua = headers.get("user-agent")?.slice(0, 300) ?? null;
  return { ip, ua };
}
