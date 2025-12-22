import unicorn from "eslint-plugin-unicorn"
import tseslint from "typescript-eslint"

export default [
  {
    ignores: ["coverage/**"],
  },
  ...tseslint.configs.recommended,
  {
    files: [
      "packages/**/src/**/*.{ts,tsx,js,jsx}",
      "examples/**/src/**/*.{ts,tsx,js,jsx}",
    ],
    plugins: { unicorn },
    rules: {
      "unicorn/filename-case": ["error", { case: "kebabCase" }],
    },
  },
]
