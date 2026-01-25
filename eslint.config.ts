import boundaries from "eslint-plugin-boundaries"
import unicorn from "eslint-plugin-unicorn"
import tseslint from "typescript-eslint"

export default [
  {
    ignores: ["**/dist/**", "**/build/**", "**/coverage/**", "**/node_modules/**"],
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      unicorn,
      boundaries,
    },
    // settings: {
    //   "boundaries/elements": [
    //     { type: "domain", pattern: "src/domains/*" },
    //     { type: "app", pattern: "src/app/*" },
    //     { type: "lib", pattern: "src/lib/*" },
    //     { type: "infra", pattern: "src/infra/*" },
    //   ],
    //   "boundaries/include": ["src/**/*.ts"],
    // },
    rules: {
      "unicorn/filename-case": ["error", { case: "kebabCase" }],
      "unicorn/no-null": "off",
      "unicorn/prefer-module": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/consistent-type-assertions": "off",

      // "boundaries/element-types": [
      //   "error",
      //   {
      //     default: "disallow",
      //     rules: [
      //       { from: "app", allow: ["domain", "lib", "app", "infra"] },
      //       { from: "domain", allow: ["lib", "domain"] },
      //       { from: "infra", allow: ["lib", "infra"] },
      //       { from: "lib", allow: ["lib"] },
      //     ],
      //   },
      // ],
      // "boundaries/entry-point": [
      //   "error",
      //   {
      //     default: "disallow",
      //     rules: [
      //       { target: "domain", allow: "index.ts" },
      //       { target: "lib", allow: "**" },
      //       { target: "app", allow: "**" },
      //       { target: "infra", allow: "**" },
      //     ],
      //   },
      // ],
    },
  },
]
