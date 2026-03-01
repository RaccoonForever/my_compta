import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Request,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../infrastructure/http/guards/AuthGuard.js';
import { RecurringService } from './recurring.service.js';
import { CreateRecurringTemplateDto } from './dto/CreateRecurringTemplateDto.js';
import { RecurringTemplateResponseDto } from './dto/RecurringTemplateResponseDto.js';

interface AuthRequest { user: { uid: string } }

@ApiTags('recurring')
@Controller({ path: 'recurring', version: '1' })
export class RecurringController {
  constructor(private readonly recurringService: RecurringService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Create a recurring template' })
  async create(
    @Request() req: AuthRequest,
    @Body() dto: CreateRecurringTemplateDto,
  ): Promise<RecurringTemplateResponseDto> {
    const template = await this.recurringService.create(req.user.uid, dto);
    return RecurringTemplateResponseDto.from(template.toPrimitives());
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'List recurring templates' })
  async list(@Request() req: AuthRequest): Promise<RecurringTemplateResponseDto[]> {
    const templates = await this.recurringService.list(req.user.uid);
    return templates.map(t => RecurringTemplateResponseDto.from(t.toPrimitives()));
  }

  @Patch(':id/pause')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Pause a recurring template' })
  async pause(
    @Request() req: AuthRequest,
    @Param('id') id: string,
  ): Promise<RecurringTemplateResponseDto> {
    const template = await this.recurringService.pause(req.user.uid, id);
    return RecurringTemplateResponseDto.from(template.toPrimitives());
  }

  @Patch(':id/resume')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Resume a recurring template' })
  async resume(
    @Request() req: AuthRequest,
    @Param('id') id: string,
  ): Promise<RecurringTemplateResponseDto> {
    const template = await this.recurringService.resume(req.user.uid, id);
    return RecurringTemplateResponseDto.from(template.toPrimitives());
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a recurring template' })
  async delete(
    @Request() req: AuthRequest,
    @Param('id') id: string,
  ): Promise<void> {
    await this.recurringService.delete(req.user.uid, id);
  }

  /**
   * Scheduler endpoint — called by Cloud Scheduler (service account) or
   * manually in development. Protected by a shared secret header.
   */
  @Post('run-due')
  @ApiOperation({ summary: 'Run all due recurring templates (scheduler endpoint)' })
  async runDue(
    @Headers('x-scheduler-secret') secret: string | undefined,
  ): Promise<{ processed: number; skipped: number }> {
    if (secret !== process.env['SCHEDULER_SECRET']) {
      throw new UnauthorizedException('Invalid scheduler secret');
    }
    return this.recurringService.runDue();
  }
}
