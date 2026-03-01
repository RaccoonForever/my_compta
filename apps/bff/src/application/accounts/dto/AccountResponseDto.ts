import { ApiProperty } from '@nestjs/swagger';
import { AccountPrimitives } from '@my-compta/domain';

export class AccountResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() type!: string;
  @ApiProperty() currency!: string;
  @ApiProperty() balance!: number;
  @ApiProperty() isArchived!: boolean;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;

  static from(p: AccountPrimitives): AccountResponseDto {
    const dto = new AccountResponseDto();
    dto.id = p.id;
    dto.name = p.name;
    dto.type = p.type;
    dto.currency = p.currency;
    dto.balance = p.balance;
    dto.isArchived = p.isArchived;
    dto.createdAt = p.createdAt.toISOString();
    dto.updatedAt = p.updatedAt.toISOString();
    return dto;
  }
}
