import unicorn from "eslint-plugin-unicorn"
import tseslint from "typescript-eslint"

export default [
  {
    ignores: ["**/dist/**", "**/build/**", "**/coverage/**", "**/node_modules/**"],
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: { unicorn },
    rules: {
      "unicorn/filename-case": ["error", { case: "kebabCase" }],
      "unicorn/no-null": "off",
      "unicorn/prefer-module": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/consistent-type-assertions": "off",
    },
  },
]
