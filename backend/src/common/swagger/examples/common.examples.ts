export const EXAMPLE_UUID = '550e8400-e29b-41d4-a716-446655440000';
export const EXAMPLE_PROJECT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
export const EXAMPLE_ORG_ID = '11111111-2222-3333-4444-555555555555';
export const EXAMPLE_USER_ID = '99999999-8888-7777-6666-555555555555';
export const API_BASE = 'http://localhost:4000/api/v1';

export const success = <T>(data: T) => ({ success: true, data });

export const paginated = <T>(data: T[]) => ({
  success: true,
  data,
  meta: {
    page: 1,
    limit: 20,
    total: 42,
    totalPages: 3,
    hasNextPage: true,
    hasPreviousPage: false,
  },
});
