export class CommandError extends Error {}

export function sleep(ms: number) {
  return new Promise((resolve) => {
    return setTimeout(resolve, ms)
  })
}
