import 'server-only'

export class AppError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
    this.name = 'AppError'
  }
}

export class UnauthorizedError extends AppError {
  constructor(msg = 'გთხოვთ გაიაროთ ავტორიზაცია') {
    super(msg, 401)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends AppError {
  constructor(msg = 'წვდომა შეზღუდულია') {
    super(msg, 403)
    this.name = 'ForbiddenError'
  }
}

export class NotFoundError extends AppError {
  constructor(msg = 'ვერ მოიძებნა') {
    super(msg, 404)
    this.name = 'NotFoundError'
  }
}

export class ValidationError extends AppError {
  constructor(msg = 'არასწორი მონაცემები') {
    super(msg, 422)
    this.name = 'ValidationError'
  }
}
