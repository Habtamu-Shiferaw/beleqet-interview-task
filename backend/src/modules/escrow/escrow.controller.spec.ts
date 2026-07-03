import * as crypto from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EscrowController } from './escrow.controller';
import { EscrowService } from './escrow.service';

const WEBHOOK_SECRET = 'test-webhook-secret';

const mockEscrowService = { handleWebhook: jest.fn() };

function configFor(nodeEnv: string) {
  return {
    get: jest.fn((key: string) => {
      if (key === 'CHAPA_WEBHOOK_SECRET') return WEBHOOK_SECRET;
      if (key === 'NODE_ENV') return nodeEnv;
      return undefined;
    }),
  };
}

function signedRequest(payload: Record<string, unknown>) {
  const rawBody = Buffer.from(JSON.stringify(payload), 'utf8');
  const signature = crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
  return { req: { rawBody } as never, signature, payload };
}

describe('EscrowController webhook signature verification', () => {
  let controller: EscrowController;
  let mockConfig: ReturnType<typeof configFor>;

  async function build(nodeEnv: string) {
    mockConfig = configFor(nodeEnv);
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EscrowController],
      providers: [
        { provide: EscrowService, useValue: mockEscrowService },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    controller = module.get<EscrowController>(EscrowController);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('accepts a correctly signed payload and forwards it to the service', async () => {
    await build('production');
    const { req, signature, payload } = signedRequest({ reference: 'tx-1', status: 'success' });

    await controller.webhook(payload, req, signature, undefined);

    expect(mockEscrowService.handleWebhook).toHaveBeenCalledWith(payload);
  });

  it('rejects a payload with a tampered signature', async () => {
    await build('production');
    const { req, payload } = signedRequest({ reference: 'tx-1', status: 'success' });
    const badSignature = '0'.repeat(64); // same length as a real sha256 hex digest, wrong value

    expect(() => controller.webhook(payload, req, badSignature, undefined)).toThrow(UnauthorizedException);
    expect(mockEscrowService.handleWebhook).not.toHaveBeenCalled();
  });

  it('rejects a signature of the wrong length without throwing an unhandled error', async () => {
    await build('production');
    const { req, payload } = signedRequest({ reference: 'tx-1', status: 'success' });

    // crypto.timingSafeEqual throws RangeError on mismatched buffer lengths if not
    // guarded — this is a regression test for that guard.
    expect(() => controller.webhook(payload, req, 'too-short', undefined)).toThrow(UnauthorizedException);
  });

  it('rejects a production request with no signature at all', async () => {
    await build('production');
    const { req, payload } = signedRequest({ reference: 'tx-1', status: 'success' });

    expect(() => controller.webhook(payload, req, undefined, undefined)).toThrow(UnauthorizedException);
  });
});
