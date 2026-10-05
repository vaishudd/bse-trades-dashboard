// Errors we throw on purpose; the message is safe to show to the client.
class AppError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
  }
}
module.exports = { AppError };
