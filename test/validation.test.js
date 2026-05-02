import test from "node:test";
import assert from "node:assert/strict";
import { validateFile, isValidTool, getToolConfig } from "../src/services/validation.service.js";

test("accepts a valid PDF to Word file", () => {
  assert.equal(isValidTool("pdf-to-word"), true);
  const file = {
    originalname: "example.pdf",
    size: 1024 * 1024,
    path: "/tmp/example.pdf"
  };

  const errors = validateFile(file, "pdf-to-word");
  assert.equal(errors.length, 0);
  assert.equal(getToolConfig("pdf-to-word").outputFormat, ".docx");
});

test("rejects a wrong file type", () => {
  const file = {
    originalname: "example.txt",
    size: 1024,
    path: "/tmp/example.txt"
  };

  const errors = validateFile(file, "pdf-to-word");
  assert.ok(errors.some((message) => message.includes("Invalid file type")));
});