import { Injectable } from '@nestjs/common';
import { PrismaService } from '@src/infrastructure/database/prisma.service';

export interface IPaginationOptions {
    page?: number;
    limit?: number;
}

export interface IFetchEventTicketOptions {
    skipPopulates?: string[];
    populateAll?: boolean;
    populate?: any[];
}

@Injectable()
export class EventSharedService {
    constructor(private readonly prisma: PrismaService) {}

    async getEventTicketsData(
        _filter: any,
        _pagination?: IPaginationOptions,
        _options?: IFetchEventTicketOptions,
    ) {
        return [];
    }

    async helperEventTicketUpdateMany(_filter: any, _update: any) {
        return { count: 0 };
    }

    async helperGetEventParticipants(
        _filter: { eventId: string; userId: string },
        _me: any,
    ) {
        return { data: [], count: 0 };
    }

    async helperEventFindById(id: string) {
        return this.prisma.event.findFirst({
            where: { id, isDeleted: false },
            include: { location: true },
        });
    }

    async helperSingleEventFilter(filter: any) {
        const where: any = {};
        if (filter._id || filter.id) where.id = filter._id ?? filter.id;
        if (filter.isDeleted !== undefined) where.isDeleted = filter.isDeleted;
        if (filter.status) where.status = filter.status;
        return this.prisma.event.findFirst({ where });
    }

    async getUserPurchasedEventList(_userId: string | null, _eventId?: string) {
        return [];
    }

    async calculateEventEarning(_eventId: string) {
        return [];
    }
}
