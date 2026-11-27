import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * DevModeMiddleware: Developer bypasses have been disabled.
 * Requests pass through standard authentication pipelines.
 */
@Injectable()
export class DevModeMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    next();
  }
}
