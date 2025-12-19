import unicorn from "eslint-plugin-unicorn"

export default [
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
