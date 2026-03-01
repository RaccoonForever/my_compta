import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecurringTemplatePrimitives } from '@my-compta/domain';

export class RecurringTemplateResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() label!: string;
  @ApiProperty() amount!: number;
  @ApiProperty() currency!: string;
  @ApiProperty() type!: string;
  @ApiProperty() accountId!: string;
  @ApiPropertyOptional() categoryId?: string;
  @ApiProperty() schedule!: RecurringTemplatePrimitives['schedule'];
  @ApiProperty() nextRunDate!: string;
  @ApiProperty() status!: string;
  @ApiProperty() tz!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;

  static from(p: RecurringTemplatePrimitives): RecurringTemplateResponseDto {
    const dto = new RecurringTemplateResponseDto();
    dto.id = p.id;
    dto.label = p.label;
    dto.amount = p.amount.value;
    dto.currency = p.amount.currency;
    dto.type = p.type;
    dto.accountId = p.accountId;
    dto.categoryId = p.categoryId;
    dto.schedule = p.schedule;
    dto.nextRunDate = p.nextRunDate.toISOString();
    dto.status = p.status;
    dto.tz = p.tz;
    dto.createdAt = p.createdAt.toISOString();
    dto.updatedAt = p.updatedAt.toISOString();
    return dto;
  }
}
