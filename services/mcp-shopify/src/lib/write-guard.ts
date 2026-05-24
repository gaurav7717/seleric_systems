export function assertWriteEnabled(): void {
  if (process.env.WRITE_ENABLED !== "true") {
    throw new Error("Write operations disabled. Set WRITE_ENABLED=true to enable.")
  }
}
