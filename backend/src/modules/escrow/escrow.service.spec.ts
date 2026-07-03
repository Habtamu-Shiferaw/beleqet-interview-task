import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bull';
import { EscrowService } from './escrow.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES } from '../queues/queues.constants';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrismaService: any = {
  freelanceJob: { findFirst: jest.fn() },
  escrowTransaction: { create: jest.fn() },
  milestone: { findFirst: jest.fn(), update: jest.fn() },
  $transaction: jest.fn(async (arg: unknown) => {
    if (typeof arg === 'function') return arg(mockPrismaService);
    return Promise.all(arg as Promise<unknown>[]);
  }),
  eventLog: { create: jest.fn() },
};

// No CHAPA_SECRET_KEY -> initiate() skips the external Chapa call entirely.
const mockConfigService = { get: jest.fn(() => undefined) };
const mockEscrowQueue = { add: jest.fn() };

describe('EscrowService', () => {
  let service: EscrowService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getQueueToken(QUEUE_NAMES.ESCROW), useValue: mockEscrowQueue },
      ],
    }).compile();

    service = module.get<EscrowService>(EscrowService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initiate', () => {
    it('throws NotFoundException when the job does not belong to this client', async () => {
      mockPrismaService.freelanceJob.findFirst.mockResolvedValue(null);
      await expect(service.initiate('client-1', 'job-1')).rejects.toThrow(NotFoundException);
    });

    it('computes fees from the agreed contract amount when a contract exists', async () => {
      mockPrismaService.freelanceJob.findFirst.mockResolvedValue({
        id: 'job-1',
        title: 'Website',
        budgetMax: 9999, // should be ignored in favor of the contract amount
        contract: { agreedAmount: 1000 },
        client: { email: 'c@x.com', firstName: 'C', lastName: 'X' },
      });
      mockPrismaService.escrowTransaction.create.mockResolvedValue({ id: 'escrow-1' });

      const result = await service.initiate('client-1', 'job-1');

      expect(result.grossAmount).toBe(1000);
      expect(result.platformFee).toBe(100); // 10% platform fee
      expect(result.netAmount).toBe(900);
    });

    it('falls back to budgetMax when no contract exists yet', async () => {
      mockPrismaService.freelanceJob.findFirst.mockResolvedValue({
        id: 'job-1',
        title: 'Website',
        budgetMax: 2000,
        contract: null,
        client: { email: 'c@x.com', firstName: 'C', lastName: 'X' },
      });
      mockPrismaService.escrowTransaction.create.mockResolvedValue({ id: 'escrow-1' });

      const result = await service.initiate('client-1', 'job-1');

      expect(result.grossAmount).toBe(2000);
      expect(result.platformFee).toBe(200);
      expect(result.netAmount).toBe(1800);
    });
  });

  describe('releaseMilestone', () => {
    it('throws NotFoundException when the milestone does not belong to this client', async () => {
      mockPrismaService.milestone.findFirst.mockResolvedValue(null);
      await expect(service.releaseMilestone('milestone-1', 'client-1')).rejects.toThrow(NotFoundException);
    });

    it('approves the milestone and enqueues the auto-release job', async () => {
      mockPrismaService.milestone.findFirst.mockResolvedValue({
        id: 'milestone-1',
        amount: 500,
        contract: { freelancerId: 'freelancer-1', freelanceJob: { escrowTx: {} } },
      });

      const result = await service.releaseMilestone('milestone-1', 'client-1');

      expect(result).toEqual({ success: true });
      expect(mockEscrowQueue.add).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ milestoneId: 'milestone-1', freelancerId: 'freelancer-1', amount: 500 }),
      );
    });
  });
});
