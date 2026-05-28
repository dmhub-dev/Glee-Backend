import { IsIn, IsOptional, IsString } from 'class-validator';

export class ReviewVendorEventDto {
    @IsIn(['approve', 'reject'])
    decision: 'approve' | 'reject';

    @IsOptional()
    @IsString()
    reason?: string;
}
