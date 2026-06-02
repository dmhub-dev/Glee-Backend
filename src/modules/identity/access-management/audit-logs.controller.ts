import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Permissions } from '@src/auth/rbac/permissions.decorator';
import { Permission } from '@src/auth/rbac/permissions.enum';
import { ApiResponses } from '@src/common/responses/response';
import { ListAuditLogsQueryDto } from './dto/access-management.dto';
import { AccessManagementService } from './access-management.service';

@Controller('audit-logs')
@ApiTags('Audit Logs')
export class AuditLogsController {
  constructor(private readonly accessManagementService: AccessManagementService) {}

  @Get()
  @ApiResponses(true, [UserRole.SUPER_ADMIN])
  @Permissions(Permission.AUDIT_LOGS_READ)
  listAuditLogs(@Query() query: ListAuditLogsQueryDto) {
    return this.accessManagementService.listAuditLogs(query);
  }
}
