import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import { Actor, DomainError, roles, TENANT_ID } from '../../shared/model.js';
const tenantKeys = createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`));

export function validateClaims(payload: JWTPayload, tenant: string, client: string): Actor {
  if (tenant !== TENANT_ID || payload.tid !== tenant || payload.ver !== '2.0') throw new DomainError(401, 'This token is not from the authorised tenant.');
  if (typeof payload.oid !== 'string' || !/^[0-9a-f-]{36}$/i.test(payload.oid)) throw new DomainError(401, 'A work user identity is required.');
  if (payload.azp !== client || typeof payload.scp !== 'string' || !payload.scp.split(' ').includes('access_as_user')) throw new DomainError(403, 'The portal access permission is required.');
  const tokenRoles = Array.isArray(payload.roles) ? payload.roles : [];
  const assigned = roles.filter(r => tokenRoles.includes(r));
  if (!assigned.length) throw new DomainError(403, 'Your administrator must assign a sales workspace role.');
  return { oid: payload.oid, tid: tenant, name: typeof payload.name === 'string' ? payload.name.slice(0, 160) : 'Team member', roles: assigned };
}
export async function verifyAccessToken(token: string, settings: { tenant: string; audience: string; client: string }, getKey?: JWTVerifyGetKey) {
  if (!settings.audience || !settings.client || settings.tenant !== TENANT_ID) throw new DomainError(503, 'Work account access is not configured.');
  const issuer = `https://login.microsoftonline.com/${settings.tenant}/v2.0`;
  const { payload } = await jwtVerify(token, getKey ?? tenantKeys, { issuer, audience: settings.audience, algorithms: ['RS256'], requiredClaims: ['exp', 'iat', 'nbf', 'tid', 'oid', 'azp', 'scp', 'ver'], clockTolerance: 30 });
  return validateClaims(payload, settings.tenant, settings.client);
}
