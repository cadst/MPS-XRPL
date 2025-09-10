import { ApiProperty } from '@nestjs/swagger';

export class CategoryDto {
  @ApiProperty({ example: 1 })
  category_id!: number;

  @ApiProperty({ example: 'Pop' })
  category_name!: string;
}
