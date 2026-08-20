import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

class SupportFeedbackDto {
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsOptional() @IsString() @MaxLength(1500) comment?: string;
}

@UseGuards(AuthGuard('jwt'))
@Controller('operations/support-feedback')
export class SupportFeedbackController {
  constructor(private readonly prisma:PrismaService){}

  @Get(':conversationId')
  async get(@CurrentUser() user:AuthenticatedUser,@Param('conversationId',new ParseUUIDPipe()) conversationId:string){
    const conversation=await this.prisma.$queryRaw<Array<{requesterUserId:string;assignedToUserId:string|null;status:string}>>`
      SELECT "requesterUserId","assignedToUserId",status::text status FROM "SupportConversation"
      WHERE id=${conversationId}::uuid AND "organizationId"=${user.organizationId}::uuid LIMIT 1
    `;
    const item=conversation[0];if(!item)throw new BadRequestException('Conversation introuvable');
    const isStaff=['OWNER','ADMIN','OPERATOR'].includes(String(user.role));if(item.requesterUserId!==user.id&&!isStaff)throw new BadRequestException('Avis indisponible');
    const rows=await this.prisma.$queryRaw<any[]>`SELECT id,rating,comment,"agentUserId","requesterUserId","createdAt" FROM "SupportFeedback" WHERE "conversationId"=${conversationId}::uuid LIMIT 1`;
    return{resolved:item.status==='RESOLVED',feedback:rows[0]??null};
  }

  @Post(':conversationId')
  async submit(@CurrentUser() user:AuthenticatedUser,@Param('conversationId',new ParseUUIDPipe()) conversationId:string,@Body() dto:SupportFeedbackDto){
    const conversation=await this.prisma.$queryRaw<Array<{requesterUserId:string;assignedToUserId:string|null;resolvedByUserId:string|null;status:string}>>`
      SELECT "requesterUserId","assignedToUserId","resolvedByUserId",status::text status FROM "SupportConversation"
      WHERE id=${conversationId}::uuid AND "organizationId"=${user.organizationId}::uuid LIMIT 1
    `;
    const item=conversation[0];if(!item||item.requesterUserId!==user.id)throw new BadRequestException('Cette demande ne peut pas être notée par ce compte');
    if(item.status!=='RESOLVED')throw new BadRequestException('La conversation doit être résolue avant de pouvoir noter l’assistance');
    const agentId=item.assignedToUserId??item.resolvedByUserId;if(!agentId)throw new BadRequestException('Aucun agent n’est associé à cette résolution');
    const comment=String(dto.comment??'').trim().slice(0,1500)||null;
    const rows=await this.prisma.$queryRaw<any[]>`
      INSERT INTO "SupportFeedback" (id,"organizationId","conversationId","agentUserId","requesterUserId",rating,comment,"createdAt")
      VALUES (gen_random_uuid(),${user.organizationId}::uuid,${conversationId}::uuid,${agentId}::uuid,${user.id}::uuid,${dto.rating},${comment},CURRENT_TIMESTAMP)
      ON CONFLICT ("conversationId") DO UPDATE SET rating=EXCLUDED.rating,comment=EXCLUDED.comment,"agentUserId"=EXCLUDED."agentUserId"
      RETURNING id,rating,comment,"agentUserId","createdAt"
    `;
    await this.prisma.$executeRaw`
      INSERT INTO "SupportMessage" (id,"conversationId",author,body,"createdAt")
      VALUES (gen_random_uuid(),${conversationId}::uuid,'KHE','Merci pour votre avis. Votre note a bien été enregistrée et contribuera au suivi qualité de l’équipe KHE.',CURRENT_TIMESTAMP)
    `;
    return{saved:true,feedback:rows[0]};
  }
}
