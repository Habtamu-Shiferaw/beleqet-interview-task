import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WalletService } from './wallet.service';
import { PrismaService } from '../../prisma/prisma.service';

// Minimal mock so jest doesn't try to connect to a real database.
// $transaction runs the callback against this same mock, matching how
// Prisma's interactive transactions behave.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrismaService: any = {
  freelancerWallet: {
    findUnique: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
  },
  walletTransaction: {
    create: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(async (arg: unknown) => {
    if (typeof arg === 'function') {
      return arg(mockPrismaService);
    }
    return Promise.all(arg as Promise<unknown>[]);
  }),
};

const mockConfigService = {
  get: jest.fn(() => undefined), // no CHAPA_SECRET_KEY configured -> skip payout call
};

describe('WalletService', () => {
  let service: WalletService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('withdraw', () => {
    const userId = 'user-1';
    const wallet = { id: 'wallet-1', userId, availableBalance: 500 };

    it('throws NotFoundException when the wallet does not exist', async () => {
      mockPrismaService.freelancerWallet.findUnique.mockResolvedValue(null);

      await expect(service.withdraw(userId, { amount: 100, method: 'CHAPA', accountRef: 'acc' }))
        .rejects.toThrow(NotFoundException);
    });

    it('rejects the withdrawal when the atomic balance guard finds insufficient funds', async () => {
      mockPrismaService.freelancerWallet.findUnique.mockResolvedValue(wallet);
      // Simulates a concurrent withdrawal having already spent the balance:
      // the conditional updateMany matches zero rows even though the initial
      // findUnique showed a sufficient balance.
      mockPrismaService.freelancerWallet.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.withdraw(userId, { amount: 100, method: 'CHAPA', accountRef: 'acc' }))
        .rejects.toThrow(BadRequestException);

      expect(mockPrismaService.walletTransaction.create).not.toHaveBeenCalled();
    });

    it('guards the deduction with a WHERE availableBalance >= amount condition, not a prior read', async () => {
      mockPrismaService.freelancerWallet.findUnique.mockResolvedValue(wallet);
      mockPrismaService.freelancerWallet.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.walletTransaction.create.mockResolvedValue({ id: 'tx-1' });

      await service.withdraw(userId, { amount: 100, method: 'CHAPA', accountRef: 'acc' });

      expect(mockPrismaService.freelancerWallet.updateMany).toHaveBeenCalledWith({
        where: { userId, availableBalance: { gte: 100 } },
        data: { availableBalance: { decrement: 100 } },
      });
    });

    it('succeeds and creates a pending debit transaction when funds are sufficient', async () => {
      mockPrismaService.freelancerWallet.findUnique.mockResolvedValue(wallet);
      mockPrismaService.freelancerWallet.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.walletTransaction.create.mockResolvedValue({ id: 'tx-1' });

      const result = await service.withdraw(userId, { amount: 100, method: 'TELEBIRR', accountRef: 'acc' });

      expect(result).toEqual({
        success: true,
        amount: 100,
        method: 'TELEBIRR',
        note: 'Payout processing — typically 1-2 business days',
      });
      expect(mockPrismaService.walletTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ walletId: wallet.id, type: 'DEBIT_WITHDRAWAL', amount: 100 }),
      });
    });
  });
});
