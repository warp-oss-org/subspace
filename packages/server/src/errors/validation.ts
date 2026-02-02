import { BaseError, type ErrorContext } from "@subspace/errors"

type ZodMiniIssue = {
  path: unknown[]
  message: string
}

type ZodMiniError = {
  issues: ZodMiniIssue[]
}

export type ValidationIssue = { path: string; message: string }
export type ValidationErrorContext = ErrorContext & {
  issues: ValidationIssue[]
}

function formatPath(path: unknown[]): string {
  let out = ""
  for (const part of path) {
    if (typeof part === "number") out += `[${part}]`
    else out += out ? `.${String(part)}` : String(part)
  }
  return out
}

export class ValidationError extends BaseError<"validation_error"> {
  static fromZodError(err: ZodMiniError): ValidationError {
    const issues = err.issues.map((i) => ({
      path: formatPath(i.path),
      message: i.message,
    }))

    const message = issues[0]?.message ?? "Invalid input"

    return new ValidationError(message, {
      code: "validation_error",
      context: { issues },
    })
  }
}

function isZodMiniError(err: unknown): err is ZodMiniError {
  if (!err || typeof err !== "object") return false

  const issues = (err as { issues?: unknown }).issues
  if (!Array.isArray(issues)) return false

  return issues.every((i) => {
    if (!i || typeof i !== "object") return false
    const rec = i as { path?: unknown; message?: unknown }
    return Array.isArray(rec.path) && typeof rec.message === "string"
  })
}

export function parseOrThrow<T>(
  schema: { parse: (data: unknown) => T },
  data: unknown,
): T {
  try {
    return schema.parse(data)
  } catch (err) {
    if (isZodMiniError(err)) {
      throw ValidationError.fromZodError(err)
    }
    throw err
  }
}

export function isValidationError(
  err: unknown,
): err is ValidationError & { context: { issues: unknown[] } } {
  return (
    err instanceof ValidationError &&
    err.code === "validation_error" &&
    Array.isArray(err.context.issues)
  )
}
