import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

interface AwsLikeError {
  name?: string;
  message?: string;
  Code?: string;
}

function getNestedErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'AggregateError' && 'errors' in error) {
      const nested = (error as AggregateError).errors;
      if (Array.isArray(nested) && nested.length > 0) {
        return nested.map((item) => getNestedErrorMessage(item)).join('; ');
      }
    }
    if (error.message) {
      return error.message;
    }
    return error.name;
  }
  return String(error);
}

export function isStorageConnectionError(error: unknown): boolean {
  const message = getNestedErrorMessage(error).toLowerCase();
  return (
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    message.includes('connect timeout') ||
    message.includes('network') ||
    message.includes('getaddrinfo')
  );
}

export function toHttpException(error: unknown, operation: string): HttpException {
  const message = getNestedErrorMessage(error);
  const awsError = error as AwsLikeError;
  const code = awsError.name ?? awsError.Code ?? '';

  if (isStorageConnectionError(error)) {
    return new ServiceUnavailableException(
      `Storage operation failed (${operation}): ${message}. Ensure Garage is running and S3 credentials in .env are correct.`,
    );
  }

  switch (code) {
    case 'BucketAlreadyOwnedByYou':
    case 'BucketAlreadyExists':
      return new ConflictException(message || 'Bucket already exists');
    case 'NoSuchBucket':
      return new NotFoundException(message || 'Bucket not found');
    case 'NoSuchKey':
      return new NotFoundException(message || 'Object not found');
    case 'AccessDenied':
      return new ForbiddenException(message || 'Access denied');
    case 'InvalidRequest':
    case 'InvalidArgument':
      return new BadRequestException(message || 'Invalid storage request');
    default:
      return new BadRequestException(
        message
          ? `Storage operation failed (${operation}): ${message}`
          : `Storage operation failed (${operation})`,
      );
  }
}

export { getNestedErrorMessage };
