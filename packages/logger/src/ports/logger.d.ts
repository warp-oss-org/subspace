import type { LogContext, LogMeta } from "./log-context";
export interface Logger<TContext extends LogContext = LogContext> {
    trace(message: string, meta?: LogMeta<TContext>): void;
    debug(message: string, meta?: LogMeta<TContext>): void;
    info(message: string, meta?: LogMeta<TContext>): void;
    warn(message: string, meta?: LogMeta<TContext>): void;
    error(message: string, meta?: LogMeta<TContext>): void;
    fatal(message: string, meta?: LogMeta<TContext>): void;
    /**
     * Creates a child logger that inherits the parent context and adds
     * additional contextual fields.
     *
     * The provided context is merged into the existing context and is
     * included in all subsequent log entries emitted by the child.
     *
     * This is intended for scoping logs to a request, operation, or
     * execution context (e.g. requestId, userId, tenantId).
     */
    child<U extends Partial<LogContext> & Record<string, unknown>>(context: U): Logger<TContext & U>;
}
//# sourceMappingURL=logger.d.ts.map