import { IsNotEmpty, IsString } from 'class-validator';

export class CheckInTicketQrDto {
    @IsNotEmpty()
    @IsString()
    eventId: string;

    @IsNotEmpty()
    @IsString()
    ticketRef: string;
}
