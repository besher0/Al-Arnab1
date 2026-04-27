import { UserRole } from '@prisma/client';
import { Request } from 'express';

export type JwtUserPayload = {
  sub: string;
  phone: string;
  role: UserRole;
};

export type RequestWithUser = Request & {
  user: JwtUserPayload;
};
