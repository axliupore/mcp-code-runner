import { z } from "zod";

export const Language = z.enum(["go", "python", "java", "c", "cpp", "javascript", "typescript"])
export type Language = z.infer<typeof Language>;

export const DEFAULT_IMAGES: Record<Language, string> = {
    go: "golang:1.22",
    python: "python:3.12-slim",
    java: "eclipse-temurin:17-jdk",
    c: "gcc:12",
    cpp: "gcc:12",
    javascript: "node:20-alpine",
    typescript: "node:20-alpine"
  };