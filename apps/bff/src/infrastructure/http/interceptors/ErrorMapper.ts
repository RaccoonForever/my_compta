import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

type Reply = { status: (s: number) => { send: (b: unknown) => void } };
import {
  DomainError,
  NotFoundError,
  ValidationError,
} from '@my-compta/domain';

@Catch()
export class ErrorMapper implements ExceptionFilter {
  private readonly logger = new Logger(ErrorMapper.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<Reply>();
    const request = ctx.getRequest<{ headers: Record<string, string> }>();
    const correlationId = request.headers['x-correlation-id'] ?? crypto.randomUUID();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';
    let details: Record<string, string> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      code = typeof res === 'object' && 'error' in (res as object)
        ? String((res as Record<string, unknown>)['error'])
        : exception.name;
      message = exception.message;
    } else if (exception instanceof NotFoundError) {
      status = HttpStatus.NOT_FOUND;
      code = exception.code;
      message = exception.message;
    } else if (exception instanceof ValidationError) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      code = exception.code;
      message = exception.message;
      if (exception.field) details = { field: exception.field };
    } else if (exception instanceof DomainError) {
      status = HttpStatus.BAD_REQUEST;
      code = exception.code;
      message = exception.message;
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
    }

    void reply.status(status).send({ code, message, details, correlationId });
  }
}
