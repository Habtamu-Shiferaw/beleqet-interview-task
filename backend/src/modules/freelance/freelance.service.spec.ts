import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FreelanceService } from './freelance.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrismaService = {
  contract: { findFirst: jest.fn() },
};

describe('FreelanceService', () => {
  let service: FreelanceService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FreelanceService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<FreelanceService>(FreelanceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getContract', () => {
    const contractId = 'contract-1';

    it('scopes the lookup to the requesting user as client or freelancer', async () => {
      mockPrismaService.contract.findFirst.mockResolvedValue({ id: contractId });

      await service.getContract(contractId, 'user-1');

      expect(mockPrismaService.contract.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: contractId, OR: [{ clientId: 'user-1' }, { freelancerId: 'user-1' }] },
        }),
      );
    });

    it('throws NotFoundException for a user who is neither the client nor the freelancer', async () => {
      // Prisma's findFirst returns null because the WHERE clause excludes contracts
      // that don't belong to this user — this is what closes the IDOR: an outsider
      // guessing a valid contract ID gets a 404, not the contract's private data.
      mockPrismaService.contract.findFirst.mockResolvedValue(null);

      await expect(service.getContract(contractId, 'outsider')).rejects.toThrow(NotFoundException);
    });

    it('returns the contract when the requester is a participant', async () => {
      const contract = { id: contractId, clientId: 'user-1', freelancerId: 'user-2' };
      mockPrismaService.contract.findFirst.mockResolvedValue(contract);

      await expect(service.getContract(contractId, 'user-2')).resolves.toEqual(contract);
    });
  });
});
