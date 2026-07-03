import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bull';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES } from '../queues/queues.constants';

const mockPrismaService = {
  user: { findUnique: jest.fn(), create: jest.fn() },
  refreshToken: { create: jest.fn(), findMany: jest.fn(), deleteMany: jest.fn() },
};

const mockJwtService = { sign: jest.fn(() => 'signed-jwt') };
const mockConfigService = { get: jest.fn((key: string, fallback?: unknown) => fallback) };
const mockNotificationsQueue = { add: jest.fn() };

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrismaService.refreshToken.findMany.mockResolvedValue([]);
    mockPrismaService.refreshToken.create.mockResolvedValue({ id: 'rt-1' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getQueueToken(QUEUE_NAMES.NOTIFICATIONS), useValue: mockNotificationsQueue },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('throws ConflictException when the email is already registered', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.register({ email: 'a@b.com', password: 'pw', firstName: 'A', lastName: 'B' } as never),
      ).rejects.toThrow(ConflictException);

      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
    });

    it('hashes the password before storing the user and issues tokens', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        id: 'user-1', email: 'a@b.com', firstName: 'A', lastName: 'B', role: 'JOB_SEEKER',
      });

      const result = await service.register({
        email: 'A@B.com', password: 'plaintext-pw', firstName: 'A', lastName: 'B',
      } as never);

      const createArgs = mockPrismaService.user.create.mock.calls[0][0];
      expect(createArgs.data.passwordHash).not.toBe('plaintext-pw');
      expect(await bcrypt.compare('plaintext-pw', createArgs.data.passwordHash)).toBe(true);
      expect(createArgs.data.email).toBe('a@b.com'); // normalized to lowercase

      expect(result.accessToken).toBe('signed-jwt');
      expect(result.user.email).toBe('a@b.com');
    });
  });

  describe('validateUser', () => {
    it('throws UnauthorizedException when no user matches the email', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      await expect(service.validateUser('nobody@x.com', 'pw')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when the account is deactivated', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ isActive: false, passwordHash: 'x' });
      await expect(service.validateUser('a@b.com', 'pw')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when the password does not match', async () => {
      const passwordHash = await bcrypt.hash('correct-pw', 12);
      mockPrismaService.user.findUnique.mockResolvedValue({ isActive: true, passwordHash });

      await expect(service.validateUser('a@b.com', 'wrong-pw')).rejects.toThrow(UnauthorizedException);
    });

    it('returns the user when credentials are valid', async () => {
      const passwordHash = await bcrypt.hash('correct-pw', 12);
      const user = { id: 'user-1', email: 'a@b.com', isActive: true, passwordHash };
      mockPrismaService.user.findUnique.mockResolvedValue(user);

      await expect(service.validateUser('a@b.com', 'correct-pw')).resolves.toEqual(user);
    });
  });
});
