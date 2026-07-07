import { applyDecorators } from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';

export type EndpointDocumentation = {
  summary: string;
  description?: string;
  purpose?: string;
  permissions?: string[];
  auth?: 'public' | 'bearer' | 'api-key' | 'bearer-or-api-key';
  requestExample?: unknown;
  responseExample?: unknown;
  responseStatus?: number;
  noContent?: boolean;
  consumes?: 'multipart/form-data' | 'application/json';
  query?: Record<string, { description: string; example?: unknown; required?: boolean }>;
  params?: Record<string, { description: string; example?: string }>;
  curlExample?: string;
  skipDefaultErrors?: boolean;
};

function buildDescription(doc: EndpointDocumentation): string {
  const parts: string[] = [];

  if (doc.purpose) {
    parts.push(`**Purpose:** ${doc.purpose}`);
  }

  parts.push(doc.description ?? doc.purpose ?? doc.summary);

  if (doc.permissions?.length) {
    parts.push(`**Required permissions:** \`${doc.permissions.join('`, `')}\``);
  }

  switch (doc.auth) {
    case 'public':
      parts.push('**Authentication:** None (public endpoint).');
      break;
    case 'api-key':
      parts.push(
        '**Authentication:** Project API key — `Authorization: Bearer sk_live_...` or `sk_test_...`.',
      );
      break;
    case 'bearer-or-api-key':
      parts.push(
        '**Authentication:** JWT access token **or** project API key (`Authorization: Bearer <token>`).',
      );
      break;
    default:
      parts.push('**Authentication:** JWT access token (`Authorization: Bearer <accessToken>`).');
      break;
  }

  if (doc.curlExample) {
    parts.push(`**Example request:**\n\`\`\`bash\n${doc.curlExample}\n\`\`\``);
  }

  return parts.join('\n\n');
}

export function DocumentedEndpoint(doc: EndpointDocumentation) {
  const decorators: Array<ClassDecorator | MethodDecorator | PropertyDecorator> = [
    ApiOperation({
      summary: doc.summary,
      description: buildDescription(doc),
    }),
  ];

  if (doc.consumes) {
    decorators.push(ApiConsumes(doc.consumes));
  }

  if (doc.params) {
    for (const [name, meta] of Object.entries(doc.params)) {
      decorators.push(
        ApiParam({ name, description: meta.description, example: meta.example }),
      );
    }
  }

  if (doc.query) {
    for (const [name, meta] of Object.entries(doc.query)) {
      decorators.push(
        ApiQuery({
          name,
          description: meta.description,
          example: meta.example,
          required: meta.required,
        }),
      );
    }
  }

  if (doc.requestExample !== undefined) {
    decorators.push(
      ApiBody({
        description: 'JSON request body',
        schema: { type: 'object', example: doc.requestExample },
      }),
    );
  }

  const status = doc.noContent ? 204 : (doc.responseStatus ?? 200);

  if (doc.noContent) {
    decorators.push(ApiResponse({ status: 204, description: 'Success — no response body' }));
  } else if (doc.responseExample !== undefined) {
    decorators.push(
      ApiResponse({
        status,
        description: 'Success response',
        content: {
          'application/json': {
            schema: { type: 'object', example: doc.responseExample },
          },
        },
      }),
    );
  } else {
    decorators.push(ApiResponse({ status, description: 'Success' }));
  }

  if (!doc.skipDefaultErrors) {
    decorators.push(
      ApiResponse({ status: 400, description: 'Validation error — invalid body or query parameters' }),
      ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid token' }),
      ApiResponse({ status: 403, description: 'Forbidden — insufficient permissions or bucket scope' }),
      ApiResponse({ status: 404, description: 'Not found' }),
      ApiResponse({ status: 409, description: 'Conflict — resource already exists' }),
    );
  }

  return applyDecorators(...decorators);
}

export function apiDoc(config: EndpointDocumentation): EndpointDocumentation {
  return {
    ...config,
    description: config.description ?? config.purpose ?? config.summary,
  };
}
