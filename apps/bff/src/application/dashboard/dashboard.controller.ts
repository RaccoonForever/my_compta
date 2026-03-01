import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../infrastructure/http/guards/AuthGuard.js';
import { DashboardService } from './dashboard.service.js';

interface AuthRequest { user: { uid: string } }

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ path: 'dashboard', version: '1' })
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Get full dashboard data (totals, forecast, breakdown, alerts)' })
  async getDashboard(@Request() req: AuthRequest) {
    return this.dashboardService.getDashboard(req.user.uid, new Date());
  }
}
