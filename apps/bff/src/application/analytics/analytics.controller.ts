import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../infrastructure/http/guards/AuthGuard.js';
import { AnalyticsService } from './analytics.service.js';

interface AuthRequest { user: { uid: string } }

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ path: 'analytics', version: '1' })
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('earnings')
  @ApiOperation({ summary: 'Yearly earnings: total + monthly bars' })
  @ApiQuery({ name: 'year', required: true, type: Number })
  async getYearlyEarnings(
    @Request() req: AuthRequest,
    @Query('year') year: string,
  ) {
    return this.analyticsService.getYearlyEarnings(req.user.uid, Number(year));
  }

  @Get('expenses')
  @ApiOperation({ summary: 'Expenses by category (year or year+month)' })
  @ApiQuery({ name: 'year', required: true, type: Number })
  @ApiQuery({ name: 'month', required: false, type: Number })
  async getCategoryExpenses(
    @Request() req: AuthRequest,
    @Query('year') year: string,
    @Query('month') month?: string,
  ) {
    return this.analyticsService.getCategoryExpenses(
      req.user.uid,
      Number(year),
      month ? Number(month) : undefined,
    );
  }

  @Get('net-cashflow')
  @ApiOperation({ summary: 'Net cashflow: inflow vs outflow over a period' })
  @ApiQuery({ name: 'from', required: true, description: 'ISO date' })
  @ApiQuery({ name: 'to', required: true, description: 'ISO date' })
  async getNetCashflow(
    @Request() req: AuthRequest,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.analyticsService.getNetCashflow(
      req.user.uid,
      new Date(from),
      new Date(to),
    );
  }
}
