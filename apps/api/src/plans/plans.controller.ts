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
import { PlansService } from './plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { CreatePlanVersionDto } from './dto/create-plan-version.dto';
import { ListPlansQueryDto } from './dto/list-plans.query.dto';

@Controller('plans')
@UseGuards(JwtAuthGuard, CapabilitiesGuard)
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  @RequireCapabilities('plans.read')
  list(@Query() query: ListPlansQueryDto) {
    return this.plansService.list(query);
  }

  @Get(':id')
  @RequireCapabilities('plans.read')
  findOne(@Param('id') id: string) {
    return this.plansService.findOne(id);
  }

  @Post()
  @RequireCapabilities('plans.manage')
  create(@Body() dto: CreatePlanDto, @CurrentUser() actor: JwtPayload) {
    return this.plansService.create(actor.sub, dto);
  }

  @Post(':id/versions')
  @RequireCapabilities('plans.manage')
  addVersion(
    @Param('id') id: string,
    @Body() dto: CreatePlanVersionDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.plansService.addVersion(actor.sub, id, dto);
  }
}
