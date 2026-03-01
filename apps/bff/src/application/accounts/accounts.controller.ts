import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../infrastructure/http/guards/AuthGuard.js';
import { AccountsService } from './accounts.service.js';
import { CreateAccountDto } from './dto/CreateAccountDto.js';
import { UpdateAccountDto } from './dto/UpdateAccountDto.js';
import { AccountResponseDto } from './dto/AccountResponseDto.js';

interface AuthRequest { user: { uid: string } }

@ApiTags('accounts')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ path: 'accounts', version: '1' })
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  @ApiOperation({ summary: 'Create an account' })
  async create(
    @Request() req: AuthRequest,
    @Body() dto: CreateAccountDto,
  ): Promise<AccountResponseDto> {
    const account = await this.accountsService.create(req.user.uid, dto);
    return AccountResponseDto.from(account.toPrimitives());
  }

  @Get()
  @ApiOperation({ summary: 'List accounts' })
  @ApiQuery({ name: 'includeArchived', required: false, type: Boolean })
  async list(
    @Request() req: AuthRequest,
    @Query('includeArchived') includeArchived?: string,
  ): Promise<AccountResponseDto[]> {
    const accounts = await this.accountsService.list(
      req.user.uid,
      includeArchived === 'true',
    );
    return accounts.map(a => AccountResponseDto.from(a.toPrimitives()));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get account details' })
  async findOne(
    @Request() req: AuthRequest,
    @Param('id') id: string,
  ): Promise<AccountResponseDto> {
    const account = await this.accountsService.findById(req.user.uid, id);
    return AccountResponseDto.from(account.toPrimitives());
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an account' })
  async update(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
  ): Promise<AccountResponseDto> {
    const account = await this.accountsService.update(req.user.uid, id, dto);
    return AccountResponseDto.from(account.toPrimitives());
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Archive an account (soft delete)' })
  async archive(
    @Request() req: AuthRequest,
    @Param('id') id: string,
  ): Promise<AccountResponseDto> {
    const account = await this.accountsService.archive(req.user.uid, id);
    return AccountResponseDto.from(account.toPrimitives());
  }

}
