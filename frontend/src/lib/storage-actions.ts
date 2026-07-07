import { apiClient, apiDownloadBlob, saveBlobAsFile } from '@/lib/api-client';
import type { PresignedUrlResult } from '@storage/shared';

export async function downloadObject(bucket: string, key: string): Promise<void> {
  const blob = await apiDownloadBlob(`/buckets/${bucket}/download`, { params: { key } });
  const filename = key.split('/').pop() ?? 'download';
  saveBlobAsFile(blob, filename);
}

export async function downloadObjectsAsZip(bucket: string, keys: string[]): Promise<void> {
  const blob = await apiDownloadBlob(`/buckets/${bucket}/download/zip`, {
    method: 'POST',
    body: { keys },
  });
  saveBlobAsFile(blob, `${bucket}-download.zip`);
}

export function buildS3Uri(bucket: string, key: string): string {
  return `s3://${bucket}/${key}`;
}

export async function getPresignedUrl(bucket: string, key: string): Promise<string> {
  const result = await apiClient<{ success: boolean; data: PresignedUrlResult }>(
    `/buckets/${bucket}/objects/presigned-url`,
    { method: 'POST', body: { key, operation: 'getObject', expiresIn: 3600 } },
  );
  return result.data.url;
}

export async function copyS3Uri(bucket: string, key: string): Promise<void> {
  await navigator.clipboard.writeText(buildS3Uri(bucket, key));
}

export async function copyObjectUrl(bucket: string, key: string): Promise<void> {
  const url = await getPresignedUrl(bucket, key);
  await navigator.clipboard.writeText(url);
}

export async function openObject(bucket: string, key: string): Promise<void> {
  const url = await getPresignedUrl(bucket, key);
  window.open(url, '_blank', 'noopener,noreferrer');
}
