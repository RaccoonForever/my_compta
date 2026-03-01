import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { NotFoundError, ValidationError } from '@my-compta/domain';

@Catch(NotFoundError, ValidationError)
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: NotFoundError | ValidationError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse();

    const isNotFound = exception instanceof NotFoundError;
    const statusCode = isNotFound ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST;

    const response = {
      statusCode,
      message: exception.message,
      timestamp: new Date().toISOString(),
    };

    this.logger.warn(`Domain exception: ${exception.message}`);
    reply.status(statusCode).send(response);
  }
}
