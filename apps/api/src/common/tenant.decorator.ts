import { BadRequestException, createParamDecorator, ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The institution a request acts on. Tenant users always act on their own
 * institution; a platform Super Admin picks one with the `X-Institution-Id`
 * header. Every tenant-scoped service method takes this id and filters by it,
 * which is what keeps one institution's data out of another's responses.
 */
export const TenantId = createParamDecorator((_: unknown, context: ExecutionContext): string => {
  const request = context.switchToHttp().getRequest<{ user?: AuthUser; headers: Record<string, string | undefined> }>();
  const user = request.user;
  if (!user) {
    throw new ForbiddenException();
  }
  if (user.institutionId) {
    return user.institutionId;
  }
  const header = request.headers['x-institution-id'];
  if (!user.isPlatformAdmin || !header) {
    // Super Admin without a selected institution (API clients: send X-Institution-Id).
    throw new BadRequestException('Choose an institution to manage first.');
  }
  if (!UUID.test(header)) {
    throw new BadRequestException('X-Institution-Id must be a UUID');
  }
  return header;
});
