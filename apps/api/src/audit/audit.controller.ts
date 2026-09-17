import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CapabilitiesGuard } from '../rbac/capabilities.guard';
import { RequireCapabilities } from '../rbac/capabilities.decorator';
import { AuditService } from './audit.service';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs.query.dto';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, CapabilitiesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequireCapabilities('audit.read')
  list(@Query() query: ListAuditLogsQueryDto) {
    return this.auditService.list(query);
  }
}
