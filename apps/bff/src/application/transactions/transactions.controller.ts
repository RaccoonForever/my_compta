import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../infrastructure/http/guards/AuthGuard.js';
import { TransactionsService } from './transactions.service.js';
import { CreateTransactionDto } from './dto/CreateTransactionDto.js';
import { UpdateTransactionDto } from './dto/UpdateTransactionDto.js';
import {
  AutocompleteResponseDto,
  TransactionResponseDto,
} from './dto/TransactionResponseDto.js';

interface AuthRequest { user: { uid: string } }

@ApiTags('transactions')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ path: 'transactions', version: '1' })
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @ApiOperation({ summary: 'Add a transaction (income or expense)' })
  async create(
    @Request() req: AuthRequest,
    @Body() dto: CreateTransactionDto,
  ): Promise<TransactionResponseDto> {
    const tx = await this.transactionsService.create(req.user.uid, dto);
    return TransactionResponseDto.from(tx.toPrimitives());
  }

  @Get()
  @ApiOperation({ summary: 'List transactions with filters' })
  @ApiQuery({ name: 'accountId', required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'type', required: false, enum: ['income', 'expense', 'transfer'] })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO date' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'afterId', required: false })
  async list(
    @Request() req: AuthRequest,
    @Query('accountId') accountId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('afterId') afterId?: string,
  ): Promise<TransactionResponseDto[]> {
    const txs = await this.transactionsService.list(req.user.uid, {
      accountId,
      categoryId,
      type: type as 'income' | 'expense' | 'transfer' | undefined,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit: limit ? Number(limit) : undefined,
      afterId,
    });
    return txs.map(tx => TransactionResponseDto.from(tx.toPrimitives()));
  }

  @Get('autocomplete')
  @ApiOperation({ summary: 'Autocomplete suggestions based on label history' })
  @ApiQuery({ name: 'q', required: true })
  async autocomplete(
    @Request() req: AuthRequest,
    @Query('q') q: string,
  ): Promise<AutocompleteResponseDto[]> {
    return this.transactionsService.autocomplete(req.user.uid, q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a transaction by ID' })
  async findOne(
    @Request() req: AuthRequest,
    @Param('id') id: string,
  ): Promise<TransactionResponseDto> {
    const tx = await this.transactionsService.findById(req.user.uid, id);
    return TransactionResponseDto.from(tx.toPrimitives());
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a transaction' })
  async update(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
  ): Promise<TransactionResponseDto> {
    const tx = await this.transactionsService.update(req.user.uid, id, dto);
    return TransactionResponseDto.from(tx.toPrimitives());
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a transaction' })
  async delete(
    @Request() req: AuthRequest,
    @Param('id') id: string,
  ): Promise<void> {
    await this.transactionsService.delete(req.user.uid, id);
  }
}
