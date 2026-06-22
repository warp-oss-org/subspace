import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite-plus"

type PackageJson = {
  name: string
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

const workspaceRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

const entriesByPackage: Record<string, Record<string, string>> = {
  "@subspace-kit/cache": { index: "src/index.ts", redis: "src/redis.ts" },
  "@subspace-kit/config": { index: "src/index.ts", dotenv: "src/dotenv.ts" },
  "@subspace-kit/email": {
    index: "src/index.ts",
    postmark: "src/postmark.ts",
    sendgrid: "src/sendgrid.ts",
    ses: "src/ses.ts",
    smtp: "src/smtp.ts",
  },
  "@subspace-kit/kv": { index: "src/index.ts", redis: "src/redis.ts" },
  "@subspace-kit/lock": {
    index: "src/index.ts",
    postgres: "src/postgres.ts",
    redis: "src/redis.ts",
  },
  "@subspace-kit/logger": { index: "src/index.ts", pino: "src/pino.ts" },
  "@subspace-kit/secrets": {
    index: "src/index.ts",
    "aws-secrets-manager": "src/aws-secrets-manager.ts",
    "aws-ssm": "src/aws-ssm.ts",
    gcp: "src/gcp.ts",
  },
  "@subspace-kit/storage": {
    index: "src/index.ts",
    s3: "src/s3.ts",
    gcs: "src/gcs.ts",
    "testing/s3": "src/testing/s3.ts",
  },
}

const readPackageJson = () =>
  JSON.parse(
    readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
  ) as PackageJson

const test = {
  environment: "node",
  globals: true,
  passWithNoTests: true,
  clearMocks: true,
  restoreMocks: true,
  mockReset: true,
  exclude: ["**/dist/**", "**/node_modules/**"],
  setupFiles: [path.join(workspaceRoot, "packages/server/vitest.setup.ts")],
  coverage: {
    enabled: true,
    provider: "v8",
    reporter: ["text", "html", "lcov"],
    include: ["src/**/*.{ts,tsx}"],
    exclude: [
      "**/*tests*/**",
      "**/*.test.*",
      "**/*.spec.*",
      "**/dist/**",
      "**/node_modules/**",
    ],
  },
} as const

export const defineSubspaceTestConfig = () =>
  defineConfig({
    test,
  })

export const defineSubspacePackageConfig = () => {
  const packageJson = readPackageJson()
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.peerDependencies,
  }

  return defineConfig({
    test,
    pack: {
      entry: entriesByPackage[packageJson.name] ?? { index: "src/index.ts" },
      format: ["esm"],
      platform: "node",
      target: "node22",
      outDir: "dist",
      outExtensions: () => ({
        dts: ".d.ts",
        js: ".js",
      }),
      clean: true,
      unbundle: false,
      splitting: true,
      treeshake: true,
      sourcemap: true,
      dts: { compilerOptions: { composite: false } },
      deps: {
        neverBundle: Object.keys(dependencies),
        skipNodeModulesBundle: true,
      },
    },
  })
}
