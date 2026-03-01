import { Body, Controller, Get, Patch, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../infrastructure/http/guards/AuthGuard.js';
import { SettingsService } from './settings.service.js';
import { UpdateSettingsDto } from './dto/UpdateSettingsDto.js';

interface AuthRequest { user: { uid: string } }

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ path: 'settings', version: '1' })
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get user settings' })
  async get(@Request() req: AuthRequest) {
    return this.settingsService.get(req.user.uid);
  }

  @Patch()
  @ApiOperation({ summary: 'Update user settings' })
  async update(
    @Request() req: AuthRequest,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.settingsService.update(req.user.uid, dto);
  }
}
