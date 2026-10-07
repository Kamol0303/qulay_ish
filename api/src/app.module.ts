import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ResourcesModule } from './resources/resources.module';
import { UploadsModule } from './uploads/uploads.module';
import { VerificationModule } from './verification/verification.module';
import { EmployerModule } from './employer/employer.module';
import { AdminModule } from './admin/admin.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // api/.env — cwd dan qat'iy nazar (root yoki api dan ishga tushirilganda ham)
      envFilePath: [
        join(__dirname, '..', '.env'),
        join(process.cwd(), 'api', '.env'),
        join(process.cwd(), '.env'),
      ],
    }),
    PrismaModule,
    AuthModule,
    ResourcesModule,
    UploadsModule,
    VerificationModule,
    EmployerModule,
    AdminModule,
    SubscriptionModule,
    AiModule,
  ],
})
export class AppModule {}
