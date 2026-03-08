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
import { TransactionImportService } from './transaction-import.service.js';
import { CreateTransactionDto } from './dto/CreateTransactionDto.js';
import { UpdateTransactionDto } from './dto/UpdateTransactionDto.js';
import {
  AutocompleteResponseDto,
  TransactionResponseDto,
} from './dto/TransactionResponseDto.js';
import { ImportSummary, ConfirmImportRequest, ConfirmImportResponse } from './dto/ImportTransactionDto.js';

interface AuthRequest { user: { uid: string } }

const parseStartOfDay = (value?: string): Date | undefined => {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

const parseEndOfDay = (value?: string): Date | undefined => {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  parsed.setHours(23, 59, 59, 999);
  return parsed;
};

@ApiTags('transactions')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ path: 'transactions', version: '1' })
export class TransactionsController {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly importService: TransactionImportService,
  ) {}

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
  @ApiQuery({ name: 'type', required: false, enum: ['income', 'expense'] })
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
      type: type as 'income' | 'expense' | undefined,
      from: parseStartOfDay(from),
      to: parseEndOfDay(to),
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

  @Post('import/validate')
  @ApiOperation({
    summary: 'Validate and preview CSV import without committing to database',
  })
  async validateImport(
    @Body() dto: { csvContent: string },
  ): Promise<ImportSummary> {
    // The import service does not access the database during validation
    // It only parses and validates the CSV structure and content
    const summary = await this.importService.parseAndValidateCsv(dto.csvContent);
    return summary;
  }

  @Post('import/confirm')
  @ApiOperation({
    summary: 'Confirm and save validated CSV import to database',
  })
  async confirmImport(
    @Request() req: AuthRequest,
    @Body() dto: ConfirmImportRequest,
  ): Promise<ConfirmImportResponse> {
    return this.importService.confirmImport(req.user.uid, dto);
  }
}
