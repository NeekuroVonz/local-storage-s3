import { Controller, Get, Post, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { User } from '../../common/decorators/user.decorator';
import { DocumentedEndpoint } from '../../common/swagger/documented-endpoint.decorator';
import { SearchDocs } from '../../common/swagger/docs';
import { Permission } from '@storage/shared';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@ApiTags('Search')
@ApiBearerAuth()
@Controller('search')
@UseGuards(PermissionsGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @RequirePermissions(Permission.OBJECTS_READ)
  @DocumentedEndpoint(SearchDocs.search)
  search(@Query() query: SearchQueryDto, @User() user: AuthenticatedUser) {
    return this.searchService.search(user, {
      query: query.q,
      bucket: query.bucket,
      prefix: query.prefix,
      fileType: query.fileType,
      minSize: query.minSize,
      maxSize: query.maxSize,
      limit: query.limit,
    });
  }

  @Get('saved')
  @RequirePermissions(Permission.OBJECTS_READ)
  @DocumentedEndpoint(SearchDocs.getSaved)
  getSaved(@User() user: AuthenticatedUser) {
    return this.searchService.getSavedSearches(user.id);
  }

  @Post('saved')
  @RequirePermissions(Permission.OBJECTS_READ)
  @DocumentedEndpoint(SearchDocs.saveSearch)
  saveSearch(
    @User() user: AuthenticatedUser,
    @Body() body: { name: string; query: Record<string, unknown> },
  ) {
    return this.searchService.saveSearch(user.id, body.name, body.query);
  }

  @Delete('saved/:id')
  @RequirePermissions(Permission.OBJECTS_READ)
  @DocumentedEndpoint(SearchDocs.deleteSaved)
  deleteSaved(@User() user: AuthenticatedUser, @Param('id') id: string) {
    return this.searchService.deleteSavedSearch(user.id, id);
  }
}
