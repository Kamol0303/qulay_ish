import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ResourcesModule } from './resources/resources.module';

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
  ],
})
export class AppModule {}
