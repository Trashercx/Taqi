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
import { UsageService } from './usage.service';
import { RecordUsageEventDto } from './dto/record-usage-event.dto';
import { UsageSummaryQueryDto } from './dto/usage-summary.query.dto';
import { UsageTimeseriesQueryDto } from './dto/usage-timeseries.query.dto';

@Controller('usage')
@UseGuards(JwtAuthGuard, CapabilitiesGuard)
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  // No listado literalmente en SS9 (que solo lista los GET de lectura), pero
  // hace falta un punto de ingesta real: es lo que llamaria la futura
  // intranet del cliente para reportar su propio consumo.
  @Post('events')
  @RequireCapabilities('usage.write')
  recordEvent(
    @Body() dto: RecordUsageEventDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.usageService.recordEvent(actor.sub, dto);
  }

  @Get('summary')
  @RequireCapabilities('usage.read')
  summary(@Query() query: UsageSummaryQueryDto) {
    return this.usageService.summary(query);
  }

  @Get('timeseries')
  @RequireCapabilities('usage.read')
  timeseries(@Query() query: UsageTimeseriesQueryDto) {
    return this.usageService.timeseries(query);
  }

  @Get('organizations/:organizationId')
  @RequireCapabilities('usage.read')
  organizationUsage(@Param('organizationId') organizationId: string) {
    return this.usageService.organizationUsage(organizationId);
  }
}
