import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errors: any;
  meta?: any;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        const response = context.switchToHttp().getResponse();
        const meta = data?.meta || undefined;
        const message = data?.message || 'Operation completed successfully';
        const responseData = data?.data !== undefined ? data.data : data;

        return {
          success: true,
          message,
          data: responseData,
          errors: null,
          ...(meta ? { meta } : {}),
        };
      }),
    );
  }
}
