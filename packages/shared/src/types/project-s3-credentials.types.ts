export interface ProjectS3CredentialStatus {
  provisioned: boolean;
  keyName: string | null;
  accessKeyId: string | null;
  provisionedAt: string | null;
  endpoint: string;
  region: string;
  forcePathStyle: boolean;
  garageAdminConfigured: boolean;
}

export interface ProjectS3CredentialsCreated {
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  region: string;
  forcePathStyle: boolean;
}
