import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionPrimitives } from '@my-compta/domain';

export class TransactionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() accountId!: string;
  @ApiPropertyOptional() categoryId?: string;
  @ApiPropertyOptional() subcategory?: string;
  @ApiProperty() type!: string;
  @ApiProperty() isForecasted!: boolean;
  @ApiProperty() amount!: number;
  @ApiProperty() currency!: string;
  @ApiProperty() date!: string;
  @ApiProperty() label!: string;
  @ApiPropertyOptional() note?: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;

  static from(p: TransactionPrimitives): TransactionResponseDto {
    const dto = new TransactionResponseDto();
    dto.id = p.id;
    dto.accountId = p.accountId;
    dto.categoryId = p.categoryId;
    dto.subcategory = p.subcategory;
    dto.type = p.type;
    dto.isForecasted = p.isForecasted;
    dto.amount = p.amount.value;
    dto.currency = p.amount.currency;
    dto.date = p.date.toISOString();
    dto.label = p.label;
    dto.note = p.note;
    dto.createdAt = p.createdAt.toISOString();
    dto.updatedAt = p.updatedAt.toISOString();
    return dto;
  }
}

export class AutocompleteResponseDto {
  @ApiProperty() label!: string;
  @ApiPropertyOptional() amount?: number;
  @ApiPropertyOptional() currency?: string;
  @ApiPropertyOptional() categoryId?: string;
  @ApiPropertyOptional() type?: string;
}
