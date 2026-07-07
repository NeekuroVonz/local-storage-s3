import { apiDoc } from '../documented-endpoint.decorator';
import { API_BASE, EXAMPLE_USER_ID, success } from '../examples/common.examples';

export const AuthDocs = {
  register: apiDoc({
    summary: 'Register a new user',
    purpose: 'Create a platform user account.',
    description:
      'Registers a new user with email and password. The account may require email verification depending on platform settings. Returns JWT tokens on success.',
    auth: 'public',
    requestExample: {
      email: 'user@example.com',
      password: 'SecurePass123!',
      firstName: 'Jane',
      lastName: 'Doe',
    },
    responseExample: {
      success: true,
      user: {
        id: EXAMPLE_USER_ID,
        email: 'user@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        role: 'user',
      },
      tokens: {
        accessToken: 'eyJhbGciOiJIUzI1NiIs...',
        refreshToken: 'eyJhbGciOiJIUzI1NiIs...',
      },
    },
    curlExample: `curl -X POST ${API_BASE}/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{"email":"user@example.com","password":"SecurePass123!","firstName":"Jane","lastName":"Doe"}'`,
  }),

  login: apiDoc({
    summary: 'Login with email and password',
    purpose: 'Obtain JWT access and refresh tokens.',
    description:
      'Authenticates a user and returns short-lived access token plus refresh token. Use the access token in `Authorization: Bearer` for subsequent API calls.',
    auth: 'public',
    requestExample: {
      email: 'admin@storage.local',
      password: 'Admin123!',
      rememberMe: false,
    },
    responseExample: {
      success: true,
      user: {
        id: EXAMPLE_USER_ID,
        email: 'admin@storage.local',
        firstName: 'System',
        lastName: 'Admin',
        role: 'admin',
      },
      tokens: {
        accessToken: 'eyJhbGciOiJIUzI1NiIs...',
        refreshToken: 'eyJhbGciOiJIUzI1NiIs...',
      },
    },
    curlExample: `curl -X POST ${API_BASE}/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"admin@storage.local","password":"Admin123!"}'`,
  }),

  refresh: apiDoc({
    summary: 'Refresh access token',
    purpose: 'Rotate an expired access token without re-login.',
    description: 'Exchanges a valid refresh token for a new access/refresh token pair.',
    auth: 'public',
    requestExample: { refreshToken: 'eyJhbGciOiJIUzI1NiIs...' },
    responseExample: {
      accessToken: 'eyJhbGciOiJIUzI1NiIs...',
      refreshToken: 'eyJhbGciOiJIUzI1NiIs...',
    },
    curlExample: `curl -X POST ${API_BASE}/auth/refresh \\
  -H "Content-Type: application/json" \\
  -d '{"refreshToken":"<refreshToken>"}'`,
  }),

  logout: apiDoc({
    summary: 'Logout current session',
    purpose: 'Invalidate refresh token and end session.',
    description: 'Revokes the provided refresh token. Access tokens expire naturally; clients should discard both tokens locally.',
    auth: 'bearer',
    requestExample: { refreshToken: 'eyJhbGciOiJIUzI1NiIs...' },
    noContent: true,
    curlExample: `curl -X POST ${API_BASE}/auth/logout \\
  -H "Authorization: Bearer <accessToken>" \\
  -H "Content-Type: application/json" \\
  -d '{"refreshToken":"<refreshToken>"}'`,
  }),

  changePassword: apiDoc({
    summary: 'Change password',
    purpose: 'Update the authenticated user password.',
    description: 'Requires the current password. All active sessions may be invalidated depending on policy.',
    auth: 'bearer',
    requestExample: {
      currentPassword: 'Admin123!',
      newPassword: 'NewSecurePass456!',
    },
    noContent: true,
    curlExample: `curl -X POST ${API_BASE}/auth/change-password \\
  -H "Authorization: Bearer <accessToken>" \\
  -H "Content-Type: application/json" \\
  -d '{"currentPassword":"Admin123!","newPassword":"NewSecurePass456!"}'`,
  }),

  me: apiDoc({
    summary: 'Get current user profile',
    purpose: 'Return the authenticated user identity and role.',
    description: 'Used by the web UI to hydrate session state. Returns the JWT subject as a user object.',
    auth: 'bearer',
    responseExample: success({
      id: EXAMPLE_USER_ID,
      email: 'admin@storage.local',
      firstName: 'System',
      lastName: 'Admin',
      role: 'admin',
      permissions: ['buckets:read', 'objects:write'],
    }),
    curlExample: `curl ${API_BASE}/auth/me \\
  -H "Authorization: Bearer <accessToken>"`,
  }),
};
