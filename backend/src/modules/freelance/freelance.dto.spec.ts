import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateBidDto, CreateFreelanceJobDto } from './freelance.service';

describe('CreateBidDto validation', () => {
  it('rejects a negative bid amount', async () => {
    const dto = plainToInstance(CreateBidDto, { amount: -50, timelineDays: 5, coverLetter: 'hi' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'amount')).toBe(true);
  });

  it('rejects a non-integer timelineDays', async () => {
    const dto = plainToInstance(CreateBidDto, { amount: 500, timelineDays: 2.5, coverLetter: 'hi' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'timelineDays')).toBe(true);
  });

  it('accepts a well-formed bid', async () => {
    const dto = plainToInstance(CreateBidDto, { amount: 500, timelineDays: 14, coverLetter: 'I can do this.' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

describe('CreateFreelanceJobDto validation', () => {
  const base = {
    title: 'Build a website',
    description: 'Need a marketing site',
    categoryId: '123e4567-e89b-12d3-a456-426614174000',
    budgetMin: 1000,
    budgetMax: 5000,
    deadlineDays: 30,
    skills: ['react'],
  };

  it('rejects a non-UUID categoryId', async () => {
    const dto = plainToInstance(CreateFreelanceJobDto, { ...base, categoryId: 'not-a-uuid' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'categoryId')).toBe(true);
  });

  it('rejects a negative budgetMin', async () => {
    const dto = plainToInstance(CreateFreelanceJobDto, { ...base, budgetMin: -100 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'budgetMin')).toBe(true);
  });

  it('rejects deadlineDays outside the allowed range', async () => {
    const dto = plainToInstance(CreateFreelanceJobDto, { ...base, deadlineDays: 9999 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'deadlineDays')).toBe(true);
  });

  it('accepts a well-formed job', async () => {
    const dto = plainToInstance(CreateFreelanceJobDto, base);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
