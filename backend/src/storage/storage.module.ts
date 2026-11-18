import { Global, Module } from '@nestjs/common';
import { PgStore } from './pg-store';

@Global()
@Module({
  providers: [PgStore],
  exports: [PgStore],
})
export class StorageModule {}
