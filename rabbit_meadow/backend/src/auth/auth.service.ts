import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GuestDto } from './dto/guest.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

type AuthResponse = {
  accessToken: string;
  user: {
    id: string;
    name: string;
    phone: string;
    role: UserRole;
  };
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(payload: RegisterDto): Promise<AuthResponse> {
    return this.withDbRetry(async () => {
      const name = payload.name.trim();
      const phone = payload.phone.trim();

      const user = await this.prisma.user.upsert({
        where: { phone },
        update: {
          name,
          isActive: true,
        },
        create: {
          name,
          phone,
          role: UserRole.CUSTOMER,
          isActive: true,
        },
      });

      await this.ensureActiveCart(user.id);

      return this.issueAuthResponse(user.id);
    });
  }

  async login(payload: LoginDto): Promise<AuthResponse> {
    return this.withDbRetry(async () => {
      const phone = payload.phone.trim();
      const user = await this.prisma.user.findUnique({ where: { phone } });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('رقم الهاتف غير مسجل.');
      }

      if (payload.name?.trim() && payload.name.trim() !== user.name) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            name: payload.name.trim(),
          },
        });
      }

      await this.ensureActiveCart(user.id);

      return this.issueAuthResponse(user.id);
    });
  }

  async guestLogin(payload: GuestDto): Promise<AuthResponse> {
    return this.withDbRetry(async () => {
      const timestamp = Date.now();
      const user = await this.prisma.user.create({
        data: {
          name:
            payload.name?.trim() ||
            `ضيف الأرنب ${timestamp.toString().slice(-4)}`,
          phone: `guest-${timestamp}`,
          role: UserRole.CUSTOMER,
        },
      });

      await this.ensureActiveCart(user.id);

      return this.issueAuthResponse(user.id);
    });
  }

  async session(userId: string): Promise<AuthResponse['user']> {
    return this.withDbRetry(async () => {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.isActive) {
        throw new NotFoundException('المستخدم غير موجود.');
      }

      return {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
      };
    });
  }

  async updateProfile(
    userId: string,
    payload: UpdateProfileDto,
  ): Promise<AuthResponse['user']> {
    return this.withDbRetry(async () => {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.isActive) {
        throw new NotFoundException('المستخدم غير موجود.');
      }

      const nextName = payload.name?.trim();
      const nextPhone = payload.phone?.trim();
      const updateData: { name?: string; phone?: string } = {};

      if (nextName && nextName !== user.name) {
        updateData.name = nextName;
      }

      if (nextPhone && nextPhone !== user.phone) {
        const existingUser = await this.prisma.user.findUnique({
          where: { phone: nextPhone },
          select: { id: true },
        });

        if (existingUser && existingUser.id !== user.id) {
          throw new ConflictException('رقم الهاتف مستخدم بالفعل.');
        }

        updateData.phone = nextPhone;
      }

      if (!Object.keys(updateData).length) {
        throw new BadRequestException('لا يوجد تعديل جديد لحفظه.');
      }

      const updatedUser = await this.prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      return {
        id: updatedUser.id,
        name: updatedUser.name,
        phone: updatedUser.phone,
        role: updatedUser.role,
      };
    });
  }
  private async ensureActiveCart(userId: string) {
    await this.prisma.cart.upsert({
      where: {
        userId_status: {
          userId,
          status: 'ACTIVE',
        },
      },
      update: {},
      create: {
        userId,
        status: 'ACTIVE',
      },
    });
  }

  private async issueAuthResponse(userId: string): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('المستخدم غير موجود.');
    }

    const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN') || '7d';
    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        phone: user.phone,
        role: user.role,
      },
      {
        secret: this.configService.get<string>('JWT_SECRET') || 'dev-secret',
        expiresIn: expiresIn as any,
      },
    );

    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
    };
  }

  private isDbConnectionError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const maybeCode = (error as { code?: string }).code;
    return maybeCode === 'P1001';
  }

  private async withDbRetry<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (!this.isDbConnectionError(error)) {
        throw error;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 900));

    try {
      return await operation();
    } catch (error) {
      if (this.isDbConnectionError(error)) {
        throw new ServiceUnavailableException(
          'تعذر الاتصال بقاعدة البيانات. حاول مرة ثانية بعد ثوانٍ.',
        );
      }

      throw error;
    }
  }
}
