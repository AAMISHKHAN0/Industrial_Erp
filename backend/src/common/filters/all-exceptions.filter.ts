import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // Safety guard: If headers were already sent, delegate to Express default handler
    if (response.headersSent) {
      return;
    }

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();
      message =
        typeof exResponse === 'string'
          ? exResponse
          : (exResponse as any).message || exception.message;
    } else if (
      exception &&
      typeof exception === 'object' &&
      'code' in exception &&
      typeof (exception as any).code === 'string'
    ) {
      const code = (exception as any).code;

      if (code === 'P2002') {
        status = HttpStatus.BAD_REQUEST;
        const target = (exception as any).meta?.target;
        const fields = Array.isArray(target)
          ? target.filter(Boolean).join(', ')
          : target;
        message = fields
          ? `A record with this ${fields} already exists.`
          : 'A record with the same unique fields already exists.';
      } else if (code === 'P2003') {
        status = HttpStatus.BAD_REQUEST;
        message = 'A related record does not exist or violates a constraint.';
      } else if (code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = 'Record not found.';
      } else if (code === 'P2034' || code === '40P01' || code === '40001') {
        // Deadlock / lock contention / serialization failure under concurrent load
        status = HttpStatus.CONFLICT;
        message = 'Database lock contention or concurrent update in progress. Please retry.';
      } else if (code === 'P1008' || code === 'P2028') {
        // Operation / transaction timeout under heavy load
        status = HttpStatus.REQUEST_TIMEOUT;
        message = 'Database operation timed out under load. Please retry.';
      } else if (code === 'P1001' || code === 'P1002' || code === 'P1017' || code === '57P01') {
        // Connection lost or pool exhausted
        status = HttpStatus.SERVICE_UNAVAILABLE;
        message = 'Database connection temporarily busy under high load. Please retry.';
      } else if (code.startsWith('P2')) {
        status = HttpStatus.BAD_REQUEST;
        message = `Database error: ${((exception as any).message || '').split('\n').pop()}`;
      } else {
        message = `Database error: ${code}`;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      if ((exception as any).code === 'ECONNRESET' || (exception as any).code === 'ETIMEDOUT') {
        status = HttpStatus.GATEWAY_TIMEOUT;
        message = 'Connection timed out under load.';
      }
    }

    try {
      response.status(status).json({
        success: false,
        message: Array.isArray(message) ? message[0] : message,
        data: null,
        errors: Array.isArray(message) ? message : null,
      });
    } catch (err) {
      console.error('[CRASH_GUARD] Exception filter failed to send response:', err);
    }
  }
}
