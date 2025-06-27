import { Injectable } from "@nestjs/common";

@Injectable()
export class UserHydraterService {
    async hydrateUserByEmail(email?: string | null) {
        return { email };
    }
}
