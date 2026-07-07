import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { JwtOnly } from '../../common/decorators/jwt-only.decorator';
import { User } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { DocumentedEndpoint } from '../../common/swagger/documented-endpoint.decorator';
import { OrganizationsDocs, ProjectsDocs } from '../../common/swagger/docs';
import {
  addProjectMemberSchema,
  createOrganizationSchema,
  createProjectBucketSchema,
  createProjectSchema,
  linkProjectBucketSchema,
  updateOrganizationSchema,
  updateProjectSchema,
  AddProjectMemberInput,
  CreateOrganizationInput,
  CreateProjectBucketInput,
  CreateProjectInput,
  LinkProjectBucketInput,
  UpdateOrganizationInput,
  UpdateProjectInput,
  createApiKeySchema,
  CreateApiKeyInput,
  createBucketGrantSchema,
  CreateBucketGrantInput,
  createProjectWebhookSchema,
  CreateProjectWebhookInput,
  updateProjectQuotasSchema,
  UpdateProjectQuotasInput,
  Permission,
} from '@storage/shared';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { BucketGrantsService } from '../bucket-grants/bucket-grants.service';
import { ProjectS3CredentialsService } from '../project-s3-credentials/project-s3-credentials.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { ProjectQuotasService } from '../project-quotas/project-quotas.service';

@ApiTags('Organizations')
@ApiBearerAuth()
@JwtOnly()
@Controller('organizations')
@UseGuards(PermissionsGuard)
export class OrganizationsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @RequirePermissions(Permission.PROJECTS_READ)
  @DocumentedEndpoint(OrganizationsDocs.list)
  list(@User() user: AuthenticatedUser) {
    return this.projectsService.listOrganizations(user);
  }

  @Post()
  @RequirePermissions(Permission.PROJECTS_MANAGE)
  @DocumentedEndpoint(OrganizationsDocs.create)
  create(@Body(new ZodValidationPipe(createOrganizationSchema)) body: CreateOrganizationInput) {
    return this.projectsService.createOrganization(body);
  }

  @Patch(':orgId')
  @RequirePermissions(Permission.PROJECTS_MANAGE)
  @DocumentedEndpoint(OrganizationsDocs.update)
  update(
    @Param('orgId') orgId: string,
    @Body(new ZodValidationPipe(updateOrganizationSchema)) body: UpdateOrganizationInput,
  ) {
    return this.projectsService.updateOrganization(orgId, body);
  }

  @Delete(':orgId')
  @RequirePermissions(Permission.PROJECTS_MANAGE)
  @DocumentedEndpoint(OrganizationsDocs.remove)
  remove(@Param('orgId') orgId: string) {
    return this.projectsService.deleteOrganization(orgId);
  }
}

