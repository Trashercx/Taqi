import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CapabilitiesGuard } from '../rbac/capabilities.guard';
import { RequireCapabilities } from '../rbac/capabilities.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt-payload';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { ListOrganizationsQueryDto } from './dto/list-organizations.query.dto';

@Controller('organizations')
@UseGuards(JwtAuthGuard, CapabilitiesGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  @RequireCapabilities('organizations.read')
  list(@Query() query: ListOrganizationsQueryDto) {
    return this.organizationsService.list(query);
  }

  @Get(':id')
  @RequireCapabilities('organizations.read')
  findOne(@Param('id') id: string) {
    return this.organizationsService.findOne(id);
  }

  @Get(':id/overview')
  @RequireCapabilities('organizations.read')
  overview(@Param('id') id: string) {
    return this.organizationsService.overview(id);
  }

  @Post()
  @RequireCapabilities('organizations.create')
  create(@Body() dto: CreateOrganizationDto, @CurrentUser() actor: JwtPayload) {
    return this.organizationsService.create(actor.sub, dto);
  }

  @Patch(':id')
  @RequireCapabilities('organizations.update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.organizationsService.update(id, actor.sub, dto);
  }
}
