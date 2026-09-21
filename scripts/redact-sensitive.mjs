const urlPattern = /https?:\/\/[^\s"'<>]+/gi
const bearerPattern = /Bearer\s+[A-Za-z0-9._~-]+/gi
const secretAssignmentPattern = /\b([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|ACCESS_KEY)[A-Z0-9_]*)\s*[=:]\s*[^\s,;]+/gi

export function redactSensitiveText(value) {
  return String(value ?? '')
    .replace(urlPattern, '[redacted-url]')
    .replace(bearerPattern, 'Bearer [redacted]')
    .replace(secretAssignmentPattern, '$1=[redacted]')
}

export function safeErrorMessage(error, fallback = 'operation failed') {
  const message = error instanceof Error ? error.message : error
  return redactSensitiveText(message || fallback)
}