@ApiTags('Projects')
@ApiBearerAuth()
@JwtOnly()
@Controller('projects')
@UseGuards(PermissionsGuard)
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly apiKeysService: ApiKeysService,
    private readonly bucketGrantsService: BucketGrantsService,
    private readonly projectS3CredentialsService: ProjectS3CredentialsService,
    private readonly webhooksService: WebhooksService,
    private readonly projectQuotasService: ProjectQuotasService,
  ) {}

  @Get()
  @RequirePermissions(Permission.PROJECTS_READ)
  @DocumentedEndpoint(ProjectsDocs.list)
  list(@User() user: AuthenticatedUser, @Query('organizationId') organizationId?: string) {
    return this.projectsService.listProjects(user, organizationId);
  }

  @Get(':projectId')
  @RequirePermissions(Permission.PROJECTS_READ)
  @DocumentedEndpoint(ProjectsDocs.getOne)
  getOne(@Param('projectId') projectId: string, @User() user: AuthenticatedUser) {
    return this.projectsService.getProject(projectId, user);
  }

  @Post()
  @RequirePermissions(Permission.PROJECTS_WRITE)
  @DocumentedEndpoint(ProjectsDocs.create)
  create(
    @Body(new ZodValidationPipe(createProjectSchema)) body: CreateProjectInput,
    @User() user: AuthenticatedUser,
  ) {
    return this.projectsService.createProject(body, user);
  }

  @Patch(':projectId')
  @RequirePermissions(Permission.PROJECTS_WRITE)
  @DocumentedEndpoint(ProjectsDocs.update)
  update(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(updateProjectSchema)) body: UpdateProjectInput,
    @User() user: AuthenticatedUser,
  ) {
    return this.projectsService.updateProject(projectId, body, user);
  }

  @Delete(':projectId')
  @RequirePermissions(Permission.PROJECTS_MANAGE)
  @DocumentedEndpoint(ProjectsDocs.remove)
  remove(@Param('projectId') projectId: string, @User() user: AuthenticatedUser) {
    return this.projectsService.deleteProject(projectId, user);
  }

  @Post(':projectId/members')
  @RequirePermissions(Permission.PROJECTS_WRITE)
  @DocumentedEndpoint(ProjectsDocs.addMember)
  addMember(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(addProjectMemberSchema)) body: AddProjectMemberInput,
    @User() user: AuthenticatedUser,
  ) {
    return this.projectsService.addMember(projectId, body, user);
  }

  @Delete(':projectId/members/:userId')
  @RequirePermissions(Permission.PROJECTS_WRITE)
  @DocumentedEndpoint(ProjectsDocs.removeMember)
  removeMember(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
    @User() user: AuthenticatedUser,
  ) {
    return this.projectsService.removeMember(projectId, userId, user);
  }

  @Post(':projectId/buckets')
  @RequirePermissions(Permission.PROJECTS_WRITE)
  @DocumentedEndpoint(ProjectsDocs.createBucket)
  createBucket(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(createProjectBucketSchema)) body: CreateProjectBucketInput,
    @User() user: AuthenticatedUser,
  ) {
    return this.projectsService.createProjectBucket(projectId, body, user);
  }

  @Post(':projectId/buckets/link')
  @RequirePermissions(Permission.PROJECTS_WRITE)
  @DocumentedEndpoint(ProjectsDocs.linkBucket)
  linkBucket(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(linkProjectBucketSchema)) body: LinkProjectBucketInput,
    @User() user: AuthenticatedUser,
  ) {
    return this.projectsService.linkProjectBucket(projectId, body, user);
  }

  @Delete(':projectId/buckets/:bucketName')
  @RequirePermissions(Permission.PROJECTS_WRITE)
  @DocumentedEndpoint(ProjectsDocs.unlinkBucket)
  unlinkBucket(
    @Param('projectId') projectId: string,
    @Param('bucketName') bucketName: string,
    @User() user: AuthenticatedUser,
  ) {
    return this.projectsService.unlinkProjectBucket(projectId, bucketName, user);
  }

  @Get(':projectId/api-keys')
  @RequirePermissions(Permission.PROJECTS_READ)
  @DocumentedEndpoint(ProjectsDocs.listApiKeys)
  listApiKeys(@Param('projectId') projectId: string) {
    return this.apiKeysService.list(projectId);
  }

  @Post(':projectId/api-keys')
  @RequirePermissions(Permission.PROJECTS_WRITE)
  @DocumentedEndpoint(ProjectsDocs.createApiKey)
  createApiKey(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(createApiKeySchema)) body: CreateApiKeyInput,
    @User() user: AuthenticatedUser,
  ) {
    return this.projectsService
      .getProject(projectId, user)
      .then(() => this.apiKeysService.create(projectId, body, user.id));
  }

  @Delete(':projectId/api-keys/:keyId')
  @RequirePermissions(Permission.PROJECTS_WRITE)
  @DocumentedEndpoint(ProjectsDocs.revokeApiKey)
  revokeApiKey(@Param('projectId') projectId: string, @Param('keyId') keyId: string) {
    return this.apiKeysService.revoke(projectId, keyId);
  }

  @Get(':projectId/grants')
  @RequirePermissions(Permission.PROJECTS_READ)
  @DocumentedEndpoint(ProjectsDocs.listGrants)
  listGrants(
    @Param('projectId') projectId: string,
    @Query('bucketName') bucketName?: string,
  ) {
    return this.bucketGrantsService.list(projectId, bucketName);
  }

  @Post(':projectId/grants')
  @RequirePermissions(Permission.PROJECTS_WRITE)
  @DocumentedEndpoint(ProjectsDocs.createGrant)
  createGrant(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(createBucketGrantSchema)) body: CreateBucketGrantInput,
    @User() user: AuthenticatedUser,
  ) {
    return this.projectsService
      .getProject(projectId, user)
      .then(() => this.bucketGrantsService.create(projectId, body, user.id));
  }

  @Delete(':projectId/grants/:grantId')
  @RequirePermissions(Permission.PROJECTS_WRITE)
  @DocumentedEndpoint(ProjectsDocs.removeGrant)
  removeGrant(@Param('projectId') projectId: string, @Param('grantId') grantId: string) {
    return this.bucketGrantsService.remove(projectId, grantId);
  }

  @Get(':projectId/s3-credentials')
  @RequirePermissions(Permission.PROJECTS_READ)
  @DocumentedEndpoint(ProjectsDocs.getS3Credentials)
  getS3Credentials(@Param('projectId') projectId: string) {
    return this.projectS3CredentialsService.getStatus(projectId);
  }

  @Post(':projectId/s3-credentials/provision')
  @RequirePermissions(Permission.PROJECTS_MANAGE)
  @DocumentedEndpoint(ProjectsDocs.provisionS3Credentials)
  provisionS3Credentials(
    @Param('projectId') projectId: string,
    @User() user: AuthenticatedUser,
  ) {
    return this.projectsService
      .getProject(projectId, user)
      .then(() => this.projectS3CredentialsService.provision(projectId));
  }

  @Post(':projectId/s3-credentials/rotate')
  @RequirePermissions(Permission.PROJECTS_MANAGE)
  @DocumentedEndpoint(ProjectsDocs.rotateS3Credentials)
  rotateS3Credentials(@Param('projectId') projectId: string, @User() user: AuthenticatedUser) {
    return this.projectsService
      .getProject(projectId, user)
      .then(() => this.projectS3CredentialsService.rotate(projectId));
  }

  @Delete(':projectId/s3-credentials')
  @RequirePermissions(Permission.PROJECTS_MANAGE)
  @DocumentedEndpoint(ProjectsDocs.revokeS3Credentials)
  revokeS3Credentials(@Param('projectId') projectId: string, @User() user: AuthenticatedUser) {
    return this.projectsService
      .getProject(projectId, user)
      .then(() => this.projectS3CredentialsService.revoke(projectId));
  }

  @Get(':projectId/webhooks')
  @RequirePermissions(Permission.PROJECTS_READ)
  @DocumentedEndpoint(ProjectsDocs.listWebhooks)
  listWebhooks(@Param('projectId') projectId: string) {
    return this.webhooksService.list(projectId);
  }

  @Post(':projectId/webhooks')
  @RequirePermissions(Permission.PROJECTS_WRITE)
  @DocumentedEndpoint(ProjectsDocs.createWebhook)
  createWebhook(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(createProjectWebhookSchema)) body: CreateProjectWebhookInput,
    @User() user: AuthenticatedUser,
  ) {
    return this.projectsService
      .getProject(projectId, user)
      .then(() => this.webhooksService.create(projectId, body, user.id));
  }

  @Delete(':projectId/webhooks/:webhookId')
  @RequirePermissions(Permission.PROJECTS_WRITE)
  @DocumentedEndpoint(ProjectsDocs.removeWebhook)
  removeWebhook(@Param('projectId') projectId: string, @Param('webhookId') webhookId: string) {
    return this.webhooksService.remove(projectId, webhookId);
  }

  @Get(':projectId/webhooks/:webhookId/deliveries')
  @RequirePermissions(Permission.PROJECTS_READ)
  @DocumentedEndpoint(ProjectsDocs.listWebhookDeliveries)
  listWebhookDeliveries(
    @Param('projectId') projectId: string,
    @Param('webhookId') webhookId: string,
  ) {
    return this.webhooksService.listDeliveries(projectId, webhookId);
  }

  @Get(':projectId/quotas')
  @RequirePermissions(Permission.PROJECTS_READ)
  @DocumentedEndpoint(ProjectsDocs.getQuotas)
  getQuotas(@Param('projectId') projectId: string) {
    return this.projectQuotasService.getStatus(projectId);
  }

  @Patch(':projectId/quotas')
  @RequirePermissions(Permission.PROJECTS_MANAGE)
  @DocumentedEndpoint(ProjectsDocs.updateQuotas)
  updateQuotas(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(updateProjectQuotasSchema)) body: UpdateProjectQuotasInput,
    @User() user: AuthenticatedUser,
  ) {
    return this.projectsService
      .getProject(projectId, user)
      .then(() => this.projectQuotasService.update(projectId, body));
  }

  @Post(':projectId/quotas/reconcile')
  @RequirePermissions(Permission.PROJECTS_MANAGE)
  @DocumentedEndpoint(ProjectsDocs.reconcileQuotas)
  reconcileQuotas(@Param('projectId') projectId: string, @User() user: AuthenticatedUser) {
    return this.projectsService
      .getProject(projectId, user)
      .then(() => this.projectQuotasService.reconcile(projectId));
  }
}
