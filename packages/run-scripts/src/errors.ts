export class CliExitError extends Error {
  constructor(
    message: string,
    readonly exitCode: number,
    readonly silent = false,
  ) {
    super(message);
    this.name = "CliExitError";
  }
}
