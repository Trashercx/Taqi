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
import { FinanceService } from './finance.service';
import { CreateFinancialCategoryDto } from './dto/create-financial-category.dto';
import { CreateCostCenterDto } from './dto/create-cost-center.dto';
import { CreateFinancialTransactionDto } from './dto/create-financial-transaction.dto';
import { UpdateFinancialTransactionDto } from './dto/update-financial-transaction.dto';
import { VoidFinancialTransactionDto } from './dto/void-financial-transaction.dto';
import { ListFinancialTransactionsQueryDto } from './dto/list-financial-transactions.query.dto';
import { FinanceDashboardQueryDto } from './dto/finance-dashboard.query.dto';

@Controller('finance')
@UseGuards(JwtAuthGuard, CapabilitiesGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  // Plomeria no listada literalmente en SS9: sin categorias no se puede
  // crear un movimiento (categoryId es requerido).
  @Get('categories')
  @RequireCapabilities('finance.read')
  listCategories() {
    return this.financeService.listCategories();
  }

  @Post('categories')
  @RequireCapabilities('finance.write')
  createCategory(
    @Body() dto: CreateFinancialCategoryDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.financeService.createCategory(actor.sub, dto);
  }

  @Get('cost-centers')
  @RequireCapabilities('finance.read')
  listCostCenters() {
    return this.financeService.listCostCenters();
  }

  @Post('cost-centers')
  @RequireCapabilities('finance.write')
  createCostCenter(
    @Body() dto: CreateCostCenterDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.financeService.createCostCenter(actor.sub, dto);
  }

  @Get('transactions')
  @RequireCapabilities('finance.read')
  list(@Query() query: ListFinancialTransactionsQueryDto) {
    return this.financeService.list(query);
  }

  @Get('transactions/:id')
  @RequireCapabilities('finance.read')
  findOne(@Param('id') id: string) {
    return this.financeService.findOne(id);
  }

  @Post('transactions')
  @RequireCapabilities('finance.write')
  create(
    @Body() dto: CreateFinancialTransactionDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.financeService.create(actor.sub, dto);
  }

  @Patch('transactions/:id')
  @RequireCapabilities('finance.write')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFinancialTransactionDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.financeService.update(actor.sub, id, dto);
  }

  @Post('transactions/:id/void')
  @RequireCapabilities('finance.write')
  void(
    @Param('id') id: string,
    @Body() dto: VoidFinancialTransactionDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.financeService.void(actor.sub, id, dto);
  }

  @Get('dashboard')
  @RequireCapabilities('finance.read')
  dashboard(@Query() query: FinanceDashboardQueryDto) {
    return this.financeService.dashboard(query);
  }
}
