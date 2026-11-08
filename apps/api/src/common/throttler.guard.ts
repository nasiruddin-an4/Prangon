import { createHash } from 'node:crypto';
import { Injectable, type ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

const SIGN_IN_PATH = /\/auth\/(sign-in|token)$/;
const SESSION_COOKIE = /(?:^|;\s*)(?:__Host-sid|sid)=([^;]+)/;

const hash = (value: string) => createHash('sha256').update(value).digest('base64url').slice(0, 32);

/**
 * Rate limits that suit campus networks, where hundreds of students and staff
 * share one public IP address:
 *
 * - `default` counts per credential (session cookie, bearer token or API key),
 *   and per IP + email on sign-in routes, so one busy lab doesn't lock out
 *   everyone behind the same NAT, and guessing one account's password is slow.
 * - `ip` counts per IP address with a much higher ceiling, to cap floods and
 *   password spraying across many accounts from one address.
 */
@Injectable()
export class CampusThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, any>): Promise<string> {
    const path: string = req.path ?? req.url ?? '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : null;
    if (SIGN_IN_PATH.test(path) && email) {
      return `signin:${req.ip}:${hash(email)}`;
    }
    const authorization: string | undefined = req.headers?.authorization;
    if (authorization) {
      return `bearer:${hash(authorization)}`;
    }
    const session = SESSION_COOKIE.exec(req.headers?.cookie ?? '')?.[1];
    if (session) {
      return `session:${hash(session)}`;
    }
    return `ip:${req.ip}`;
  }

  protected override generateKey(context: ExecutionContext, suffix: string, name: string): string {
    if (name === 'ip') {
      const { req } = this.getRequestResponse(context);
      return super.generateKey(context, `ip:${req.ip}`, name);
    }
    return super.generateKey(context, suffix, name);
  }
}
