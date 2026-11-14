import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/dist/**", "**/.supabase/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      // Rule 8: no direct provider SDK calls outside packages/llm and packages/connectors.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "@anthropic-ai/sdk", message: "Use packages/llm (budget gateway)." },
            { name: "openai", message: "Use packages/llm (budget gateway)." },
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.test.ts", "**/testutil.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
  {
    files: ["packages/llm/**", "packages/connectors/**"],
    rules: { "no-restricted-imports": "off" },
  },
);
