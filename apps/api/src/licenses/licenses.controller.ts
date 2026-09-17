import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CapabilitiesGuard } from '../rbac/capabilities.guard';
import { RequireCapabilities } from '../rbac/capabilities.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt-payload';
import { LicensesService } from './licenses.service';
import { CreateLicenseDto } from './dto/create-license.dto';
import { RenewLicenseDto } from './dto/renew-license.dto';
import { SuspendLicenseDto } from './dto/suspend-license.dto';
import { ReactivateLicenseDto } from './dto/reactivate-license.dto';
import { RevokeLicenseDto } from './dto/revoke-license.dto';
import { ListLicensesQueryDto } from './dto/list-licenses.query.dto';

@Controller('licenses')
@UseGuards(JwtAuthGuard, CapabilitiesGuard)
export class LicensesController {
  constructor(private readonly licensesService: LicensesService) {}

  @Get()
  @RequireCapabilities('licenses.read')
  list(@Query() query: ListLicensesQueryDto) {
    return this.licensesService.list(query);
  }

  @Get(':id')
  @RequireCapabilities('licenses.read')
  findOne(@Param('id') id: string) {
    return this.licensesService.findOne(id);
  }

  @Post()
  @RequireCapabilities('licenses.issue')
  issue(@Body() dto: CreateLicenseDto, @CurrentUser() actor: JwtPayload) {
    return this.licensesService.issue(actor.sub, dto);
  }

  @Post(':id/renew')
  @RequireCapabilities('licenses.renew')
  renew(
    @Param('id') id: string,
    @Body() dto: RenewLicenseDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.licensesService.renew(actor.sub, id, dto);
  }

  @Post(':id/suspend')
  @RequireCapabilities('licenses.suspend')
  suspend(
    @Param('id') id: string,
    @Body() dto: SuspendLicenseDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.licensesService.suspend(actor.sub, id, dto);
  }

  // Reutiliza licenses.suspend: quien puede suspender una licencia tambien
  // puede deshacerlo. No hay una capacidad "licenses.reactivate" separada.
  @Post(':id/reactivate')
  @RequireCapabilities('licenses.suspend')
  reactivate(
    @Param('id') id: string,
    @Body() dto: ReactivateLicenseDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.licensesService.reactivate(actor.sub, id, dto);
  }

  @Post(':id/revoke')
  @RequireCapabilities('licenses.revoke')
  revoke(
    @Param('id') id: string,
    @Body() dto: RevokeLicenseDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.licensesService.revoke(actor.sub, id, dto);
  }
}
