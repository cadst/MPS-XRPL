import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { MusicsModule } from "./musics/musics.module";
import { CompanyModule } from "./company/company.module";
import { SystemModule } from "./system/system.module";
import { TokensModule } from "./tokens/tokens.module";

@Module({
    imports: [AuthModule,
        MusicsModule,
        CompanyModule,
        SystemModule,
        TokensModule,]
})
export class AdminModule { }
