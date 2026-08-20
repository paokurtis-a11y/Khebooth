import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser, JwtPayload } from './auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is required');
    super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), ignoreExpiration: false, secretOrKey: secret });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const rows=await this.prisma.$queryRaw<Array<{id:string;organizationId:string;email:string;role:any;authVersion:number;isActive:boolean;passwordResetRequired:boolean}>>`
      SELECT id,"organizationId",email,role,"authVersion","isActive","passwordResetRequired"
      FROM "User" WHERE id=${payload.sub}::uuid AND "organizationId"=${payload.organizationId}::uuid LIMIT 1
    `;
    const user=rows[0];
    if(!user||!user.isActive||user.passwordResetRequired||user.authVersion!==payload.authVersion)throw new UnauthorizedException();
    return {id:user.id,organizationId:user.organizationId,email:user.email,role:user.role};
  }
}