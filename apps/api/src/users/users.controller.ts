import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
import { ReqContext } from '../auth/request-context.decorator';
import { RequestContext } from '../auth/auth.service';
import { UsersService } from './users.service';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersQueryDto } from './dto/list-users.query.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(JwtAuthGuard, CapabilitiesGuard)
  @RequireCapabilities('users.invite')
  list(@Query() query: ListUsersQueryDto) {
    return this.usersService.list(query);
  }

  @Post('invitations')
  @UseGuards(JwtAuthGuard, CapabilitiesGuard)
  @RequireCapabilities('users.invite')
  invite(@Body() dto: InviteUserDto, @CurrentUser() actor: JwtPayload) {
    return this.usersService.invite(actor.sub, dto);
  }

  @Post('invitations/:token/accept')
  @HttpCode(HttpStatus.OK)
  acceptInvitation(
    @Param('token') token: string,
    @Body() dto: AcceptInvitationDto,
    @ReqContext() ctx: RequestContext,
  ) {
    return this.usersService.acceptInvitation(token, dto.password, ctx);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, CapabilitiesGuard)
  @RequireCapabilities('users.invite')
  @HttpCode(HttpStatus.NO_CONTENT)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: JwtPayload,
  ): Promise<void> {
    await this.usersService.update(id, actor.sub, dto);
  }

  @Post(':id/suspend')
  @UseGuards(JwtAuthGuard, CapabilitiesGuard)
  @RequireCapabilities('users.reset_credentials')
  @HttpCode(HttpStatus.NO_CONTENT)
  async suspend(
    @Param('id') id: string,
    @Body('reason') reason: string | undefined,
    @CurrentUser() actor: JwtPayload,
  ): Promise<void> {
    await this.usersService.suspend(id, actor.sub, reason);
  }

  @Post(':id/revoke-sessions')
  @UseGuards(JwtAuthGuard, CapabilitiesGuard)
  @RequireCapabilities('users.reset_credentials')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSessions(
    @Param('id') id: string,
    @CurrentUser() actor: JwtPayload,
  ): Promise<void> {
    await this.usersService.revokeSessions(id, actor.sub);
  }

  @Post(':id/reset-credentials')
  @UseGuards(JwtAuthGuard, CapabilitiesGuard)
  @RequireCapabilities('users.reset_credentials')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetCredentials(
    @Param('id') id: string,
    @CurrentUser() actor: JwtPayload,
  ): Promise<void> {
    await this.usersService.resetCredentials(id, actor.sub);
  }
}
