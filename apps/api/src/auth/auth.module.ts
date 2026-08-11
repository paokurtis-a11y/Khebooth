import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

const jwtSecret = process.env.JWT_SECRET?.trim();
if (!jwtSecret) {
  throw new Error('JWT_SECRET is required');
}

const rawJwtExpiresInSeconds = process.env.JWT_EXPIRES_IN_SECONDS?.trim();
const parsedJwtExpiresInSeconds = rawJwtExpiresInSeconds
  ? Number.parseInt(rawJwtExpiresInSeconds, 10)
  : Number.NaN;
const jwtExpiresInSeconds =
  Number.isInteger(parsedJwtExpiresInSeconds) && parsedJwtExpiresInSeconds > 0
    ? parsedJwtExpiresInSeconds
    : 43200;

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: jwtSecret,
      signOptions: { expiresIn: jwtExpiresInSeconds },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [JwtModule],
})
export class AuthModule {}
